import { on as onStoreEvent } from "../../state/store.js";
import { getItemDef } from "../inventory/runtime/inventoryAuthority.js";
import { showToast } from "./domToasts.js";

let panelEl = null;
let currentNpc = null;
let currentScene = null;
let currentPlayer = null;
let currentMode = "buy";
let currentCategory = "ressource";
let currentSubCategory = null;
let currentSlot = null;
let currentQuery = "";
let currentPage = 1;
let pageSize = 40;
let totalListings = 0;
let listings = [];
let myListings = [];
let returns = [];
let marketBalance = 0;
let selectedSellItemId = null;
let selectedSellQty = 1;
let selectedSellPrice = "";
let marketInvFilter = "all";
let expandedBuyItemId = null;
let pendingQuery = "";
let marketItemCardEl = null;
let marketItemCardDrag = null;
let marketItemCardDocListener = null;
let buyConfirmState = null;
let buyConfirmListenerReady = false;
let sellEnterListenerReady = false;
let lastSellAction = null;
let lastSellBtnEl = null;
const lastConfirmedPrices = new Map();
let buyConfirmModalEl = null;
let lastConfirmedAction = null;
let unsubMarket = null;
let unsubInventory = null;
let unsubPlayer = null;

const EQUIPMENT_FILTERS = [
  { id: "weapon", label: "Arme" },
  { id: "head", label: "Coiffe" },
  { id: "cape", label: "Cape" },
  { id: "ring", label: "Anneau" },
  { id: "boots", label: "Bottes" },
  { id: "amulet", label: "Amulette" },
  { id: "belt", label: "Ceinture" },
];

const RESOURCE_FILTERS = [
  { id: "all", label: "Tout" },
  { id: "os", label: "Os" },
  { id: "plume", label: "Plume" },
  { id: "patte", label: "Patte" },
  { id: "peau", label: "Peau" },
  { id: "bois", label: "Bois" },
  { id: "plante", label: "Plante" },
  { id: "clef", label: "Clef" },
  { id: "etoffe", label: "Etoffe" },
  { id: "queue", label: "Queue" },
  { id: "divers", label: "Divers" },
  { id: "special", label: "Special" },
];

const MARKET_TAX_PCT = 0.02;
const formatThousands = (value) =>
  String(Math.max(0, Math.round(Number(value) || 0))).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    " "
  );

const STAT_LABELS = {
  vitalite: "Vitalite",
  agilite: "Agilite",
  force: "Force",
  intelligence: "Intelligence",
  chance: "Chance",
  sagesse: "Sagesse",
  pa: "PA",
  pm: "PM",
};

const EFFECT_LABELS = {
  hpPlus: "PV",
  paPlusCombat: "PA (combat)",
};

const STAT_CLASS_MAP = {
  vitalite: "vitalite",
  agilite: "agilite",
  force: "force",
  intelligence: "intel",
  chance: "chance",
  sagesse: "sagesse",
  pa: "pa",
  pm: "pm",
};

const EFFECT_CLASS_MAP = {
  hpPlus: "hp",
  paPlusCombat: "pa",
};

function buildDetailLines(def) {
  const lines = [];
  if (def?.statsBonus && typeof def.statsBonus === "object") {
    Object.entries(def.statsBonus).forEach(([key, value]) => {
      if (!Number.isFinite(value) || value === 0) return;
      const label = STAT_LABELS[key] || key;
      const sign = value > 0 ? "+" : "";
      const cls = STAT_CLASS_MAP[key] || "generic";
      lines.push({ text: `${sign}${value} ${label}`, cls });
    });
  }
  if (def?.effect && typeof def.effect === "object") {
    Object.entries(def.effect).forEach(([key, value]) => {
      if (!Number.isFinite(value) || value === 0) return;
      const label = EFFECT_LABELS[key] || key;
      const sign = value > 0 ? "+" : "";
      const cls = EFFECT_CLASS_MAP[key] || "generic";
      lines.push({ text: `${sign}${value} ${label}`, cls });
    });
  }
  return lines;
}

function ensureMarketItemCard() {
  if (marketItemCardEl) return marketItemCardEl;
  marketItemCardEl = document.createElement("div");
  marketItemCardEl.className = "market-item-card";
  marketItemCardEl.style.display = "none";
  marketItemCardEl.innerHTML = `
    <div class="market-item-card-header">
      <span class="market-item-card-title"></span>
      <button type="button" class="market-item-card-close" aria-label="Fermer">X</button>
    </div>
    <div class="market-item-card-body"></div>
  `;
  document.body.appendChild(marketItemCardEl);

  const closeBtn = marketItemCardEl.querySelector(".market-item-card-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", hideMarketItemCard);
  }

  const header = marketItemCardEl.querySelector(".market-item-card-header");
  if (header) {
    header.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      const rect = marketItemCardEl.getBoundingClientRect();
      marketItemCardDrag = {
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
      };
      event.preventDefault();
    });
  }

  window.addEventListener("mousemove", (event) => {
    if (!marketItemCardDrag || !marketItemCardEl) return;
    const left = Math.max(8, event.clientX - marketItemCardDrag.offsetX);
    const top = Math.max(8, event.clientY - marketItemCardDrag.offsetY);
    marketItemCardEl.style.left = `${left}px`;
    marketItemCardEl.style.top = `${top}px`;
  });
  window.addEventListener("mouseup", () => {
    marketItemCardDrag = null;
  });

  if (!marketItemCardDocListener) {
    marketItemCardDocListener = (event) => {
      if (!marketItemCardEl || marketItemCardEl.style.display === "none") return;
      const target = event.target;
      if (marketItemCardEl.contains(target)) return;
      if (target?.classList?.contains("market-buy-pack-icon")) return;
      hideMarketItemCard();
    };
    document.addEventListener("mousedown", marketItemCardDocListener);
  }

  return marketItemCardEl;
}

