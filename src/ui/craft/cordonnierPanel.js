import { ensureCordonnierState, addCordonnierXp } from "../../metier/cordonnier/state.js";
import { cordonnierRecipes } from "../../metier/cordonnier/recipes.js";
import { removeItem, addItem, getItemDef } from "../../inventory/inventoryCore.js";
import { emit as emitStoreEvent } from "../../state/store.js";

let panelEl = null;
let isOpen = false;
let lastCrafted = null;
let activeRecipePreview = null;

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
  const ensureLink = (id, href) => {
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  };
  ensureLink("craft-base-css", "assets/css/craft-base.css");
  ensureLink("craft-cordonnier-css", "assets/css/craft-cordonnier.css");

  panelEl = document.createElement("div");
  panelEl.id = "cordonnier-craft-panel";
  panelEl.className = "craft-panel cordonnier";
  panelEl.innerHTML = `
    <div class="craft-panel-inner">
      <header class="craft-panel-header">
        <h3>Table de Cordonnier</h3>
        <button type="button" class="craft-panel-close" aria-label="Fermer">✕</button>
      </header>
      <div class="craft-xp-row">
        <div class="craft-xp-bar">
          <div class="craft-xp-bar-fill" id="cordonnier-xp-fill"></div>
          <div class="craft-xp-bar-label" id="cordonnier-xp-label">XP 0 / 100</div>
        </div>
        <div class="craft-xp-level">Niv. <span id="cordonnier-xp-level">1</span></div>
      </div>
      <div class="craft-body">
        <section class="craft-left">
          <ul class="craft-recipes" id="cordonnier-recipes"></ul>
        </section>
        <section class="craft-center">
          <div class="craft-slots" id="cordonnier-slots"></div>
          <div class="craft-actions">
            <button type="button" class="craft-btn" id="cordonnier-craft-btn">Crafter</button>
            <div class="craft-result empty" id="cordonnier-result">
              <span>Aucun craft réalisé.</span>
            </div>
          </div>
        </section>
        <section class="craft-inventory">
          <div class="craft-inventory-header">
            <div class="craft-inventory-filters" id="cordonnier-inventory-filters">
              <button type="button" data-filter="all" class="active">Tout</button>
              <button type="button" data-filter="equipement">Équipement</button>
              <button type="button" data-filter="ressource">Ressources</button>
              <button type="button" data-filter="consommable">Consommables</button>
            </div>
          </div>
          <div class="craft-inventory-grid" id="cordonnier-inventory"></div>
        </section>
      </div>
    </div>
  `;
  document.body.appendChild(panelEl);

  const closeBtn = panelEl.querySelector(".craft-panel-close");
  closeBtn.addEventListener("click", () => closeCordonnierCraftPanel());

  return panelEl;
}

function renderInventory(player) {
  const grid = panelEl.querySelector("#cordonnier-inventory");
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
  const slotsEl = panelEl.querySelector("#cordonnier-slots");
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
  const resultEl = panelEl.querySelector("#cordonnier-result");
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

  resultEl.appendChild(text);
}

function renderRecipes(player, selectedIdRef) {
  const list = panelEl.querySelector("#cordonnier-recipes");
  if (!list) return;
  list.innerHTML = "";

  const inventory = player?.inventory;
  const state = ensureCordonnierState(player);

  const hasItem = (id, qty) => {
    if (!inventory) return false;
    const count = inventory.slots.reduce(
      (acc, slot) => acc + (slot && slot.itemId === id ? slot.qty : 0),
      0
    );
    return count >= qty;
  };

  let currentSelected = selectedIdRef?.value || (cordonnierRecipes[0] && cordonnierRecipes[0].id);

  cordonnierRecipes.forEach((recipe) => {
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
      renderRecipes(player, selectedIdRef);
      renderSlots(recipe, player);
      updateCraftButton(recipe, player);
      renderResult(player);
    });

    list.appendChild(li);
  });

  return currentSelected;
}

function updateCraftButton(recipe, player) {
  const btn = panelEl.querySelector("#cordonnier-craft-btn");
  if (!btn || !recipe) return;
  const inventory = player?.inventory;
  const state = ensureCordonnierState(player);
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

function renderXpHeader(player) {
  const state = ensureCordonnierState(player);
  if (!state) return;
  const fill = panelEl.querySelector("#cordonnier-xp-fill");
  const label = panelEl.querySelector("#cordonnier-xp-label");
  const lvl = panelEl.querySelector("#cordonnier-xp-level");
  const percent =
    state.xpNext > 0 ? Math.min(100, (state.xp / state.xpNext) * 100) : 0;
  if (fill) fill.style.width = `${percent}%`;
  if (label) label.textContent = `XP ${state.xp} / ${state.xpNext}`;
  if (lvl) lvl.textContent = String(state.level ?? 1);
}

export function openCordonnierCraftPanel(scene, player) {
  ensurePanelElements();
  if (!panelEl) return;
  const selectedRef = { value: cordonnierRecipes[0]?.id };
  const selected = renderRecipes(player, selectedRef);
  const getActiveRecipe = () =>
    cordonnierRecipes.find((r) => r.id === selectedRef.value) ||
    cordonnierRecipes.find((r) => r.id === selected) ||
    cordonnierRecipes[0];
  const recipe = getActiveRecipe();
  activeRecipePreview = recipe || null;
  renderXpHeader(player);
  renderSlots(recipe, player);
  renderInventory(player);
  updateCraftButton(recipe, player);
  renderResult(player);

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

  const btn = panelEl.querySelector("#cordonnier-craft-btn");
  if (btn) {
    btn.onclick = () => {
      const activeRecipe = getActiveRecipe();
      if (!activeRecipe || btn.disabled) return;
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
        addCordonnierXp(player, activeRecipe.xpGain);
        emitStoreEvent("metier:updated", { id: "cordonnier", state: player.metiers.cordonnier });
        renderXpHeader(player);
      }
      emitStoreEvent("craft:completed", {
        metierId: "cordonnier",
        recipeId: activeRecipe.id,
        itemId: activeRecipe.output.itemId,
        qty: activeRecipe.output.qty,
      });
      renderInventory(player);
      renderRecipes(player, selectedRef);
      renderSlots(activeRecipe, player);
      activeRecipePreview = activeRecipe;
      renderResult(player);
      updateCraftButton(activeRecipe, player);
    };
  }

  panelEl.classList.add("open");
  isOpen = true;
}

export function closeCordonnierCraftPanel() {
  if (!panelEl) return;
  panelEl.classList.remove("open");
  isOpen = false;
}
