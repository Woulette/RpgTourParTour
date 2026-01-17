function createInventoryHandlers({
  state,
  send,
  persistPlayerState,
  getItemDefs,
  getItemDefsPromise,
  getItemDefsFailed,
  helpers,
  sync,
  computeFinalStats,
  MAX_QTY_PER_OP,
}) {
  const {
    ensurePlayerInventory,
    getItemDef,
    countItemInInventory,
    addItemToInventory,
    removeItemFromInventory,
    diffInventory,
    logAntiDup,
  } = helpers;
  const { sendPlayerSync, findClientByPlayerId } = sync;
  const EQUIP_SLOTS = [
    "head",
    "cape",
    "amulet",
    "weapon",
    "ring1",
    "ring2",
    "belt",
    "boots",
  ];
  const TRASH_TTL_MS = 24 * 60 * 60 * 1000;

  function ensureEquipmentSlots(player) {
    if (!player.equipment || typeof player.equipment !== "object") {
      player.equipment = {};
    }
    EQUIP_SLOTS.forEach((slot) => {
      if (!(slot in player.equipment)) {
        player.equipment[slot] = null;
      }
    });
    return player.equipment;
  }

  function ensureTrashContainer(player, size = 50) {
    if (!player.trash || !Array.isArray(player.trash.slots)) {
      const safeSize = Number.isFinite(size) && size > 0 ? size : 50;
      player.trash = { size: safeSize, slots: new Array(safeSize).fill(null) };
      return player.trash;
    }
    const desiredSize = Number.isFinite(size) && size > 0 ? size : player.trash.size;
    if (!Number.isFinite(player.trash.size) || player.trash.size <= 0) {
      player.trash.size = player.trash.slots.length || desiredSize || 50;
    }
    if (Number.isFinite(desiredSize) && desiredSize > player.trash.size) {
      player.trash.size = desiredSize;
    }
    if (player.trash.slots.length > player.trash.size) {
      player.trash.slots = player.trash.slots.slice(0, player.trash.size);
    }
    while (player.trash.slots.length < player.trash.size) {
      player.trash.slots.push(null);
    }
    return player.trash;
  }

  function purgeExpiredTrash(container, now = Date.now()) {
    if (!container || !Array.isArray(container.slots)) return 0;
    let removed = 0;
    for (let i = 0; i < container.size; i += 1) {
      const slot = container.slots[i];
      if (!slot) continue;
      if (typeof slot.expiresAt === "number" && slot.expiresAt <= now) {
        container.slots[i] = null;
        removed += 1;
      }
    }
    return removed;
  }

  function findEmptyTrashSlot(container) {
    for (let i = 0; i < container.size; i += 1) {
      if (!container.slots[i]) return i;
    }
    return -1;
  }

  function canAddItemToTrash(container, itemId, qty) {
    if (!container || !Array.isArray(container.slots) || !itemId || qty <= 0) {
      return false;
    }
    const def = getItemDef(itemId);
    if (!def) return false;
    const maxStack = def.maxStack ?? 9999;
    let remaining = qty;

    if (def.stackable) {
      for (let i = 0; i < container.size; i += 1) {
        const slot = container.slots[i];
        if (!slot || slot.itemId !== itemId) continue;
        if (slot.qty < maxStack) {
          remaining -= Math.min(maxStack - slot.qty, remaining);
          if (remaining <= 0) return true;
        }
      }
    }

    const emptySlots = container.slots.filter((slot) => !slot).length;
    if (def.stackable) {
      return emptySlots * maxStack >= remaining;
    }
    return emptySlots >= remaining;
  }

  function addItemToTrash(container, itemId, qty, now = Date.now()) {
    if (!container || !Array.isArray(container.slots) || !itemId || qty <= 0) {
      return qty;
    }
    purgeExpiredTrash(container, now);
    const def = getItemDef(itemId);
    if (!def) return qty;
    const maxStack = def.maxStack ?? 9999;
    const expiresAt = now + TRASH_TTL_MS;
    let remaining = qty;

    if (def.stackable) {
      for (let i = 0; i < container.size; i += 1) {
        const slot = container.slots[i];
        if (!slot || slot.itemId !== itemId) continue;
        if (slot.qty >= maxStack) continue;
        const addNow = Math.min(maxStack - slot.qty, remaining);
        slot.qty += addNow;
        slot.expiresAt = Math.max(slot.expiresAt || 0, expiresAt);
        remaining -= addNow;
        if (remaining <= 0) break;
      }
    }

    while (remaining > 0) {
      const idx = findEmptyTrashSlot(container);
      if (idx === -1) break;
      const addNow = def.stackable ? Math.min(maxStack, remaining) : 1;
      container.slots[idx] = { itemId, qty: addNow, expiresAt };
      remaining -= addNow;
      if (!def.stackable && remaining <= 0) break;
    }
    return remaining;
  }

  function removeTrashSlot(container, slotIndex) {
    if (!container || !Array.isArray(container.slots)) return null;
    if (!Number.isFinite(slotIndex)) return null;
    if (slotIndex < 0 || slotIndex >= container.size) return null;
    const slot = container.slots[slotIndex];
    if (!slot) return null;
    container.slots[slotIndex] = null;
    return slot;
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
    if (msg.__server !== true) {
      if (trace) {
        // eslint-disable-next-line no-console
        console.log("[LAN][Trace] inventoryOp:reject", "client_blocked", {
          playerId: msg?.playerId ?? null,
          op: msg?.op ?? null,
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
    if (Number.isInteger(player.tradeId)) {
      if (trace) {
        // eslint-disable-next-line no-console
        console.log("[LAN][Trace] inventoryOp:reject", "trade_locked");
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

  function applyInventoryOpFromServer(playerId, op, itemId, qty, reason) {
    if (!Number.isInteger(playerId)) return 0;
    const target = findClientByPlayerId(playerId);
    const msg = {
      __server: true,
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

  function handleCmdEquipItem(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return false;
    const player = state.players[clientInfo.id];
    if (!player) return false;
    if (Number.isInteger(player.tradeId)) return false;
    const inv = ensurePlayerInventory(player);
    const slotIndex = Number.isInteger(msg.inventorySlotIndex)
      ? msg.inventorySlotIndex
      : null;
    if (slotIndex === null || slotIndex < 0 || slotIndex >= inv.size) return false;
    const slot = inv.slots[slotIndex];
    if (!slot || !slot.itemId) return false;
    const def = getItemDef(slot.itemId);
    if (!def || def.category !== "equipement") return false;
    const playerLevel = Number.isFinite(player.levelState?.niveau)
      ? Math.round(player.levelState.niveau)
      : Number.isFinite(player.level)
        ? Math.round(player.level)
        : 1;
    const requiredLevel =
      typeof def.requiredLevel === "number" ? def.requiredLevel : 1;
    if (playerLevel < requiredLevel) return false;
    const equipSlot = def.slot;
    if (!equipSlot) return false;

    const equipment = ensureEquipmentSlots(player);
    const currentEquip = equipment[equipSlot];

    const removed = removeItemFromInventory(inv, slot.itemId, 1);
    if (removed <= 0) return false;

    if (currentEquip && currentEquip.itemId) {
      const added = addItemToInventory(inv, currentEquip.itemId, 1);
      if (added <= 0) {
        addItemToInventory(inv, slot.itemId, 1);
        return false;
      }
    }

    equipment[equipSlot] = { itemId: slot.itemId };

    if (typeof computeFinalStats === "function" && player.baseStats) {
      const nextStats = computeFinalStats(player.baseStats, player.equipment);
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

    if (typeof persistPlayerState === "function") {
      persistPlayerState(player);
    }
    const target = findClientByPlayerId(player.id);
    if (target?.ws) {
      sendPlayerSync(target.ws, player, "equipment");
    }
    return true;
  }

  function handleCmdUnequipItem(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return false;
    const player = state.players[clientInfo.id];
    if (!player) return false;
    if (Number.isInteger(player.tradeId)) return false;
    const inv = ensurePlayerInventory(player);
    const equipSlot = typeof msg.equipSlot === "string" ? msg.equipSlot : null;
    if (!equipSlot) return false;

    const equipment = ensureEquipmentSlots(player);
    const currentEquip = equipment[equipSlot];
    if (!currentEquip || !currentEquip.itemId) return false;

    const added = addItemToInventory(inv, currentEquip.itemId, 1);
    if (added <= 0) return false;

    equipment[equipSlot] = null;

    if (typeof computeFinalStats === "function" && player.baseStats) {
      const nextStats = computeFinalStats(player.baseStats, player.equipment);
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

    if (typeof persistPlayerState === "function") {
      persistPlayerState(player);
    }
    const target = findClientByPlayerId(player.id);
    if (target?.ws) {
      sendPlayerSync(target.ws, player, "equipment");
    }
    return true;
  }

  function handleCmdUseItem(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return false;
    const player = state.players[clientInfo.id];
    if (!player || player.inCombat) return false;
    if (Number.isInteger(player.tradeId)) return false;
    const inv = ensurePlayerInventory(player);
    const slotIndex = Number.isInteger(msg.inventorySlotIndex)
      ? msg.inventorySlotIndex
      : null;
    if (slotIndex === null || slotIndex < 0 || slotIndex >= inv.size) return false;
    const slot = inv.slots[slotIndex];
    if (!slot || !slot.itemId) return false;
    const def = getItemDef(slot.itemId);
    if (!def || def.category !== "consommable") return false;
    const effect = def.effect || null;
    if (!effect || typeof effect !== "object") return false;

    const removed = removeItemFromInventory(inv, slot.itemId, 1);
    if (removed <= 0) return false;

    let didApply = false;
    const hpMax =
      Number.isFinite(player.hpMax)
        ? player.hpMax
        : Number.isFinite(player.stats?.hpMax)
          ? player.stats.hpMax
          : 0;
    const currentHp =
      Number.isFinite(player.hp)
        ? player.hp
        : Number.isFinite(player.stats?.hp)
          ? player.stats.hp
          : hpMax;

    if (typeof effect.hpPlus === "number" && effect.hpPlus !== 0) {
      const nextHp = Math.min(hpMax, currentHp + effect.hpPlus);
      player.hp = nextHp;
      if (player.stats) {
        player.stats.hp = nextHp;
        if (Number.isFinite(hpMax)) player.stats.hpMax = hpMax;
      }
      didApply = true;
    }
    if (typeof effect.paPlus === "number" && effect.paPlus !== 0) {
      if (player.stats) {
        player.stats.pa = (player.stats.pa ?? 0) + effect.paPlus;
      }
      didApply = true;
    }
    if (typeof effect.pmPlus === "number" && effect.pmPlus !== 0) {
      if (player.stats) {
        player.stats.pm = (player.stats.pm ?? 0) + effect.pmPlus;
      }
      didApply = true;
    }

    if (!didApply) {
      addItemToInventory(inv, slot.itemId, 1);
      return false;
    }

    if (typeof persistPlayerState === "function") {
      persistPlayerState(player);
    }
    const target = findClientByPlayerId(player.id);
    if (target?.ws) {
      sendPlayerSync(target.ws, player, "consumable");
    }
    return true;
  }

  function handleCmdConsumeItem(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return false;
    const player = state.players[clientInfo.id];
    if (!player || player.inCombat) return false;
    if (Number.isInteger(player.tradeId)) return false;
    const itemId = typeof msg.itemId === "string" ? msg.itemId : null;
    const qty = Number.isInteger(msg.qty) ? msg.qty : 1;
    if (!itemId || qty <= 0 || qty > MAX_QTY_PER_OP) return false;

    const inv = ensurePlayerInventory(player);
    const available = countItemInInventory(inv, itemId);
    if (available < qty) return false;
    const removed = removeItemFromInventory(inv, itemId, qty);
    if (removed < qty) return false;

    if (typeof persistPlayerState === "function") {
      persistPlayerState(player);
    }
    const target = findClientByPlayerId(player.id);
    if (target?.ws) {
      sendPlayerSync(target.ws, player, "consume");
    }
    return true;
  }

  function handleCmdTrashItem(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return false;
    const player = state.players[clientInfo.id];
    if (!player) return false;
    const inv = ensurePlayerInventory(player);
    const slotIndex = Number.isInteger(msg.inventorySlotIndex)
      ? msg.inventorySlotIndex
      : null;
    const qty = Number.isInteger(msg.qty) ? msg.qty : 0;
    if (slotIndex === null || slotIndex < 0 || slotIndex >= inv.size) return false;
    if (qty <= 0 || qty > MAX_QTY_PER_OP) return false;
    const slot = inv.slots[slotIndex];
    if (!slot || !slot.itemId) return false;
    const removeQty = Math.min(slot.qty ?? 0, qty);
    if (removeQty <= 0) return false;

    const trash = ensureTrashContainer(player, inv.size);
    purgeExpiredTrash(trash);
    if (!canAddItemToTrash(trash, slot.itemId, removeQty)) return false;

    const removed = removeItemFromInventory(inv, slot.itemId, removeQty);
    if (removed <= 0) return false;
    addItemToTrash(trash, slot.itemId, removed);

    if (typeof persistPlayerState === "function") {
      persistPlayerState(player);
    }
    const target = findClientByPlayerId(player.id);
    if (target?.ws) {
      sendPlayerSync(target.ws, player, "trash");
    }
    return true;
  }

  function handleCmdTrashRestore(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return false;
    const player = state.players[clientInfo.id];
    if (!player) return false;
    const inv = ensurePlayerInventory(player);
    const slotIndex = Number.isInteger(msg.trashSlotIndex)
      ? msg.trashSlotIndex
      : null;
    if (slotIndex === null) return false;

    const trash = ensureTrashContainer(player, inv.size);
    purgeExpiredTrash(trash);
    const movedSlot = removeTrashSlot(trash, slotIndex);
    if (!movedSlot) return false;
    const remaining = addItemToInventory(inv, movedSlot.itemId, movedSlot.qty ?? 1);
    if (remaining > 0) {
      trash.slots[slotIndex] = {
        itemId: movedSlot.itemId,
        qty: remaining,
        expiresAt: movedSlot.expiresAt,
      };
    }

    if (typeof persistPlayerState === "function") {
      persistPlayerState(player);
    }
    const target = findClientByPlayerId(player.id);
    if (target?.ws) {
      sendPlayerSync(target.ws, player, "trash");
    }
    return true;
  }

  return {
    handleCmdInventoryOp,
    handleCmdEquipItem,
    handleCmdUnequipItem,
    handleCmdUseItem,
    handleCmdConsumeItem,
    handleCmdTrashItem,
    handleCmdTrashRestore,
    applyInventoryOpFromServer,
  };
}

module.exports = {
  createInventoryHandlers,
};
