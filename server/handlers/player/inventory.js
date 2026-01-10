function createInventoryHandlers({
  state,
  send,
  persistPlayerState,
  getItemDefs,
  getItemDefsPromise,
  getItemDefsFailed,
  helpers,
  sync,
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

  return {
    handleCmdInventoryOp,
    applyInventoryOpFromServer,
  };
}

module.exports = {
  createInventoryHandlers,
};
