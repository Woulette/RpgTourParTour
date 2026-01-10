function createPlayerHandlers(ctx) {
  const {
    state,
    clients,
    broadcast,
    send,
    createPlayer,
    accountStore,
    characterStore,
    buildBaseStatsForClass,
    computeFinalStats,
    config,
    getNextPlayerId,
    getNextEventId,
    getHostId,
    setHostId,
    tryStartCombatIfNeeded,
    snapshotForClient,
    ensureMapInitialized,
    persistPlayerState,
    getCombatJoinPayload,
    ensureCombatSnapshot,
    issueSessionToken,
    getAccountIdFromSession,
    getItemDefs,
    getItemDefsPromise,
    getItemDefsFailed,
    getQuestDefs,
    getQuestDefsPromise,
    getQuestDefsFailed,
    getQuestStates,
    getLevelApi,
    getLevelApiFailed,
    getMonsterDef,
    getCraftRecipe,
    getCraftDefsPromise,
    getCraftDefsFailed,
  } = ctx;

  const { PROTOCOL_VERSION, GAME_DATA_VERSION, MAX_PLAYERS } = config;
  const MAX_INV_SIZE = 200;
  const MAX_GOLD_DELTA = 100000;
  const MAX_QTY_PER_OP = 9999;

  const sendCombatResync = (ws, player) => {
    if (!player || !player.inCombat) return;
    if (typeof getCombatJoinPayload !== "function") return;
    const payload = getCombatJoinPayload(player.id);
    if (!payload) return;
    send(ws, {
      t: "EvCombatJoinReady",
      eventId: getNextEventId(),
      ...payload,
    });
    send(ws, {
      t: "EvCombatUpdated",
      eventId: getNextEventId(),
      ...payload.combat,
    });
    const combatId = payload.combat?.combatId;
    if (!combatId) return;
    const combat = state.combats[combatId];
    const snapshot =
      combat && typeof ensureCombatSnapshot === "function"
        ? ensureCombatSnapshot(combat)
        : combat?.stateSnapshot || null;
    if (!combat || !snapshot) return;
    send(ws, {
      t: "EvCombatState",
      eventId: getNextEventId(),
      combatId: combat.id,
      mapId: combat.mapId || null,
      turn: combat.turn || null,
      round: Number.isInteger(combat.round) ? combat.round : null,
      activePlayerId: Number.isInteger(combat.activePlayerId)
        ? combat.activePlayerId
        : null,
      activeMonsterId: Number.isInteger(combat.activeMonsterId)
        ? combat.activeMonsterId
        : null,
      activeMonsterIndex: Number.isInteger(combat.activeMonsterIndex)
        ? combat.activeMonsterIndex
        : null,
      activeSummonId: Number.isInteger(combat.activeSummonId)
        ? combat.activeSummonId
        : null,
      actorOrder: combat.actorOrder || undefined,
      players: Array.isArray(snapshot.players) ? snapshot.players : [],
      monsters: Array.isArray(snapshot.monsters) ? snapshot.monsters : [],
      summons: Array.isArray(snapshot.summons) ? snapshot.summons : [],
      resync: true,
    });
  };

  function findPathOnGrid(startX, startY, endX, endY, meta, blocked, allowDiagonal, maxSteps) {
    if (!meta) return null;
    if (startX === endX && startY === endY) return [];
    const width = meta.width;
    const height = meta.height;
    if (
      startX < 0 ||
      startY < 0 ||
      endX < 0 ||
      endY < 0 ||
      startX >= width ||
      startY >= height ||
      endX >= width ||
      endY >= height
    ) {
      return null;
    }
    if (blocked && blocked.has(`${endX},${endY}`)) return null;

    const dirs4 = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];
    const dirs8 = [
      ...dirs4,
      { dx: 1, dy: 1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: 1 },
      { dx: -1, dy: -1 },
    ];
    const dirs = allowDiagonal ? dirs8 : dirs4;

    const key = (x, y) => `${x},${y}`;
    const visited = new Set([key(startX, startY)]);
    const prev = new Map();
    const queue = [{ x: startX, y: startY }];
    let qi = 0;

    while (qi < queue.length) {
      const current = queue[qi++];
      for (const { dx, dy } of dirs) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const k = key(nx, ny);
        if (visited.has(k)) continue;
        if (blocked && blocked.has(k)) continue;
        if (dx !== 0 && dy !== 0) {
          const sideA = `${current.x + dx},${current.y}`;
          const sideB = `${current.x},${current.y + dy}`;
          if (blocked && (blocked.has(sideA) || blocked.has(sideB))) {
            continue;
          }
        }
        visited.add(k);
        prev.set(k, current);
        if (nx === endX && ny === endY) {
          const path = [{ x: nx, y: ny }];
          let back = current;
          while (back && !(back.x === startX && back.y === startY)) {
            path.push({ x: back.x, y: back.y });
            back = prev.get(key(back.x, back.y));
          }
          path.reverse();
          if (Number.isInteger(maxSteps) && path.length > maxSteps) {
            return null;
          }
          return path;
        }
        if (
          Number.isInteger(maxSteps) &&
          Math.abs(nx - startX) + Math.abs(ny - startY) > maxSteps
        ) {
          continue;
        }
        queue.push({ x: nx, y: ny });
      }
    }

    return null;
  }

  function sanitizeInventorySnapshot(raw) {
    if (!raw || typeof raw !== "object") return null;
    const size =
      Number.isInteger(raw.size) && raw.size > 0 && raw.size <= 200
        ? raw.size
        : null;
    if (!size) return null;
    const slots = Array.isArray(raw.slots) ? raw.slots.slice(0, size) : [];
    while (slots.length < size) slots.push(null);

    const cleanSlots = slots.map((slot) => {
      if (!slot || typeof slot !== "object") return null;
      const itemId = typeof slot.itemId === "string" ? slot.itemId : null;
      const qty =
        Number.isInteger(slot.qty) && slot.qty > 0 ? Math.min(slot.qty, 9999) : null;
      if (!itemId || qty === null) return null;
      return { itemId, qty };
    });

    const autoGrow =
      raw.autoGrow && typeof raw.autoGrow === "object"
        ? {
            enabled: raw.autoGrow.enabled === true,
            minEmptySlots:
              Number.isInteger(raw.autoGrow.minEmptySlots) && raw.autoGrow.minEmptySlots >= 0
                ? raw.autoGrow.minEmptySlots
                : 0,
            growBy:
              Number.isInteger(raw.autoGrow.growBy) && raw.autoGrow.growBy > 0
                ? raw.autoGrow.growBy
                : 0,
          }
        : null;

    return {
      size,
      slots: cleanSlots,
      autoGrow,
    };
  }

  function isInventoryEmpty(inv) {
    if (!inv || !Array.isArray(inv.slots)) return true;
    return inv.slots.every(
      (slot) =>
        !slot ||
        typeof slot.itemId !== "string" ||
        !Number.isInteger(slot.qty) ||
        slot.qty <= 0
    );
  }

  function snapshotInventory(inv) {
    if (!inv) return null;
    return {
      size: inv.size,
      slots: inv.slots.map((slot) =>
        slot && typeof slot.itemId === "string" && Number.isInteger(slot.qty)
          ? { itemId: slot.itemId, qty: slot.qty }
          : null
      ),
      autoGrow: inv.autoGrow ? { ...inv.autoGrow } : null,
    };
  }

  function restoreInventory(inv, snapshot) {
    if (!inv || !snapshot) return;
    inv.size = snapshot.size;
    inv.slots = Array.isArray(snapshot.slots)
      ? snapshot.slots.map((slot) =>
          slot && typeof slot.itemId === "string" && Number.isInteger(slot.qty)
            ? { itemId: slot.itemId, qty: slot.qty }
            : null
        )
      : [];
    while (inv.slots.length < inv.size) inv.slots.push(null);
    inv.autoGrow = snapshot.autoGrow ? { ...snapshot.autoGrow } : null;
  }

  function ensureMetierState(player, metierId) {
    if (!player || !metierId) return null;
    if (!player.metiers) player.metiers = {};
    if (!player.metiers[metierId]) {
      player.metiers[metierId] = { level: 1, xp: 0, xpNext: 100 };
    }
    const state = player.metiers[metierId];
    state.level = Number.isInteger(state.level) && state.level > 0 ? state.level : 1;
    state.xp = Number.isFinite(state.xp) ? state.xp : 0;
    state.xpNext =
      Number.isInteger(state.xpNext) && state.xpNext > 0
        ? state.xpNext
        : state.level * 100;
    return state;
  }

  function addMetierXp(player, metierId, amount) {
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const state = ensureMetierState(player, metierId);
    if (!state) return null;
    state.xp += amount;
    while (state.xp >= state.xpNext) {
      state.xp -= state.xpNext;
      state.level += 1;
      state.xpNext = state.level * 100;
    }
    return state;
  }

  function sanitizeLevel(raw) {
    if (!Number.isFinite(raw)) return null;
    const lvl = Math.round(raw);
    if (lvl < 1 || lvl > 200) return null;
    return lvl;
  }

  function sanitizeJsonPayload(raw, maxLen) {
    if (raw == null) return null;
    if (typeof raw !== "object") return null;
    try {
      const json = JSON.stringify(raw);
      if (Number.isInteger(maxLen) && json.length > maxLen) return null;
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  function sanitizeEquipment(raw) {
    if (!raw || typeof raw !== "object") return null;
    const slots = [
      "head",
      "cape",
      "amulet",
      "weapon",
      "ring1",
      "ring2",
      "belt",
      "boots",
    ];
    const cleaned = {};
    for (const slot of slots) {
      const entry = raw[slot];
      if (!entry || typeof entry !== "object") {
        cleaned[slot] = null;
        continue;
      }
      const itemId = typeof entry.itemId === "string" ? entry.itemId : null;
      cleaned[slot] = itemId ? { itemId } : null;
    }
    return cleaned;
  }

  function summarizeInventory(inv) {
    if (!inv || !Array.isArray(inv.slots)) return new Map();
    const summary = new Map();
    inv.slots.forEach((slot) => {
      if (!slot || typeof slot.itemId !== "string") return;
      const qty = Number.isInteger(slot.qty) ? slot.qty : 0;
      if (qty <= 0) return;
      summary.set(slot.itemId, (summary.get(slot.itemId) || 0) + qty);
    });
    return summary;
  }

  function diffInventory(beforeInv, afterInv) {
    const before = summarizeInventory(beforeInv);
    const after = summarizeInventory(afterInv);
    const deltas = [];
    const itemIds = new Set([...before.keys(), ...after.keys()]);
    for (const itemId of itemIds) {
      const delta = (after.get(itemId) || 0) - (before.get(itemId) || 0);
      if (delta !== 0) {
        deltas.push({ itemId, delta });
      }
    }
    deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    return deltas;
  }

  function logAntiDup(entry) {
    if (!entry) return;
    try {
      const fs = require("fs");
      const path = require("path");
      const logPath = path.resolve(__dirname, "..", "data", "anti_dup.log");
      const line = `${JSON.stringify(entry)}\n`;
      fs.appendFile(logPath, line, "utf8", () => {});
    } catch {
      // ignore logging errors
    }
  }

  function getItemDef(itemId) {
    const defs = typeof getItemDefs === "function" ? getItemDefs() : null;
    if (!defs || !itemId) return null;
    return defs[itemId] || null;
  }

  function ensurePlayerInventory(player) {
    if (player.inventory && Array.isArray(player.inventory.slots)) {
      return normalizeInventory(player.inventory, player);
    }
    const size = 50;
    player.inventory = {
      size,
      slots: new Array(size).fill(null),
      autoGrow: { enabled: true, minEmptySlots: 10, growBy: 5 },
    };
    return normalizeInventory(player.inventory, player);
  }

  function normalizeInventory(inv, player) {
    if (!inv || !Array.isArray(inv.slots)) return inv;
    let size = Number.isInteger(inv.size) ? inv.size : inv.slots.length;
    if (!Number.isInteger(size) || size <= 0) size = inv.slots.length || 50;
    if (size > MAX_INV_SIZE) {
      size = MAX_INV_SIZE;
    }
    inv.size = size;
    if (inv.slots.length > size) {
      inv.slots = inv.slots.slice(0, size);
    }
    while (inv.slots.length < size) inv.slots.push(null);
    inv.slots = inv.slots.map((slot) => {
      if (!slot || typeof slot !== "object") return null;
      const itemId = typeof slot.itemId === "string" ? slot.itemId : null;
      const qty =
        Number.isInteger(slot.qty) && slot.qty > 0 ? Math.min(slot.qty, 9999) : null;
      if (!itemId || qty === null) return null;
      return { itemId, qty };
    });
    return inv;
  }

  function countEmptySlots(inv) {
    if (!inv || !Array.isArray(inv.slots)) return 0;
    let empty = 0;
    for (let i = 0; i < inv.size; i += 1) {
      if (!inv.slots[i]) empty += 1;
    }
    return empty;
  }

  function maybeAutoGrow(inv) {
    const cfg = inv?.autoGrow;
    if (!cfg || cfg.enabled !== true) return;
    const minEmptySlots =
      Number.isFinite(cfg.minEmptySlots) && cfg.minEmptySlots >= 0
        ? cfg.minEmptySlots
        : 0;
    const growBy = Number.isFinite(cfg.growBy) && cfg.growBy > 0 ? cfg.growBy : 0;
    if (growBy <= 0) return;
    let empty = countEmptySlots(inv);
    while (empty < minEmptySlots) {
      inv.size += growBy;
      for (let i = 0; i < growBy; i += 1) inv.slots.push(null);
      empty += growBy;
    }
  }

  function findStackSlot(inv, itemId, maxStack) {
    for (let i = 0; i < inv.size; i += 1) {
      const slot = inv.slots[i];
      if (slot && slot.itemId === itemId && slot.qty < maxStack) return i;
    }
    return -1;
  }

  function findEmptySlot(inv) {
    for (let i = 0; i < inv.size; i += 1) {
      if (!inv.slots[i]) return i;
    }
    return -1;
  }

  function countItemInInventory(inv, itemId) {
    if (!inv || !Array.isArray(inv.slots) || !itemId) return 0;
    let total = 0;
    for (let i = 0; i < inv.size; i += 1) {
      const slot = inv.slots[i];
      if (!slot || slot.itemId !== itemId) continue;
      if (Number.isInteger(slot.qty) && slot.qty > 0) {
        total += slot.qty;
        if (total >= MAX_QTY_PER_OP) return total;
      }
    }
    return total;
  }

  function addItemToInventory(inv, itemId, qty) {
    if (!inv || !itemId || qty <= 0) return 0;
    const def = getItemDef(itemId);
    const stackable = def?.stackable !== false;
    const maxStack =
      stackable && Number.isFinite(def?.maxStack) ? Math.max(1, def.maxStack) : 1;

    let remaining = qty;
    maybeAutoGrow(inv);
    const maxIterations =
      Math.max(1, Number.isInteger(inv.size) ? inv.size : 1) + remaining + 50;
    let iterations = 0;

    while (remaining > 0) {
      iterations += 1;
      if (iterations > maxIterations) {
        break;
      }
      let slotIndex = stackable ? findStackSlot(inv, itemId, maxStack) : -1;
      if (slotIndex === -1) {
        slotIndex = findEmptySlot(inv);
        if (slotIndex === -1) {
          maybeAutoGrow(inv);
          slotIndex = findEmptySlot(inv);
          if (slotIndex === -1) break;
        }
        inv.slots[slotIndex] = { itemId, qty: 0 };
      }

      const slot = inv.slots[slotIndex];
      if (!Number.isFinite(slot.qty)) slot.qty = 0;
      const space = Math.max(0, maxStack - slot.qty);
      const addNow = stackable ? Math.min(space, remaining) : 1;
      if (!Number.isFinite(addNow) || addNow <= 0) {
        break;
      }
      slot.qty += addNow;
      remaining -= addNow;
      if (!stackable) {
        // non-stackable: move to next slot each time
        continue;
      }
    }

    return qty - remaining;
  }

  function removeItemFromInventory(inv, itemId, qty) {
    if (!inv || !itemId || qty <= 0) return 0;
    let remaining = qty;
    let removed = 0;
    for (let i = 0; i < inv.size && remaining > 0; i += 1) {
      const slot = inv.slots[i];
      if (!slot || slot.itemId !== itemId) continue;
      const take = Math.min(slot.qty, remaining);
      slot.qty -= take;
      remaining -= take;
      removed += take;
      if (slot.qty <= 0) {
        inv.slots[i] = null;
      }
    }
    return removed;
  }

  const QUEST_STATES =
    (typeof getQuestStates === "function" && getQuestStates()) || {
      NOT_STARTED: "not_started",
      IN_PROGRESS: "in_progress",
      COMPLETED: "completed",
    };

  function getQuestDefsSafe() {
    return typeof getQuestDefs === "function" ? getQuestDefs() : null;
  }

  function getQuestDef(questId) {
    const defs = getQuestDefsSafe();
    if (!defs || !questId) return null;
    return defs[questId] || null;
  }

  function ensureQuestContainer(player) {
    if (!player.quests || typeof player.quests !== "object") {
      player.quests = {};
    }
    return player.quests;
  }

  function resetQuestProgress(state) {
    state.progress = { currentCount: 0, crafted: {}, kills: {}, applied: false };
  }

  function getQuestState(player, questId, { create = true } = {}) {
    if (!player || !questId) return null;
    const container = ensureQuestContainer(player);
    if (!container[questId]) {
      if (!create) return null;
      container[questId] = {
        state: QUEST_STATES.NOT_STARTED,
        stageIndex: 0,
        progress: { currentCount: 0 },
      };
    }
    return container[questId];
  }

  function getQuestStageByIndex(questDef, stageIndex = 0) {
    if (!questDef || !Array.isArray(questDef.stages) || questDef.stages.length === 0) {
      return null;
    }
    const safeIndex = Math.max(0, Math.min(stageIndex, questDef.stages.length - 1));
    return questDef.stages[safeIndex];
  }

  function getCurrentQuestStage(questDef, state) {
    if (!questDef || !state) return null;
    return getQuestStageByIndex(questDef, state.stageIndex || 0);
  }

  function isQuestCompleted(player, questId) {
    const state = getQuestState(player, questId, { create: false });
    return state?.state === QUEST_STATES.COMPLETED;
  }

  function canAcceptQuest(player, questDef) {
    if (!player || !questDef) return false;
    const state = getQuestState(player, questDef.id, { create: false });
    if (state?.state && state.state !== QUEST_STATES.NOT_STARTED) return false;
    const requires = Array.isArray(questDef.requires) ? questDef.requires : [];
    if (requires.length === 0) return true;
    return requires.every((reqId) => isQuestCompleted(player, reqId));
  }

  function getMonsterFamilyId(monsterId) {
    if (!monsterId || typeof getMonsterDef !== "function") return null;
    const def = getMonsterDef(monsterId);
    return def?.familyId || null;
  }

  function isMonsterObjectiveMatch(objective, monsterId) {
    if (!objective || !monsterId) return false;
    const targetId = objective.monsterId;
    const targetFamily = objective.monsterFamily;
    const familyId = getMonsterFamilyId(monsterId);
    if (targetId && targetId === monsterId) return true;
    if (targetId && familyId && targetId === familyId) return true;
    if (targetFamily && familyId && targetFamily === familyId) return true;
    return false;
  }

  function getCraftedCount(player, state, itemId) {
    if (!itemId) return 0;
    const crafted = state?.progress?.crafted?.[itemId] || 0;
    const inInventory = countItemInInventory(player?.inventory, itemId);
    return Math.max(crafted, inInventory);
  }

  function hasEquippedParchment(player) {
    if (!player || !player.spellParchments) return false;
    return Object.keys(player.spellParchments).length > 0;
  }

  function hasAppliedParchment(player, state) {
    return Boolean(state?.progress?.applied) || hasEquippedParchment(player);
  }

  function getTurnInNpcId(stage) {
    return stage?.turnInNpcId || stage?.npcId || stage?.objective?.npcId || null;
  }

  function isTurnInReadyAtNpc(player, questDef, state, stage, npcId) {
    if (!questDef || !state || !stage || !npcId) return false;
    if (state.state !== QUEST_STATES.IN_PROGRESS) return false;
    const turnInNpcId = getTurnInNpcId(stage);
    if (turnInNpcId !== npcId) return false;

    const objective = stage.objective;
    if (!objective || !objective.type) return false;

    if (objective.type === "talk_to_npc") {
      if (
        questDef?.id === "alchimiste_marchand_5" &&
        stage?.id === "apply_parchemin"
      ) {
        return hasAppliedParchment(player, state);
      }
      return true;
    }

    if (objective.type === "kill_monster") {
      const required = objective.requiredCount || 1;
      const current = state.progress?.currentCount || 0;
      return current >= required;
    }

    if (objective.type === "kill_monsters") {
      const list = Array.isArray(objective.monsters) ? objective.monsters : [];
      if (list.length === 0) return false;
      const kills = state.progress?.kills || {};
      return list.every((entry) => {
        if (!entry || !entry.monsterId) return false;
        const required = entry.requiredCount || 1;
        const current = kills[entry.monsterId] || 0;
        return current >= required;
      });
    }

    if (objective.type === "deliver_item") {
      const required = objective.qty || 1;
      const current = countItemInInventory(player?.inventory, objective.itemId);
      return current >= required;
    }

    if (objective.type === "deliver_items") {
      const items = Array.isArray(objective.items) ? objective.items : [];
      if (items.length === 0) return false;
      return items.every((it) => {
        if (!it || !it.itemId) return false;
        const required = it.qty || 1;
        const current = countItemInInventory(player?.inventory, it.itemId);
        return current >= required;
      });
    }

    if (objective.type === "craft_items") {
      const items = Array.isArray(objective.items) ? objective.items : [];
      if (items.length === 0) return false;
      return items.every((it) => {
        if (!it || !it.itemId) return false;
        const required = it.qty || 1;
        const current = getCraftedCount(player, state, it.itemId);
        return current >= required;
      });
    }

    if (objective.type === "craft_set") {
      const requiredSlots = Array.isArray(objective.requiredSlots)
        ? objective.requiredSlots.filter(Boolean)
        : [];
      const required =
        requiredSlots.length > 0 ? requiredSlots.length : objective.requiredCount || 1;
      const current = state.progress?.currentCount || 0;
      return current >= required;
    }

    return false;
  }

  function applyQuestStageHook(player, questId, stageId, hookName) {
    if (!player || !questId || !stageId) return false;
    const hookKey = `${questId}:${stageId}:${hookName}`;
    const rewards = {
      "alchimiste_marchand_1:deliver_invoice:onStart": {
        itemId: "facture_alchimiste",
        qty: 1,
      },
      "andemia_intro_3:bring_orties:onComplete": {
        itemId: "extracteur_essence",
        qty: 1,
      },
      "alchimiste_marchand_4:bring_paper:onComplete": {
        itemId: "talisman_inferieur_tier_1",
        qty: 1,
      },
    };
    const reward = rewards[hookKey];
    if (!reward) return false;
    const inv = ensurePlayerInventory(player);
    const beforeInv = snapshotInventory(inv);
    const added = addItemToInventory(inv, reward.itemId, reward.qty);
    if (added < reward.qty) {
      restoreInventory(inv, beforeInv);
      return false;
    }
    const deltas = diffInventory(beforeInv, inv);
    logAntiDup({
      ts: Date.now(),
      reason: "QuestHookReward",
      accountId: player.accountId || null,
      characterId: player.characterId || null,
      playerId: player.id || null,
      mapId: player.mapId || null,
      op: "add",
      itemId: reward.itemId,
      qty: reward.qty,
      itemDeltas: deltas.slice(0, 20),
    });
    return true;
  }

  function sendQuestSync(player, reason) {
    const target = findClientByPlayerId(player.id);
    if (!target?.ws) return;
    sendPlayerSync(target.ws, player, reason || "quest");
  }

  function applyQuestRewards(player, questDef) {
    if (!player || !questDef) return;
    const rewards = questDef.rewards || {};
    const xp = Number.isFinite(rewards.xpPlayer) ? rewards.xpPlayer : 0;
    const gold = Number.isFinite(rewards.gold) ? rewards.gold : 0;

    if (xp > 0 && typeof getLevelApi === "function") {
      const api = getLevelApi();
      if (api && typeof api.ajouterXp === "function") {
        const levelState =
          player.levelState && typeof player.levelState === "object"
            ? player.levelState
            : typeof api.createLevelState === "function"
              ? api.createLevelState()
              : { niveau: 1, xp: 0, xpTotal: 0, xpProchain: 0, pointsCaracLibres: 0 };
        const result = api.ajouterXp(levelState, xp);
        if (result?.nouveauState) {
          player.levelState = result.nouveauState;
          player.level = result.nouveauState.niveau;
        }
      }
    }

    if (gold > 0) {
      const beforeGold = Number.isFinite(player.gold) ? player.gold : 0;
      player.gold = Math.max(0, beforeGold + Math.round(gold));
      logAntiDup({
        ts: Date.now(),
        reason: "QuestReward",
        accountId: player.accountId || null,
        characterId: player.characterId || null,
        playerId: player.id || null,
        mapId: player.mapId || null,
        goldDelta: player.gold - beforeGold,
      });
    }
  }

  function applyCombatRewardsForPlayer(playerId, { xp = 0, gold = 0 } = {}) {
    const player = state.players[playerId];
    if (!player) return { xpApplied: 0, goldApplied: 0 };
    let xpApplied = 0;
    let goldApplied = 0;
    let levelsGained = 0;

    if (Number.isFinite(xp) && xp > 0 && typeof getLevelApi === "function") {
      const api = getLevelApi();
      if (api && typeof api.ajouterXp === "function") {
        const levelState =
          player.levelState && typeof player.levelState === "object"
            ? player.levelState
            : typeof api.createLevelState === "function"
              ? api.createLevelState()
              : { niveau: 1, xp: 0, xpTotal: 0, xpProchain: 0, pointsCaracLibres: 0 };
        const result = api.ajouterXp(levelState, xp);
        if (result?.nouveauState) {
          player.levelState = result.nouveauState;
          player.level = result.nouveauState.niveau;
          levelsGained = Number.isInteger(result.niveauxGagnes)
            ? result.niveauxGagnes
            : 0;
          xpApplied = xp;
        }
      }
    }

    if (levelsGained > 0) {
      if (!player.baseStats) player.baseStats = {};
      const baseHpMax = Number.isFinite(player.baseStats.hpMax)
        ? player.baseStats.hpMax
        : Number.isFinite(player.hpMax)
          ? player.hpMax
          : 50;
      player.baseStats.hpMax = baseHpMax + levelsGained * 5;
      if (typeof computeFinalStats === "function") {
        const nextStats = computeFinalStats(player.baseStats);
        if (nextStats) {
          player.stats = nextStats;
          player.hpMax = Number.isFinite(nextStats.hpMax) ? nextStats.hpMax : player.hpMax;
          if (Number.isFinite(player.hp)) {
            player.hp = Math.min(player.hp, player.hpMax);
          } else if (Number.isFinite(player.hpMax)) {
            player.hp = player.hpMax;
          }
        }
      }
    }

    if (Number.isFinite(gold) && gold > 0) {
      const beforeGold = Number.isFinite(player.gold) ? player.gold : 0;
      player.gold = Math.max(0, beforeGold + Math.round(gold));
      goldApplied = player.gold - beforeGold;
      if (goldApplied !== 0) {
        logAntiDup({
          ts: Date.now(),
          reason: "CombatReward",
          accountId: player.accountId || null,
          characterId: player.characterId || null,
          playerId: player.id || null,
          mapId: player.mapId || null,
          goldDelta: goldApplied,
        });
      }
    }

    if (xpApplied > 0) {
      logAntiDup({
        ts: Date.now(),
        reason: "CombatReward",
        accountId: player.accountId || null,
        characterId: player.characterId || null,
        playerId: player.id || null,
        mapId: player.mapId || null,
        xpDelta: xpApplied,
      });
    }

    if (xpApplied > 0 || goldApplied > 0) {
      if (typeof persistPlayerState === "function") {
        persistPlayerState(player);
      }
      sendQuestSync(player, "combat_reward");
    }

    return { xpApplied, goldApplied };
  }

  function advanceQuestStage(player, questDef, state) {
    if (!player || !questDef || !state) return;
    if (state.state !== QUEST_STATES.IN_PROGRESS) return;
    const currentStage = getCurrentQuestStage(questDef, state);
    if (currentStage) {
      applyQuestStageHook(player, questDef.id, currentStage.id, "onComplete");
    }

    const hasStages =
      Array.isArray(questDef.stages) && questDef.stages.length > 0;
    const nextIndex = hasStages ? state.stageIndex + 1 : 0;

    if (!hasStages || nextIndex >= questDef.stages.length) {
      state.state = QUEST_STATES.COMPLETED;
      if (hasStages) {
        state.stageIndex = Math.max(0, questDef.stages.length - 1);
      }
      applyQuestRewards(player, questDef);
      return;
    }

    state.stageIndex = nextIndex;
    resetQuestProgress(state);
    const nextStage = getCurrentQuestStage(questDef, state);
    if (nextStage) {
      applyQuestStageHook(player, questDef.id, nextStage.id, "onStart");
    }
  }

  function incrementKillProgressForPlayer(player, monsterId, count = 1) {
    if (!player || !monsterId) return false;
    if (!Number.isFinite(count) || count <= 0) return false;
    const defs = getQuestDefsSafe();
    if (!defs) return false;
    let changed = false;
    Object.values(defs).forEach((questDef) => {
      if (!questDef) return;
      const state = getQuestState(player, questDef.id, { create: false });
      if (!state || state.state !== QUEST_STATES.IN_PROGRESS) return;
      const stage = getCurrentQuestStage(questDef, state);
      const objective = stage?.objective;
      if (!objective || !objective.type) return;

      if (objective.type === "kill_monster") {
        if (!isMonsterObjectiveMatch(objective, monsterId)) return;
        const required = objective.requiredCount || 1;
        const current = state.progress?.currentCount || 0;
        const next = Math.min(required, current + count);
        state.progress = state.progress || {};
        state.progress.currentCount = next;
        if (next >= required) {
          advanceQuestStage(player, questDef, state);
        }
        changed = true;
        return;
      }

      if (objective.type === "kill_monsters") {
        const list = Array.isArray(objective.monsters) ? objective.monsters : [];
        if (list.length === 0) return;
        const target = list.find((entry) => isMonsterObjectiveMatch(entry, monsterId));
        if (!target) return;
        state.progress = state.progress || {};
        state.progress.kills = state.progress.kills || {};
        const current = state.progress.kills[target.monsterId] || 0;
        const required = target.requiredCount || 1;
        const next = Math.min(required, current + count);
        state.progress.kills[target.monsterId] = next;

        const done = list.every((entry) => {
          if (!entry || !entry.monsterId) return false;
          const req = entry.requiredCount || 1;
          const cur = state.progress.kills[entry.monsterId] || 0;
          return cur >= req;
        });
        if (done) {
          advanceQuestStage(player, questDef, state);
        }
        changed = true;
      }
    });
    return changed;
  }

  function incrementCraftProgressForPlayer(player, itemId, qty = 1) {
    if (!player || !itemId || qty <= 0) return false;
    const defs = getQuestDefsSafe();
    if (!defs) return false;
    let changed = false;
    Object.values(defs).forEach((questDef) => {
      if (!questDef) return;
      const state = getQuestState(player, questDef.id, { create: false });
      if (!state || state.state !== QUEST_STATES.IN_PROGRESS) return;
      const stage = getCurrentQuestStage(questDef, state);
      const objective = stage?.objective;
      if (!objective || !objective.type) return;

      if (objective.type === "craft_items") {
        const items = Array.isArray(objective.items) ? objective.items : [];
        const target = items.find((it) => it && it.itemId === itemId);
        if (!target) return;
        const required = target.qty || 1;
        state.progress = state.progress || {};
        state.progress.crafted = state.progress.crafted || {};
        const current = state.progress.crafted[itemId] || 0;
        const next = Math.min(required, current + qty);
        state.progress.crafted[itemId] = next;

        const totalRequired = items.reduce((acc, it) => acc + (it?.qty || 1), 0);
        const totalCurrent = items.reduce(
          (acc, it) =>
            acc + Math.min(it?.qty || 1, state.progress.crafted[it.itemId] || 0),
          0
        );
        state.progress.currentCount = Math.min(totalRequired, totalCurrent);
        changed = true;
        return;
      }

      if (objective.type === "craft_set") {
        const def = getItemDef(itemId);
        const setId = objective.setId;
        if (!def || !setId) return;
        const defSetId = def.setId || "";
        const matchesSet = defSetId === setId || defSetId.startsWith(`${setId}_`);
        if (!matchesSet) return;

        state.progress = state.progress || {};
        const requiredSlots = Array.isArray(objective.requiredSlots)
          ? objective.requiredSlots.filter(Boolean)
          : [];

        if (requiredSlots.length > 0) {
          const slot = def.slot || null;
          if (!slot || !requiredSlots.includes(slot)) return;
          state.progress.craftedSlots = state.progress.craftedSlots || {};
          state.progress.craftedSlots[slot] = true;
          const current = requiredSlots.reduce(
            (acc, s) => acc + (state.progress.craftedSlots[s] ? 1 : 0),
            0
          );
          state.progress.currentCount = Math.min(requiredSlots.length, current);
        } else {
          const required = objective.requiredCount || 1;
          const current = state.progress.currentCount || 0;
          state.progress.currentCount = Math.min(required, current + qty);
        }
        changed = true;
      }
    });
    return changed;
  }

  function handleQuestActionAccept(player, questDef, npcId) {
    if (!player || !questDef) return false;
    if (npcId && questDef.giverNpcId && questDef.giverNpcId !== npcId) return false;
    if (!canAcceptQuest(player, questDef)) return false;
    const state = getQuestState(player, questDef.id);
    if (!state) return false;
    state.state = QUEST_STATES.IN_PROGRESS;
    state.stageIndex = 0;
    resetQuestProgress(state);
    const stage = getCurrentQuestStage(questDef, state);
    if (stage) {
      applyQuestStageHook(player, questDef.id, stage.id, "onStart");
    }
    return true;
  }

  function handleQuestActionTurnIn(player, questDef, npcId, stageId) {
    if (!player || !questDef) return { ok: false };
    const state = getQuestState(player, questDef.id, { create: false });
    if (!state || state.state !== QUEST_STATES.IN_PROGRESS) return { ok: false };
    const stage = getCurrentQuestStage(questDef, state);
    if (!stage || (stageId && stage.id !== stageId)) return { ok: false };
    if (!isTurnInReadyAtNpc(player, questDef, state, stage, npcId)) {
      return { ok: false };
    }

    const objective = stage.objective;
    const inv = ensurePlayerInventory(player);
    const beforeInv = snapshotInventory(inv);
    if (objective?.type === "deliver_item") {
      const required = objective.qty || 1;
      const consume = objective.consume !== false;
      if (consume) {
        const removed = removeItemFromInventory(inv, objective.itemId, required);
        if (removed < required) {
          restoreInventory(inv, beforeInv);
          return { ok: false };
        }
      }
    } else if (objective?.type === "deliver_items") {
      const items = Array.isArray(objective.items) ? objective.items : [];
      const consume = objective.consume !== false;
      if (consume) {
        for (const it of items) {
          if (!it || !it.itemId) continue;
          const required = it.qty || 1;
          const removed = removeItemFromInventory(inv, it.itemId, required);
          if (removed < required) {
            restoreInventory(inv, beforeInv);
            return { ok: false };
          }
        }
      }
    }

    advanceQuestStage(player, questDef, state);
    const afterInv = snapshotInventory(inv);
    const deltas = diffInventory(beforeInv, afterInv);
    if (deltas.length > 0) {
      logAntiDup({
        ts: Date.now(),
        reason: "QuestTurnIn",
        accountId: player.accountId || null,
        characterId: player.characterId || null,
        playerId: player.id || null,
        mapId: player.mapId || null,
        itemDeltas: deltas.slice(0, 20),
      });
    }
    return { ok: true };
  }

  function findClientByPlayerId(playerId) {
    for (const [ws, info] of clients.entries()) {
      if (info && info.id === playerId) {
        return { ws, info };
      }
    }
    return null;
  }

  function applyInventoryOpFromServer(playerId, op, itemId, qty, reason) {
    if (!Number.isInteger(playerId)) return 0;
    const target = findClientByPlayerId(playerId);
    const msg = {
      playerId,
      op,
      itemId,
      qty,
      reason: reason || "server",
    };
    const ws = target?.ws || null;
    const info = target?.info || { id: playerId };
    return handleCmdInventoryOp(ws, info, msg) || 0;
  }

  function sendPlayerSync(ws, player, reason) {
    if (!ws || !player) return;
    send(ws, {
      t: "EvPlayerSync",
      eventId: getNextEventId(),
      playerId: player.id,
      reason: reason || null,
      inventory: player.inventory || null,
      gold: Number.isFinite(player.gold) ? player.gold : 0,
      honorPoints: Number.isFinite(player.honorPoints) ? player.honorPoints : 0,
      equipment: player.equipment || null,
      levelState: player.levelState || null,
      quests: player.quests || {},
      achievements: player.achievements || null,
      metiers: player.metiers || null,
      baseStats: player.baseStats || null,
      hp: Number.isFinite(player.hp) ? player.hp : null,
      hpMax: Number.isFinite(player.hpMax) ? player.hpMax : null,
    });
  }

  function sanitizeBaseStats(raw) {
    if (!raw || typeof raw !== "object") return null;
    const allowed = new Set([
      "force",
      "intelligence",
      "agilite",
      "chance",
      "tacle",
      "fuite",
      "pods",
      "dommagesCrit",
      "soins",
      "resistanceFixeTerre",
      "resistanceFixeFeu",
      "resistanceFixeAir",
      "resistanceFixeEau",
      "prospection",
      "critChancePct",
      "puissance",
      "vitalite",
      "initiative",
      "sagesse",
      "hpMax",
      "hp",
      "pa",
      "pm",
      "pushDamage",
      "dommage",
      "dommageFeu",
      "dommageEau",
      "dommageAir",
      "dommageTerre",
      "baseTacle",
      "baseFuite",
      "basePods",
      "baseDommagesCrit",
      "baseSoins",
      "baseResistanceFixeTerre",
      "baseResistanceFixeFeu",
      "baseResistanceFixeAir",
      "baseResistanceFixeEau",
      "baseProspection",
      "baseCritChancePct",
    ]);
    const cleaned = {};
    let count = 0;
    for (const [key, value] of Object.entries(raw)) {
      if (!allowed.has(key)) continue;
      if (!Number.isFinite(value)) continue;
      cleaned[key] = Math.round(value);
      count += 1;
      if (count > 64) break;
    }
    return count > 0 ? cleaned : null;
  }

  function handleHello(ws, msg) {
    const protoOk = msg.protocolVersion === PROTOCOL_VERSION;
    const dataOk = msg.dataHash === GAME_DATA_VERSION;
    if (!protoOk || !dataOk) {
      send(ws, {
        t: "EvRefuse",
        reason: "version_mismatch",
        protocolVersion: PROTOCOL_VERSION,
        dataHash: GAME_DATA_VERSION,
      });
      ws.close();
      return;
    }

    const sessionToken =
      typeof msg.sessionToken === "string" ? msg.sessionToken : null;
    const inventoryAuthority = msg.inventoryAuthority === true;
    const accountName =
      typeof msg.accountName === "string" ? msg.accountName : null;
    const accountPassword =
      typeof msg.accountPassword === "string" ? msg.accountPassword : null;
    const authMode =
      msg.authMode === "register"
        ? "register"
        : msg.authMode === "login"
          ? "login"
          : "auto";
    let accountId = null;

    const hasCredentials = !!(accountName && accountPassword);
    if (!hasCredentials && typeof getAccountIdFromSession === "function" && sessionToken) {
      accountId = getAccountIdFromSession(sessionToken);
    }

    if (!accountId) {
      if (!accountStore) {
        send(ws, { t: "EvRefuse", reason: "auth_unavailable" });
        ws.close();
        return;
      }
      if (!hasCredentials) {
        send(ws, { t: "EvRefuse", reason: "auth_required" });
        ws.close();
        return;
      }
      const existingAccount = accountStore.getAccountByName(accountName);
      if (authMode === "register") {
        if (existingAccount) {
          send(ws, { t: "EvRefuse", reason: "account_exists" });
          ws.close();
          return;
        }
        const created = accountStore.createAccount({
          name: accountName,
          password: accountPassword,
        });
        if (!created) {
          send(ws, { t: "EvRefuse", reason: "auth_failed" });
          ws.close();
          return;
        }
        accountId = created.accountId;
      } else if (authMode === "login") {
        if (!existingAccount) {
          send(ws, { t: "EvRefuse", reason: "account_missing" });
          ws.close();
          return;
        }
        const ok = accountStore.verifyPassword(existingAccount, accountPassword);
        if (!ok) {
          send(ws, { t: "EvRefuse", reason: "auth_failed" });
          ws.close();
          return;
        }
        accountId = existingAccount.accountId;
      } else if (existingAccount) {
        const ok = accountStore.verifyPassword(existingAccount, accountPassword);
        if (!ok) {
          send(ws, { t: "EvRefuse", reason: "auth_failed" });
          ws.close();
          return;
        }
        accountId = existingAccount.accountId;
      } else {
        const created = accountStore.createAccount({
          name: accountName,
          password: accountPassword,
        });
        if (!created) {
          send(ws, { t: "EvRefuse", reason: "auth_failed" });
          ws.close();
          return;
        }
        accountId = created.accountId;
      }
    }

    const characterId = typeof msg.characterId === "string" ? msg.characterId : null;
    if (!characterId || !characterStore) {
      send(ws, { t: "EvRefuse", reason: "character_required" });
      ws.close();
      return;
    }

    if (clients.size >= MAX_PLAYERS) {
      send(ws, { t: "EvRefuse", reason: "room_full" });
      ws.close();
      return;
    }

    if (typeof buildBaseStatsForClass !== "function" || typeof computeFinalStats !== "function") {
      send(ws, { t: "EvRefuse", reason: "server_loading" });
      ws.close();
      return;
    }

    const incomingName = typeof msg.characterName === "string" ? msg.characterName : null;
    const incomingClassId = typeof msg.classId === "string" ? msg.classId : null;
    const incomingLevel = Number.isInteger(msg.level) ? msg.level : null;

    const existingPlayer = Object.values(state.players).find(
      (p) => p && p.characterId === characterId
    );
    if (existingPlayer) {
      if (existingPlayer.accountId && existingPlayer.accountId !== accountId) {
        send(ws, { t: "EvRefuse", reason: "character_owned" });
        ws.close();
        return;
      }
      const accountAlreadyConnected = Object.values(state.players).some(
        (p) => p && p.accountId === accountId && p.connected !== false
      );
      if (accountAlreadyConnected) {
        send(ws, { t: "EvRefuse", reason: "account_in_use" });
        ws.close();
        return;
      }
      const alreadyConnected = Array.from(clients.values()).some(
        (info) => info && info.id === existingPlayer.id
      );
      if (alreadyConnected) {
        send(ws, { t: "EvRefuse", reason: "character_in_use" });
        ws.close();
        return;
      }

      existingPlayer.connected = true;
      if (Number.isInteger(existingPlayer.combatId)) {
        const combat = state.combats[existingPlayer.combatId];
        if (combat?.pendingFinalizeTimer) {
          clearTimeout(combat.pendingFinalizeTimer);
          combat.pendingFinalizeTimer = null;
          combat.pendingFinalizeAt = null;
        }
      }
      clients.set(ws, {
        id: existingPlayer.id,
        lastCmdId: 0,
        ready: true,
        lastAckEventId: 0,
        accountId: existingPlayer.accountId || accountId || null,
        inventoryAuthority,
      });

      if (!getHostId()) {
        setHostId(existingPlayer.id);
      }

      const nextSessionToken =
        typeof issueSessionToken === "function"
          ? issueSessionToken(accountId)
          : null;
      send(ws, {
        t: "EvWelcome",
        eventId: getNextEventId(),
        playerId: existingPlayer.id,
        hostId: getHostId(),
        isHost: existingPlayer.id === getHostId(),
        protocolVersion: PROTOCOL_VERSION,
        dataHash: GAME_DATA_VERSION,
        sessionToken: nextSessionToken,
        snapshot: snapshotForClient(),
      });

      sendCombatResync(ws, existingPlayer);
      broadcast({
        t: "EvPlayerJoined",
        mapId: existingPlayer.mapId || null,
        player: existingPlayer,
      });
      return;
    }

    const accountAlreadyConnected = Object.values(state.players).some(
      (p) => p && p.accountId === accountId && p.connected !== false
    );
    if (accountAlreadyConnected) {
      send(ws, { t: "EvRefuse", reason: "account_in_use" });
      ws.close();
      return;
    }

    let character = characterStore.getCharacter(characterId);
    if (!character) {
      if (incomingName && typeof characterStore.getCharacterByName === "function") {
        const taken = characterStore.getCharacterByName(incomingName);
        if (taken && taken.characterId !== characterId) {
          send(ws, { t: "EvRefuse", reason: "name_in_use" });
          ws.close();
          return;
        }
      }
      const baseStats = buildBaseStatsForClass(incomingClassId || "archer");
      character = characterStore.upsertCharacter({
        characterId,
        accountId,
        name: incomingName || "Joueur",
        classId: incomingClassId || "archer",
        level: incomingLevel ?? 1,
        baseStats,
      });
    } else if (character.accountId && character.accountId !== accountId) {
      send(ws, { t: "EvRefuse", reason: "character_owned" });
      ws.close();
      return;
    }
    if (!character) {
      send(ws, { t: "EvRefuse", reason: "character_invalid" });
      ws.close();
      return;
    }
    if (!character.accountId && accountId && characterStore) {
      character = characterStore.upsertCharacter({
        ...character,
        accountId,
      });
    }

    const baseStats =
      character.baseStats || buildBaseStatsForClass(character.classId || "archer");
    const finalStats = computeFinalStats(baseStats) || {};
    const computedHpMax = Number.isFinite(finalStats.hpMax) ? finalStats.hpMax : 0;
    const savedHpMax = Number.isFinite(character.hpMax) ? character.hpMax : null;
    const hpMax = savedHpMax !== null ? Math.max(savedHpMax, computedHpMax) : computedHpMax;
    const savedHp = Number.isFinite(character.hp) ? character.hp : null;
    const hp = savedHp !== null ? Math.min(savedHp, hpMax) : hpMax;

    const playerId = getNextPlayerId();
    const player = createPlayer(playerId);
    player.connected = true;
    player.characterId = character.characterId;
    player.accountId = character.accountId || accountId || null;
    player.classId = character.classId || "archer";
    player.displayName = character.name || "Joueur";
    player.level = Number.isInteger(character.level) ? character.level : 1;
    player.baseStats = baseStats || null;
    player.stats = finalStats || null;
    player.hp = Number.isFinite(hp) ? hp : player.hp;
    player.hpMax = Number.isFinite(hpMax) ? hpMax : player.hpMax;
    if (player.stats) {
      player.stats.hp = player.hp;
      player.stats.hpMax = player.hpMax;
    }
    player.pa = Number.isFinite(finalStats.pa) ? finalStats.pa : player.pa;
    player.pm = Number.isFinite(finalStats.pm) ? finalStats.pm : player.pm;
    player.initiative = Number.isFinite(finalStats.initiative)
      ? finalStats.initiative
      : player.initiative;
    player.capturedMonsterId =
      typeof character.capturedMonsterId === "string" ? character.capturedMonsterId : null;
    player.capturedMonsterLevel = Number.isFinite(character.capturedMonsterLevel)
      ? character.capturedMonsterLevel
      : null;
    player.inventory = character.inventory || null;
    player.gold = Number.isFinite(character.gold) ? character.gold : player.gold;
    player.honorPoints = Number.isFinite(character.honorPoints)
      ? character.honorPoints
      : player.honorPoints;
    player.levelState = character.levelState || null;
    player.equipment = character.equipment || null;
    player.trash = character.trash || null;
    player.quests = character.quests || null;
    player.achievements = character.achievements || null;
    player.metiers = character.metiers || null;
    player.spellParchments = character.spellParchments || null;
    player.mapId = character.mapId || state.mapId;
    if (Number.isFinite(character.posX) && Number.isFinite(character.posY)) {
      player.x = character.posX;
      player.y = character.posY;
    }
    state.players[playerId] = player;
    clients.set(ws, {
      id: playerId,
      lastCmdId: 0,
      ready: true,
      lastAckEventId: 0,
      accountId: player.accountId || accountId || null,
      inventoryAuthority,
    });

    if (!getHostId()) {
      setHostId(playerId);
    }

    if (typeof ensureMapInitialized === "function" && player.mapId) {
      ensureMapInitialized(player.mapId);
    }

    tryStartCombatIfNeeded();

    const nextSessionToken =
      typeof issueSessionToken === "function"
        ? issueSessionToken(accountId)
        : null;
    send(ws, {
      t: "EvWelcome",
      eventId: getNextEventId(),
      playerId,
      hostId: getHostId(),
      isHost: playerId === getHostId(),
      protocolVersion: PROTOCOL_VERSION,
      dataHash: GAME_DATA_VERSION,
      sessionToken: nextSessionToken,
      snapshot: snapshotForClient(),
    });

    broadcast({
      t: "EvPlayerJoined",
      mapId: player.mapId || null,
      player,
    });
  }

  function handleCmdCombatResync(clientInfo, msg) {
    if (!clientInfo || !Number.isInteger(clientInfo.id)) return;
    const player = state.players[clientInfo.id];
    if (!player) return;
    const ws = Array.from(clients.entries()).find(([, info]) => info?.id === player.id)?.[0];
    if (!ws) return;
    sendCombatResync(ws, player);
  }

  function handleCmdMove(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    if (!Number.isInteger(msg.toX) || !Number.isInteger(msg.toY)) return;

    const player = state.players[clientInfo.id];
    if (!player) return;
    const seq = Number.isInteger(msg.seq) ? msg.seq : 0;
    const mapId = player.mapId;
    if (msg?.debug === true) {
      // eslint-disable-next-line no-console
      console.log("[LAN] CmdMove", {
        playerId: player.id,
        mapId,
        seq,
        fromX: msg.fromX,
        fromY: msg.fromY,
        toX: msg.toX,
        toY: msg.toY,
      });
    }
    const sendMoveCorrection = (reason, details) => {
      broadcast({
        t: "EvMoveStart",
        seq,
        playerId: player.id,
        mapId,
        fromX: Number.isInteger(player.x) ? player.x : 0,
        fromY: Number.isInteger(player.y) ? player.y : 0,
        toX: Number.isInteger(player.x) ? player.x : 0,
        toY: Number.isInteger(player.y) ? player.y : 0,
        path: [],
        rejected: true,
        reason,
        ...(details || null),
      });
    };

    if (player.inCombat) {
      sendMoveCorrection("in_combat");
      return;
    }
    if (seq <= (player.lastMoveSeq || 0)) {
      if (msg?.debug === true) {
        // eslint-disable-next-line no-console
        console.log("[LAN] CmdMove drop (seq)", {
          playerId: player.id,
          mapId,
          seq,
          lastMoveSeq: player.lastMoveSeq || 0,
        });
      }
      sendMoveCorrection("seq_out_of_order", {
        serverLastMoveSeq: player.lastMoveSeq || 0,
        clientSeq: seq,
      });
      return;
    }
    player.lastMoveSeq = seq;
    player.lastMoveAt = 0;

    const meta = mapId ? state.mapMeta[mapId] : null;
    const blocked = mapId ? state.mapCollisions?.[mapId] : null;
    if (!meta || !Number.isInteger(meta.width) || !Number.isInteger(meta.height)) {
      if (typeof ensureMapInitialized === "function" && mapId) {
        ensureMapInitialized(mapId);
      }
      sendMoveCorrection("map_not_ready");
      return;
    }

    const MAX_PATH_STEPS = 200;
    const MIN_MOVE_MS = 120;
    const now = Date.now();
    const cmdFromX = Number.isInteger(msg.fromX) ? msg.fromX : null;
    const cmdFromY = Number.isInteger(msg.fromY) ? msg.fromY : null;
    if (
      cmdFromX !== null &&
      cmdFromY !== null &&
      cmdFromX >= 0 &&
      cmdFromY >= 0 &&
      cmdFromX < meta.width &&
      cmdFromY < meta.height
    ) {
      const dx = Math.abs(cmdFromX - player.x);
      const dy = Math.abs(cmdFromY - player.y);
      const dist = dx + dy;
      const MAX_DESYNC_TILES = 200;
      if (dist > 0 && dist <= MAX_DESYNC_TILES) {
        player.x = cmdFromX;
        player.y = cmdFromY;
      }
    }

    const prevX = Number.isInteger(player.x) ? player.x : null;
    const prevY = Number.isInteger(player.y) ? player.y : null;
    if (prevX === null || prevY === null) {
      sendMoveCorrection("invalid_position");
      return;
    }

    const from = { x: player.x, y: player.y };
    const targetX = msg.toX;
    const targetY = msg.toY;
    if (
      targetX < 0 ||
      targetY < 0 ||
      targetX >= meta.width ||
      targetY >= meta.height
    ) {
      sendMoveCorrection("out_of_bounds");
      return;
    }
    if (blocked && blocked.has(`${targetX},${targetY}`)) {
      sendMoveCorrection("blocked_target");
      return;
    }

    const serverPath = findPathOnGrid(
      from.x,
      from.y,
      targetX,
      targetY,
      meta,
      blocked,
      true,
      MAX_PATH_STEPS
    );
    if (!serverPath) {
      sendMoveCorrection("no_path");
      return;
    }

    const lastMoveAt = Number.isFinite(player.lastMoveAt) ? player.lastMoveAt : 0;
    if (lastMoveAt && now - lastMoveAt < MIN_MOVE_MS) {
      sendMoveCorrection("rate_limited");
      return;
    }

    player.x = targetX;
    player.y = targetY;
    player.lastMoveAt = now;

    broadcast({
      t: "EvMoveStart",
      seq,
      playerId: player.id,
      mapId,
      fromX: from.x,
      fromY: from.y,
      toX: player.x,
      toY: player.y,
      path: serverPath,
    });
  }

  function handleCmdMapChange(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const mapId = typeof msg.mapId === "string" ? msg.mapId : null;
    if (!mapId) return;

    const player = state.players[clientInfo.id];
    if (!player) return;
    if (player.inCombat) return;

    const fromMapId = player.mapId;
    player.mapId = mapId;

    if (Number.isInteger(msg.tileX) && Number.isInteger(msg.tileY)) {
      player.x = msg.tileX;
      player.y = msg.tileY;
    }
    if (typeof persistPlayerState === "function") {
      persistPlayerState(player);
    }

    broadcast({
      t: "EvPlayerMap",
      playerId: player.id,
      mapId: player.mapId,
      fromMapId: typeof fromMapId === "string" ? fromMapId : null,
      tileX: player.x,
      tileY: player.y,
    });

    ensureMapInitialized(mapId);
  }

  function handleCmdRequestMapPlayers(ws, clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const player = state.players[clientInfo.id];
    if (!player) return;
    const mapId = typeof msg.mapId === "string" ? msg.mapId : null;
    if (!mapId || player.mapId !== mapId) return;
    const list = Object.values(state.players)
      .filter((p) => p && p.connected !== false && p.mapId === mapId)
      .map((p) => ({
        id: p.id,
        mapId: p.mapId,
        x: Number.isFinite(p.x) ? p.x : 0,
        y: Number.isFinite(p.y) ? p.y : 0,
        classId: p.classId || null,
        displayName: p.displayName || null,
        inCombat: p.inCombat === true,
        combatId: Number.isInteger(p.combatId) ? p.combatId : null,
      }));
    send(ws, {
      t: "EvMapPlayers",
      eventId: getNextEventId(),
      mapId,
      players: list,
    });
  }

  function handleCmdPlayerSync(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const player = state.players[clientInfo.id];
    if (!player) return;

    const beforeInventory = player.inventory || null;
    const beforeGold = Number.isFinite(player.gold) ? player.gold : 0;
    const allowInventorySync = clientInfo.inventoryAuthority !== true;
    if (!allowInventorySync) {
      if (msg?.migrateInventory === true) {
        if (player.inventoryMigrated) return;
        if (!isInventoryEmpty(player.inventory)) return;
        const inventory = sanitizeInventorySnapshot(msg.inventory);
        if (!inventory) return;
        player.inventory = inventory;
        if (Number.isFinite(msg.gold)) {
          player.gold = Math.max(0, Math.round(msg.gold));
        }
        player.inventoryMigrated = true;
        if (typeof persistPlayerState === "function") {
          persistPlayerState(player);
        }
        const afterInventory = player.inventory || null;
        const afterGold = Number.isFinite(player.gold) ? player.gold : 0;
        const goldDelta = afterGold - beforeGold;
        const itemDeltas = diffInventory(beforeInventory, afterInventory);
        if (goldDelta !== 0 || itemDeltas.length > 0) {
          logAntiDup({
            ts: Date.now(),
            reason: "InventoryMigration",
            accountId: player.accountId || null,
            characterId: player.characterId || null,
            playerId: player.id || null,
            mapId: player.mapId || null,
            goldDelta,
            itemDeltas: itemDeltas.slice(0, 20),
          });
        }
        const target = findClientByPlayerId(player.id);
        if (target?.ws) {
          sendPlayerSync(target.ws, player, "inventory_migration");
        }
      }
      // Server-authoritative: ignore client snapshots to prevent desync/cheat.
      return;
    }

    const inventory = sanitizeInventorySnapshot(msg.inventory);
    if (inventory) {
      player.inventory = inventory;
    }
    if (Number.isFinite(msg.gold)) {
      player.gold = Math.max(0, Math.round(msg.gold));
    }
    if (Number.isFinite(msg.honorPoints)) {
      player.honorPoints = Math.max(0, Math.round(msg.honorPoints));
    }

    const level = sanitizeLevel(msg.level);
    if (level !== null) {
      player.level = level;
    }

    const baseStats = sanitizeBaseStats(msg.baseStats);
    if (baseStats) {
      player.baseStats = baseStats;
      if (typeof computeFinalStats === "function") {
        const nextStats = computeFinalStats(baseStats);
        if (nextStats) {
          player.stats = nextStats;
          player.hpMax = Number.isFinite(nextStats.hpMax) ? nextStats.hpMax : player.hpMax;
          if (Number.isFinite(player.hp)) {
            player.hp = Math.min(player.hp, player.hpMax);
          } else if (Number.isFinite(nextStats.hp)) {
            player.hp = Math.min(nextStats.hp, player.hpMax);
          }
        }
      }
    }

    const levelState = sanitizeJsonPayload(msg.levelState, 50000);
    if (levelState) {
      player.levelState = levelState;
    }

    const equipment = sanitizeEquipment(msg.equipment);
    if (equipment) {
      player.equipment = equipment;
    }

    const trash = sanitizeJsonPayload(msg.trash, 20000);
    if (trash) {
      player.trash = trash;
    }

    const quests = sanitizeJsonPayload(msg.quests, 80000);
    if (quests) {
      player.quests = quests;
    }

    const achievements = sanitizeJsonPayload(msg.achievements, 60000);
    if (achievements) {
      player.achievements = achievements;
    }

    const metiers = sanitizeJsonPayload(msg.metiers, 60000);
    if (metiers) {
      player.metiers = metiers;
    }

    const spellParchments = sanitizeJsonPayload(msg.spellParchments, 20000);
    if (spellParchments) {
      player.spellParchments = spellParchments;
    }

    if (typeof persistPlayerState === "function") {
      persistPlayerState(player);
    }

    const afterInventory = player.inventory || null;
    const afterGold = Number.isFinite(player.gold) ? player.gold : 0;
    const goldDelta = afterGold - beforeGold;
    const itemDeltas = diffInventory(beforeInventory, afterInventory);
    if (goldDelta !== 0 || itemDeltas.length > 0) {
      logAntiDup({
        ts: Date.now(),
        reason: "CmdPlayerSync",
        accountId: player.accountId || null,
        characterId: player.characterId || null,
        playerId: player.id || null,
        mapId: player.mapId || null,
        goldDelta,
        itemDeltas: itemDeltas.slice(0, 20),
      });
    }
  }

  function handleCmdInventoryOp(ws, clientInfo, msg) {
    const trace = process.env.LAN_TRACE === "1";
    if (clientInfo.id !== msg.playerId) {
      if (trace) {
        // eslint-disable-next-line no-console
        console.log("[LAN][Trace] inventoryOp:reject", "player_mismatch", {
          clientId: clientInfo.id,
          playerId: msg?.playerId ?? null,
        });
      }
      return 0;
    }
    if (!msg || (msg.op !== "add" && msg.op !== "remove")) {
      if (trace) {
        // eslint-disable-next-line no-console
        console.log("[LAN][Trace] inventoryOp:reject", "invalid_op", {
          op: msg?.op ?? null,
        });
      }
      return 0;
    }
    const itemId = typeof msg.itemId === "string" ? msg.itemId : null;
    const qty = Number.isInteger(msg.qty) ? msg.qty : 0;
    if (!itemId || itemId.length > 64 || qty <= 0 || qty > MAX_QTY_PER_OP) {
      if (trace) {
        // eslint-disable-next-line no-console
        console.log("[LAN][Trace] inventoryOp:reject", "invalid_payload", {
          itemId,
          qty,
        });
      }
      return 0;
    }

    const defs = typeof getItemDefs === "function" ? getItemDefs() : null;
    const defsFailed =
      typeof getItemDefsFailed === "function" ? getItemDefsFailed() : false;
    const defsPromise =
      typeof getItemDefsPromise === "function" ? getItemDefsPromise() : null;

    if (!defs && !defsFailed) {
      if (!msg.__itemDefsWaited) {
        msg.__itemDefsWaited = true;
        defsPromise?.then(() => handleCmdInventoryOp(ws, clientInfo, msg));
        return 0;
      }
    }
    if (!defs || defsFailed) {
      if (trace) {
        // eslint-disable-next-line no-console
        console.log("[LAN][Trace] inventoryOp:reject", "itemdefs_unavailable");
      }
      return 0;
    }

    const player = state.players[clientInfo.id];
    if (!player) {
      if (trace) {
        // eslint-disable-next-line no-console
        console.log("[LAN][Trace] inventoryOp:reject", "player_missing");
      }
      return 0;
    }
    const inv = ensurePlayerInventory(player);
    const def = getItemDef(itemId);
    if (!def) {
      if (trace) {
        // eslint-disable-next-line no-console
        console.log("[LAN][Trace] inventoryOp:reject", "item_unknown", {
          itemId,
        });
      }
      return 0;
    }
    const stackable = def.stackable !== false;
    if (!stackable && qty > inv.size) {
      if (trace) {
        // eslint-disable-next-line no-console
        console.log("[LAN][Trace] inventoryOp:reject", "non_stack_overflow", {
          itemId,
          qty,
          invSize: inv.size,
        });
      }
      return 0;
    }
    if (msg.op === "remove") {
      const available = countItemInInventory(inv, itemId);
      if (available < qty) {
        if (trace) {
          // eslint-disable-next-line no-console
          console.log("[LAN][Trace] inventoryOp:reject", "insufficient_qty", {
            itemId,
            qty,
            available,
          });
        }
        return 0;
      }
    }
    const beforeInv = {
      size: inv.size,
      slots: inv.slots.map((slot) =>
        slot && typeof slot.itemId === "string" && Number.isInteger(slot.qty)
          ? { itemId: slot.itemId, qty: slot.qty }
          : null
      ),
      autoGrow: inv.autoGrow ? { ...inv.autoGrow } : null,
    };

    let applied = 0;
    if (msg.op === "add") {
      applied = addItemToInventory(inv, itemId, qty);
    } else {
      applied = removeItemFromInventory(inv, itemId, qty);
    }
    if (applied <= 0) return 0;

    if (typeof persistPlayerState === "function") {
      persistPlayerState(player);
    }

    const deltas = diffInventory(beforeInv, inv);
    logAntiDup({
      ts: Date.now(),
      reason: msg.reason || "CmdInventoryOp",
      accountId: player.accountId || null,
      characterId: player.characterId || null,
      playerId: player.id || null,
      mapId: player.mapId || null,
      op: msg.op,
      itemId,
      qty: applied,
      itemDeltas: deltas.slice(0, 20),
    });

    sendPlayerSync(ws, player, "inventory");
    return applied;
  }

  function handleCmdCraft(ws, clientInfo, msg) {
    const trace = process.env.LAN_TRACE === "1";
    if (clientInfo.id !== msg.playerId) return;
    const metierId = typeof msg.metierId === "string" ? msg.metierId : null;
    const recipeId = typeof msg.recipeId === "string" ? msg.recipeId : null;
    if (!metierId || !recipeId) return;

    const recipe =
      typeof getCraftRecipe === "function" ? getCraftRecipe(metierId, recipeId) : null;
    const defsFailed =
      typeof getCraftDefsFailed === "function" ? getCraftDefsFailed() : false;
    const defsPromise =
      typeof getCraftDefsPromise === "function" ? getCraftDefsPromise() : null;
    if (!recipe && !defsFailed) {
      if (!msg.__craftDefsWaited) {
        msg.__craftDefsWaited = true;
        defsPromise?.then(() => handleCmdCraft(ws, clientInfo, msg));
        return;
      }
    }
    if (!recipe) {
      if (trace) {
        // eslint-disable-next-line no-console
        console.log("[LAN][Trace] craft:reject", "recipe_missing", {
          metierId,
          recipeId,
        });
      }
      return;
    }

    const player = state.players[clientInfo.id];
    if (!player) return;
    const inv = ensurePlayerInventory(player);
    if (!inv) return;

    const inputs = Array.isArray(recipe.inputs) ? recipe.inputs : [];
    const output = recipe.output || null;
    const outItemId = typeof output?.itemId === "string" ? output.itemId : null;
    const outQty = Number.isInteger(output?.qty) ? output.qty : 0;
    if (!outItemId || outQty <= 0) return;

    const itemDefs = typeof getItemDefs === "function" ? getItemDefs() : null;
    if (!itemDefs || !itemDefs[outItemId]) {
      if (trace) {
        // eslint-disable-next-line no-console
        console.log("[LAN][Trace] craft:reject", "output_unknown", {
          outItemId,
        });
      }
      return;
    }
    const badInput = inputs.some(
      (entry) =>
        !entry ||
        typeof entry.itemId !== "string" ||
        !Number.isInteger(entry.qty) ||
        entry.qty <= 0 ||
        !itemDefs?.[entry.itemId]
    );
    if (badInput) return;

    const metierState = ensureMetierState(player, metierId);
    const requiredLevel =
      Number.isInteger(recipe.level) && recipe.level > 0 ? recipe.level : 1;
    if (!metierState || metierState.level < requiredLevel) {
      if (trace) {
        // eslint-disable-next-line no-console
        console.log("[LAN][Trace] craft:reject", "level_too_low", {
          metierId,
          level: metierState?.level ?? null,
          requiredLevel,
        });
      }
      return;
    }

    const hasAllInputs = inputs.every(
      (entry) => countItemInInventory(inv, entry.itemId) >= entry.qty
    );
    if (!hasAllInputs) {
      if (trace) {
        // eslint-disable-next-line no-console
        console.log("[LAN][Trace] craft:reject", "missing_inputs", {
          metierId,
          recipeId,
        });
      }
      return;
    }

    const beforeInv = snapshotInventory(inv);
    inputs.forEach((entry) => {
      removeItemFromInventory(inv, entry.itemId, entry.qty);
    });
    const added = addItemToInventory(inv, outItemId, outQty);
    if (added < outQty) {
      restoreInventory(inv, beforeInv);
      return;
    }

    const xpGain =
      Number.isFinite(recipe.xpGain) && recipe.xpGain > 0 ? recipe.xpGain : 0;
    if (xpGain > 0) {
      addMetierXp(player, metierId, xpGain);
    }

    if (typeof persistPlayerState === "function") {
      persistPlayerState(player);
    }

    const deltas = diffInventory(beforeInv, inv);
    logAntiDup({
      ts: Date.now(),
      reason: "Craft",
      accountId: player.accountId || null,
      characterId: player.characterId || null,
      playerId: player.id || null,
      mapId: player.mapId || null,
      op: "craft",
      itemId: outItemId,
      qty: outQty,
      itemDeltas: deltas.slice(0, 20),
    });

    sendPlayerSync(ws, player, "craft");
    if (incrementCraftProgressForPlayer(player, outItemId, outQty)) {
      if (typeof persistPlayerState === "function") {
        persistPlayerState(player);
      }
      sendQuestSync(player, "quest_craft");
    }
    send(ws, {
      t: "EvCraftCompleted",
      eventId: getNextEventId(),
      playerId: player.id,
      metierId,
      recipeId,
      itemId: outItemId,
      qty: outQty,
      xpGain,
    });
  }

  function applyQuestKillProgressForPlayer(playerId, monsterId, count = 1) {
    const player = state.players[playerId];
    if (!player) return;
    if (incrementKillProgressForPlayer(player, monsterId, count)) {
      if (typeof persistPlayerState === "function") {
        persistPlayerState(player);
      }
      sendQuestSync(player, "quest_kill");
    }
  }

  function handleCmdQuestAction(ws, clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const action = typeof msg.action === "string" ? msg.action : null;
    const questId = typeof msg.questId === "string" ? msg.questId : null;
    if (!action || !questId) return;

    const defs = getQuestDefsSafe();
    const defsFailed =
      typeof getQuestDefsFailed === "function" ? getQuestDefsFailed() : false;
    const defsPromise =
      typeof getQuestDefsPromise === "function" ? getQuestDefsPromise() : null;
    if (!defs && !defsFailed) {
      if (!msg.__questDefsWaited) {
        msg.__questDefsWaited = true;
        defsPromise?.then(() => handleCmdQuestAction(ws, clientInfo, msg));
      }
      return;
    }
    if (!defs || defsFailed) return;

    const player = state.players[clientInfo.id];
    if (!player) return;
    const questDef = getQuestDef(questId);
    if (!questDef) return;

    const npcId = typeof msg.npcId === "string" ? msg.npcId : null;
    const stageId = typeof msg.stageId === "string" ? msg.stageId : null;
    let changed = false;

    if (action === "accept") {
      changed = handleQuestActionAccept(player, questDef, npcId);
    } else if (action === "turn_in") {
      changed = handleQuestActionTurnIn(player, questDef, npcId, stageId).ok;
    } else if (action === "advance_many") {
      const count = Number.isInteger(msg.count) ? msg.count : 0;
      const state = getQuestState(player, questDef.id, { create: false });
      const stage = getCurrentQuestStage(questDef, state);
      if (
        count > 0 &&
        state &&
        stage &&
        stageId &&
        stage.id === stageId &&
        questDef.id === "alchimiste_marchand_3" &&
        stage.id === "meet_maire_marchand"
      ) {
        const maxAdvance = Math.min(
          count,
          Math.max(0, questDef.stages.length - (state.stageIndex || 0))
        );
        for (let i = 0; i < maxAdvance; i += 1) {
          advanceQuestStage(player, questDef, state);
        }
        changed = true;
      }
    }

    if (changed) {
      if (typeof persistPlayerState === "function") {
        persistPlayerState(player);
      }
      sendQuestSync(player, "quest_action");
    }
  }

  function handleCmdGoldOp(ws, clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const delta = Number.isFinite(msg.delta) ? Math.round(msg.delta) : 0;
    if (!delta || Math.abs(delta) > MAX_GOLD_DELTA) return;
    const player = state.players[clientInfo.id];
    if (!player) return;
    const beforeGold = Number.isFinite(player.gold) ? player.gold : 0;
    const nextGold = Math.max(0, beforeGold + delta);
    if (nextGold === beforeGold) return;
    player.gold = nextGold;

    if (typeof persistPlayerState === "function") {
      persistPlayerState(player);
    }

    logAntiDup({
      ts: Date.now(),
      reason: msg.reason || "CmdGoldOp",
      accountId: player.accountId || null,
      characterId: player.characterId || null,
      playerId: player.id || null,
      mapId: player.mapId || null,
      goldDelta: nextGold - beforeGold,
    });

    sendPlayerSync(ws, player, "gold");
  }

  function handleCmdEndTurn(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    if (state.combat.activeId !== msg.playerId) return;

    const playerIds = Object.keys(state.players).map((id) => Number(id));
    if (playerIds.length === 0) return;

    const currentIndex = playerIds.indexOf(state.combat.activeId);
    const nextIndex = (currentIndex + 1) % playerIds.length;
    const nextId = playerIds[nextIndex];

    broadcast({ t: "EvTurnEnded", playerId: state.combat.activeId });
    state.combat.activeId = nextId;
    state.combat.turnIndex += 1;
    broadcast({ t: "EvTurnStarted", playerId: nextId });
  }

  return {
    handleHello,
    handleCmdMove,
    handleCmdMapChange,
    handleCmdEndTurn,
    handleCmdCombatResync,
    handleCmdRequestMapPlayers,
    handleCmdPlayerSync,
    handleCmdInventoryOp,
    handleCmdCraft,
    handleCmdGoldOp,
    handleCmdQuestAction,
    applyInventoryOpFromServer,
    applyQuestKillProgressForPlayer,
    applyCombatRewardsForPlayer,
  };
}

module.exports = {
  createPlayerHandlers,
};
