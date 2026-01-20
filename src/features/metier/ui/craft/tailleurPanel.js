import { ensureTailleurState, addTailleurXp } from "../../tailleur/state.js";
import { tailleurRecipes } from "../../tailleur/recipes.js";
import { removeItem, addItem, getItemDef } from "../../../inventory/runtime/inventoryAuthority.js";
import { emit as emitStoreEvent, on as onStoreEvent } from "../../../state/store.js";
import { getNetClient, getNetPlayerId } from "../../../../app/session.js";

let panelEl = null;
let isOpen = false;
let lastCrafted = null;
let activeRecipePreview = null;
let xpRenderRequested = false;
let craftUnsub = null;

function labelForStatKey(key) {
  switch (key) {
    case "force":
      return "Force";
    case "intelligence":
      return "Intelligence";
    case "agilite":
      return "Agilité";
    case "chance":
      return "Chance";
    case "vitalite":
      return "Vitalité";
    case "initiative":
      return "Initiative";
    case "hp":
    case "hpPlus":
    case "hpMax":
      return "PV";
    case "pa":
    case "paPlus":
      return "PA";
    case "pm":
    case "pmPlus":
      return "PM";
    case "tacle":
      return "Tacle";
    case "fuite":
      return "Fuite";
    case "dommage":
      return "Dommage";
    case "dommageFeu":
      return "Dommage Feu";
    case "dommageEau":
      return "Dommage Eau";
    case "dommageAir":
      return "Dommage Air";
    case "dommageTerre":
      return "Dommage Terre";
    default:
      return key;
  }
}

function formatStatsBonus(bonus) {
  if (!bonus) return [];
  const parts = [];
  Object.entries(bonus).forEach(([key, val]) => {
    if (typeof val !== "number" || val === 0) return;
    const label = labelForStatKey(key);
    const sign = val >= 0 ? "+" : "";
    const cls = (() => {
      switch (key) {
        case "force":
          return "inventory-bonus-stat-force";
        case "intelligence":
          return "inventory-bonus-stat-intel";
        case "agilite":
          return "inventory-bonus-stat-agilite";
        case "chance":
          return "inventory-bonus-stat-chance";
        case "vitalite":
          return "inventory-bonus-stat-vitalite";
        case "initiative":
          return "inventory-bonus-stat-init";
        case "hp":
        case "hpPlus":
        case "hpMax":
          return "inventory-bonus-stat-hp";
        case "pa":
        case "paPlus":
          return "inventory-bonus-stat-pa";
        case "pm":
        case "pmPlus":
          return "inventory-bonus-stat-pm";
        case "dommage":
          return "inventory-bonus-stat-generic";
        case "dommageFeu":
          return "inventory-bonus-stat-feu";
        case "dommageEau":
          return "inventory-bonus-stat-eau";
        case "dommageAir":
          return "inventory-bonus-stat-air";
        case "dommageTerre":
          return "inventory-bonus-stat-terre";
        default:
          return "inventory-bonus-stat-generic";
      }
    })();
    parts.push({ text: `${sign}${val} ${label}`, cls });
  });
  return parts;
}

