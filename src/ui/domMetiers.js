import { bucheronDefinition } from "../metier/bucheron/config.js";
import { ensureBucheronState } from "../metier/bucheron/state.js";
import { tailleurDefinition } from "../metier/tailleur/config.js";
import { ensureTailleurState } from "../metier/tailleur/state.js";
import { bijoutierDefinition } from "../metier/bijoutier/config.js";
import { ensureBijoutierState } from "../metier/bijoutier/state.js";
import { tailleurRecipes } from "../metier/tailleur/recipes.js";
import { bijoutierRecipes } from "../metier/bijoutier/recipes.js";
import { cordonnierDefinition } from "../metier/cordonnier/config.js";
import { ensureCordonnierState } from "../metier/cordonnier/state.js";
import { cordonnierRecipes } from "../metier/cordonnier/recipes.js";
import { getItemDef } from "../inventory/inventoryCore.js";
import { on as onStoreEvent } from "../state/store.js";

// Métier unique pour l'instant, mais structuré pour en ajouter d'autres.
const METIERS = [bucheronDefinition, tailleurDefinition, bijoutierDefinition, cordonnierDefinition];
const METIERS_BY_ID = Object.fromEntries(METIERS.map((m) => [m.id, m]));
const CRAFT_RECIPES = {
  tailleur: tailleurRecipes,
  bijoutier: bijoutierRecipes,
  cordonnier: cordonnierRecipes,
};

let metiersUiInitialized = false;
let unsubscribeMetier = null;