function showMarketItemCard(def, anchorEl) {
  if (!def || !anchorEl) return;
  const card = ensureMarketItemCard();
  const titleEl = card.querySelector(".market-item-card-title");
  const bodyEl = card.querySelector(".market-item-card-body");
  if (titleEl) titleEl.textContent = def.label || def.id;

  const level =
    typeof def.requiredLevel === "number"
      ? def.requiredLevel
      : typeof def.level === "number"
        ? def.level
        : 1;
  const description = String(def.description || "Aucune description.");
  const bonusInfo = String(def.bonusInfo || "");
  const lines = buildDetailLines(def);
  const linesHtml = lines.length
    ? `<div class="market-item-card-stats">${lines
        .map(
          (line) =>
            `<div class="market-item-card-stat market-item-card-stat-${line.cls}">${line.text}</div>`
        )
        .join("")}</div>`
    : "";
  const bonusHtml = bonusInfo
    ? `<div class="market-item-card-bonus">${bonusInfo}</div>`
    : "";

  if (bodyEl) {
    bodyEl.innerHTML = `
      <div class="market-item-card-level">Niveau : ${level}</div>
      ${linesHtml}
      <div class="market-item-card-desc">${description}</div>
      ${bonusHtml}
    `;
  }

  card.style.display = "block";
  card.style.left = "0px";
  card.style.top = "0px";
  card.style.visibility = "hidden";

  const rect = anchorEl.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const margin = 8;
  let left = rect.right + margin;
  if (left + cardRect.width > window.innerWidth - margin) {
    left = rect.left - cardRect.width - margin;
  }
  let top = rect.top - 10;
  top = Math.max(margin, Math.min(top, window.innerHeight - cardRect.height - margin));
  card.style.left = `${Math.round(left)}px`;
  card.style.top = `${Math.round(top)}px`;
  card.style.visibility = "visible";
}

function hideMarketItemCard() {
  if (!marketItemCardEl) return;
  marketItemCardEl.style.display = "none";
}

function ensureBuyConfirmModal() {
  if (buyConfirmModalEl) return buyConfirmModalEl;
  buyConfirmModalEl = document.createElement("div");
  buyConfirmModalEl.className = "market-buy-confirm-modal";
  buyConfirmModalEl.style.display = "none";
  buyConfirmModalEl.innerHTML = `
    <div class="market-buy-confirm-card" role="dialog" aria-modal="true">
      <div class="market-buy-confirm-title">Voulez-vous acheter ?</div>
      <div class="market-buy-confirm-actions">
        <button type="button" class="market-buy-confirm-no">Non</button>
        <button type="button" class="market-buy-confirm-yes">Oui</button>
      </div>
      <div class="market-buy-confirm-price"></div>
    </div>
  `;
  document.body.appendChild(buyConfirmModalEl);

  buyConfirmModalEl.addEventListener("mousedown", (event) => {
    if (event.target === buyConfirmModalEl) {
      buyConfirmModalEl.style.display = "none";
      buyConfirmState = null;
    }
  });

  const noBtn = buyConfirmModalEl.querySelector(".market-buy-confirm-no");
  if (noBtn) {
    noBtn.addEventListener("click", () => {
      buyConfirmModalEl.style.display = "none";
      buyConfirmState = null;
    });
  }

  const yesBtn = buyConfirmModalEl.querySelector(".market-buy-confirm-yes");
  if (yesBtn) {
    yesBtn.addEventListener("click", () => {
      if (buyConfirmState?.confirm) buyConfirmState.confirm();
    });
  }

  return buyConfirmModalEl;
}

function openBuyConfirmModal({ qty, unitPrice, onConfirm }) {
  const modal = ensureBuyConfirmModal();
  const priceEl = modal.querySelector(".market-buy-confirm-price");
  if (priceEl) {
    priceEl.textContent = `${formatThousands(unitPrice)} or`;
  }
  buyConfirmState = {
    confirm: () => {
      modal.style.display = "none";
      buyConfirmState = null;
      onConfirm();
    },
  };
  modal.style.display = "flex";
  const yesBtn = modal.querySelector(".market-buy-confirm-yes");
  if (yesBtn && typeof yesBtn.focus === "function") {
    yesBtn.focus();
  }
}

function getBestEntryForPack(itemId, qty) {
  if (!itemId || !Number.isFinite(qty)) return null;
  let best = null;
  listings.forEach((entry) => {
    if (entry.itemId !== itemId) return;
    if (entry.qty !== qty) return;
    if (!best || entry.unitPrice < best.unitPrice) {
      best = entry;
    }
  });
  return best;
}

function ensureBuyConfirmListener() {
  if (buyConfirmListenerReady || typeof document === "undefined") return;
  buyConfirmListenerReady = true;
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    if (!buyConfirmState) return;
    event.preventDefault();
    buyConfirmState.confirm();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    if (buyConfirmState) return;
    if (!lastConfirmedAction) return;
    const active = document.activeElement;
    if (active && active.tagName === "INPUT") return;
    const { itemId, qty, unitPrice } = lastConfirmedAction;
    const best = getBestEntryForPack(itemId, qty);
    if (!best) return;
    event.preventDefault();
    if (best.unitPrice === unitPrice) {
      sendMarketCmd("CmdMarketBuy", { itemId, unitPrice, qty });
      return;
    }
    openBuyConfirmModal({
      qty,
      unitPrice: best.unitPrice,
      onConfirm: () => {
        const confirmKey = `${itemId}:${qty}`;
        lastConfirmedPrices.set(confirmKey, best.unitPrice);
        lastConfirmedAction = {
          itemId,
          qty,
          unitPrice: best.unitPrice,
        };
        sendMarketCmd("CmdMarketBuy", {
          itemId,
          unitPrice: best.unitPrice,
          qty,
        });
      },
    });
  });
}


