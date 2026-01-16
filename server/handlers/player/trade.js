function createTradeHandlers({
  state,
  sendToPlayerId,
  getNextEventId,
  getNextTradeId,
  persistPlayerState,
  helpers,
  sync,
  getItemDefs,
  getItemDefsPromise,
  getItemDefsFailed,
  MAX_TRADE_GOLD,
}) {
  const {
    ensurePlayerInventory,
    getItemDef,
    countItemInInventory,
    addItemToInventory,
    removeItemFromInventory,
  } = helpers;
  const { sendPlayerSync, findClientByPlayerId } = sync;

  const allowedCategories = new Set(["equipement", "ressource", "consommable"]);

  function sendTradeError(playerId, reason, message) {
    sendToPlayerId(playerId, {
      t: "EvTradeError",
      eventId: getNextEventId(),
      reason,
      message,
    });
  }

  function serializeOffer(offer) {
    const items = [];
    if (offer?.items) {
      Object.entries(offer.items).forEach(([itemId, qty]) => {
        if (!itemId || !Number.isFinite(qty) || qty <= 0) return;
        items.push({ itemId, qty: Math.round(qty) });
      });
    }
    return {
      items,
      gold: Number.isFinite(offer?.gold) ? Math.max(0, Math.round(offer.gold)) : 0,
    };
  }

  function buildTradePayload(trade) {
    const aId = trade?.aId;
    const bId = trade?.bId;
    if (!Number.isInteger(aId) || !Number.isInteger(bId)) return null;
    const a = state.players[aId];
    const b = state.players[bId];
    return {
      tradeId: trade.id,
      mapId: trade.mapId || null,
      aId,
      bId,
      aName: a?.displayName || null,
      bName: b?.displayName || null,
      offers: {
        [aId]: serializeOffer(trade.offers?.[aId]),
        [bId]: serializeOffer(trade.offers?.[bId]),
      },
      validated: {
        [aId]: trade.validated?.[aId] === true,
        [bId]: trade.validated?.[bId] === true,
      },
      cooldownUntil: Number.isFinite(trade.cooldownUntil)
        ? trade.cooldownUntil
        : 0,
    };
  }

  function sendTradeState(trade, type = "EvTradeUpdate") {
    const payload = buildTradePayload(trade);
    if (!payload) return;
    payload.t = type;
    payload.eventId = getNextEventId();
    sendToPlayerId(payload.aId, payload);
    sendToPlayerId(payload.bId, payload);
  }

  function clearTrade(trade) {
    if (!trade) return;
    const a = state.players[trade.aId];
    const b = state.players[trade.bId];
    if (a && a.tradeId === trade.id) a.tradeId = null;
    if (b && b.tradeId === trade.id) b.tradeId = null;
    delete state.trades[trade.id];
  }

  function cancelTrade(trade, reason) {
    if (!trade) return;
    sendToPlayerId(trade.aId, {
      t: "EvTradeCancelled",
      eventId: getNextEventId(),
      tradeId: trade.id,
      reason: reason || "cancelled",
    });
    sendToPlayerId(trade.bId, {
      t: "EvTradeCancelled",
      eventId: getNextEventId(),
      tradeId: trade.id,
      reason: reason || "cancelled",
    });
    clearTrade(trade);
  }

  function getTrade(tradeId) {
    if (!Number.isInteger(tradeId)) return null;
    return state.trades[tradeId] || null;
  }

  function getTradeByPlayer(playerId) {
    if (!Number.isInteger(playerId)) return null;
    const player = state.players[playerId];
    if (!player || !Number.isInteger(player.tradeId)) return null;
    return getTrade(player.tradeId);
  }

  function ensureItemDefsAvailable(playerId) {
    const defs = typeof getItemDefs === "function" ? getItemDefs() : null;
    const defsFailed =
      typeof getItemDefsFailed === "function" ? getItemDefsFailed() : false;
    const defsPromise =
      typeof getItemDefsPromise === "function" ? getItemDefsPromise() : null;
    if (!defs && !defsFailed) {
      defsPromise?.then(() => {});
      sendTradeError(playerId, "item_defs_loading", "Objets en cours de chargement.");
      return false;
    }
    if (!defs || defsFailed) {
      sendTradeError(playerId, "item_defs_unavailable", "Objets indisponibles.");
      return false;
    }
    return true;
  }

  function resetValidations(trade) {
    trade.validated = { [trade.aId]: false, [trade.bId]: false };
    trade.cooldownUntil = Date.now() + 3000;
  }

  function handleCmdTradeInvite(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const playerId = clientInfo.id;
    const targetId = Number.isInteger(msg.targetId) ? msg.targetId : null;
    if (!targetId || targetId === playerId) return;
    const player = state.players[playerId];
    const target = state.players[targetId];
    if (!player || !target || target.connected === false) {
      sendTradeError(playerId, "target_missing", "Joueur introuvable.");
      return;
    }
    if (player.inCombat || target.inCombat) {
      sendTradeError(playerId, "in_combat", "Echange impossible en combat.");
      return;
    }
    if (!player.mapId || player.mapId !== target.mapId) {
      sendTradeError(playerId, "different_map", "Pas sur la meme map.");
      return;
    }
    if (Number.isInteger(player.tradeId) || Number.isInteger(target.tradeId)) {
      sendTradeError(playerId, "already_trading", "Echange deja en cours.");
      return;
    }

    const tradeId = getNextTradeId();
    state.trades[tradeId] = {
      id: tradeId,
      status: "invite",
      mapId: player.mapId,
      aId: playerId,
      bId: targetId,
      offers: {
        [playerId]: { items: {}, gold: 0 },
        [targetId]: { items: {}, gold: 0 },
      },
      validated: { [playerId]: false, [targetId]: false },
      cooldownUntil: 0,
      createdAt: Date.now(),
    };

    sendToPlayerId(targetId, {
      t: "EvTradeInvite",
      eventId: getNextEventId(),
      tradeId,
      fromId: playerId,
      fromName: player.displayName || null,
    });
  }

  function handleCmdTradeAccept(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const playerId = clientInfo.id;
    const tradeId = Number.isInteger(msg.tradeId) ? msg.tradeId : null;
    const trade = getTrade(tradeId);
    if (!trade || trade.status !== "invite") return;
    if (trade.bId !== playerId) return;

    const a = state.players[trade.aId];
    const b = state.players[trade.bId];
    if (!a || !b || a.connected === false || b.connected === false) {
      cancelTrade(trade, "player_missing");
      return;
    }
    if (!a.mapId || a.mapId !== b.mapId) {
      cancelTrade(trade, "different_map");
      return;
    }
    if (a.inCombat || b.inCombat) {
      cancelTrade(trade, "in_combat");
      return;
    }
    if (Number.isInteger(a.tradeId) || Number.isInteger(b.tradeId)) {
      cancelTrade(trade, "already_trading");
      return;
    }

    trade.status = "active";
    a.tradeId = trade.id;
    b.tradeId = trade.id;
    trade.mapId = a.mapId;
    sendTradeState(trade, "EvTradeStarted");
  }

  function handleCmdTradeDecline(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const playerId = clientInfo.id;
    const tradeId = Number.isInteger(msg.tradeId) ? msg.tradeId : null;
    const trade = getTrade(tradeId);
    if (!trade || trade.status !== "invite") return;
    if (trade.bId !== playerId) return;
    cancelTrade(trade, "declined");
  }

  function handleCmdTradeCancel(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const trade = getTradeByPlayer(clientInfo.id);
    if (!trade || trade.status !== "active") return;
    cancelTrade(trade, "cancelled");
  }

  function updateOfferItem(playerId, trade, itemId, qty) {
    if (!ensureItemDefsAvailable(playerId)) return;
    const player = state.players[playerId];
    if (!player) return;
    const offer = trade.offers[playerId];
    if (!offer) return;

    const def = getItemDef(itemId);
    if (!def || !allowedCategories.has(def.category)) {
      sendTradeError(playerId, "item_forbidden", "Objet non echangeable.");
      return;
    }
    const inv = ensurePlayerInventory(player);
    const available = countItemInInventory(inv, itemId);
    const nextQty = Math.max(0, Math.min(available, Math.round(qty)));

    if (nextQty <= 0) {
      delete offer.items[itemId];
    } else {
      offer.items[itemId] = nextQty;
    }
    resetValidations(trade);
    sendTradeState(trade);
  }

  function handleCmdTradeOfferItem(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const trade = getTradeByPlayer(clientInfo.id);
    if (!trade || trade.status !== "active") return;
    if (trade.aId !== clientInfo.id && trade.bId !== clientInfo.id) return;
    const player = state.players[clientInfo.id];
    if (!player || player.inCombat) {
      cancelTrade(trade, "in_combat");
      return;
    }
    const itemId = typeof msg.itemId === "string" ? msg.itemId : null;
    if (!itemId) return;
    const qty = Number.isFinite(msg.qty) ? msg.qty : 0;
    updateOfferItem(clientInfo.id, trade, itemId, qty);
  }

  function handleCmdTradeOfferGold(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const trade = getTradeByPlayer(clientInfo.id);
    if (!trade || trade.status !== "active") return;
    const player = state.players[clientInfo.id];
    if (!player || player.inCombat) {
      cancelTrade(trade, "in_combat");
      return;
    }
    const gold = Number.isFinite(msg.gold) ? Math.round(msg.gold) : 0;
    const clamped = Math.min(Math.max(gold, 0), MAX_TRADE_GOLD);
    const currentGold = Number.isFinite(player.gold) ? player.gold : 0;
    if (clamped > currentGold) {
      sendTradeError(clientInfo.id, "gold_insufficient", "Or insuffisant.");
      return;
    }
    const offer = trade.offers[clientInfo.id];
    if (!offer) return;
    offer.gold = clamped;
    resetValidations(trade);
    sendTradeState(trade);
  }

  function finalizeTrade(trade) {
    const a = state.players[trade.aId];
    const b = state.players[trade.bId];
    if (!a || !b || a.connected === false || b.connected === false) {
      cancelTrade(trade, "player_missing");
      return;
    }
    if (a.inCombat || b.inCombat) {
      cancelTrade(trade, "in_combat");
      return;
    }

    if (!ensureItemDefsAvailable(a.id) || !ensureItemDefsAvailable(b.id)) return;

    const aOffer = trade.offers[a.id] || { items: {}, gold: 0 };
    const bOffer = trade.offers[b.id] || { items: {}, gold: 0 };

    const aGold = Math.max(0, Math.round(aOffer.gold || 0));
    const bGold = Math.max(0, Math.round(bOffer.gold || 0));
    if (aGold > MAX_TRADE_GOLD || bGold > MAX_TRADE_GOLD) {
      cancelTrade(trade, "gold_overflow");
      return;
    }

    const aInv = ensurePlayerInventory(a);
    const bInv = ensurePlayerInventory(b);

    const aItems = Object.entries(aOffer.items || {});
    const bItems = Object.entries(bOffer.items || {});

    for (const [itemId, qty] of aItems) {
      const def = getItemDef(itemId);
      if (!def || !allowedCategories.has(def.category)) {
        cancelTrade(trade, "item_forbidden");
        return;
      }
      const available = countItemInInventory(aInv, itemId);
      if (available < qty) {
        cancelTrade(trade, "insufficient_items");
        return;
      }
    }
    for (const [itemId, qty] of bItems) {
      const def = getItemDef(itemId);
      if (!def || !allowedCategories.has(def.category)) {
        cancelTrade(trade, "item_forbidden");
        return;
      }
      const available = countItemInInventory(bInv, itemId);
      if (available < qty) {
        cancelTrade(trade, "insufficient_items");
        return;
      }
    }

    const aBeforeGold = Number.isFinite(a.gold) ? a.gold : 0;
    const bBeforeGold = Number.isFinite(b.gold) ? b.gold : 0;
    if (aBeforeGold < aGold || bBeforeGold < bGold) {
      cancelTrade(trade, "gold_insufficient");
      return;
    }

    const removedA = [];
    const removedB = [];
    for (const [itemId, qty] of aItems) {
      const removed = removeItemFromInventory(aInv, itemId, qty);
      if (removed !== qty) {
        removedA.push({ itemId, qty: removed });
        cancelTrade(trade, "insufficient_items");
        return;
      }
      removedA.push({ itemId, qty });
    }
    for (const [itemId, qty] of bItems) {
      const removed = removeItemFromInventory(bInv, itemId, qty);
      if (removed !== qty) {
        removedB.push({ itemId, qty: removed });
        removedA.forEach((entry) => addItemToInventory(aInv, entry.itemId, entry.qty));
        cancelTrade(trade, "insufficient_items");
        return;
      }
      removedB.push({ itemId, qty });
    }

    removedA.forEach((entry) => addItemToInventory(bInv, entry.itemId, entry.qty));
    removedB.forEach((entry) => addItemToInventory(aInv, entry.itemId, entry.qty));

    a.gold = Math.max(0, aBeforeGold - aGold + bGold);
    b.gold = Math.max(0, bBeforeGold - bGold + aGold);

    if (typeof persistPlayerState === "function") {
      persistPlayerState(a);
      persistPlayerState(b);
    }

    const aClient = findClientByPlayerId(a.id);
    if (aClient?.ws) sendPlayerSync(aClient.ws, a, "trade");
    const bClient = findClientByPlayerId(b.id);
    if (bClient?.ws) sendPlayerSync(bClient.ws, b, "trade");

    sendToPlayerId(a.id, {
      t: "EvTradeComplete",
      eventId: getNextEventId(),
      tradeId: trade.id,
    });
    sendToPlayerId(b.id, {
      t: "EvTradeComplete",
      eventId: getNextEventId(),
      tradeId: trade.id,
    });
    clearTrade(trade);
  }

  function handleCmdTradeValidate(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const trade = getTradeByPlayer(clientInfo.id);
    if (!trade || trade.status !== "active") return;
    const player = state.players[clientInfo.id];
    if (!player || player.inCombat) {
      cancelTrade(trade, "in_combat");
      return;
    }
    const now = Date.now();
    if (now < (trade.cooldownUntil || 0)) {
      sendTradeError(clientInfo.id, "cooldown", "Attends 3 secondes.");
      return;
    }
    trade.validated[clientInfo.id] = true;
    sendTradeState(trade);
    if (trade.validated[trade.aId] && trade.validated[trade.bId]) {
      finalizeTrade(trade);
    }
  }

  function handlePlayerDisconnect(playerId) {
    const trade = getTradeByPlayer(playerId);
    if (trade) cancelTrade(trade, "disconnect");
  }

  function cancelTradeForPlayer(playerId, reason) {
    const trade = getTradeByPlayer(playerId);
    if (trade) cancelTrade(trade, reason || "cancelled");
  }

  return {
    handleCmdTradeInvite,
    handleCmdTradeAccept,
    handleCmdTradeDecline,
    handleCmdTradeCancel,
    handleCmdTradeOfferItem,
    handleCmdTradeOfferGold,
    handleCmdTradeValidate,
    handlePlayerDisconnect,
    cancelTradeForPlayer,
  };
}

module.exports = {
  createTradeHandlers,
};