export function initDomMetiers(player) {
  if (metiersUiInitialized) return;
  const buttonEl = document.getElementById("hud-metiers-button");
  const panelEl = document.getElementById("hud-metiers-panel");

  if (!buttonEl || !panelEl || !player) return;

  // Construction du container principal (liste + détail)
  const bodyEl =
    panelEl.querySelector(".metiers-body") ||
    (() => {
      const section = document.createElement("section");
      section.className = "metiers-body";
      const reference = panelEl.querySelector(".metiers-section");
      if (reference) {
        panelEl.insertBefore(section, reference);
      } else {
        panelEl.appendChild(section);
      }
      return section;
    })();

  const listEl =
    bodyEl.querySelector(".metiers-list") ||
    (() => {
      const nav = document.createElement("nav");
      nav.id = "metiers-list";
      nav.className = "metiers-list";
      nav.setAttribute("aria-label", "Liste des métiers");
      bodyEl.appendChild(nav);
      return nav;
    })();

  const detailEl =
    bodyEl.querySelector(".metier-detail") ||
    (() => {
      const detail = document.createElement("div");
      detail.id = "metier-detail";
      detail.className = "metier-detail";
      detail.setAttribute("aria-label", "Détails du métier sélectionné");
      detail.innerHTML = `
        <header class="metier-detail-header">
          <h3 class="metier-detail-title">
            <span id="metier-detail-name">---</span>
            <span class="metier-detail-level">
              Niv. <span id="metier-detail-level">1</span>
            </span>
          </h3>
          <p class="metier-detail-xp">
            XP : <span id="metier-detail-xp">0</span>
            / <span id="metier-detail-xp-next">100</span>
          </p>
          <div class="metier-detail-xp-bar">
            <div class="metier-detail-xp-bar-fill"></div>
          </div>
        </header>
        <section class="metier-resources" id="metier-resources-section">
          <h4 class="metier-resources-title">Ressources récoltables</h4>
          <table class="metier-resources-table">
            <thead>
              <tr>
                <th>Ressource</th>
                <th>Niveau</th>
                <th>Quantité</th>
                <th>XP</th>
              </tr>
            </thead>
            <tbody id="metier-resources-body"></tbody>
          </table>
        </section>
        <section class="metier-craft" id="metier-craft-section" style="display:none; gap:10px; flex-direction:column;">
          <div class="metier-craft-controls" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <div class="metier-craft-filters" id="metier-craft-filters" style="display:flex; gap:6px; flex-wrap:wrap;"></div>
            <input id="metier-craft-search" type="text" placeholder="Rechercher un équipement..." style="flex:1; min-width:180px; padding:6px 8px; border-radius:8px; border:1px solid #4a5560; background:#0f141b; color:#e8eef7;">
          </div>
          <div class="metier-craft-body" style="display:grid; grid-template-columns: 45% 1fr; gap:10px; min-height:0;">
            <div class="metier-craft-list" id="metier-craft-list" style="display:flex; flex-direction:column; gap:6px; overflow:auto; min-height:0;">
            </div>
            <div class="metier-craft-info" id="metier-craft-info" style="border:1px solid #2d3742; border-radius:10px; padding:10px; background:rgba(255,255,255,0.06); min-height:120px; overflow:auto;">
              <p style="opacity:0.7; margin:0;">Sélectionne un équipement pour voir les détails.</p>
            </div>
          </div>
        </section>
      `;
      bodyEl.appendChild(detail);
      return detail;
    })();

  const resourcesBodyEl = detailEl.querySelector("#metier-resources-body");
  const resourcesSectionEl = detailEl.querySelector("#metier-resources-section");
  const craftSectionEl = detailEl.querySelector("#metier-craft-section");
  const craftFiltersEl = detailEl.querySelector("#metier-craft-filters");
  const craftSearchEl = detailEl.querySelector("#metier-craft-search");
  const craftListEl = detailEl.querySelector("#metier-craft-list");
  const craftInfoEl = detailEl.querySelector("#metier-craft-info");
  const detailNameEl = detailEl.querySelector("#metier-detail-name");
  const detailLevelEl = detailEl.querySelector("#metier-detail-level");
  const detailXpEl = detailEl.querySelector("#metier-detail-xp");
  const detailXpNextEl = detailEl.querySelector("#metier-detail-xp-next");
  const detailXpBarFillEl = detailEl.querySelector(".metier-detail-xp-bar-fill");

  let currentMetierId = "bucheron";
  const craftSelectedByMetier = {};
  let craftSearchValue = "";
  let craftCategory = "all";

  const getPlayerMetierState = (id) => {
    if (id === "bucheron") {
      return ensureBucheronState(player);
    }
    if (id === "tailleur") {
      return ensureTailleurState(player);
    }
    if (id === "bijoutier") {
      return ensureBijoutierState(player);
    }
    if (id === "cordonnier") {
      return ensureCordonnierState(player);
    }
    // Fallback pour futurs métiers
    if (!player.metiers) player.metiers = {};
    if (!player.metiers[id]) {
      player.metiers[id] = { level: 1, xp: 0, xpNext: 100 };
    }
    return player.metiers[id];
  };

  const renderMetiersList = () => {
    listEl.innerHTML = "";
    METIERS.forEach((metierDef) => {
      const { id, name } = metierDef;
      const state = getPlayerMetierState(id);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "metier-list-item";
      btn.dataset.metierId = id;
      if (id === currentMetierId) {
        btn.classList.add("metier-list-item-active");
      }

      const nameSpan = document.createElement("span");
      nameSpan.className = "metier-list-name";
      nameSpan.textContent = name;

      const levelSpan = document.createElement("span");
      levelSpan.className = "metier-list-level";
      levelSpan.dataset.role = "metier-level";
      levelSpan.textContent = `Niv. ${state.level}`;

      btn.appendChild(nameSpan);
      btn.appendChild(levelSpan);

      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        if (currentMetierId === id) return;
        currentMetierId = id;
        updatePanel();
      });

      listEl.appendChild(btn);
    });
  };

  const renderMetierDetail = (metierId) => {
    const def = METIERS_BY_ID[metierId];
    if (!def) return;

    const state = getPlayerMetierState(metierId);
    if (!state) return;

    if (detailNameEl) {
      detailNameEl.textContent = def.name;
    }
    if (detailLevelEl) {
      detailLevelEl.textContent = String(state.level);
    }
    if (detailXpEl) {
      detailXpEl.textContent = String(state.xp);
    }
    if (detailXpNextEl) {
      detailXpNextEl.textContent = String(state.xpNext);
    }

    if (detailXpBarFillEl) {
      const percent =
        state.xpNext > 0 ? Math.min(100, (state.xp / state.xpNext) * 100) : 0;
      detailXpBarFillEl.style.setProperty("--metier-xp-percent", `${percent}%`);
    }

    const isCraft = def.type === "craft";
    if (!isCraft) {
      craftSelectedByMetier[metierId] = null;
    }
    if (resourcesSectionEl) {
      resourcesSectionEl.style.display = isCraft ? "none" : "block";
    }
    if (craftSectionEl) {
      craftSectionEl.style.display = isCraft ? "flex" : "none";
    }

    if (!isCraft && resourcesBodyEl) {
      resourcesBodyEl.innerHTML = "";
      (def.resources || []).forEach((res) => {
        const tr = document.createElement("tr");

        const nameTd = document.createElement("td");
        nameTd.className = "metier-resource-name";
        nameTd.textContent = res.name;

        const levelTd = document.createElement("td");
        levelTd.className = "metier-resource-level";
        levelTd.textContent = `Niv. ${res.level}`;

        const qtyTd = document.createElement("td");
        qtyTd.className = "metier-resource-quantity";
        qtyTd.textContent = `${res.quantityMin}-${res.quantityMax}`;

        const xpTd = document.createElement("td");
        xpTd.className = "metier-resource-xp";
        xpTd.textContent = `${res.xpGain} XP`;

        tr.appendChild(nameTd);
        tr.appendChild(levelTd);
        tr.appendChild(qtyTd);
        tr.appendChild(xpTd);

        resourcesBodyEl.appendChild(tr);
      });
    }

    if (isCraft && craftSectionEl) {
      renderCraftPanel(def, state, metierId);
    }
  };

  const renderCraftInfo = (recipe) => {
    if (!craftInfoEl) return;
    craftInfoEl.innerHTML = "";
    if (!recipe) {
      craftInfoEl.innerHTML =
        '<p style="opacity:0.7; margin:0;">Sélectionne un équipement pour voir les détails.</p>';
      return;
    }
    const outDef = getItemDef(recipe.output.itemId);
    const title = document.createElement("div");
    title.style.display = "flex";
    title.style.alignItems = "center";
    title.style.gap = "10px";
      const icon = document.createElement("img");
      icon.src = outDef?.icon || "";
      icon.alt = outDef?.label || recipe.output.itemId;
      icon.style.width = "42px";
      icon.style.height = "42px";
      icon.style.borderRadius = "8px";
      icon.style.background = "rgba(248, 250, 252, 0.92)";
      icon.style.border = "1px solid rgba(148, 163, 184, 0.55)";
    const titleText = document.createElement("div");
    titleText.innerHTML = `<strong>${outDef?.label || recipe.label}</strong><br/>Niv. ${recipe.level}`;
    title.appendChild(icon);
    title.appendChild(titleText);

    const xpLine = document.createElement("div");
    xpLine.style.marginTop = "6px";
    xpLine.textContent = `XP gagné : ${recipe.xpGain ?? 0} XP`;

    const stats = outDef?.statsBonus;
    const statsBlock = document.createElement("div");
    statsBlock.style.marginTop = "8px";
    if (stats && typeof stats === "object") {
      const ul = document.createElement("ul");
      ul.style.listStyle = "none";
      ul.style.padding = "0";
      ul.style.margin = "0";
      Object.entries(stats).forEach(([k, v]) => {
        const li = document.createElement("li");
        li.style.display = "flex";
        li.style.gap = "6px";
        li.style.alignItems = "center";
        const spanVal = document.createElement("span");
        spanVal.textContent = `${v >= 0 ? "+" : ""}${v}`;
        const spanLabel = document.createElement("span");
        spanLabel.textContent = k;

        const cls = (() => {
          switch (k) {
            case "vitalite":
            case "hp":
            case "hpMax":
            case "hpPlus":
              return "inventory-bonus-stat-vitalite";
            case "agilite":
              return "inventory-bonus-stat-agilite";
            case "force":
              return "inventory-bonus-stat-force";
            case "intelligence":
              return "inventory-bonus-stat-intel";
            case "chance":
              return "inventory-bonus-stat-chance";
            case "initiative":
              return "inventory-bonus-stat-init";
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

        spanVal.className = cls;
        spanLabel.className = cls;
        li.appendChild(spanVal);
        li.appendChild(spanLabel);
        ul.appendChild(li);
      });
      statsBlock.appendChild(ul);
    } else {
      statsBlock.innerHTML = '<span style="opacity:0.7;">Aucune statistique.</span>';
    }

    const ingTitle = document.createElement("div");
    ingTitle.style.marginTop = "10px";
    ingTitle.innerHTML = "<strong>Ingrédients :</strong>";

    const ingList = document.createElement("ul");
    ingList.style.listStyle = "none";
    ingList.style.padding = "0";
    ingList.style.margin = "4px 0 0 0";
    recipe.inputs.forEach((input) => {
      const def = getItemDef(input.itemId);
      const li = document.createElement("li");
      li.style.display = "flex";
      li.style.alignItems = "center";
      li.style.gap = "6px";
      const ingIcon = document.createElement("img");
      ingIcon.src = def?.icon || "";
      ingIcon.alt = def?.label || input.itemId;
      ingIcon.style.width = "24px";
      ingIcon.style.height = "24px";
      ingIcon.style.objectFit = "cover";
      ingIcon.style.borderRadius = "6px";
      ingIcon.style.background = "#1f2933";
      ingIcon.style.border = "1px solid #2d3742";

      const txt = document.createElement("span");
      txt.textContent = `${input.qty} x ${def?.label || input.itemId}`;
      li.appendChild(ingIcon);
      li.appendChild(txt);
      ingList.appendChild(li);
    });

    craftInfoEl.appendChild(title);
    craftInfoEl.appendChild(xpLine);
    craftInfoEl.appendChild(statsBlock);
    craftInfoEl.appendChild(ingTitle);
    craftInfoEl.appendChild(ingList);
  };

  const renderCraftPanel = (def, state, metierId) => {
    if (!craftFiltersEl || !craftListEl) return;
    const recipesForMetier = CRAFT_RECIPES[metierId] || [];

    // Filtres
    craftFiltersEl.innerHTML = "";
    const categories =
      def.craftCategories && def.craftCategories.length > 0
        ? def.craftCategories
        : [{ id: "all", label: "Tout" }];
    const allBtn = document.createElement("button");
    allBtn.textContent = "Tout";
    allBtn.className = craftCategory === "all" ? "active" : "";
    allBtn.onclick = () => {
      craftCategory = "all";
      renderCraftPanel(def, state);
    };
    craftFiltersEl.appendChild(allBtn);

    categories.forEach((cat) => {
      const btn = document.createElement("button");
      btn.textContent = cat.label;
      btn.className = craftCategory === cat.id ? "active" : "";
      btn.onclick = () => {
        craftCategory = cat.id;
        renderCraftPanel(def, state);
      };
      craftFiltersEl.appendChild(btn);
    });

    // Recherche
    if (craftSearchEl && craftSearchEl.value !== craftSearchValue) {
      craftSearchValue = craftSearchEl.value;
    }
    if (craftSearchEl && !craftSearchEl.oninput) {
      craftSearchEl.oninput = () => {
        craftSearchValue = craftSearchEl.value || "";
        renderCraftPanel(def, state);
      };
    }

    const search = (craftSearchValue || "").toLowerCase();

    // Recettes filtrées
    const recipes = recipesForMetier.filter((r) => {
      const matchCat = craftCategory === "all" || r.category === craftCategory;
      const label = (r.label || "").toLowerCase();
      return matchCat && (!search || label.includes(search));
    });

    craftListEl.innerHTML = "";
    recipes.forEach((recipe) => {
      const outDef = getItemDef(recipe.output.itemId);
      const card = document.createElement("div");
      card.className = "metier-craft-card";
      card.style.border = "1px solid #2d3742";
      card.style.borderRadius = "10px";
      card.style.padding = "8px";
      card.style.display = "flex";
      card.style.alignItems = "center";
      card.style.justifyContent = "space-between";
      card.style.gap = "10px";
      card.style.cursor = "pointer";
      const currentSelected = craftSelectedByMetier[metierId] || null;
      card.style.background =
        currentSelected === recipe.id
          ? "rgba(59, 130, 246, 0.18)"
          : "rgba(255, 255, 255, 0.06)";

      const left = document.createElement("div");
      left.style.display = "flex";
      left.style.alignItems = "center";
      left.style.gap = "8px";
      const icon = document.createElement("img");
      icon.src = outDef?.icon || "";
      icon.alt = outDef?.label || recipe.output.itemId;
      icon.style.width = "38px";
      icon.style.height = "38px";
      icon.style.borderRadius = "8px";
      icon.style.background = "rgba(248, 250, 252, 0.92)";
      icon.style.border = "1px solid rgba(148, 163, 184, 0.55)";
      const text = document.createElement("div");
      text.innerHTML = `<div>${outDef?.label || recipe.label}</div><div style="opacity:0.7; font-size:12px;">Niv. ${recipe.level}</div>`;
      left.appendChild(icon);
      left.appendChild(text);

      const right = document.createElement("div");
      right.style.fontSize = "12px";
      right.style.color = "#dbe9f9";
      right.textContent = `${recipe.xpGain ?? 0} XP`;

      card.onclick = () => {
        craftSelectedByMetier[metierId] = recipe.id;
        renderCraftPanel(def, state, metierId);
        renderCraftInfo(recipe);
      };

      card.appendChild(left);
      card.appendChild(right);
      craftListEl.appendChild(card);
    });

    const currentSel = craftSelectedByMetier[metierId];
    if (!currentSel && recipes.length > 0) {
      craftSelectedByMetier[metierId] = recipes[0].id;
      renderCraftInfo(recipes[0]);
    } else {
      const selectedRecipe = recipes.find((r) => r.id === currentSel);
      renderCraftInfo(selectedRecipe || recipes[0]);
    }
  };

  const updatePanel = () => {
    renderMetiersList();

    const items = listEl.querySelectorAll(".metier-list-item");
    items.forEach((item) => {
      const id = item.dataset.metierId;
      item.classList.toggle("metier-list-item-active", id === currentMetierId);
      const levelSpan = item.querySelector(
        ".metier-list-level[data-role='metier-level']"
      );
      const state = id ? getPlayerMetierState(id) : null;
      if (levelSpan && state) {
        levelSpan.textContent = `Niv. ${state.level}`;
      }
    });

    renderMetierDetail(currentMetierId);
  };

  // Met à jour l'UI quand le store signale un changement métier.
  unsubscribeMetier = onStoreEvent("metier:updated", (payload) => {
    if (!payload || payload.id !== currentMetierId) return;
    updatePanel();
  });

  buttonEl.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = !document.body.classList.contains("hud-metiers-open");
    document.body.classList.toggle("hud-metiers-open", willOpen);
    if (willOpen) {
      updatePanel();
    }
  });

  metiersUiInitialized = true;
}
