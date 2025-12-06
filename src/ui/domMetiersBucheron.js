import { bucheronDefinition } from "../metier/bucheron/config.js";
import { ensureBucheronState } from "../metier/bucheron/state.js";
import { on as onStoreEvent } from "../state/store.js";

// Métier unique pour l'instant, mais structuré pour en ajouter d'autres.
const METIERS = [bucheronDefinition];
const METIERS_BY_ID = Object.fromEntries(METIERS.map((m) => [m.id, m]));

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
        <section class="metier-resources">
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
      `;
      bodyEl.appendChild(detail);
      return detail;
    })();

  const resourcesBodyEl = detailEl.querySelector("#metier-resources-body");
  const detailNameEl = detailEl.querySelector("#metier-detail-name");
  const detailLevelEl = detailEl.querySelector("#metier-detail-level");
  const detailXpEl = detailEl.querySelector("#metier-detail-xp");
  const detailXpNextEl = detailEl.querySelector("#metier-detail-xp-next");
  const detailXpBarFillEl = detailEl.querySelector(".metier-detail-xp-bar-fill");

  let currentMetierId = "bucheron";

  const getPlayerMetierState = (id) => {
    if (id === "bucheron") {
      return ensureBucheronState(player);
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

    if (resourcesBodyEl) {
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
