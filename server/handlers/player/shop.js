function createShopHandlers({
  state,
  persistPlayerState,
  helpers,
  sync,
  getShopDefs,
  getShopDefsPromise,
  getShopDefsFailed,
  MAX_QTY_PER_OP,
  MAX_GOLD_DELTA,
}) {
  const {
    ensurePlayerInventory,
    addItemToInventory,
    removeItemFromInventory,
    logAntiDup,
  } = helpers;
  const { sendPlayerSync, findClientByPlayerId } = sync;

  function resolveShopDefs(msg, handler, clientInfo) {
    const defs = typeof getShopDefs === "function" ? getShopDefs() : null;
    const defsFailed =
      typeof getShopDefsFailed === "function" ? getShopDefsFailed() : false;
    const defsPromise =
      typeof getShopDefsPromise === "function" ? getShopDefsPromise() : null;

    if (!defs && !defsFailed) {
      if (!msg.__shopDefsWaited) {
        msg.__shopDefsWaited = true;
        defsPromise?.then(() => handler(clientInfo, msg));
      }
      return null;
    }
    if (!defs || defsFailed) return null;
    return defs;
  }

  function handleCmdShopBuy(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return false;
    const player = state.players[clientInfo.id];
    if (!player || player.inCombat) return false;

    const shopId = typeof msg.shopId === "string" ? msg.shopId : null;
    const itemId = typeof msg.itemId === "string" ? msg.itemId : null;
    const qty = Number.isInteger(msg.qty) ? msg.qty : 1;
    if (!shopId || !itemId || qty <= 0 || qty > MAX_QTY_PER_OP) return false;

    const defs = resolveShopDefs(msg, handleCmdShopBuy, clientInfo);
    if (!defs) return false;
    const shop = defs[shopId];
    if (!shop || !Array.isArray(shop.sells)) return false;
    const entry = shop.sells.find((it) => it && it.itemId === itemId) || null;
    const price = Number.isFinite(entry?.price) ? Math.round(entry.price) : 0;
    if (price <= 0) return false;

    const total = price * qty;
    if (!Number.isFinite(total) || total <= 0 || total > MAX_GOLD_DELTA) return false;
    const currentGold = Number.isFinite(player.gold) ? player.gold : 0;
    if (currentGold < total) return false;

    const inv = ensurePlayerInventory(player);
    const added = addItemToInventory(inv, itemId, qty);
    if (added < qty) {
      if (added > 0) {
        removeItemFromInventory(inv, itemId, added);
      }
      return false;
    }

    const beforeGold = currentGold;
    player.gold = Math.max(0, beforeGold - total);

    if (typeof persistPlayerState === "function") {
      persistPlayerState(player);
    }
    logAntiDup({
      ts: Date.now(),
      reason: "shop_buy",
      accountId: player.accountId || null,
      characterId: player.characterId || null,
      playerId: player.id || null,
      mapId: player.mapId || null,
      itemId,
      qty,
      goldDelta: player.gold - beforeGold,
    });
    const target = findClientByPlayerId(player.id);
    if (target?.ws) {
      sendPlayerSync(target.ws, player, "shop");
    }
    return true;
  }

  function handleCmdShopSell(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return false;
    const player = state.players[clientInfo.id];
    if (!player || player.inCombat) return false;

    const shopId = typeof msg.shopId === "string" ? msg.shopId : null;
    const itemId = typeof msg.itemId === "string" ? msg.itemId : null;
    const qty = Number.isInteger(msg.qty) ? msg.qty : 1;
    if (!shopId || !itemId || qty <= 0 || qty > MAX_QTY_PER_OP) return false;

    const defs = resolveShopDefs(msg, handleCmdShopSell, clientInfo);
    if (!defs) return false;
    const shop = defs[shopId];
    if (!shop || !Array.isArray(shop.buys)) return false;
    const entry = shop.buys.find((it) => it && it.itemId === itemId) || null;
    const price = Number.isFinite(entry?.price) ? Math.round(entry.price) : 0;
    if (price <= 0) return false;

    const inv = ensurePlayerInventory(player);
    const removed = removeItemFromInventory(inv, itemId, qty);
    if (removed < qty) {
      if (removed > 0) {
        addItemToInventory(inv, itemId, removed);
      }
      return false;
    }

    const total = price * qty;
    if (!Number.isFinite(total) || total <= 0 || total > MAX_GOLD_DELTA) {
      addItemToInventory(inv, itemId, qty);
      return false;
    }

    const beforeGold = Number.isFinite(player.gold) ? player.gold : 0;
    player.gold = Math.max(0, beforeGold + total);

    if (typeof persistPlayerState === "function") {
      persistPlayerState(player);
    }
    logAntiDup({
      ts: Date.now(),
      reason: "shop_sell",
      accountId: player.accountId || null,
      characterId: player.characterId || null,
      playerId: player.id || null,
      mapId: player.mapId || null,
      itemId,
      qty,
      goldDelta: player.gold - beforeGold,
    });
    const target = findClientByPlayerId(player.id);
    if (target?.ws) {
      sendPlayerSync(target.ws, player, "shop");
    }
    return true;
  }

  return {
    handleCmdShopBuy,
    handleCmdShopSell,
  };
}

module.exports = {
  createShopHandlers,
};