function ensurePanelElements() {
  if (panelEl) return panelEl;
  // Inject CSS links if not present
  const ensureLink = (id, href) => {
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  };
  ensureLink("craft-base-css", "assets/css/craft-base.css");
  ensureLink("craft-tailleur-css", "assets/css/craft-tailleur.css");

  panelEl = document.createElement("div");
  panelEl.id = "tailleur-craft-panel";
  panelEl.className = "craft-panel tailleur";
  panelEl.innerHTML = `
    <div class="craft-panel-inner">
      <header class="craft-panel-header">
        <h3>Table de Tailleur</h3>
        <button type="button" class="craft-panel-close" aria-label="Fermer">✕</button>
      </header>
      
      <div class="craft-body">
        <section class="craft-left">
          <div class="craft-xp-row">
            <div class="craft-xp-bar">
              <div class="craft-xp-bar-fill" id="tailleur-xp-fill"></div>
              <div class="craft-xp-bar-label" id="tailleur-xp-label">XP 0 / 100</div>
            </div>
            <div class="craft-xp-level">Niv. <span id="tailleur-xp-level">1</span></div>
          </div>
          <div class="craft-recipe-filters">
            <input
              type="number"
              min="1"
              class="craft-filter-level"
              id="tailleur-filter-level"
              placeholder="Niv. max"
            />
            <input
              type="text"
              class="craft-filter-search"
              id="tailleur-filter-search"
              placeholder="Rechercher..."
            />
            <select class="craft-filter-type" id="tailleur-filter-type">
              <option value="all">Tout</option>
              <option value="cape">Cape</option>
              <option value="coiffe">Coiffe</option>
            </select>
          </div>
          <ul class="craft-recipes" id="tailleur-recipes"></ul>
        </section>
        <section class="craft-center">
          <div class="craft-slots" id="tailleur-slots"></div>
          <div class="craft-actions">
            <button type="button" class="craft-btn" id="tailleur-craft-btn">Crafter</button>
            <div class="craft-result empty" id="tailleur-result">
              <span>Aucun craft réalisé.</span>
            </div>
          </div>
        </section>
        <section class="craft-inventory">
          <div class="craft-inventory-header">
            <div class="craft-inventory-filters" id="tailleur-inventory-filters">
              <button type="button" data-filter="all" class="active">Tout</button>
              <button type="button" data-filter="equipement">Équipement</button>
              <button type="button" data-filter="ressource">Ressources</button>
              <button type="button" data-filter="consommable">Consommables</button>
            </div>
          </div>
          <div class="craft-inventory-grid" id="tailleur-inventory"></div>
        </section>
      </div>
    </div>
  `;
  document.body.appendChild(panelEl);

  const closeBtn = panelEl.querySelector(".craft-panel-close");
  closeBtn.addEventListener("click", () => closeTailleurCraftPanel());

  return panelEl;
}

function renderXpHeader(player) {
  if (!panelEl || xpRenderRequested) return;
  xpRenderRequested = true;
  requestAnimationFrame(() => {
    xpRenderRequested = false;
    const state = ensureTailleurState(player);
    if (!state) return;
    const fill = panelEl.querySelector("#tailleur-xp-fill");
    const label = panelEl.querySelector("#tailleur-xp-label");
    const lvl = panelEl.querySelector("#tailleur-xp-level");
    const percent =
      state.xpNext > 0 ? Math.min(100, (state.xp / state.xpNext) * 100) : 0;
    if (fill) fill.style.width = `${percent}%`;
    if (label) label.textContent = `XP ${state.xp} / ${state.xpNext}`;
    if (lvl) lvl.textContent = String(state.level ?? 1);
  });
}

function renderInventory(player) {
  const grid = panelEl.querySelector("#tailleur-inventory");
  if (!grid) return;
  grid.innerHTML = "";
  const inv = player?.inventory;
  if (!inv || !Array.isArray(inv.slots)) return;

  const filterBtn = panelEl.querySelector(
    ".craft-inventory-filters button.active"
  );
  const filter = filterBtn ? filterBtn.dataset.filter : "all";

  inv.slots.forEach((slot) => {
    const cell = document.createElement("div");
    cell.className = "craft-inventory-slot";
    cell.dataset.itemId = slot?.itemId || "";
    const def = slot?.itemId ? getItemDef(slot.itemId) : null;
    const match =
      filter === "all" ||
      (filter === "equipement" && def?.category === "equipement") ||
      ((filter === "ressource" || filter === "ressources") &&
        def?.category === "ressource") ||
      (filter === "consommable" && def?.category === "consommable");

    if (slot && slot.itemId && match) {
      const def = getItemDef(slot.itemId);
      if (def?.icon) {
        const img = document.createElement("img");
        img.src = def.icon;
        img.alt = def.label || slot.itemId;
        cell.appendChild(img);
      } else {
        cell.textContent = def?.label || slot.itemId;
      }
      const qty = document.createElement("span");
      qty.className = "qty";
      qty.textContent = slot.qty;
      cell.appendChild(qty);
    } else if (!match) {
      cell.classList.add("filtered-out");
    }
    grid.appendChild(cell);
  });
}

function renderSlots(recipe, player) {
  const slotsEl = panelEl.querySelector("#tailleur-slots");
  if (!slotsEl) return;
  slotsEl.innerHTML = "";

  const inv = player?.inventory;
  const ownedCount = (id) => {
    if (!inv) return 0;
    return inv.slots.reduce(
      (acc, s) => acc + (s && s.itemId === id ? s.qty : 0),
      0
    );
  };

  const inputs = recipe?.inputs || [];
  for (let i = 0; i < 8; i += 1) {
    const slot = document.createElement("div");
    slot.className = "craft-slot";
    if (inputs[i]) {
      const input = inputs[i];
      const def = getItemDef(input.itemId);
      const have = ownedCount(input.itemId);
      slot.classList.add("filled");
      const img = document.createElement("img");
      if (def?.icon) {
        img.src = def.icon;
        img.alt = def?.label || input.itemId;
      }
      slot.appendChild(img);
      const txt = document.createElement("div");
      txt.textContent = `${have}/${input.qty}`;
      slot.appendChild(txt);
    } else {
      slot.textContent = "Slot";
    }
    slotsEl.appendChild(slot);
  }
}

