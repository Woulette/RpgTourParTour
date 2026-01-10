import { ensureBricoleurState, addBricoleurXp } from "../../bricoleur/state.js";
import { bricoleurRecipes } from "../../bricoleur/recipes.js";
import { removeItem, addItem, getItemDef } from "../../../inventory/runtime/inventoryAuthority.js";
import { emit as emitStoreEvent } from "../../../state/store.js";

let panelEl = null;
let isOpen = false;
let lastCrafted = null;
let activeRecipePreview = null;
let xpRenderRequested = false;

function formatEffectLines(effect) {
  if (!effect) return [];
  const parts = [];
  if (typeof effect.hpPlus === "number" && effect.hpPlus !== 0) {
    parts.push({
      value: `+${effect.hpPlus}`,
      label: "PV",
      cls: "inventory-bonus-stat-hp",
    });
  }
  if (typeof effect.paPlus === "number" && effect.paPlus !== 0) {
    parts.push({
      value: `+${effect.paPlus}`,
      label: "PA",
      cls: "inventory-bonus-stat-pa",
    });
  }
  if (typeof effect.pmPlus === "number" && effect.pmPlus !== 0) {
    parts.push({
      value: `+${effect.pmPlus}`,
      label: "PM",
      cls: "inventory-bonus-stat-pm",
    });
  }
  if (typeof effect.paPlusCombat === "number" && effect.paPlusCombat !== 0) {
    parts.push({
      value: `+${effect.paPlusCombat}`,
      label: "PA (combat)",
      cls: "inventory-bonus-stat-pa",
    });
  }
  if (typeof effect.pmPlusCombat === "number" && effect.pmPlusCombat !== 0) {
    parts.push({
      value: `+${effect.pmPlusCombat}`,
      label: "PM (combat)",
      cls: "inventory-bonus-stat-pm",
    });
  }
  return parts;
}

function ensurePanelElements() {
  if (panelEl) return panelEl;
  const ensureLink = (id, href) => {
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  };
  ensureLink("craft-base-css", "assets/css/craft-base.css");
  ensureLink("craft-alchimiste-css", "assets/css/craft-alchimiste.css");

  panelEl = document.createElement("div");
  panelEl.id = "bricoleur-craft-panel";
  panelEl.className = "craft-panel alchimiste";
  panelEl.innerHTML = `
    <div class="craft-panel-inner">
      <header class="craft-panel-header">
        <h3>Etablie du Bricoleur</h3>
        <button type="button" class="craft-panel-close" aria-label="Fermer">X</button>
      </header>
      <div class="craft-body craft-body-alchimiste">
        <section class="craft-left craft-left-alchimiste">
          <div class="alchimiste-xp-card">
            <div class="alchimiste-xp-top">
              <span>Experience</span>
              <span class="alchimiste-xp-level">Niv. <span id="bricoleur-xp-level">1</span></span>
            </div>
            <div class="craft-xp-bar">
              <div class="craft-xp-bar-fill" id="bricoleur-xp-fill"></div>
              <div class="craft-xp-bar-label" id="bricoleur-xp-label">XP 0 / 100</div>
            </div>
          </div>
          <div class="craft-recipe-filters">
            <input
              type="number"
              min="1"
              class="craft-filter-level"
              id="bricoleur-filter-level"
              placeholder="Niv. max"
            />
            <input
              type="text"
              class="craft-filter-search"
              id="bricoleur-filter-search"
              placeholder="Rechercher..."
            />
            <select class="craft-filter-type" id="bricoleur-filter-type">
              <option value="all">Tout</option>
            </select>
          </div>
          <ul class="craft-recipes" id="bricoleur-recipes"></ul>
        </section>
        <section class="craft-center craft-center-alchimiste">
          <div class="alchimiste-top">
            <div class="alchimiste-slots-row" id="bricoleur-slots"></div>
            <button type="button" class="craft-btn" id="bricoleur-craft-btn">Preparer</button>
          </div>
          <div class="craft-result empty" id="bricoleur-result">
            <span>Aucun craft realise.</span>
          </div>
        </section>
        <section class="craft-inventory craft-inventory-alchimiste">
          <div class="craft-inventory-header">
            <div class="craft-inventory-filters" id="bricoleur-inventory-filters">
              <button type="button" data-filter="all" class="active">Tout</button>
              <button type="button" data-filter="ressource">Ressources</button>
              <button type="button" data-filter="consommable">Consommables</button>
            </div>
          </div>
          <div class="craft-inventory-grid" id="bricoleur-inventory"></div>
        </section>
      </div>
    </div>
  `;
  document.body.appendChild(panelEl);

  const closeBtn = panelEl.querySelector(".craft-panel-close");
  closeBtn.addEventListener("click", () => closeBricoleurCraftPanel());

  return panelEl;
}

