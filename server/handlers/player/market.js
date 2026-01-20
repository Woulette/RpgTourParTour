function createMarketHandlers({
  state,
  send,
  helpers,
  sync,
  marketStore,
  getItemDefs,
  MAX_QTY_PER_OP,
  persistPlayerState,
}) {
  const {
    ensurePlayerInventory,
    addItemToInventory,
    removeItemFromInventory,
    countItemInInventory,
    logAntiDup,
  } = helpers;
  const { sendPlayerSync, findClientByPlayerId } = sync;

  const MARKET_TAX_PCT = 0.02;
  const MARKET_LISTING_TTL_MS = 14 * 24 * 60 * 60 * 1000;
  const MAX_UNIT_PRICE = 1000000000;
  const MAX_TOTAL_PRICE = 2000000000;
  const DEFAULT_PAGE_SIZE = 40;
  const MAX_PAGE_SIZE = 80;

  function resolveItemDefs() {
    return typeof getItemDefs === "function" ? getItemDefs() : null;
  }

  function getItemDef(itemId) {
    const defs = resolveItemDefs();
    return defs?.[itemId] || null;
  }

  function isSellableItem(def) {
    if (!def) return false;
    return (
      def.category === "ressource" ||
      def.category === "equipement" ||
      def.category === "consommable"
    );
  }

  function sendToPlayer(playerId, payload) {
    const target = findClientByPlayerId(playerId);
    if (!target?.ws) return;
    send(target.ws, payload);
  }

  function emitNotice(playerId, message, kind = "info") {
    sendToPlayer(playerId, {
      t: "EvMarketNotice",
      kind,
      message: message || "",
    });
  }

  function cleanupExpiredListings() {
    if (!marketStore) return;
    const expired = marketStore.expireListings(Date.now());
    if (!expired || expired.length === 0) return;
    expired.forEach((entry) => {
      if (!entry || !entry.seller_account_id) return;
      marketStore.addReturn(entry.seller_account_id, entry.item_id, entry.qty);
    });
  }

  function applyFilters(listings, filters) {
    const defs = resolveItemDefs();
    if (!defs) return [];
    const category = filters?.category || null;
    const subCategory = filters?.subCategory || null;
    const slot = filters?.slot || null;
    const query =
      typeof filters?.query === "string" ? filters.query.trim().toLowerCase() : "";

    return listings.filter((entry) => {
      const def = defs[entry.itemId];
      if (!def) return false;
      if (!isSellableItem(def)) return false;
      if (category && def.category !== category) return false;
      if (category === "equipement" && slot) {
        if (slot === "ring") {
          if (def.slot !== "ring1" && def.slot !== "ring2") return false;
        } else if (def.slot !== slot) {
          return false;
        }
      }
      if (category === "ressource" && subCategory && def.subCategory !== subCategory) {
        return false;
      }
      if (query) {
        const label = String(def.label || "").toLowerCase();
        const id = String(def.id || "").toLowerCase();
        if (!label.includes(query) && !id.includes(query)) return false;
      }
      return true;
    });
  }

  function serializeListing(entry) {
    return {
      listingId: entry.listingId,
      itemId: entry.itemId,
      qty: entry.qty,
      unitPrice: entry.unitPrice,
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt,
    };
  }

  function groupListings(listings) {
    const grouped = new Map();
    listings.forEach((entry) => {
      const key = `${entry.itemId}|${entry.unitPrice}|${entry.qty}|${entry.listingId}`;
      const current = grouped.get(key);
      if (!current) {
        grouped.set(key, {
          itemId: entry.itemId,
          unitPrice: entry.unitPrice,
          qty: entry.qty,
          createdAt: entry.createdAt,
          expiresAt: entry.expiresAt,
        });
        return;
      }
      if (Number.isFinite(entry.createdAt) && entry.createdAt < current.createdAt) {
        current.createdAt = entry.createdAt;
      }
      if (Number.isFinite(entry.expiresAt) && entry.expiresAt < current.expiresAt) {
        current.expiresAt = entry.expiresAt;
      }
    });
    return Array.from(grouped.values()).sort((a, b) => {
      if (a.itemId !== b.itemId) return a.itemId.localeCompare(b.itemId);
      return a.unitPrice - b.unitPrice;
    });
  }

  function handleCmdMarketList(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    cleanupExpiredListings();
    const page = Number.isInteger(msg.page) && msg.page >= 1 ? msg.page : 1;
    const pageSize = Number.isInteger(msg.pageSize) ? msg.pageSize : DEFAULT_PAGE_SIZE;
    const safePageSize = Math.max(1, Math.min(pageSize, MAX_PAGE_SIZE));
    const filters = {
      category: typeof msg.category === "string" ? msg.category : null,
      subCategory: typeof msg.subCategory === "string" ? msg.subCategory : null,
      slot: typeof msg.slot === "string" ? msg.slot : null,
      query: typeof msg.query === "string" ? msg.query : "",
    };

    const listings = marketStore ? marketStore.listActiveListings(Date.now()) : [];
    const filtered = applyFilters(listings, filters);
    const grouped = groupListings(filtered);
    const total = grouped.length;
    const offset = (page - 1) * safePageSize;
    const pageItems = grouped.slice(offset, offset + safePageSize);

    sendToPlayer(clientInfo.id, {
      t: "EvMarketList",
      page,
      pageSize: safePageSize,
      total,
      listings: pageItems,
    });
  }

  function handleCmdMarketMyListings(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    cleanupExpiredListings();
    const player = state.players[clientInfo.id];
    if (!player || !player.accountId) return;
    const listings = marketStore
      ? marketStore.listListingsByAccount(player.accountId, Date.now()).map(serializeListing)
      : [];
    const returns = marketStore ? marketStore.listReturns(player.accountId) : [];
    sendToPlayer(clientInfo.id, {
      t: "EvMarketMine",
      listings,
      returns,
    });
  }

  function handleCmdMarketBalance(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const player = state.players[clientInfo.id];
    if (!player || !player.accountId) return;
    const balance = marketStore ? marketStore.getBalance(player.accountId) : 0;
    sendToPlayer(clientInfo.id, {
      t: "EvMarketBalance",
      balance,
    });
  }

  function handleCmdMarketSell(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const player = state.players[clientInfo.id];
    if (!player || player.inCombat || !player.accountId) return;

    const itemId = typeof msg.itemId === "string" ? msg.itemId : null;
    const qty = Number.isInteger(msg.qty) ? msg.qty : 0;
    const unitPrice = Number.isFinite(msg.unitPrice) ? Math.round(msg.unitPrice) : 0;
    if (!itemId || qty <= 0 || qty > MAX_QTY_PER_OP) {
      emitNotice(clientInfo.id, "Quantite invalide.", "error");
      return;
    }
    if (unitPrice <= 0 || unitPrice > MAX_UNIT_PRICE) {
      emitNotice(clientInfo.id, "Prix invalide.", "error");
      return;
    }
    const def = getItemDef(itemId);
    if (!isSellableItem(def)) {
      emitNotice(clientInfo.id, "Objet non vendable.", "error");
      return;
    }
    if (def?.stackable === false && qty > 1) {
      emitNotice(clientInfo.id, "Cet objet se vend a l'unite.", "error");
      return;
    }

    const total = unitPrice;
    if (!Number.isFinite(total) || total <= 0 || total > MAX_TOTAL_PRICE) {
      emitNotice(clientInfo.id, "Prix total invalide.", "error");
      return;
    }
    const tax = Math.max(0, Math.floor(total * MARKET_TAX_PCT));
    const currentGold = Number.isFinite(player.gold) ? player.gold : 0;
    if (currentGold < tax) {
      emitNotice(clientInfo.id, "Pas assez d'or pour la taxe.", "error");
      return;
    }

    const inv = ensurePlayerInventory(player);
    const owned = countItemInInventory(inv, itemId);
    if (owned < qty) {
      emitNotice(clientInfo.id, "Quantite insuffisante.", "error");
      return;
    }

    const removed = removeItemFromInventory(inv, itemId, qty);
    if (removed < qty) {
      if (removed > 0) addItemToInventory(inv, itemId, removed);
      emitNotice(clientInfo.id, "Inventaire invalide.", "error");
      return;
    }

    player.gold = Math.max(0, currentGold - tax);
    const now = Date.now();
    marketStore.addListing({
      sellerAccountId: player.accountId,
      itemId,
      qty,
      unitPrice,
      createdAt: now,
      expiresAt: now + MARKET_LISTING_TTL_MS,
    });

    logAntiDup({
      ts: now,
      reason: "market_sell",
      accountId: player.accountId || null,
      characterId: player.characterId || null,
      playerId: player.id || null,
      mapId: player.mapId || null,
      itemId,
      qty: -qty,
      goldDelta: -tax,
    });

    if (typeof persistPlayerState === "function") {
      persistPlayerState(player);
    }

    const target = findClientByPlayerId(player.id);
    if (target?.ws) {
      sendPlayerSync(target.ws, player, "market_sell");
    }
    emitNotice(clientInfo.id, "Objet mis en vente.", "info");
  }

  function handleCmdMarketBuy(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const player = state.players[clientInfo.id];
    if (!player || player.inCombat) return;

    cleanupExpiredListings();

    const listingId = Number.isInteger(msg.listingId) ? msg.listingId : null;
    const qty = Number.isInteger(msg.qty) ? msg.qty : 0;
    const itemId = typeof msg.itemId === "string" ? msg.itemId : null;
    const unitPrice = Number.isFinite(msg.unitPrice) ? Math.round(msg.unitPrice) : null;
    if ((!listingId && (!itemId || unitPrice == null)) || qty <= 0 || qty > MAX_QTY_PER_OP) {
      emitNotice(clientInfo.id, "Quantite invalide.", "error");
      return;
    }

    const allListings = marketStore ? marketStore.listActiveListings(Date.now()) : [];
    const candidates = listingId
      ? allListings.filter((entry) => entry.listingId === listingId)
      : allListings.filter(
          (entry) =>
            entry.itemId === itemId &&
            entry.unitPrice === unitPrice &&
            entry.qty === qty
        );
    if (!candidates.length) {
      emitNotice(clientInfo.id, "Offre introuvable.", "error");
      return;
    }

    const pick = candidates.slice().sort((a, b) => a.createdAt - b.createdAt)[0];
    if (listingId && pick.qty !== qty) {
      emitNotice(clientInfo.id, "Lot indisponible.", "error");
      return;
    }
    const priceUnit = pick.unitPrice;
    const total = priceUnit;
    if (!Number.isFinite(total) || total <= 0 || total > MAX_TOTAL_PRICE) {
      emitNotice(clientInfo.id, "Prix total invalide.", "error");
      return;
    }
    const currentGold = Number.isFinite(player.gold) ? player.gold : 0;
    if (currentGold < total) {
      emitNotice(clientInfo.id, "Pas assez d'or.", "error");
      return;
    }

    const inv = ensurePlayerInventory(player);
    const boughtItemId = pick.itemId;
    const added = addItemToInventory(inv, boughtItemId, qty);
    if (added < qty) {
      if (added > 0) removeItemFromInventory(inv, boughtItemId, added);
      emitNotice(clientInfo.id, "Inventaire plein.", "error");
      return;
    }

    player.gold = Math.max(0, currentGold - total);

    marketStore.deleteListing(pick.listingId);
    if (pick.sellerAccountId) {
      marketStore.addBalance(pick.sellerAccountId, pick.unitPrice);
    }

    logAntiDup({
      ts: Date.now(),
      reason: "market_buy",
      accountId: player.accountId || null,
      characterId: player.characterId || null,
      playerId: player.id || null,
      mapId: player.mapId || null,
      itemId: boughtItemId,
      qty,
      goldDelta: -total,
    });

    if (typeof persistPlayerState === "function") {
      persistPlayerState(player);
    }

    const target = findClientByPlayerId(player.id);
    if (target?.ws) {
      sendPlayerSync(target.ws, player, "market_buy");
    }

    const sellers = new Set([pick.sellerAccountId].filter(Boolean));
    sellers.forEach((accountId) => {
      const seller = Object.values(state.players).find(
        (p) => p && p.accountId === accountId && p.connected !== false
      );
      if (seller) {
        const balance = marketStore.getBalance(accountId);
        sendToPlayer(seller.id, { t: "EvMarketBalance", balance });
      }
    });
    emitNotice(clientInfo.id, "Achat effectue.", "info");
  }

  function handleCmdMarketCancel(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const player = state.players[clientInfo.id];
    if (!player || !player.accountId) return;

    cleanupExpiredListings();

    const listingId = Number.isInteger(msg.listingId) ? msg.listingId : null;
    if (!listingId) return;
    const listing = marketStore.getListing(listingId);
    if (!listing || listing.sellerAccountId !== player.accountId) return;

    marketStore.deleteListing(listingId);
    marketStore.addReturn(player.accountId, listing.itemId, listing.qty);
    emitNotice(clientInfo.id, "Vente annulee.", "info");
  }

  function handleCmdMarketWithdraw(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const player = state.players[clientInfo.id];
    if (!player || !player.accountId) return;
    const amount = Number.isFinite(msg.amount) ? Math.round(msg.amount) : 0;
    if (amount <= 0) return;
    const balance = marketStore.getBalance(player.accountId);
    if (balance < amount) {
      emitNotice(clientInfo.id, "Solde insuffisant.", "error");
      return;
    }
    const next = balance - amount;
    marketStore.setBalance(player.accountId, next);
    const beforeGold = Number.isFinite(player.gold) ? player.gold : 0;
    player.gold = Math.max(0, beforeGold + amount);

    logAntiDup({
      ts: Date.now(),
      reason: "market_withdraw",
      accountId: player.accountId || null,
      characterId: player.characterId || null,
      playerId: player.id || null,
      mapId: player.mapId || null,
      goldDelta: amount,
    });

    if (typeof persistPlayerState === "function") {
      persistPlayerState(player);
    }

    const target = findClientByPlayerId(player.id);
    if (target?.ws) {
      sendPlayerSync(target.ws, player, "market_withdraw");
    }
    sendToPlayer(player.id, { t: "EvMarketBalance", balance: next });
    emitNotice(clientInfo.id, "Solde retire.", "info");
  }

  function handleCmdMarketClaimReturn(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const player = state.players[clientInfo.id];
    if (!player || !player.accountId) return;
    const returnId = Number.isInteger(msg.returnId) ? msg.returnId : null;
    const qty = Number.isInteger(msg.qty) ? msg.qty : 0;
    if (!returnId || qty <= 0) return;
    const entry = marketStore.getReturn(returnId);
    if (!entry || entry.accountId !== player.accountId) return;
    if (qty > entry.qty) {
      emitNotice(clientInfo.id, "Quantite invalide.", "error");
      return;
    }
    const inv = ensurePlayerInventory(player);
    const added = addItemToInventory(inv, entry.itemId, qty);
    if (added < qty) {
      if (added > 0) removeItemFromInventory(inv, entry.itemId, added);
      emitNotice(clientInfo.id, "Inventaire plein.", "error");
      return;
    }
    const remaining = entry.qty - qty;
    if (remaining > 0) {
      marketStore.updateReturnQty(returnId, remaining);
    } else {
      marketStore.deleteReturn(returnId);
    }
    if (typeof persistPlayerState === "function") {
      persistPlayerState(player);
    }
    const target = findClientByPlayerId(player.id);
    if (target?.ws) {
      sendPlayerSync(target.ws, player, "market_return");
    }
    emitNotice(clientInfo.id, "Objet recupere.", "info");
  }

  return {
    handleCmdMarketList,
    handleCmdMarketMyListings,
    handleCmdMarketBalance,
    handleCmdMarketSell,
    handleCmdMarketBuy,
    handleCmdMarketCancel,
    handleCmdMarketWithdraw,
    handleCmdMarketClaimReturn,
  };
}

module.exports = {
  createMarketHandlers,
};
