import { ensureTailleurState, addTailleurXp } from "../../metier/tailleur/state.js";
import { tailleurRecipes } from "../../metier/tailleur/recipes.js";
import { removeItem, addItem, getItemDef } from "../../inventory/inventoryCore.js";
import { emit as emitStoreEvent } from "../../state/store.js";

let panelEl = null;
let isOpen = false;
let lastCrafted = null;

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

function renderResult() {
  const resultEl = panelEl.querySelector("#tailleur-result");
  if (!resultEl) return;
  resultEl.innerHTML = "";
  if (!lastCrafted) {
    resultEl.classList.add("empty");
    resultEl.textContent = "Aucun craft réalisé.";
    return;
  }
  resultEl.classList.remove("empty");
  const def = getItemDef(lastCrafted.itemId);
  if (def?.icon) {
    const img = document.createElement("img");
    img.src = def.icon;
    img.alt = def?.label || lastCrafted.itemId;
    resultEl.appendChild(img);
  }
  const text = document.createElement("div");
  text.innerHTML = `<strong>${def?.label || lastCrafted.itemId}</strong><br/>x${lastCrafted.qty}`;
  resultEl.appendChild(text);
}

function renderRecipes(player, selectedIdRef) {
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

  let currentSelected = selectedIdRef?.value || (tailleurRecipes[0] && tailleurRecipes[0].id);

  tailleurRecipes.forEach((recipe) => {
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

    if (currentSelected === recipe.id) {
      li.classList.add("active");
    }
    li.addEventListener("click", (e) => {
      e.stopPropagation();
      currentSelected = recipe.id;
      selectedIdRef.value = recipe.id;
      renderRecipes(player, selectedIdRef);
      renderSlots(recipe, player);
      updateCraftButton(recipe, player);
    });

    list.appendChild(li);
  });

  return currentSelected;
}

function updateCraftButton(recipe, player) {
  const btn = panelEl.querySelector("#tailleur-craft-btn");
  if (!btn || !recipe) return;
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
  const selectedRef = { value: tailleurRecipes[0]?.id };
  const selected = renderRecipes(player, selectedRef);
  const recipe = tailleurRecipes.find((r) => r.id === selected);
  renderSlots(recipe, player);
  renderInventory(player);
  updateCraftButton(recipe, player);
  renderResult();

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

  const btn = panelEl.querySelector("#tailleur-craft-btn");
  if (btn) {
    btn.onclick = () => {
      if (!recipe || btn.disabled) return;
      const inv = player?.inventory;
      const countItem = (id) =>
        inv?.slots?.reduce(
          (acc, slot) => acc + (slot && slot.itemId === id ? slot.qty : 0),
          0
        ) || 0;
      const stillHave = recipe.inputs.every(
        (input) => countItem(input.itemId) >= input.qty
      );
      if (!stillHave) return;

      recipe.inputs.forEach((input) => {
        removeItem(player.inventory, input.itemId, input.qty);
      });
      addItem(player.inventory, recipe.output.itemId, recipe.output.qty);
      lastCrafted = recipe.output;
      if (recipe.xpGain && recipe.xpGain > 0) {
        addTailleurXp(player, recipe.xpGain);
        emitStoreEvent("metier:updated", { id: "tailleur", state: player.metiers.tailleur });
      }
      emitStoreEvent("craft:completed", { metierId: "tailleur", recipeId: recipe.id });
      // refresh UI
      renderInventory(player);
      renderRecipes(player, selectedRef);
      renderSlots(recipe, player);
      renderResult();
      updateCraftButton(recipe, player);
    };
  }

  panelEl.classList.add("open");
  isOpen = true;
}

export function closeTailleurCraftPanel() {
  if (!panelEl) return;
  panelEl.classList.remove("open");
  isOpen = false;
}
