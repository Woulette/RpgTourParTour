import { ensureTailleurState, addTailleurXp } from "../../metier/tailleur/state.js";
import { tailleurRecipes } from "../../metier/tailleur/recipes.js";
import { removeItem, addItem } from "../../inventory/inventoryCore.js";
import { emit as emitStoreEvent } from "../../state/store.js";

let panelEl = null;
let isOpen = false;

function ensurePanelElements() {
  if (panelEl) return panelEl;
  panelEl = document.createElement("div");
  panelEl.id = "tailleur-craft-panel";
  panelEl.className = "craft-panel";
  panelEl.innerHTML = `
    <div class="craft-panel-inner">
      <header class="craft-panel-header">
        <h3>Table de Tailleur</h3>
        <button type="button" class="craft-panel-close" aria-label="Fermer">✕</button>
      </header>
      <section class="craft-panel-body">
        <p class="craft-panel-desc">Fabrique des coiffes et des capes.</p>
        <ul class="craft-recipes" id="tailleur-recipes"></ul>
      </section>
    </div>
  `;
  document.body.appendChild(panelEl);

  const style = document.createElement("style");
  style.id = "tailleur-craft-style";
  style.textContent = `
    #tailleur-craft-panel {
      position: fixed;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.35);
      z-index: 2000;
    }
    #tailleur-craft-panel.open { display: flex; }
    #tailleur-craft-panel .craft-panel-inner {
      width: 420px;
      max-width: 90vw;
      background: #0d1117;
      color: #f5f7ff;
      border-radius: 12px;
      border: 1px solid #30363d;
      box-shadow: 0 20px 60px rgba(0,0,0,0.45);
      padding: 14px 16px;
      font-family: system-ui, sans-serif;
    }
    #tailleur-craft-panel .craft-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }
    #tailleur-craft-panel .craft-panel-close {
      background: none;
      border: 1px solid #444;
      color: inherit;
      border-radius: 6px;
      padding: 4px 8px;
      cursor: pointer;
    }
    #tailleur-craft-panel .craft-panel-body {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-height: 65vh;
      overflow: auto;
    }
    #tailleur-craft-panel .craft-recipes {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    #tailleur-craft-panel .craft-recipe {
      border: 1px solid #30363d;
      border-radius: 10px;
      padding: 10px;
      background: #161b22;
    }
    #tailleur-craft-panel .craft-recipe header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
      font-weight: 600;
    }
    #tailleur-craft-panel .craft-io {
      font-size: 13px;
      color: #c9d1d9;
    }
    #tailleur-craft-panel .craft-btn {
      margin-top: 6px;
      background: #238636;
      border: none;
      color: white;
      padding: 8px 10px;
      border-radius: 8px;
      cursor: pointer;
    }
    #tailleur-craft-panel .craft-btn:disabled {
      background: #3a3f44;
      cursor: not-allowed;
    }
  `;
  document.head.appendChild(style);

  const closeBtn = panelEl.querySelector(".craft-panel-close");
  closeBtn.addEventListener("click", () => closeTailleurCraftPanel());

  return panelEl;
}

function renderRecipes(player) {
  const list = panelEl.querySelector("#tailleur-recipes");
  if (!list) return;
  list.innerHTML = "";

  const inventory = player?.inventory;
  const state = ensureTailleurState(player);

  const hasItem = (id, qty) => {
    if (!inventory) return false;
    let count = 0;
    inventory.slots.forEach((slot) => {
      if (slot && slot.itemId === id) {
        count += slot.qty;
      }
    });
    return count >= qty;
  };

  tailleurRecipes.forEach((recipe) => {
    const li = document.createElement("li");
    li.className = "craft-recipe";

    const header = document.createElement("header");
    const title = document.createElement("div");
    title.textContent = recipe.label;
    const lvl = document.createElement("span");
    lvl.textContent = `Niv. ${recipe.level}`;
    header.appendChild(title);
    header.appendChild(lvl);
    li.appendChild(header);

    const inputs = document.createElement("div");
    inputs.className = "craft-io";
    inputs.textContent =
      "Ressources : " +
      recipe.inputs.map((i) => `${i.qty} x ${i.itemId}`).join(", ");
    li.appendChild(inputs);

    const output = document.createElement("div");
    output.className = "craft-io";
    output.textContent = `Produit : ${recipe.output.qty} x ${recipe.output.itemId}`;
    li.appendChild(output);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "craft-btn";
    btn.textContent = "Fabriquer";

    const canLevel = state?.level >= recipe.level;
    const canResources = recipe.inputs.every((input) =>
      hasItem(input.itemId, input.qty)
    );
    btn.disabled = !canLevel || !canResources;

    btn.addEventListener("click", () => {
      if (!inventory || btn.disabled) return;
      // Vérifie encore les ressources
      const stillHave = recipe.inputs.every((input) =>
        hasItem(input.itemId, input.qty)
      );
      if (!stillHave) return;

      recipe.inputs.forEach((input) => {
        removeItem(inventory, input.itemId, input.qty);
      });
      addItem(inventory, recipe.output.itemId, recipe.output.qty);
      if (recipe.xpGain && recipe.xpGain > 0) {
        addTailleurXp(player, recipe.xpGain);
        emitStoreEvent("metier:updated", { id: "tailleur", state: player.metiers.tailleur });
      }
      emitStoreEvent("craft:completed", { metierId: "tailleur", recipeId: recipe.id });
      renderRecipes(player);
    });

    li.appendChild(btn);
    list.appendChild(li);
  });
}

export function openTailleurCraftPanel(scene, player) {
  ensurePanelElements();
  if (!panelEl) return;
  renderRecipes(player);
  panelEl.classList.add("open");
  isOpen = true;
}

export function closeTailleurCraftPanel() {
  if (!panelEl) return;
  panelEl.classList.remove("open");
  isOpen = false;
}