function renderResult(player) {
  const resultEl = panelEl.querySelector("#tailleur-result");
  if (!resultEl) return;
  resultEl.innerHTML = "";

  // Preview (recette sélectionnée) ou résultat (si craft effectué)
  const recipe = activeRecipePreview;
  const showRecipe = !!recipe;
  const showCrafted =
    !!(showRecipe && lastCrafted && lastCrafted.itemId === recipe.output?.itemId);

  const itemId = showRecipe ? recipe.output?.itemId : lastCrafted?.itemId;
  const qty = showCrafted
    ? lastCrafted?.qty
    : showRecipe
      ? recipe.output?.qty
      : lastCrafted?.qty;

  if (itemId) {
    resultEl.classList.remove("empty");

    const def = getItemDef(itemId);

    const icon = document.createElement("img");
    if (def?.icon) {
      icon.src = def.icon;
      icon.alt = def?.label || itemId;
    }
    resultEl.appendChild(icon);

    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.gap = "6px";
    wrap.style.minWidth = "0";

    const title = document.createElement("div");
    title.innerHTML = `<strong>${def?.label || itemId}</strong>`;
    wrap.appendChild(title);

    const meta = document.createElement("div");
    meta.style.opacity = "0.9";
    meta.style.fontSize = "12px";
    const parts = [];
    if (showRecipe && typeof recipe.level === "number") parts.push(`Niv. ${recipe.level}`);
    if (typeof qty === "number") parts.push(`x${qty}`);
    meta.textContent = parts.join(" • ");
    if (meta.textContent) wrap.appendChild(meta);

    if (showRecipe) {
      const xpLine = document.createElement("div");
      xpLine.style.opacity = "0.9";
      xpLine.style.fontSize = "12px";
      xpLine.textContent = `XP gagné : ${recipe.xpGain ?? 0} XP`;
      wrap.appendChild(xpLine);
    }

    const statsArr = formatStatsBonus(def?.statsBonus);
    if (statsArr.length > 0) {
      const statsBlock = document.createElement("div");
      statsBlock.style.display = "flex";
      statsBlock.style.flexDirection = "column";
      statsBlock.style.gap = "2px";
      statsBlock.style.marginTop = "2px";

      statsArr.forEach((entry) => {
        const line = document.createElement("div");
        line.className = `inventory-bonus-stat ${entry.cls}`;
        line.style.display = "flex";
        line.style.alignItems = "center";
        line.style.gap = "6px";
        line.style.lineHeight = "1.2";
        line.style.padding = "0";

        const valSpan = document.createElement("span");
        valSpan.textContent = entry.text.split(" ")[0];
        const labelSpan = document.createElement("span");
        labelSpan.textContent = entry.text.split(" ").slice(1).join(" ");

        line.appendChild(valSpan);
        line.appendChild(labelSpan);
        statsBlock.appendChild(line);
      });

      wrap.appendChild(statsBlock);
    }

    if (showRecipe) {
      const ingTitle = document.createElement("div");
      ingTitle.style.marginTop = "6px";
      ingTitle.innerHTML = "<strong>Ingrédients :</strong>";
      wrap.appendChild(ingTitle);

      const ingList = document.createElement("div");
      ingList.style.display = "flex";
      ingList.style.flexDirection = "column";
      ingList.style.gap = "6px";
      ingList.style.marginTop = "2px";

      const inv = player?.inventory;
      const ownedCount = (id) =>
        inv?.slots?.reduce(
          (acc, slot) => acc + (slot && slot.itemId === id ? slot.qty : 0),
          0
        ) || 0;

      recipe.inputs.forEach((input) => {
        if (!input || !input.itemId) return;
        const inDef = getItemDef(input.itemId);
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.gap = "8px";

        const img = document.createElement("img");
        img.style.width = "22px";
        img.style.height = "22px";
        img.style.borderRadius = "6px";
        img.style.objectFit = "cover";
        if (inDef?.icon) {
          img.src = inDef.icon;
          img.alt = inDef?.label || input.itemId;
        }
        row.appendChild(img);

        const txt = document.createElement("span");
        const owned = ownedCount(input.itemId);
        txt.textContent = `${owned}/${input.qty} x ${inDef?.label || input.itemId}`;
        row.appendChild(txt);

        ingList.appendChild(row);
      });

      wrap.appendChild(ingList);
    }

    const note = document.createElement("div");
    note.style.marginTop = "6px";
    note.style.opacity = "0.7";
    note.style.fontSize = "12px";
    note.textContent = showCrafted ? "Craft réalisé." : "Aperçu avant craft.";
    wrap.appendChild(note);

    resultEl.appendChild(wrap);
    return;
  }
  if (!lastCrafted) {
    resultEl.classList.add("empty");
    resultEl.textContent = "Aucun craft réalisé.";
    return;
  }
  resultEl.classList.remove("empty");
  const def = getItemDef(lastCrafted.itemId);
  const img = document.createElement("img");
  if (def?.icon) {
    img.src = def.icon;
    img.alt = def?.label || lastCrafted.itemId;
  }
  resultEl.appendChild(img);

  const text = document.createElement("div");
  text.style.display = "flex";
  text.style.flexDirection = "column";
  text.style.alignItems = "flex-start";
  text.style.gap = "2px";
  text.style.position = "relative";

  const title = document.createElement("div");
  title.innerHTML = `<strong>${def?.label || lastCrafted.itemId}</strong>`;
  text.appendChild(title);

  const qtyLine = document.createElement("div");
  qtyLine.textContent = `x${lastCrafted.qty}`;
  text.appendChild(qtyLine);

  const statsArr = formatStatsBonus(def?.statsBonus);
  if (statsArr.length > 0) {
    const statsEl = document.createElement("div");
    statsEl.style.fontSize = "12px";
    statsEl.style.color = "#c9d1d9";
    statsEl.style.marginTop = "-25px";
    statsEl.style.display = "flex";
    statsEl.style.flexDirection = "column";
    statsEl.style.gap = "2px";
    statsEl.style.alignItems = "flex-start";
    statsArr.forEach((entry) => {
      const line = document.createElement("div");
      line.className = `inventory-bonus-stat ${entry.cls}`;
      line.style.display = "block";
      line.style.lineHeight = "1.2";
      line.style.display = "flex";
      line.style.alignItems = "center";
      line.style.gap = "6px";
      line.style.marginLeft = "-50px";
      line.style.marginTop = "-2px";

      const valSpan = document.createElement("span");
      valSpan.textContent = entry.text.split(" ")[0];
      const labelSpan = document.createElement("span");
      labelSpan.textContent = entry.text.split(" ").slice(1).join(" ");

      line.appendChild(valSpan);
      line.appendChild(labelSpan);
      statsEl.appendChild(line);
    });
    text.appendChild(statsEl);
  }

  if (def?.description) {
    const descEl = document.createElement("div");
    descEl.style.fontSize = "11px";
    descEl.style.color = "#aeb8c2";
    descEl.style.marginTop = "2px";
    descEl.textContent = def.description;
    text.appendChild(descEl);
  }

  resultEl.appendChild(text);
}

