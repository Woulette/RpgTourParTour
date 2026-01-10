import { shops } from "../../shops/catalog.js";
import { getItemDef, addItem, removeItem } from "../inventory/runtime/inventoryAuthority.js";
import { on as onStoreEvent } from "../../state/store.js";
import { adjustGold } from "../inventory/runtime/goldAuthority.js";
import { startNpcDialogFlow } from "../npc/runtime/dialogFlow.js";

let panelEl = null;
let currentNpc = null;
let currentScene = null;
let currentPlayer = null;
let currentShop = null;
let currentMode = "buy";
let unsubInventory = null;
let unsubPlayer = null;

function ensurePanelElements() {
  if (panelEl) return panelEl;

  if (!document.getElementById("shop-css")) {
    const link = document.createElement("link");
    link.id = "shop-css";
    link.rel = "stylesheet";
    link.href = "assets/css/shop.css";
    document.head.appendChild(link);
  }

  panelEl = document.createElement("div");
  panelEl.id = "shop-panel";
  panelEl.className = "shop-panel";
  panelEl.innerHTML = `
    <div class="shop-panel-inner">
      <header class="shop-panel-header">
        <h3 id="shop-title">Marchand</h3>
        <button type="button" class="shop-panel-close" aria-label="Fermer">X</button>
      </header>
      <div class="shop-panel-actions">
        <button type="button" data-mode="buy" class="shop-tab active">Acheter</button>
        <button type="button" data-mode="sell" class="shop-tab">Vendre</button>
        <button type="button" data-mode="talk" class="shop-tab">Parler</button>
      </div>
      <div class="shop-panel-gold">Or : <span id="shop-gold-value">0</span></div>
      <div class="shop-panel-message" id="shop-message"></div>
      <div class="shop-panel-list" id="shop-list"></div>
    </div>
  `;
  document.body.appendChild(panelEl);

  const closeBtn = panelEl.querySelector(".shop-panel-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => closeShopPanel());
  }

  const tabs = panelEl.querySelectorAll(".shop-tab");
  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-mode") || "buy";
      if (mode === "talk") {
        handleTalk();
        return;
      }
      currentMode = mode;
      tabs.forEach((b) => b.classList.toggle("active", b === btn));
      renderShop();
    });
  });

  return panelEl;
}

function setMessage(text) {
  if (!panelEl) return;
  const msg = panelEl.querySelector("#shop-message");
  if (!msg) return;
  msg.textContent = text || "";
  msg.classList.toggle("visible", !!text);
}

function updateGoldDisplay() {
  if (!panelEl || !currentPlayer) return;
  const goldEl = panelEl.querySelector("#shop-gold-value");
  if (!goldEl) return;
  const gold =
    typeof currentPlayer.gold === "number" && !Number.isNaN(currentPlayer.gold)
      ? currentPlayer.gold
      : 0;
  goldEl.textContent = String(gold);
}

function renderBuyList(listEl) {
  const sells = currentShop?.sells || [];
  if (sells.length === 0) {
    setMessage("Aucun objet en vente.");
    return;
  }

  sells.forEach((entry) => {
    if (!entry || !entry.itemId) return;
    const def = getItemDef(entry.itemId);
    const price = Number(entry.price) || 0;

    const row = document.createElement("div");
    row.className = "shop-row";

    const left = document.createElement("div");
    left.className = "shop-row-left";

    const icon = document.createElement("img");
    icon.className = "shop-row-icon";
    if (def?.icon) {
      icon.src = def.icon;
      icon.alt = def?.label || entry.itemId;
    }
    left.appendChild(icon);

    const info = document.createElement("div");
    info.className = "shop-row-info";
    const title = document.createElement("div");
    title.textContent = def?.label || entry.itemId;
    const priceEl = document.createElement("div");
    priceEl.className = "shop-row-price";
    priceEl.textContent = `${price} or`;
    info.appendChild(title);
    info.appendChild(priceEl);
    left.appendChild(info);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "shop-row-action";
    btn.textContent = "Acheter";
    const gold = currentPlayer?.gold ?? 0;
    btn.disabled = price <= 0 || gold < price;

    btn.addEventListener("click", () => {
      if (!currentPlayer || !currentPlayer.inventory) return;
      if (price <= 0) return;
      const availableGold = currentPlayer.gold ?? 0;
      if (availableGold < price) {
        setMessage("Pas assez d'or.");
        return;
      }
      const remaining = addItem(currentPlayer.inventory, entry.itemId, 1);
      if (remaining > 0) {
        setMessage("Inventaire plein.");
        return;
      }
      adjustGold(currentPlayer, -price, "shop_buy");
      setMessage("");
      renderShop();
    });

    row.appendChild(left);
    row.appendChild(btn);
    listEl.appendChild(row);
  });
}

