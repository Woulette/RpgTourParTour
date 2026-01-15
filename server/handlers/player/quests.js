function createQuestHandlers({
  state,
  persistPlayerState,
  getQuestDefs,
  getQuestDefsPromise,
  getQuestDefsFailed,
  getQuestStates,
  getLevelApi,
  getMonsterDef,
  computeFinalStats,
  helpers,
  sync,
}) {
  const {
    ensurePlayerInventory,
    snapshotInventory,
    restoreInventory,
    addItemToInventory,
    removeItemFromInventory,
    countItemInInventory,
    diffInventory,
    logAntiDup,
  } = helpers;
  const { sendPlayerSync, findClientByPlayerId } = sync;

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
    if (!stage) return null;
    if (typeof stage.turnInNpcId === "string") return stage.turnInNpcId;
    if (typeof stage.npcId === "string") return stage.npcId;
    return null;
  }

  function isTurnInReadyAtNpc(player, questDef, state, stage, npcId) {
    if (!player || !questDef || !state || !stage) return false;
    const expectedNpc = getTurnInNpcId(stage);
    if (expectedNpc && npcId && expectedNpc !== npcId) return false;
    const objective = stage.objective;
    if (!objective) return true;

    const type = objective.type;
    if (type === "kill") {
      const targetCount = Number.isInteger(objective.count) ? objective.count : 1;
      const current = Number.isInteger(state.progress?.currentCount)
        ? state.progress.currentCount
        : 0;
      return current >= targetCount;
    }
    if (type === "deliver") {
      const itemId = typeof objective.itemId === "string" ? objective.itemId : null;
      const count = Number.isInteger(objective.count) ? objective.count : 1;
      if (!itemId) return false;
      const available = countItemInInventory(player.inventory, itemId);
      return available >= count;
    }
    if (type === "craft") {
      const itemId = typeof objective.itemId === "string" ? objective.itemId : null;
      const count = Number.isInteger(objective.count) ? objective.count : 1;
      if (!itemId) return false;
      return getCraftedCount(player, state, itemId) >= count;
    }
    if (type === "apply_parchment") {
      return hasAppliedParchment(player, state);
    }
    return true;
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
        const nextStats = computeFinalStats(player.baseStats, player.equipment);
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
    if (!player || !monsterId || count <= 0) return false;
    if (!player.quests) return false;
    let changed = false;
    Object.entries(player.quests).forEach(([questId, state]) => {
      if (!state || state.state !== QUEST_STATES.IN_PROGRESS) return;
      const questDef = getQuestDef(questId);
      if (!questDef) return;
      const stage = getCurrentQuestStage(questDef, state);
      if (!stage || stage.objective?.type !== "kill") return;
      if (!isMonsterObjectiveMatch(stage.objective, monsterId)) return;
      const max = Number.isInteger(stage.objective.count) ? stage.objective.count : 1;
      const prev = Number.isInteger(state.progress?.currentCount)
        ? state.progress.currentCount
        : 0;
      const next = Math.min(prev + count, max);
      if (next !== prev) {
        if (!state.progress) state.progress = {};
        state.progress.currentCount = next;
        changed = true;
        if (next >= max) {
          advanceQuestStage(player, questDef, state);
        }
      }
    });
    return changed;
  }

  function incrementCraftProgressForPlayer(player, itemId, qty = 1) {
    if (!player || !itemId || qty <= 0) return false;
    if (!player.quests) return false;
    let changed = false;
    Object.entries(player.quests).forEach(([questId, state]) => {
      if (!state || state.state !== QUEST_STATES.IN_PROGRESS) return;
      const questDef = getQuestDef(questId);
      if (!questDef) return;
      const stage = getCurrentQuestStage(questDef, state);
      if (!stage || stage.objective?.type !== "craft") return;
      if (stage.objective.itemId !== itemId) return;
      const max = Number.isInteger(stage.objective.count) ? stage.objective.count : 1;
      const crafted = state.progress?.crafted || {};
      const prev = Number.isInteger(crafted[itemId]) ? crafted[itemId] : 0;
      const next = Math.min(prev + qty, max);
      if (!state.progress) state.progress = {};
      if (!state.progress.crafted) state.progress.crafted = {};
      if (next !== prev) {
        state.progress.crafted[itemId] = next;
        changed = true;
        if (next >= max) {
          advanceQuestStage(player, questDef, state);
        }
      }
    });
    return changed;
  }

  function handleQuestActionAccept(player, questDef, npcId) {
    if (!player || !questDef) return false;
    if (!canAcceptQuest(player, questDef)) return false;
    const state = getQuestState(player, questDef.id, { create: true });
    if (!state) return false;
    state.state = QUEST_STATES.IN_PROGRESS;
    state.stageIndex = 0;
    resetQuestProgress(state);
    const stage = getCurrentQuestStage(questDef, state);
    if (!stage) return true;
    if (npcId && stage.npcId && stage.npcId !== npcId) return false;
    applyQuestStageHook(player, questDef.id, stage.id, "onStart");
    return true;
  }

  function handleQuestActionTurnIn(player, questDef, npcId, stageId) {
    if (!player || !questDef) return { ok: false };
    const state = getQuestState(player, questDef.id, { create: false });
    if (!state || state.state !== QUEST_STATES.IN_PROGRESS) return { ok: false };
    const stage = getCurrentQuestStage(questDef, state);
    if (!stage) return { ok: false };
    if (stageId && stage.id !== stageId) return { ok: false };
    if (!isTurnInReadyAtNpc(player, questDef, state, stage, npcId)) return { ok: false };

    if (stage.objective?.type === "deliver") {
      const itemId = typeof stage.objective.itemId === "string" ? stage.objective.itemId : null;
      const count = Number.isInteger(stage.objective.count) ? stage.objective.count : 1;
      if (!itemId) return { ok: false };
      const inv = ensurePlayerInventory(player);
      const beforeInv = snapshotInventory(inv);
      const removed = removeItemFromInventory(inv, itemId, count);
      if (removed < count) {
        restoreInventory(inv, beforeInv);
        return { ok: false };
      }
      const deltas = diffInventory(beforeInv, inv);
      logAntiDup({
        ts: Date.now(),
        reason: "QuestTurnIn",
        accountId: player.accountId || null,
        characterId: player.characterId || null,
        playerId: player.id || null,
        mapId: player.mapId || null,
        op: "remove",
        itemId,
        qty: count,
        itemDeltas: deltas.slice(0, 20),
      });
    }

    advanceQuestStage(player, questDef, state);
    return { ok: true };
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

  return {
    sendQuestSync,
    incrementCraftProgressForPlayer,
    applyCombatRewardsForPlayer,
    applyQuestKillProgressForPlayer,
    handleCmdQuestAction,
  };
}

module.exports = {
  createQuestHandlers,
};