function getRecipeFilters() {
  const levelInput = panelEl.querySelector("#tailleur-filter-level");
  const searchInput = panelEl.querySelector("#tailleur-filter-search");
  const typeSelect = panelEl.querySelector("#tailleur-filter-type");
  const levelValue = levelInput ? parseInt(levelInput.value, 10) : NaN;
  return {
    levelMax: Number.isFinite(levelValue) ? levelValue : null,
    search: (searchInput?.value || "").trim().toLowerCase(),
    type: typeSelect?.value || "all",
  };
}

function getFilteredRecipes() {
  const filters = getRecipeFilters();
  const sortedRecipes = tailleurRecipes.slice().sort((a, b) => {
    const aLevel = typeof a?.level === "number" ? a.level : 0;
    const bLevel = typeof b?.level === "number" ? b.level : 0;
    if (aLevel !== bLevel) return bLevel - aLevel;
    const aLabel = (a?.label || "").toLowerCase();
    const bLabel = (b?.label || "").toLowerCase();
    return aLabel.localeCompare(bLabel);
  });

  return sortedRecipes.filter((recipe) => {
    if (filters.levelMax !== null && recipe.level > filters.levelMax) {
      return false;
    }
    if (filters.type !== "all" && recipe.category !== filters.type) {
      return false;
    }
    if (filters.search) {
      const label = (recipe.label || "").toLowerCase();
      if (!label.includes(filters.search)) return false;
    }
    return true;
  });
}