function ensurePanelElements() {
  if (panelEl) return panelEl;

  if (!document.getElementById("market-css")) {
    const link = document.createElement("link");
    link.id = "market-css";
    link.rel = "stylesheet";
    link.href = "assets/css/market.css";
    document.head.appendChild(link);
  }

  panelEl = document.createElement("div");
  panelEl.id = "market-panel";
  panelEl.className = "market-panel";
  panelEl.innerHTML = `
    <div class="market-panel-inner">
      <header class="market-header">
        <div class="market-header-left">
          <div class="market-title">Hotel des ventes</div>
          <div class="market-balance">
            Solde HDV : <span id="market-balance-value">0</span>
            <input id="market-withdraw-input" type="number" min="1" step="1" placeholder="Montant" />
            <button id="market-withdraw-btn" type="button">Retirer</button>
          </div>
        </div>
        <button type="button" class="market-close" aria-label="Fermer">X</button>
      </header>

      <div class="market-tabs">
        <button type="button" data-mode="buy" class="market-tab">Acheter</button>
        <button type="button" data-mode="sell" class="market-tab">Vendre</button>
      </div>

      <div class="market-body">
        <aside class="market-filters">
          <div id="market-filter-groups">
          <div class="market-filter-group">
            <div class="market-filter-title">Categorie</div>
            <div class="market-category-tabs">
              <button type="button" data-category="equipement">Equipement</button>
              <button type="button" data-category="consommable">Consommable</button>
              <button type="button" data-category="ressource">Ressource</button>
            </div>
          </div>
          <div class="market-filter-group">
            <div class="market-filter-title">Filtres</div>
            <div id="market-subfilters" class="market-subfilters"></div>
          </div>
          <div class="market-filter-group" id="market-search-group">
            <div class="market-filter-title">Recherche</div>
            <input id="market-search" class="market-search" type="search" placeholder="Nom de l'objet" />
          </div>
          </div>
          <div id="market-sell-left" class="market-sell-left"></div>
        </aside>

        <div class="market-list-wrap">
          <div class="market-list-top">
            <div id="market-list-title" class="market-list-title-outer">Offres</div>
            <div id="market-search-target" class="market-search-target"></div>
          </div>

          <section class="market-list">
            <div class="market-list-header">
              <div class="market-pagination">
                <button type="button" id="market-prev">Prec</button>
                <div id="market-page">1</div>
                <button type="button" id="market-next">Suiv</button>
              </div>
            </div>
            <div id="market-list-content" class="market-list-content"></div>
          </section>
        </div>

        <div class="market-inventory-wrap">
          <div class="market-inventory-title">Inventaire</div>
          <aside id="market-inventory" class="market-inventory">
            <div class="market-inventory-header">
              <div class="inventory-filters market-inventory-filters">
                <button class="inventory-filter-btn" data-filter="all">Tout</button>
                <button class="inventory-filter-btn" data-filter="equipement">Equip.</button>
                <button class="inventory-filter-btn" data-filter="consommable">Consom.</button>
                <button class="inventory-filter-btn" data-filter="ressource">Ress.</button>
              </div>
            </div>
            <div class="inventory-gold">
              Or : <span id="market-inventory-gold">0</span>
            </div>
            <div id="market-inventory-grid" class="inventory-grid"></div>
          </aside>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(panelEl);

  const closeBtn = panelEl.querySelector(".market-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => closeMarketPanel());
  }

  const withdrawBtn = panelEl.querySelector("#market-withdraw-btn");
  const withdrawInput = panelEl.querySelector("#market-withdraw-input");
  if (withdrawBtn && withdrawInput) {
    withdrawBtn.addEventListener("click", () => {
      const amount = Math.max(0, Math.round(Number(withdrawInput.value)));
      if (!amount) return;
      if (!sendMarketCmd("CmdMarketWithdraw", { amount })) return;
      withdrawInput.value = "";
    });
  }

  const tabs = panelEl.querySelectorAll(".market-tab");
  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      currentMode = btn.getAttribute("data-mode") || "buy";
      tabs.forEach((tab) => tab.classList.toggle("active", tab === btn));
      renderMarket();
      if (currentMode === "sell") {
        requestMine();
      } else {
        requestListings();
      }
    });
  });

  const categoryBtns = panelEl.querySelectorAll(".market-category-tabs button");
  categoryBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      currentCategory = btn.getAttribute("data-category") || "ressource";
      currentSubCategory = null;
      currentSlot = null;
      currentPage = 1;
      updateFilterUi();
      if (currentMode === "buy") {
        requestListings();
      } else {
        renderMarket();
      }
    });
  });

  const searchInput = panelEl.querySelector("#market-search");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      pendingQuery = searchInput.value || "";
      if (!pendingQuery && currentQuery) {
        currentQuery = "";
        currentPage = 1;
        if (currentMode === "buy") {
          requestListings();
        } else {
          renderMarket();
        }
      }
    });
    searchInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      currentQuery = pendingQuery;
      currentPage = 1;
      if (currentMode === "buy") {
        requestListings();
      } else {
        renderMarket();
      }
    });
  }

  const invFilterBtns = panelEl.querySelectorAll(
    ".market-inventory-wrap .inventory-filter-btn"
  );
  invFilterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      marketInvFilter = btn.getAttribute("data-filter") || "all";
      invFilterBtns.forEach((el) =>
        el.classList.toggle("inventory-filter-active", el === btn)
      );
      renderMarket();
    });
  });

  const prevBtn = panelEl.querySelector("#market-prev");
  const nextBtn = panelEl.querySelector("#market-next");
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (currentMode !== "buy") return;
      if (currentPage <= 1) return;
      currentPage -= 1;
      requestListings();
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (currentMode !== "buy") return;
      const maxPage = Math.max(1, Math.ceil(totalListings / pageSize));
      if (currentPage >= maxPage) return;
      currentPage += 1;
      requestListings();
    });
  }

  return panelEl;
}

function sendMarketCmd(command, payload) {
  if (typeof window === "undefined") return false;
  if (window.__lanInventoryAuthority !== true) return false;
  const client = window.__lanClient;
  const playerId = window.__netPlayerId;
  if (!client || !Number.isInteger(playerId)) return false;
  try {
    client.sendCmd(command, { playerId, ...payload });
    return true;
  } catch {
    return false;
  }
}

function requestListings() {
  if (currentMode !== "buy") return;
  sendMarketCmd("CmdMarketList", {
    page: currentPage,
    pageSize,
    category: currentCategory,
    subCategory: currentSubCategory,
    slot: currentSlot,
    query: currentQuery,
  });
}

function requestMine() {
  sendMarketCmd("CmdMarketMyListings", {});
}

function requestBalance() {
  sendMarketCmd("CmdMarketBalance", {});
}

function updateBalanceUi() {
  if (!panelEl) return;
  const balanceEl = panelEl.querySelector("#market-balance-value");
  if (balanceEl) balanceEl.textContent = formatThousands(marketBalance);
}

function updatePaginationUi() {
  if (!panelEl) return;
  const maxPage = Math.max(1, Math.ceil(totalListings / pageSize));
  const pageEl = panelEl.querySelector("#market-page");
  const prevBtn = panelEl.querySelector("#market-prev");
  const nextBtn = panelEl.querySelector("#market-next");
  const pagination = panelEl.querySelector(".market-pagination");
  if (pagination) pagination.style.display = currentMode === "buy" ? "flex" : "none";
  if (pageEl) pageEl.textContent = `${currentPage} / ${maxPage}`;
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= maxPage;
}

function placeSearchInput() {
  if (!panelEl) return;
  const searchInput = panelEl.querySelector("#market-search");
  const searchTarget = panelEl.querySelector("#market-search-target");
  const searchGroup = panelEl.querySelector("#market-search-group");
  if (!searchInput || !searchTarget || !searchGroup) return;
  if (!searchTarget.querySelector(".market-search-label")) {
    const label = document.createElement("button");
    label.type = "button";
    label.className = "market-search-label market-search-btn";
    label.textContent = "Rechercher";
    const triggerSearch = () => {
      pendingQuery = searchInput.value || "";
      currentQuery = pendingQuery;
      currentPage = 1;
      if (currentMode === "buy") {
        requestListings();
      } else {
        renderMarket();
      }
      searchInput.focus();
    };
    label.addEventListener("click", triggerSearch);
    label.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        triggerSearch();
      }
    });
    searchTarget.prepend(label);
  }
  if (searchInput.parentElement !== searchTarget) {
    searchTarget.appendChild(searchInput);
  }
  searchGroup.style.display = "none";
}

function matchesFilters(def) {
  if (!def) return false;
  const query = currentQuery.trim().toLowerCase();
  if (currentMode !== "buy") {
    if (!query) return true;
    const label = String(def.label || "").toLowerCase();
    const id = String(def.id || "").toLowerCase();
    return label.includes(query) || id.includes(query);
  }
  if (currentCategory && def.category !== currentCategory) return false;
  if (currentCategory === "equipement" && currentSlot) {
    if (currentSlot === "ring") {
      if (def.slot !== "ring1" && def.slot !== "ring2") return false;
    } else if (def.slot !== currentSlot) {
      return false;
    }
  }
  if (currentCategory === "ressource" && currentSubCategory) {
    if (def.subCategory !== currentSubCategory) return false;
  }
  if (query) {
    const label = String(def.label || "").toLowerCase();
    const id = String(def.id || "").toLowerCase();
    if (!label.includes(query) && !id.includes(query)) return false;
  }
  return true;
}

function updateFilterUi() {
  if (!panelEl) return;
  const categoryBtns = panelEl.querySelectorAll(".market-category-tabs button");
  categoryBtns.forEach((btn) => {
    const id = btn.getAttribute("data-category");
    btn.classList.toggle("active", id === currentCategory);
  });

  const subfilters = panelEl.querySelector("#market-subfilters");
  if (!subfilters) return;
  subfilters.innerHTML = "";
  let filters = [];
  if (currentCategory === "equipement") {
    filters = EQUIPMENT_FILTERS;
  } else if (currentCategory === "ressource") {
    filters = RESOURCE_FILTERS;
  }

  filters.forEach((filter) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "market-subfilter";
    btn.textContent = filter.label;
    const active =
      (currentCategory === "equipement" && currentSlot === filter.id) ||
      (currentCategory === "ressource" &&
        (filter.id === "all"
          ? currentSubCategory === null
          : currentSubCategory === filter.id));
    btn.classList.toggle("active", active);
    btn.addEventListener("click", () => {
      if (currentCategory === "equipement") {
        currentSlot = currentSlot === filter.id ? null : filter.id;
      } else {
        currentSubCategory =
          filter.id === "all"
            ? null
            : currentSubCategory === filter.id
              ? null
              : filter.id;
      }
      currentPage = 1;
      updateFilterUi();
      requestListings();
    });
    subfilters.appendChild(btn);
  });
}

function collectInventoryItems() {
  const inv = currentPlayer?.inventory;
  if (!inv || !Array.isArray(inv.slots)) return [];
  const totals = new Map();
  inv.slots.forEach((slot) => {
    if (!slot || !slot.itemId) return;
    const prev = totals.get(slot.itemId) || 0;
    totals.set(slot.itemId, prev + (slot.qty || 0));
  });
  return Array.from(totals.entries())
    .map(([itemId, qty]) => ({
      itemId,
      qty,
      def: getItemDef(itemId),
    }))
    .filter((entry) => entry.def && entry.def.category !== "quete");
}

function getSelectedSellEntry() {
  if (!selectedSellItemId) return null;
  const items = collectInventoryItems();
  return items.find((entry) => entry.itemId === selectedSellItemId) || null;
}

function attemptSellSelected() {
  const selectedEntry = getSelectedSellEntry();
  if (!selectedEntry) return false;
  const unitPrice = Math.max(0, Math.round(Number(selectedSellPrice) || 0));
  if (!unitPrice) {
    showToast({ title: "HDV", text: "Prix invalide." });
    return false;
  }
  sendMarketCmd("CmdMarketSell", {
    itemId: selectedEntry.itemId,
    qty: selectedSellQty,
    unitPrice,
  });
  lastSellAction = {
    itemId: selectedEntry.itemId,
    qty: selectedSellQty,
    unitPrice,
  };
  return true;
}

function applyInventoryFilters(items) {
  return items.filter((entry) => {
    const def = entry.def;
    if (!def) return false;
    if (marketInvFilter !== "all" && def.category !== marketInvFilter) return false;
    return true;
  });
}

function renderBuyList(container) {
  if (!listings.length) {
    container.innerHTML = `<div class="market-empty">Aucune offre.</div>`;
    return;
  }

  ensureBuyConfirmListener();

  const qtyValues = [1, 10, 100];
  const grouped = new Map();

  listings.forEach((entry) => {
    const def = getItemDef(entry.itemId);
    if (!def) return;
    const qty = Number(entry.qty) || 0;
    if (qty <= 0) return;
    const current = grouped.get(entry.itemId) || {
      itemId: entry.itemId,
      def,
      packs: new Map(),
    };
    qtyValues.forEach((value) => {
      if (qty !== value) return;
      const existing = current.packs.get(value);
      if (!existing || entry.unitPrice < existing.unitPrice) {
        current.packs.set(value, entry);
      }
    });
    grouped.set(entry.itemId, current);
  });

  const items = Array.from(grouped.values());
  if (!items.length) {
    container.innerHTML = `<div class="market-empty">Aucune offre.</div>`;
    return;
  }

  items.forEach((item) => {
    const availableQtys = qtyValues.filter((value) => item.packs.has(value));
    if (!availableQtys.length) return;

    const row = document.createElement("div");
    row.className = "market-row market-row-buy market-buy-item";
    const isExpanded = expandedBuyItemId === item.itemId;
    row.classList.toggle("expanded", isExpanded);

    const header = document.createElement("button");
    header.type = "button";
    header.className = "market-buy-header";
    header.setAttribute("aria-expanded", isExpanded ? "true" : "false");
    header.addEventListener("click", () => {
      expandedBuyItemId = expandedBuyItemId === item.itemId ? null : item.itemId;
      renderMarket();
    });

    const headerLeft = document.createElement("div");
    headerLeft.className = "market-buy-header-left";

    const icon = document.createElement("img");
    icon.className = "market-row-icon";
    if (item.def.icon) icon.src = item.def.icon;
    icon.alt = item.def.label || item.itemId;
    icon.dataset.itemId = item.itemId;
    headerLeft.appendChild(icon);

    const title = document.createElement("div");
    title.className = "market-buy-name";
    title.textContent = item.def.label || item.itemId;
    headerLeft.appendChild(title);

    const headerRight = document.createElement("div");
    headerRight.className = "market-buy-header-right";

    const levelEl = document.createElement("div");
    levelEl.className = "market-buy-header-level";
    const levelValue =
      typeof item.def?.requiredLevel === "number" ? item.def.requiredLevel : 1;
    levelEl.textContent = `NIV ${levelValue}`;
    headerRight.appendChild(levelEl);

    header.appendChild(headerLeft);
    header.appendChild(headerRight);

    const packs = document.createElement("div");
    packs.className = "market-buy-pack-list";
    availableQtys.forEach((value) => {
      const entry = item.packs.get(value);
      if (!entry) return;
      const confirmKey = `${entry.itemId}:${value}`;
      const packRow = document.createElement("div");
      packRow.className = "market-buy-pack-row";

    const packIcon = document.createElement("img");
    packIcon.className = "market-buy-pack-icon";
    if (item.def?.icon) packIcon.src = item.def.icon;
    packIcon.alt = item.def?.label || item.itemId;
    packIcon.addEventListener("click", (event) => {
      event.stopPropagation();
      showMarketItemCard(item.def, packIcon);
    });

      const qtyEl = document.createElement("div");
      qtyEl.className = "market-buy-pack-qty";
      qtyEl.textContent = `x${value}`;

      const priceEl = document.createElement("div");
      priceEl.className = "market-buy-pack-price";
      priceEl.textContent = `${formatThousands(entry.unitPrice)} or`;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "market-row-action market-buy-pack-btn";
      btn.textContent = "Acheter";
      btn.addEventListener("click", () => {
        const lastPrice = lastConfirmedPrices.get(confirmKey);
        if (lastPrice === entry.unitPrice) {
          sendMarketCmd("CmdMarketBuy", {
            itemId: entry.itemId,
            unitPrice: entry.unitPrice,
            qty: value,
          });
          lastConfirmedAction = {
            itemId: entry.itemId,
            qty: value,
            unitPrice: entry.unitPrice,
          };
          return;
        }
        openBuyConfirmModal({
          qty: value,
          unitPrice: entry.unitPrice,
          onConfirm: () => {
            lastConfirmedPrices.set(confirmKey, entry.unitPrice);
            lastConfirmedAction = {
              itemId: entry.itemId,
              qty: value,
              unitPrice: entry.unitPrice,
            };
            sendMarketCmd("CmdMarketBuy", {
              itemId: entry.itemId,
              unitPrice: entry.unitPrice,
              qty: value,
            });
          },
        });
      });

      packRow.appendChild(packIcon);
      packRow.appendChild(qtyEl);
      packRow.appendChild(priceEl);
      packRow.appendChild(btn);
      packs.appendChild(packRow);
    });

    row.appendChild(header);
    row.appendChild(packs);
    container.appendChild(row);
  });
}

function filterListingEntries(entries) {
  return entries.filter((entry) => {
    const def = getItemDef(entry.itemId || entry.item_id);
    return matchesFilters(def);
  });
}

function renderMineList(container) {
  const filteredListings = filterListingEntries(myListings);
  const filteredReturns = filterListingEntries(returns);
  const activeTitle = document.createElement("div");
  activeTitle.className = "market-section-title";
  activeTitle.textContent = "Ventes actives";
  container.appendChild(activeTitle);

  if (!filteredListings.length) {
    const empty = document.createElement("div");
    empty.className = "market-empty";
    empty.textContent = "Aucune vente en cours.";
    container.appendChild(empty);
  } else {
    filteredListings.forEach((entry) => {
      const def = getItemDef(entry.itemId);
      if (!def) return;
      const row = document.createElement("div");
      row.className = "market-row";

      const left = document.createElement("div");
      left.className = "market-row-left";
      const icon = document.createElement("img");
      icon.className = "market-row-icon";
      if (def.icon) icon.src = def.icon;
      icon.alt = def.label || entry.itemId;
      icon.dataset.itemId = entry.itemId;
      left.appendChild(icon);

      const info = document.createElement("div");
      info.className = "market-row-info";
      const title = document.createElement("div");
      title.textContent = def.label || entry.itemId;
      const meta = document.createElement("div");
      meta.className = "market-row-meta";
      const remainingMs = Math.max(0, entry.expiresAt - Date.now());
      const days = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
      meta.textContent = `x${formatThousands(entry.qty)} - ${formatThousands(entry.unitPrice)} or/lot - ${days}j`;
      info.appendChild(title);
      info.appendChild(meta);
      left.appendChild(info);

      const right = document.createElement("div");
      right.className = "market-row-right";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "market-row-action";
      btn.textContent = "Annuler";
      btn.addEventListener("click", () => {
        sendMarketCmd("CmdMarketCancel", { listingId: entry.listingId });
      });
      right.appendChild(btn);

      row.appendChild(left);
      row.appendChild(right);
      container.appendChild(row);
    });
  }

  const returnsTitle = document.createElement("div");
  returnsTitle.className = "market-section-title";
  returnsTitle.textContent = "Retours";
  container.appendChild(returnsTitle);

  if (!filteredReturns.length) {
    const empty = document.createElement("div");
    empty.className = "market-empty";
    empty.textContent = "Aucun retour.";
    container.appendChild(empty);
    return;
  }

  filteredReturns.forEach((entry) => {
    const def = getItemDef(entry.item_id || entry.itemId);
    if (!def) return;
    const row = document.createElement("div");
    row.className = "market-row";

    const left = document.createElement("div");
    left.className = "market-row-left";
    const icon = document.createElement("img");
    icon.className = "market-row-icon";
    if (def.icon) icon.src = def.icon;
    icon.alt = def.label || entry.itemId;
    icon.dataset.itemId = entry.item_id || entry.itemId;
    left.appendChild(icon);

    const info = document.createElement("div");
    info.className = "market-row-info";
    const title = document.createElement("div");
    title.textContent = def.label || entry.itemId;
    const meta = document.createElement("div");
    meta.className = "market-row-meta";
      meta.textContent = `x${formatThousands(entry.qty)}`;
    info.appendChild(title);
    info.appendChild(meta);
    left.appendChild(info);

    const right = document.createElement("div");
    right.className = "market-row-right";
    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.min = "1";
    qtyInput.max = String(entry.qty);
    qtyInput.value = String(entry.qty);
    qtyInput.className = "market-row-input";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "market-row-action";
    btn.textContent = "Recuperer";
    btn.addEventListener("click", () => {
      const qty = Math.max(1, Math.min(entry.qty, Math.round(Number(qtyInput.value) || 1)));
      sendMarketCmd("CmdMarketClaimReturn", {
        returnId: entry.return_id || entry.returnId,
        qty,
      });
    });
    right.appendChild(qtyInput);
    right.appendChild(btn);

    row.appendChild(left);
    row.appendChild(right);
    container.appendChild(row);
  });
}

function renderSellLeftPanel() {
  if (!panelEl) return;
  const left = panelEl.querySelector("#market-sell-left");
  if (!left) return;

  if (currentMode !== "sell") {
    left.innerHTML = "";
    return;
  }

  const selectedEntry = getSelectedSellEntry();

  left.innerHTML = "";
  const hasSelection = !!selectedEntry;

  if (selectedEntry) {
    const def = selectedEntry.def;
    const qtyValues = [1, 10, 100];
    const allowed = qtyValues.filter((value) =>
      def?.stackable === false ? value === 1 : selectedEntry.qty >= value
    );
    if (!allowed.includes(selectedSellQty)) {
      selectedSellQty = allowed.length ? allowed[0] : 1;
    }
  }

  const formTitle = document.createElement("div");
  formTitle.className = "market-section-title";
  formTitle.textContent = "Mettre en vente";
  left.appendChild(formTitle);

  if (hasSelection) {
    const def = selectedEntry.def;
    const info = document.createElement("div");
    info.className = "market-sell-info";

    const icon = document.createElement("img");
    icon.className = "market-row-icon";
    if (def?.icon) icon.src = def.icon;
    icon.alt = def?.label || selectedEntry.itemId;
    icon.dataset.itemId = selectedEntry.itemId;
    info.appendChild(icon);

    const title = document.createElement("div");
    title.className = "market-sell-title";
    title.textContent = def?.label || selectedEntry.itemId;
    info.appendChild(title);
    left.appendChild(info);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "market-empty";
    placeholder.textContent = "Selectionnez un objet dans l'inventaire.";
    left.appendChild(placeholder);
  }

  const qtyRow = document.createElement("div");
  qtyRow.className = "market-sell-qty";
  const qtyLabel = document.createElement("div");
  qtyLabel.textContent = `Quantite : ${selectedSellQty}`;
  qtyRow.appendChild(qtyLabel);

  const qtyOptions = document.createElement("div");
  qtyOptions.className = "market-qty-options";
  const qtyValues = [1, 10, 100];
  qtyValues.forEach((value) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "market-qty-btn";
    btn.textContent = `x${value}`;
    const maxAllowed =
      !hasSelection
        ? false
        : selectedEntry.def?.stackable === false
          ? value === 1
          : selectedEntry.qty >= value;
    btn.disabled = !maxAllowed;
    btn.classList.toggle("active", selectedSellQty === value);
    btn.addEventListener("click", () => {
      selectedSellQty = value;
      renderMarket();
    });
    qtyOptions.appendChild(btn);
  });
  qtyRow.appendChild(qtyOptions);
  left.appendChild(qtyRow);

  const priceRow = document.createElement("div");
  priceRow.className = "market-sell-price";
  const priceInput = document.createElement("input");
  priceInput.type = "text";
  priceInput.inputMode = "numeric";
  priceInput.autocomplete = "off";
  priceInput.spellcheck = false;
  priceInput.placeholder = "Prix du lot";
  priceInput.value = selectedSellPrice ? formatThousands(selectedSellPrice) : "";
  priceInput.disabled = !hasSelection;
  const taxRow = document.createElement("div");
  taxRow.className = "market-sell-tax";
  const taxLabel = document.createElement("div");
  taxLabel.className = "market-sell-tax-label";
  taxLabel.textContent = "Taxe :";
  const taxValue = document.createElement("div");
  taxValue.className = "market-sell-tax-value";
  const updateTax = () => {
    if (!hasSelection) {
      taxValue.textContent = "-";
      return;
    }
    const unitPrice = Math.max(0, Math.round(Number(selectedSellPrice) || 0));
    if (!unitPrice) {
      taxValue.textContent = "-";
      return;
    }
    const tax = Math.max(0, Math.floor(unitPrice * MARKET_TAX_PCT));
    taxValue.textContent = `${formatThousands(tax)} or`;
  };
  priceInput.addEventListener("input", () => {
    const raw = String(priceInput.value || "").replace(/\D/g, "");
    selectedSellPrice = raw;
    priceInput.value = raw ? formatThousands(raw) : "";
    updateTax();
  });
  priceInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.stopPropagation();
    event.preventDefault();
    attemptSellSelected();
  });
  priceRow.appendChild(priceInput);
  left.appendChild(priceRow);
  taxRow.appendChild(taxLabel);
  taxRow.appendChild(taxValue);
  left.appendChild(taxRow);
  updateTax();

  const sellBtn = document.createElement("button");
  sellBtn.type = "button";
  sellBtn.className = "market-row-action";
  sellBtn.textContent = "Mettre en vente";
  sellBtn.disabled = !hasSelection;
  lastSellBtnEl = sellBtn;
  sellBtn.addEventListener("click", () => {
    const didSell = attemptSellSelected();
    if (didSell && typeof sellBtn.focus === "function") {
      sellBtn.focus();
    }
  });
  left.appendChild(sellBtn);
}

function buildMarketSlot(slotData, isSelected, onSelect) {
  const slot = document.createElement("button");
  slot.type = "button";
  slot.className = "inventory-slot";

  if (slotData) {
    const def = getItemDef(slotData.itemId);
    slot.classList.add("filled");
    slot.dataset.itemId = slotData.itemId;
    if (isSelected) slot.classList.add("market-slot-selected");
    if (def && def.icon) {
      const icon = document.createElement("div");
      icon.className = "inventory-slot-icon";
      icon.style.backgroundImage = `url("${def.icon}")`;
      slot.appendChild(icon);
    } else {
      const label = document.createElement("span");
      label.className = "inventory-slot-label";
      label.textContent = def ? def.label : slotData.itemId;
      slot.appendChild(label);
    }
    if (slotData.qty > 1) {
      const qty = document.createElement("span");
      qty.className = "inventory-slot-qty";
      qty.textContent = String(slotData.qty);
      slot.appendChild(qty);
    }
    slot.addEventListener("click", () => onSelect(slotData));
  } else {
    slot.classList.add("empty");
  }

  return slot;
}

function renderMarketInventory() {
  if (!panelEl) return;
  const panel = panelEl.querySelector("#market-inventory");
  const grid = panelEl.querySelector("#market-inventory-grid");
  const goldEl = panelEl.querySelector("#market-inventory-gold");
  if (!panel || !grid || !goldEl) return;

  if (currentMode !== "sell" && currentMode !== "buy") {
    grid.innerHTML = "";
    return;
  }

  const goldValue =
    typeof currentPlayer?.gold === "number" && !Number.isNaN(currentPlayer?.gold)
      ? currentPlayer.gold
      : 0;
  goldEl.textContent = formatThousands(goldValue);

  const inv = currentPlayer?.inventory;
  if (!inv || !Array.isArray(inv.slots)) {
    grid.innerHTML = "";
    return;
  }

  const filtered = [];
  for (let i = 0; i < inv.size; i += 1) {
    const slotData = inv.slots[i];
    if (!slotData) continue;
    const def = getItemDef(slotData.itemId);
    const cat = def?.category ?? "inconnu";
    if (cat === "quete") continue;
    if (marketInvFilter === "all" || cat === marketInvFilter) {
      filtered.push({ realIndex: i, slotData });
    }
  }

  grid.innerHTML = "";
  for (let v = 0; v < inv.size; v += 1) {
    const entry = filtered[v] || null;
    const slotData = entry ? entry.slotData : null;
    const isSelected = slotData?.itemId === selectedSellItemId;
    const slot = buildMarketSlot(slotData, isSelected, (data) => {
      if (data?.itemId) {
        selectedSellItemId = data.itemId;
        selectedSellQty = 1;
        selectedSellPrice = "";
        renderMarket();
      }
    });
    grid.appendChild(slot);
  }
}

function renderMarket() {
  if (!panelEl) return;
  updateFilterUi();
  updateBalanceUi();
  panelEl.classList.toggle("market-mode-sell", currentMode === "sell");
  panelEl.classList.toggle("market-mode-buy", currentMode === "buy");
  placeSearchInput();

  const listTitle = panelEl.querySelector("#market-list-title");
  if (listTitle) {
    listTitle.textContent = currentMode === "sell" ? "Ventes" : "Offres";
  }

  const content = panelEl.querySelector("#market-list-content");
  if (!content) return;
  content.innerHTML = "";

  if (currentMode === "sell") {
    renderMineList(content);
  } else {
    renderBuyList(content);
  }
  renderSellLeftPanel();
  renderMarketInventory();

  updatePaginationUi();
}

function ensureSellEnterListener() {
  if (sellEnterListenerReady || typeof document === "undefined") return;
  sellEnterListenerReady = true;
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    if (!document.body.classList.contains("market-open")) return;
    if (currentMode !== "sell") return;
    if (buyConfirmState) return;
    const active = document.activeElement;
    if (active && active.tagName === "INPUT") {
      if (!active.closest(".market-sell-price")) return;
    }
    const didSell = attemptSellSelected();
    if (didSell) {
      event.preventDefault();
      if (lastSellBtnEl && typeof lastSellBtnEl.focus === "function") {
        lastSellBtnEl.focus();
      }
    }
  });
}

function attachMarketEvents() {
  if (unsubMarket) return;
  ensureSellEnterListener();
  unsubMarket = [
    onStoreEvent("market:list", (payload) => {
      listings = Array.isArray(payload?.listings) ? payload.listings : [];
      totalListings = Number.isInteger(payload?.total) ? payload.total : 0;
      pageSize = Number.isInteger(payload?.pageSize) ? payload.pageSize : pageSize;
      currentPage = Number.isInteger(payload?.page) ? payload.page : currentPage;
      if (document.body.classList.contains("market-open")) {
        renderMarket();
      }
    }),
    onStoreEvent("market:mine", (payload) => {
      myListings = Array.isArray(payload?.listings) ? payload.listings : [];
      returns = Array.isArray(payload?.returns) ? payload.returns : [];
      if (document.body.classList.contains("market-open")) {
        renderMarket();
      }
    }),
    onStoreEvent("market:balance", (payload) => {
      marketBalance = Number.isFinite(payload?.balance) ? payload.balance : 0;
      if (document.body.classList.contains("market-open")) {
        updateBalanceUi();
      }
    }),
    onStoreEvent("market:notice", (payload) => {
      if (!payload) return;
      const text = payload.message || "";
      if (!text) return;
      const title = payload.kind === "error" ? "HDV" : "HDV";
      showToast({ title, text });
      requestBalance();
      requestMine();
      requestListings();
    }),
  ];
}

function detachMarketEvents() {
  if (!unsubMarket) return;
  unsubMarket.forEach((unsub) => {
    try {
      unsub();
    } catch {
      // ignore unsubscribe errors
    }
  });
  unsubMarket = null;
}

export function openMarketPanel(scene, player, npc) {
  ensurePanelElements();
  currentScene = scene || null;
  currentNpc = npc || null;
  currentPlayer = player || null;
  currentMode = "buy";
  currentCategory = "ressource";
  currentSubCategory = null;
  currentSlot = null;
  currentQuery = "";
  currentPage = 1;
  selectedSellItemId = null;
  selectedSellQty = 1;
  selectedSellPrice = "";
  marketInvFilter = "all";
  expandedBuyItemId = null;
  pendingQuery = "";

  const tabs = panelEl.querySelectorAll(".market-tab");
  tabs.forEach((btn) => {
    const mode = btn.getAttribute("data-mode") || "";
    btn.classList.toggle("active", mode === "buy");
  });

  const invFilterBtns = panelEl.querySelectorAll(
    ".market-inventory-wrap .inventory-filter-btn"
  );
  invFilterBtns.forEach((btn) => {
    const filter = btn.getAttribute("data-filter") || "";
    btn.classList.toggle("inventory-filter-active", filter === "all");
  });

  renderMarket();
  attachMarketEvents();
  requestBalance();
  requestMine();
  requestListings();

  document.body.classList.add("market-open");
  if (typeof window !== "undefined") {
    window.__marketCloseRequest = closeMarketPanel;
  }

  if (!unsubInventory) {
    unsubInventory = onStoreEvent("inventory:updated", () => {
      if (document.body.classList.contains("market-open")) renderMarket();
    });
  }
  if (!unsubPlayer) {
    unsubPlayer = onStoreEvent("player:updated", () => {
      if (document.body.classList.contains("market-open")) updateBalanceUi();
    });
  }
}

export function closeMarketPanel() {
  document.body.classList.remove("market-open");
  detachMarketEvents();
  hideMarketItemCard();
  if (typeof window !== "undefined" && window.__marketCloseRequest === closeMarketPanel) {
    window.__marketCloseRequest = null;
  }
}

export function isMarketOpen() {
  return document.body.classList.contains("market-open");
}
