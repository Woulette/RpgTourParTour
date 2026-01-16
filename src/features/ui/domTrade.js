import { getNetClient, getNetPlayerId } from "../../app/session.js";
import { getPlayer, on as onStoreEvent } from "../../state/store.js";
import { getItemDef } from "../inventory/runtime/inventoryAuthority.js";
import { showToast } from "./domToasts.js";

const TRADE_SLOT_COUNT = 10;
const ALLOWED_CATEGORIES = new Set(["equipement", "ressource", "consommable"]);

let panelEl = null;
let inviteEl = null;
let inviteTextEl = null;
let inviteAcceptBtn = null;
let inviteDeclineBtn = null;
let inviteState = null;

let tradeState = null;
let localPanel = null;
let remotePanel = null;
let inventoryGrid = null;
let localGoldInput = null;
let localGoldTotalEl = null;
let localValidateBtn = null;
let localCancelBtn = null;
let localStatusEl = null;
let remoteStatusEl = null;
let closeBtn = null;
let goldInputTimer = null;
let cooldownTimer = null;
let unsubInventory = null;
let unsubPlayer = null;
let currentFilter = "all";

function ensurePanel() {
  if (panelEl) return panelEl;
  panelEl = document.getElementById("hud-trade-panel");
  if (!panelEl) return null;

  localPanel = panelEl.querySelector(".trade-panel-local");
  remotePanel = panelEl.querySelector(".trade-panel-remote");
  inventoryGrid = panelEl.querySelector("#trade-inventory-grid");
  localGoldInput = panelEl.querySelector(".trade-gold-input");
  localGoldTotalEl = panelEl.querySelector("[data-role='gold-total']");
  localValidateBtn = panelEl.querySelector(".trade-btn-validate");
  localCancelBtn = panelEl.querySelector(".trade-btn-cancel");
  localStatusEl = localPanel?.querySelector("[data-role='status']") || null;
  remoteStatusEl = remotePanel?.querySelector("[data-role='status']") || null;
  closeBtn = panelEl.querySelector(".trade-close");
  const filterButtons = panelEl.querySelectorAll(".trade-filter-btn");

  if (closeBtn) {
    closeBtn.addEventListener("click", () => closeTradePanel({ sendCancel: true }));
  }
  if (localCancelBtn) {
    localCancelBtn.addEventListener("click", () => closeTradePanel({ sendCancel: true }));
  }
  if (localValidateBtn) {
    localValidateBtn.addEventListener("click", () => requestValidate());
  }

  if (localGoldInput) {
    localGoldInput.addEventListener("input", () => {
      if (goldInputTimer) window.clearTimeout(goldInputTimer);
      goldInputTimer = window.setTimeout(() => {
        goldInputTimer = null;
        sendGoldOffer();
      }, 200);
    });
  }

  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const filter = btn.getAttribute("data-filter") || "all";
      currentFilter = filter;
      filterButtons.forEach((b) => {
        b.classList.toggle("is-active", b === btn);
      });
      renderInventoryGrid();
    });
  });

  window.__tradeCloseRequest = () => closeTradePanel({ sendCancel: true });

  return panelEl;
}

function ensureInvite() {
  if (inviteEl) return inviteEl;
  inviteEl = document.createElement("div");
  inviteEl.className = "trade-invite";
  inviteEl.style.display = "none";
  inviteEl.innerHTML = `
    <div class="trade-invite-title">Demande d'echange</div>
    <div class="trade-invite-text"></div>
    <div class="trade-invite-actions">
      <button type="button" class="trade-btn trade-btn-cancel">Refuser</button>
      <button type="button" class="trade-btn">Accepter</button>
    </div>
  `;
  inviteTextEl = inviteEl.querySelector(".trade-invite-text");
  inviteAcceptBtn = inviteEl.querySelector(".trade-invite-actions .trade-btn:last-child");
  inviteDeclineBtn = inviteEl.querySelector(".trade-invite-actions .trade-btn");

  document.body.appendChild(inviteEl);

  inviteAcceptBtn.addEventListener("click", () => {
    if (!inviteState) return;
    const client = getNetClient();
    const playerId = getNetPlayerId();
    if (!client || !playerId) return;
    client.sendCmd("CmdTradeAccept", {
      playerId,
      tradeId: inviteState.tradeId,
    });
    closeTradeInvite();
  });

  inviteDeclineBtn.addEventListener("click", () => {
    if (!inviteState) return;
    const client = getNetClient();
    const playerId = getNetPlayerId();
    if (!client || !playerId) return;
    client.sendCmd("CmdTradeDecline", {
      playerId,
      tradeId: inviteState.tradeId,
    });
    closeTradeInvite();
  });

  return inviteEl;
}

