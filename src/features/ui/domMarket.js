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
      currentQuery = searchInput.value || "";
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
  if (balanceEl) balanceEl.textContent = String(marketBalance);
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
      (currentCategory === "ressource" && currentSubCategory === filter.id);
    btn.classList.toggle("active", active);
    btn.addEventListener("click", () => {
      if (currentCategory === "equipement") {
        currentSlot = currentSlot === filter.id ? null : filter.id;
      } else {
        currentSubCategory = currentSubCategory === filter.id ? null : filter.id;
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

  const qtyValues = [1, 10, 100];
  const grouped = new Map();

  listings.forEach((entry) => {
    const def = getItemDef(entry.itemId);
    if (!def) return;
    const qty = Number(entry.qty) || 0;
    if (!qtyValues.includes(qty)) return;
    const current = grouped.get(entry.itemId) || {
      itemId: entry.itemId,
      def,
      packs: new Map(),
    };
    const existing = current.packs.get(qty);
    if (!existing || entry.unitPrice < existing.unitPrice) {
      current.packs.set(qty, entry);
    }
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
      const packRow = document.createElement("div");
      packRow.className = "market-buy-pack-row";

      const qtyEl = document.createElement("div");
      qtyEl.className = "market-buy-pack-qty";
      qtyEl.textContent = `x${value}`;

      const priceEl = document.createElement("div");
      priceEl.className = "market-buy-pack-price";
      priceEl.textContent = `${entry.unitPrice} or`;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "market-row-action market-buy-pack-btn";
      btn.textContent = "Acheter";
      btn.addEventListener("click", () => {
        sendMarketCmd("CmdMarketBuy", {
          itemId: entry.itemId,
          unitPrice: entry.unitPrice,
          qty: value,
        });
      });

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
      left.appendChild(icon);

      const info = document.createElement("div");
      info.className = "market-row-info";
      const title = document.createElement("div");
      title.textContent = def.label || entry.itemId;
      const meta = document.createElement("div");
      meta.className = "market-row-meta";
      const remainingMs = Math.max(0, entry.expiresAt - Date.now());
      const days = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
      meta.textContent = `x${entry.qty} - ${entry.unitPrice} or/u - ${days}j`;
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
    left.appendChild(icon);

    const info = document.createElement("div");
    info.className = "market-row-info";
    const title = document.createElement("div");
    title.textContent = def.label || entry.itemId;
    const meta = document.createElement("div");
    meta.className = "market-row-meta";
    meta.textContent = `x${entry.qty}`;
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

  const items = collectInventoryItems();
  const selectedEntry = items.find((entry) => entry.itemId === selectedSellItemId) || null;

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
  priceInput.type = "number";
  priceInput.min = "1";
  priceInput.step = "1";
  priceInput.placeholder = "Prix par unite";
  priceInput.value = selectedSellPrice;
  priceInput.disabled = !hasSelection;
  priceInput.addEventListener("input", () => {
    selectedSellPrice = priceInput.value;
  });
  priceRow.appendChild(priceInput);
  left.appendChild(priceRow);

  const sellBtn = document.createElement("button");
  sellBtn.type = "button";
  sellBtn.className = "market-row-action";
  sellBtn.textContent = "Mettre en vente";
  sellBtn.disabled = !hasSelection;
  sellBtn.addEventListener("click", () => {
    if (!hasSelection) return;
    const unitPrice = Math.max(0, Math.round(Number(selectedSellPrice) || 0));
    if (!unitPrice) {
      showToast({ title: "HDV", text: "Prix invalide." });
      return;
    }
    sendMarketCmd("CmdMarketSell", {
      itemId: selectedEntry.itemId,
      qty: selectedSellQty,
      unitPrice,
    });
    selectedSellPrice = "";
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
  goldEl.textContent = String(goldValue);

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

function attachMarketEvents() {
  if (unsubMarket) return;
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
  if (typeof window !== "undefined" && window.__marketCloseRequest === closeMarketPanel) {
    window.__marketCloseRequest = null;
  }
}

export function isMarketOpen() {
  return document.body.classList.contains("market-open");
}