function renderRecipes(player, selectedIdRef, filteredRecipes) {
  const list = panelEl.querySelector("#tailleur-recipes");
  if (!list) return;
  list.innerHTML = "";

  const inventory = player?.inventory;
  const state = ensureTailleurState(player);

  const hasItem = (id, qty) => {
    if (!inventory) return false;
    const count = inventory.slots.reduce(
      (acc, slot) => acc + (slot && slot.itemId === id ? slot.qty : 0),
      0
    );
    return count >= qty;
  };

  if (!filteredRecipes || filteredRecipes.length === 0) {
    return null;
  }
  let currentSelected =
    selectedIdRef?.value || (filteredRecipes[0] && filteredRecipes[0].id);
  if (!filteredRecipes.find((recipe) => recipe.id === currentSelected)) {
    currentSelected = filteredRecipes[0].id;
    if (selectedIdRef) selectedIdRef.value = currentSelected;
  }

  filteredRecipes.forEach((recipe) => {
    const li = document.createElement("li");
    li.className = "craft-recipe";
    li.dataset.recipeId = recipe.id;

    const header = document.createElement("header");
    const titleWrap = document.createElement("div");
    titleWrap.style.display = "flex";
    titleWrap.style.alignItems = "center";
    titleWrap.style.gap = "8px";

    const icon = document.createElement("img");
    icon.className = "recipe-icon";
    const outDef = getItemDef(recipe.output.itemId);
    if (outDef?.icon) {
      icon.src = outDef.icon;
      icon.alt = outDef?.label || recipe.output.itemId;
    }

    const title = document.createElement("div");
    title.textContent = recipe.label;
    titleWrap.appendChild(icon);
    titleWrap.appendChild(title);

    const lvl = document.createElement("span");
    lvl.className = "craft-tag";
    const locked = state?.level < recipe.level;
    if (locked) {
      lvl.classList.add("locked");
    }
    lvl.textContent = `Niv. ${recipe.level}`;

    header.appendChild(titleWrap);
    header.appendChild(lvl);
    li.appendChild(header);

    const reqs = document.createElement("div");
    reqs.className = "craft-req";
    recipe.inputs.forEach((input) => {
      const def = getItemDef(input.itemId);
      const have = hasItem(input.itemId, input.qty)
        ? def
          ? `${input.qty} x ${def.label || input.itemId}`
          : `${input.qty} x ${input.itemId}`
        : `${input.qty} x ${def?.label || input.itemId}`;
      const pill = document.createElement("div");
      pill.className = "req-item";
      if (def?.icon) {
        const img = document.createElement("img");
        img.src = def.icon;
        img.alt = def?.label || input.itemId;
        pill.appendChild(img);
      }
      const text = document.createElement("span");
      const owned = inventory
        ? inventory.slots.reduce(
            (acc, s) => acc + (s && s.itemId === input.itemId ? s.qty : 0),
            0
          )
        : 0;
      text.textContent = `${owned}/${input.qty}`;
      pill.appendChild(text);
      reqs.appendChild(pill);
    });
    li.appendChild(reqs);

    const xpPill = document.createElement("div");
    xpPill.className = "craft-recipe-xp";
    const xpValue = recipe.xpGain ?? 0;
    xpPill.textContent = `${xpValue} XP`;
    li.appendChild(xpPill);

    if (currentSelected === recipe.id) {
      li.classList.add("active");
    }
    li.addEventListener("click", (e) => {
      e.stopPropagation();
      currentSelected = recipe.id;
      selectedIdRef.value = recipe.id;
      activeRecipePreview = recipe;
      renderRecipes(player, selectedIdRef, filteredRecipes);
      renderSlots(recipe, player);
      updateCraftButton(recipe, player);
      renderResult(player);
    });

    list.appendChild(li);
  });

  return currentSelected;
}

function updateCraftButton(recipe, player) {
  const btn = panelEl.querySelector("#tailleur-craft-btn");
  if (!btn) return;
  if (!recipe) {
    btn.disabled = true;
    return;
  }
  const inventory = player?.inventory;
  const state = ensureTailleurState(player);
  const hasItem = (id, qty) => {
    if (!inventory) return false;
    const count = inventory.slots.reduce(
      (acc, slot) => acc + (slot && slot.itemId === id ? slot.qty : 0),
      0
    );
    return count >= qty;
  };
  const canLevel = state?.level >= recipe.level;
  const canResources = recipe.inputs.every((input) =>
    hasItem(input.itemId, input.qty)
  );
  btn.disabled = !canLevel || !canResources;
}