function normalizeOffer(offer) {
  const items = Array.isArray(offer?.items) ? offer.items : [];
  const itemsById = new Map();
  items.forEach((entry) => {
    if (!entry || !entry.itemId) return;
    const qty = Math.max(0, Math.round(entry.qty || 0));
    if (qty <= 0) return;
    itemsById.set(entry.itemId, qty);
  });
  return {
    items,
    itemsById,
    gold: Number.isFinite(offer?.gold) ? Math.max(0, Math.round(offer.gold)) : 0,
  };
}

function normalizeTrade(trade) {
  const localId = getNetPlayerId();
  if (!trade || !Number.isInteger(localId)) return null;
  const offers = trade.offers || {};
  const aOffer = normalizeOffer(offers[trade.aId]);
  const bOffer = normalizeOffer(offers[trade.bId]);
  return {
    ...trade,
    localId,
    offersById: {
      [trade.aId]: aOffer,
      [trade.bId]: bOffer,
    },
  };
}

function getInventoryCount(player, itemId) {
  if (!player?.inventory?.slots || !itemId) return 0;
  let total = 0;
  player.inventory.slots.forEach((slot) => {
    if (slot?.itemId === itemId) {
      total += Math.max(0, Math.round(slot.qty || 0));
    }
  });
  return total;
}

function getLocalOffer() {
  if (!tradeState) return null;
  return tradeState.offersById?.[tradeState.localId] || null;
}

function getRemoteOffer() {
  if (!tradeState) return null;
  const remoteId = tradeState.localId === tradeState.aId ? tradeState.bId : tradeState.aId;
  return tradeState.offersById?.[remoteId] || null;
}

function getLocalName() {
  if (!tradeState) return "Vous";
  return tradeState.localId === tradeState.aId
    ? tradeState.aName || "Vous"
    : tradeState.bName || "Vous";
}

function getRemoteName() {
  if (!tradeState) return "Joueur";
  return tradeState.localId === tradeState.aId
    ? tradeState.bName || "Joueur"
    : tradeState.aName || "Joueur";
}

function renderTradeGrid(panel, offer, allowRemove) {
  if (!panel) return;
  const grid = panel.querySelector("[data-role='grid']");
  if (!grid) return;
  grid.innerHTML = "";
  const items = Array.isArray(offer?.items) ? offer.items : [];

  for (let i = 0; i < TRADE_SLOT_COUNT; i += 1) {
    const slot = document.createElement("div");
    slot.className = "trade-slot";
    slot.dataset.index = String(i);
    const entry = items[i] || null;
    if (!entry || !entry.itemId) {
      slot.classList.add("empty");
    } else {
      slot.dataset.itemId = entry.itemId;
      slot.classList.add("filled");
      const def = getItemDef(entry.itemId);
      if (def?.icon) {
        const icon = document.createElement("div");
        icon.className = "inventory-slot-icon";
        icon.style.backgroundImage = `url("${def.icon}")`;
        slot.appendChild(icon);
      }
      const qty = Math.max(1, Math.round(entry.qty || 1));
      if (qty > 1) {
        const qtyEl = document.createElement("span");
        qtyEl.className = "inventory-slot-qty";
        qtyEl.textContent = String(qty);
        slot.appendChild(qtyEl);
      }
    }

    if (allowRemove) {
      slot.addEventListener("dblclick", () => {
        const itemId = slot.dataset.itemId;
        if (!itemId) return;
        requestOfferItemChange(itemId, -1);
      });
      slot.addEventListener("dragover", (event) => {
        event.preventDefault();
      });
      slot.addEventListener("drop", (event) => {
        event.preventDefault();
        const itemId = event.dataTransfer?.getData("text/plain") || "";
        if (!itemId) return;
        promptDropQuantity(itemId);
      });
    }

    grid.appendChild(slot);
  }
}