function renderXpHeader(player) {
  if (!panelEl || xpRenderRequested) return;
  const state = ensureBricoleurState(player);
  if (!state) return;

  const levelEl = panelEl.querySelector("#bricoleur-xp-level");
  const fillEl = panelEl.querySelector("#bricoleur-xp-fill");
  const labelEl = panelEl.querySelector("#bricoleur-xp-label");

  if (levelEl) levelEl.textContent = state.level ?? 1;
  if (labelEl) labelEl.textContent = `XP ${state.xp ?? 0} / ${state.xpNext ?? 100}`;

  if (fillEl) {
    const ratio =
      state.xpNext > 0 ? Math.min(1, (state.xp ?? 0) / state.xpNext) : 0;
    fillEl.style.width = `${Math.round(ratio * 100)}%`;
  }
}

function renderSlots(recipe, player) {
  const slotsEl = panelEl.querySelector("#bricoleur-slots");
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
  for (let i = 0; i < 6; i += 1) {
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
  const resultEl = panelEl.querySelector("#bricoleur-result");
  if (!resultEl) return;
  resultEl.innerHTML = "";

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
    meta.textContent = parts.join(" * ");
    if (meta.textContent) wrap.appendChild(meta);

    if (showRecipe) {
      const xpLine = document.createElement("div");
      xpLine.style.opacity = "0.9";
      xpLine.style.fontSize = "12px";
      xpLine.textContent = `XP gagne : ${recipe.xpGain ?? 0} XP`;
      wrap.appendChild(xpLine);
    }

    if (showRecipe) {
      const effectParts = formatEffectLines(def?.effect);
      if (effectParts.length > 0) {
        const effectsBlock = document.createElement("div");
        effectsBlock.style.display = "flex";
        effectsBlock.style.flexDirection = "column";
        effectsBlock.style.gap = "2px";
        effectsBlock.style.marginTop = "2px";

        effectParts.forEach((entry) => {
          const line = document.createElement("div");
          line.className = `inventory-bonus-stat ${entry.cls}`;
          line.style.fontSize = "15px";
          line.style.lineHeight = "1.2";
          line.style.display = "flex";
          line.style.alignItems = "center";
          line.style.gap = "6px";
          line.style.padding = "0";
          line.style.margin = "0";

          const valSpan = document.createElement("span");
          valSpan.textContent = entry.value;
          const labelSpan = document.createElement("span");
          labelSpan.textContent = entry.label;
          line.appendChild(valSpan);
          line.appendChild(labelSpan);
          effectsBlock.appendChild(line);
        });

        wrap.appendChild(effectsBlock);
      }
    }

    if (showRecipe) {
      const ingTitle = document.createElement("div");
      ingTitle.style.marginTop = "6px";
      ingTitle.innerHTML = "<strong>Ingredients :</strong>";
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

    const preview = document.createElement("div");
    preview.style.opacity = "0.6";
    preview.style.fontSize = "12px";
    preview.style.marginTop = "6px";
    preview.textContent = "Apercu avant craft.";
    wrap.appendChild(preview);

    resultEl.appendChild(wrap);
  }
}

function renderInventory(player) {
  const grid = panelEl.querySelector("#bricoleur-inventory");
  if (!grid) return;
  grid.innerHTML = "";

  const inv = player?.inventory;
  if (!inv || !Array.isArray(inv.slots)) return;

  const filterBtn = panelEl.querySelector(
    "#bricoleur-inventory-filters button.active"
  );
  const filter = filterBtn ? filterBtn.dataset.filter : "all";

  inv.slots.forEach((slot) => {
    const cell = document.createElement("div");
    cell.className = "craft-inventory-slot";
    const def = slot?.itemId ? getItemDef(slot.itemId) : null;
    const match =
      filter === "all" ||
      ((filter === "ressource" || filter === "ressources") &&
        def?.category === "ressource") ||
      (filter === "consommable" && def?.category === "consommable");

    if (slot && slot.itemId && match) {
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

function getRecipeFilters() {
  const levelInput = panelEl.querySelector("#bricoleur-filter-level");
  const searchInput = panelEl.querySelector("#bricoleur-filter-search");
  const typeSelect = panelEl.querySelector("#bricoleur-filter-type");
  const levelValue = levelInput ? parseInt(levelInput.value, 10) : NaN;
  return {
    levelMax: Number.isFinite(levelValue) ? levelValue : null,
    search: (searchInput?.value || "").trim().toLowerCase(),
    type: typeSelect?.value || "all",
  };
}

function getFilteredRecipes() {
  const filters = getRecipeFilters();
  const sortedRecipes = bricoleurRecipes.slice().sort((a, b) => {
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
  const list = panelEl.querySelector("#bricoleur-recipes");
  if (!list) return null;
  list.innerHTML = "";

  const inventory = player?.inventory;
  const state = ensureBricoleurState(player);

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
    const recipeIcon = recipe.recipeIcon || outDef?.icon || "";
    if (recipeIcon) {
      icon.src = recipeIcon;
      icon.alt = outDef?.label || recipe.label || recipe.output.itemId;
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

    if (!recipe.inputs.every((input) => hasItem(input.itemId, input.qty))) {
      li.classList.add("missing");
    }
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
  const btn = panelEl.querySelector("#bricoleur-craft-btn");
  if (!btn) return;
  if (!recipe) {
    btn.disabled = true;
    return;
  }
  const inventory = player?.inventory;
  const state = ensureBricoleurState(player);
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

export function openBricoleurCraftPanel(scene, player) {
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

  const levelInput = panelEl.querySelector("#bricoleur-filter-level");
  const searchInput = panelEl.querySelector("#bricoleur-filter-search");
  const typeSelect = panelEl.querySelector("#bricoleur-filter-type");
  if (levelInput) {
    const state = ensureBricoleurState(player);
    const defaultLevel = state?.level ?? 1;
    levelInput.value = String(defaultLevel);
    levelInput.oninput = () => refreshRecipes();
  }
  if (searchInput) {
    searchInput.oninput = () => refreshRecipes();
  }
  if (typeSelect) {
    typeSelect.onchange = () => refreshRecipes();
  }

  refreshRecipes();

  const btn = panelEl.querySelector("#bricoleur-craft-btn");
  if (btn) {
    btn.onclick = () => {
      const activeRecipe = getActiveRecipe();
      if (!activeRecipe) {
        updateCraftButton(null, player);
        return;
      }
      if (btn.disabled) return;
      const inv = player?.inventory;
      const countItem = (id) =>
        inv?.slots?.reduce(
          (acc, slot) => acc + (slot && slot.itemId === id ? slot.qty : 0),
          0
        ) || 0;

      if (activeRecipe.inputs.some((input) => countItem(input.itemId) < input.qty)) {
        return;
      }

      activeRecipe.inputs.forEach((input) => {
        removeItem(inv, input.itemId, input.qty);
      });

      addItem(inv, activeRecipe.output.itemId, activeRecipe.output.qty || 1);

      lastCrafted = {
        itemId: activeRecipe.output.itemId,
        qty: activeRecipe.output.qty || 1,
      };

      const { state } = addBricoleurXp(player, activeRecipe.xpGain ?? 0);
      if (state) {
        emitStoreEvent("metier:updated", { id: "bricoleur", state });
      }

      renderXpHeader(player);
      renderInventory(player);
      refreshRecipes();
    };
  }

  panelEl.classList.add("open");
  isOpen = true;
}

export function closeBricoleurCraftPanel() {
  if (!panelEl) return;
  panelEl.classList.remove("open");
  isOpen = false;
}

export function isBricoleurCraftOpen() {
  return isOpen;
}