export function openTailleurCraftPanel(scene, player) {
  ensurePanelElements();
  if (!panelEl) return;
  const selectedRef = { value: null };
  const refreshRecipes = () => {
    const filteredRecipes = getFilteredRecipes();
    const selected = renderRecipes(player, selectedRef, filteredRecipes);
    const recipe =
      filteredRecipes.find((r) => r.id === selectedRef.value) ||
      filteredRecipes.find((r) => r.id === selected);
    activeRecipePreview = recipe || null;
    renderSlots(recipe, player);
    updateCraftButton(recipe, player);
    renderResult(player);
  };
  const getActiveRecipe = () => {
    const filteredRecipes = getFilteredRecipes();
    return (
      filteredRecipes.find((r) => r.id === selectedRef.value) ||
      filteredRecipes[0]
    );
  };

  renderXpHeader(player);
  renderInventory(player);

  const filters = panelEl.querySelectorAll(
    ".craft-inventory-filters button[data-filter]"
  );
  filters.forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      filters.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderInventory(player);
    };
  });

  const levelInput = panelEl.querySelector("#tailleur-filter-level");
  const searchInput = panelEl.querySelector("#tailleur-filter-search");
  const typeSelect = panelEl.querySelector("#tailleur-filter-type");
  if (levelInput) {
    const state = ensureTailleurState(player);
    const defaultLevel = state?.level ?? 1;
    levelInput.value = String(defaultLevel);
  }
  if (levelInput) {
    levelInput.oninput = () => refreshRecipes();
  }
  if (searchInput) {
    searchInput.oninput = () => refreshRecipes();
  }
  if (typeSelect) {
    typeSelect.onchange = () => refreshRecipes();
  }

  refreshRecipes();

  const btn = panelEl.querySelector("#tailleur-craft-btn");
  if (btn) {
    btn.onclick = () => {
      const activeRecipe = getActiveRecipe();
      if (!activeRecipe) {
        updateCraftButton(null, player);
        return;
      }
      if (btn.disabled) return;
      const useAuthority =
        typeof window !== "undefined" && window.__lanInventoryAuthority === true;
      if (useAuthority) {
        const netClient = getNetClient();
        const playerId = getNetPlayerId();
        if (netClient && Number.isInteger(playerId)) {
          netClient.sendCmd("CmdCraft", {
            playerId,
            metierId: "tailleur",
            recipeId: activeRecipe.id,
          });
        }
        return;
      }
      const inv = player?.inventory;
      const countItem = (id) =>
        inv?.slots?.reduce(
          (acc, slot) => acc + (slot && slot.itemId === id ? slot.qty : 0),
          0
        ) || 0;
      const stillHave = activeRecipe.inputs.every(
        (input) => countItem(input.itemId) >= input.qty
      );
      if (!stillHave) return;

      activeRecipe.inputs.forEach((input) => {
        removeItem(player.inventory, input.itemId, input.qty);
      });
      addItem(player.inventory, activeRecipe.output.itemId, activeRecipe.output.qty);
      lastCrafted = activeRecipe.output;
      if (activeRecipe.xpGain && activeRecipe.xpGain > 0) {
        addTailleurXp(player, activeRecipe.xpGain);
        emitStoreEvent("metier:updated", { id: "tailleur", state: player.metiers.tailleur });
        renderXpHeader(player);
      }
      emitStoreEvent("craft:completed", {
        metierId: "tailleur",
        recipeId: activeRecipe.id,
        itemId: activeRecipe.output.itemId,
        qty: activeRecipe.output.qty,
      });
      // refresh UI
      renderInventory(player);
      refreshRecipes();
    };
  }

  if (!craftUnsub) {
    craftUnsub = onStoreEvent("craft:completed", (payload) => {
      if (!payload || payload.metierId !== "tailleur") return;
      lastCrafted = { itemId: payload.itemId, qty: payload.qty };
      renderInventory(player);
      renderXpHeader(player);
      refreshRecipes();
    });
  }

  panelEl.classList.add("open");
  isOpen = true;
}

export function closeTailleurCraftPanel() {
  if (!panelEl) return;
  panelEl.classList.remove("open");
  isOpen = false;
  if (craftUnsub) {
    craftUnsub();
    craftUnsub = null;
  }
}