function renderInventoryGrid() {
  if (!inventoryGrid) return;
  inventoryGrid.innerHTML = "";
  const player = getPlayer();
  if (!player?.inventory?.slots) return;

  const displaySlots = [];
  player.inventory.slots.forEach((slot) => {
    if (!slot || !slot.itemId) return;
    const def = getItemDef(slot.itemId);
    if (!def || !ALLOWED_CATEGORIES.has(def.category)) return;
    if (currentFilter !== "all" && def.category !== currentFilter) return;
    displaySlots.push({
      itemId: slot.itemId,
      qty: Math.max(0, Math.round(slot.qty || 0)),
    });
  });

  const size = Math.max(player.inventory.size || 0, displaySlots.length);
  const offer = getLocalOffer();
  const offerRemaining = new Map();
  if (offer?.itemsById) {
    offer.itemsById.forEach((qty, itemId) => {
      offerRemaining.set(itemId, Math.max(0, Math.round(qty || 0)));
    });
  }
  const compactedSlots = [];
  displaySlots.forEach((slot) => {
    const reserved = offerRemaining.get(slot.itemId) || 0;
    const used = Math.min(slot.qty, reserved);
    const remaining = slot.qty - used;
    if (reserved > 0) {
      offerRemaining.set(slot.itemId, Math.max(0, reserved - used));
    }
    if (remaining > 0) {
      compactedSlots.push({ itemId: slot.itemId, qty: remaining });
    }
  });
  for (let i = 0; i < size; i += 1) {
    const entry = compactedSlots[i] || null;
    const slotEl = document.createElement("button");
    slotEl.type = "button";
    slotEl.className = "inventory-slot";
    if (!entry || !entry.itemId) {
      slotEl.classList.add("empty");
    } else {
      const def = getItemDef(entry.itemId);
      const qty = Math.max(0, Math.round(entry.qty || 0));
      if (qty <= 0) {
        slotEl.classList.add("empty");
      } else {
        slotEl.classList.add("filled");
        slotEl.dataset.itemId = entry.itemId;
        const isAllowed = def && ALLOWED_CATEGORIES.has(def.category);
        if (!isAllowed) {
          slotEl.classList.add("trade-inventory-disabled");
        } else {
          slotEl.draggable = true;
        }
        if (def?.icon) {
          const icon = document.createElement("div");
          icon.className = "inventory-slot-icon";
          icon.style.backgroundImage = `url("${def.icon}")`;
          slotEl.appendChild(icon);
        }
        if (qty > 1) {
          const qtyEl = document.createElement("span");
          qtyEl.className = "inventory-slot-qty";
          qtyEl.textContent = String(qty);
          slotEl.appendChild(qtyEl);
        }

        if (isAllowed) {
          slotEl.addEventListener("dblclick", (event) => {
            if (event.ctrlKey) {
              const available = getInventoryCount(player, entry.itemId);
              requestOfferItemSet(entry.itemId, available);
              return;
            }
            requestOfferItemChange(entry.itemId, +1);
          });

          slotEl.addEventListener("dragstart", (event) => {
            event.dataTransfer?.setData("text/plain", entry.itemId);
          });
        }
      }
    }

    inventoryGrid.appendChild(slotEl);
  }
}

function updatePanelStatus(panel, isValidated) {
  panel?.classList.toggle("is-validated", isValidated);
}