function renderSellList(listEl) {
  const buys = currentShop?.buys || [];
  if (buys.length === 0) {
    setMessage("Le marchand n'achete rien pour le moment.");
    return;
  }

  const buyMap = new Map();
  buys.forEach((entry) => {
    if (!entry || !entry.itemId) return;
    buyMap.set(entry.itemId, Number(entry.price) || 0);
  });

  const counts = new Map();
  const inv = currentPlayer?.inventory;
  if (inv && Array.isArray(inv.slots)) {
    inv.slots.forEach((slot) => {
      if (!slot || !slot.itemId) return;
      const prev = counts.get(slot.itemId) || 0;
      counts.set(slot.itemId, prev + (slot.qty || 0));
    });
  }

  buys.forEach((entry) => {
    if (!entry || !entry.itemId) return;
    const def = getItemDef(entry.itemId);
    const price = Number(entry.price) || 0;
    const owned = counts.get(entry.itemId) || 0;

    const row = document.createElement("div");
    row.className = "shop-row";

    const left = document.createElement("div");
    left.className = "shop-row-left";

    const icon = document.createElement("img");
    icon.className = "shop-row-icon";
    if (def?.icon) {
      icon.src = def.icon;
      icon.alt = def?.label || entry.itemId;
    }
    left.appendChild(icon);

    const info = document.createElement("div");
    info.className = "shop-row-info";
    const title = document.createElement("div");
    title.textContent = def?.label || entry.itemId;
    const priceEl = document.createElement("div");
    priceEl.className = "shop-row-price";
    priceEl.textContent = `${price} or`;
    const qtyEl = document.createElement("div");
    qtyEl.className = "shop-row-qty";
    qtyEl.textContent = `x${owned}`;
    info.appendChild(title);
    info.appendChild(priceEl);
    info.appendChild(qtyEl);
    left.appendChild(info);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "shop-row-action";
    btn.textContent = "Vendre";
    btn.disabled = owned <= 0 || price <= 0;
    btn.addEventListener("click", () => {
      if (!currentPlayer || !currentPlayer.inventory) return;
      if (price <= 0) return;
      const removed = removeItem(currentPlayer.inventory, entry.itemId, 1);
      if (removed <= 0) return;
      adjustGold(currentPlayer, price, "shop_sell");
      setMessage("");
      renderShop();
    });

    row.appendChild(left);
    row.appendChild(btn);
    listEl.appendChild(row);
  });
}

function renderShop() {
  if (!panelEl) return;
  const listEl = panelEl.querySelector("#shop-list");
  if (!listEl) return;
  listEl.innerHTML = "";
  setMessage("");

  updateGoldDisplay();

  if (!currentShop) {
    setMessage("Aucune boutique configuree.");
    return;
  }

  if (currentMode === "sell") {
    renderSellList(listEl);
  } else {
    renderBuyList(listEl);
  }
}

function handleTalk() {
  if (!currentNpc || !currentPlayer || !currentScene) return;
  closeShopPanel();
  startNpcDialogFlow(currentScene, currentPlayer, currentNpc);
}

export function openShopPanel(scene, player, npc) {
  ensurePanelElements();
  currentScene = scene || null;
  currentNpc = npc || null;
  currentPlayer = player || null;
  currentShop = npc?.def?.shopId ? shops[npc.def.shopId] : null;
  currentMode = "buy";

  const titleEl = panelEl.querySelector("#shop-title");
  if (titleEl) {
    titleEl.textContent = npc?.def?.name || "Marchand";
  }

  const tabs = panelEl.querySelectorAll(".shop-tab");
  tabs.forEach((btn) => {
    const mode = btn.getAttribute("data-mode") || "";
    btn.classList.toggle("active", mode === "buy");
  });

  renderShop();

  document.body.classList.add("shop-open");

  if (!unsubInventory) {
    unsubInventory = onStoreEvent("inventory:updated", () => {
      if (document.body.classList.contains("shop-open")) renderShop();
    });
  }
  if (!unsubPlayer) {
    unsubPlayer = onStoreEvent("player:updated", () => {
      if (document.body.classList.contains("shop-open")) renderShop();
    });
  }
}

export function closeShopPanel() {
  document.body.classList.remove("shop-open");
}

export function isShopOpen() {
  return document.body.classList.contains("shop-open");
}