function renderTradeState() {
  if (!tradeState) return;
  const localOffer = getLocalOffer();
  const remoteOffer = getRemoteOffer();

  const localName = getLocalName();
  const remoteName = getRemoteName();

  const localNameEl = localPanel?.querySelector("[data-role='name']");
  const remoteNameEl = remotePanel?.querySelector("[data-role='name']");
  if (localNameEl) localNameEl.textContent = localName;
  if (remoteNameEl) remoteNameEl.textContent = remoteName;

  const remoteGoldEl = remotePanel?.querySelector("[data-role='gold']");
  if (remoteGoldEl) remoteGoldEl.textContent = String(remoteOffer?.gold ?? 0);

  if (localGoldInput && localOffer) {
    const value = Number.isFinite(localOffer.gold) ? localOffer.gold : 0;
    if (String(localGoldInput.value) !== String(value)) {
      localGoldInput.value = String(value);
    }
  }
  const player = getPlayer();
  const totalGold =
    typeof player?.gold === "number" && !Number.isNaN(player?.gold) ? player.gold : 0;
  if (localGoldTotalEl) {
    localGoldTotalEl.textContent = `/ ${totalGold}`;
  }
  if (localGoldInput) {
    const maxGold = Math.max(0, Math.min(1000000000, totalGold));
    localGoldInput.max = String(maxGold);
  }

  renderTradeGrid(remotePanel, remoteOffer, false);
  renderTradeGrid(localPanel, localOffer, true);
  renderInventoryGrid();

  const localValidated = tradeState.validated?.[tradeState.localId] === true;
  const remoteId =
    tradeState.localId === tradeState.aId ? tradeState.bId : tradeState.aId;
  const remoteValidated = tradeState.validated?.[remoteId] === true;

  updatePanelStatus(localPanel, localValidated);
  updatePanelStatus(remotePanel, remoteValidated);

  const cooldownRemaining =
    Number.isFinite(tradeState.cooldownUntil) && tradeState.cooldownUntil > Date.now()
      ? tradeState.cooldownUntil - Date.now()
      : 0;

  if (localStatusEl) {
    if (cooldownRemaining > 0) {
      localStatusEl.textContent = "Attends 3s";
    } else if (localValidated) {
      localStatusEl.textContent = "Valide";
    } else {
      localStatusEl.textContent = "En attente";
    }
  }

  if (remoteStatusEl) {
    remoteStatusEl.textContent = remoteValidated ? "Valide" : "En attente";
  }

  if (localValidateBtn) {
    localValidateBtn.disabled = localValidated || cooldownRemaining > 0;
  }

  if (cooldownTimer) window.clearTimeout(cooldownTimer);
  if (cooldownRemaining > 0) {
    cooldownTimer = window.setTimeout(() => {
      cooldownTimer = null;
      renderTradeState();
    }, Math.min(cooldownRemaining + 50, 3100));
  }
}

function requestOfferItemChange(itemId, delta) {
  if (!tradeState || !itemId || !delta) return;
  const player = getPlayer();
  if (!player?.inventory) return;
  const def = getItemDef(itemId);
  if (!def || !ALLOWED_CATEGORIES.has(def.category)) {
    showToast({ title: "Echange", text: "Objet non echangeable." });
    return;
  }
  const available = getInventoryCount(player, itemId);
  const localOffer = getLocalOffer();
  const current = localOffer?.itemsById?.get(itemId) || 0;
  const next = Math.max(0, Math.min(available, current + delta));
  if (next === current) return;

  const client = getNetClient();
  const playerId = getNetPlayerId();
  if (!client || !playerId) return;
  client.sendCmd("CmdTradeOfferItem", {
    playerId,
    itemId,
    qty: next,
  });
}

function requestOfferItemSet(itemId, qty) {
  if (!tradeState || !itemId) return;
  const player = getPlayer();
  if (!player?.inventory) return;
  const def = getItemDef(itemId);
  if (!def || !ALLOWED_CATEGORIES.has(def.category)) {
    showToast({ title: "Echange", text: "Objet non echangeable." });
    return;
  }
  const available = getInventoryCount(player, itemId);
  const safeQty = Math.max(0, Math.min(available, Math.round(qty || 0)));
  const localOffer = getLocalOffer();
  const current = localOffer?.itemsById?.get(itemId) || 0;
  if (safeQty === current) return;
  const client = getNetClient();
  const playerId = getNetPlayerId();
  if (!client || !playerId) return;
  client.sendCmd("CmdTradeOfferItem", {
    playerId,
    itemId,
    qty: safeQty,
  });
}

function promptDropQuantity(itemId) {
  const player = getPlayer();
  if (!player?.inventory) return;
  const available = getInventoryCount(player, itemId);
  const localOffer = getLocalOffer();
  const current = localOffer?.itemsById?.get(itemId) || 0;
  const remaining = Math.max(0, available - current);
  if (remaining <= 0) return;
  const raw = window.prompt(
    `Quantite a ajouter (max ${remaining}) :`,
    String(remaining)
  );
  if (raw === null) return;
  const qty = Math.max(0, Math.min(remaining, Math.round(Number(raw))));
  if (!Number.isFinite(qty) || qty <= 0) return;
  requestOfferItemSet(itemId, current + qty);
}

function sendGoldOffer() {
  if (!tradeState || !localGoldInput) return;
  const raw = Number.parseInt(localGoldInput.value || "0", 10);
  const player = getPlayer();
  const totalGold =
    typeof player?.gold === "number" && !Number.isNaN(player?.gold) ? player.gold : 0;
  const cap = Math.max(0, Math.min(1000000000, totalGold));
  const gold = Number.isFinite(raw) ? Math.max(0, Math.min(raw, cap)) : 0;
  if (String(localGoldInput.value) !== String(gold)) {
    localGoldInput.value = String(gold);
  }
  const client = getNetClient();
  const playerId = getNetPlayerId();
  if (!client || !playerId) return;
  client.sendCmd("CmdTradeOfferGold", {
    playerId,
    gold,
  });
}

function requestValidate() {
  if (!tradeState) return;
  const client = getNetClient();
  const playerId = getNetPlayerId();
  if (!client || !playerId) return;
  client.sendCmd("CmdTradeValidate", { playerId });
}

function openTradePanel(trade) {
  ensurePanel();
  const normalized = normalizeTrade(trade);
  if (!normalized || !panelEl) return;
  tradeState = normalized;
  document.body.classList.add("hud-trade-open");
  window.__tradeLockMovement = true;
  renderTradeState();

  if (!unsubInventory) {
    unsubInventory = onStoreEvent("inventory:updated", () => {
      if (document.body.classList.contains("hud-trade-open")) {
        renderInventoryGrid();
      }
    });
  }
  if (!unsubPlayer) {
    unsubPlayer = onStoreEvent("player:updated", () => {
      if (document.body.classList.contains("hud-trade-open")) {
        renderTradeState();
      }
    });
  }
}

function updateTradeState(trade) {
  if (!tradeState) {
    openTradePanel(trade);
    return;
  }
  const normalized = normalizeTrade(trade);
  if (!normalized) return;
  tradeState = normalized;
  renderTradeState();
}

function closeTradePanel({ sendCancel } = {}) {
  if (!panelEl) ensurePanel();
  if (!tradeState) {
    document.body.classList.remove("hud-trade-open");
    window.__tradeLockMovement = false;
    return;
  }
  const shouldSend = sendCancel === true;
  if (shouldSend) {
    const client = getNetClient();
    const playerId = getNetPlayerId();
    if (client && playerId) {
      client.sendCmd("CmdTradeCancel", { playerId });
    }
  }
  tradeState = null;
  document.body.classList.remove("hud-trade-open");
  window.__tradeLockMovement = false;
}

function openTradeInvite(invite) {
  if (!invite) return;
  ensureInvite();
  inviteState = invite;
  const name = invite.fromName || "Un joueur";
  inviteTextEl.textContent = `${name} veut echanger avec toi.`;
  inviteEl.style.display = "block";
}

function closeTradeInvite() {
  inviteState = null;
  if (inviteEl) inviteEl.style.display = "none";
}

function showTradeError(msg) {
  if (!msg) return;
  const text = msg.message || "Echange impossible.";
  showToast({ title: "Echange", text });
}

export function initDomTrade() {
  ensurePanel();
  ensureInvite();
  closeTradeInvite();
  window.__tradeLockMovement = false;
}

export function handleTradeInvite(msg) {
  openTradeInvite({
    tradeId: msg.tradeId,
    fromId: msg.fromId,
    fromName: msg.fromName,
  });
}

export function handleTradeStarted(msg) {
  closeTradeInvite();
  openTradePanel(msg);
}

export function handleTradeUpdated(msg) {
  updateTradeState(msg);
}

export function handleTradeCancelled(msg) {
  closeTradeInvite();
  closeTradePanel({ sendCancel: false });
  const reason = msg?.reason;
  if (reason === "declined") {
    showToast({ title: "Echange", text: "Demande refusee." });
  } else if (reason === "disconnect") {
    showToast({ title: "Echange", text: "Joueur deconnecte." });
  } else if (reason === "different_map") {
    showToast({ title: "Echange", text: "Pas sur la meme map." });
  } else if (reason === "in_combat") {
    showToast({ title: "Echange", text: "Combat en cours." });
  } else if (reason) {
    showToast({ title: "Echange", text: "Echange annule." });
  }
}

export function handleTradeComplete() {
  closeTradeInvite();
  closeTradePanel({ sendCancel: false });
  showToast({ title: "Echange", text: "Echange termine." });
}

export function handleTradeError(msg) {
  showTradeError(msg);
}
