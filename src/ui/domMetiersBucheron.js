export function initDomMetiers(player) {
  const buttonEl = document.getElementById("hud-metiers-button");
  const panelEl = document.getElementById("hud-metiers-panel");

  if (!buttonEl || !panelEl || !player) return;

  // Définition des métiers disponibles et de leurs ressources
  const METIERS_DEFS = {
    bucheron: {
      id: "bucheron",
      name: "Bucheron",
      resources: [
        {
          id: "Chene",
          name: "Bois De Chene",
          level: 1,
          quantityMin: 1,
          quantityMax: 3,
          xpGain: 10,
        },
        {
          id: "chene-solide",
          name: "Chêne solide",
          level: 10,
          quantityMin: 1,
          quantityMax: 4,
          xpGain: 25,
        },
      ],
    },
  };

  // S'assure qu'on a une structure de base pour les métiers du joueur
  if (!player.metiers) {
    player.metiers = {};
  }

  Object.keys(METIERS_DEFS).forEach((id) => {
    if (!player.metiers[id]) {
      player.metiers[id] = { level: 1, xp: 0, xpNext: 100 };
    }
  });

  // Construction de la nouvelle structure HTML dans le panneau (liste + détails)
  const existingBody = panelEl.querySelector(".metiers-body");
  const bodyEl =
    existingBody ||
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

  let listEl = bodyEl.querySelector(".metiers-list");
  if (!listEl) {
    listEl = document.createElement("nav");
    listEl.id = "metiers-list";
    listEl.className = "metiers-list";
    listEl.setAttribute("aria-label", "Liste des métiers");
    bodyEl.appendChild(listEl);
  }

  let detailEl = bodyEl.querySelector(".metier-detail");
  if (!detailEl) {
    detailEl = document.createElement("div");
    detailEl.id = "metier-detail";
    detailEl.className = "metier-detail";
    detailEl.setAttribute(
      "aria-label",
      "Détails du métier sélectionné"
    );
    detailEl.innerHTML = `
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
    bodyEl.appendChild(detailEl);
  }

  const resourcesBodyEl = detailEl.querySelector("#metier-resources-body");
  const detailNameEl = detailEl.querySelector("#metier-detail-name");
  const detailLevelEl = detailEl.querySelector("#metier-detail-level");
  const detailXpEl = detailEl.querySelector("#metier-detail-xp");
  const detailXpNextEl = detailEl.querySelector("#metier-detail-xp-next");
  const detailXpBarFillEl = detailEl.querySelector(
    ".metier-detail-xp-bar-fill"
  );

  let currentMetierId = "bucheron";

  const getPlayerMetierState = (id) => {
    const def = METIERS_DEFS[id];
    if (!def) return null;
    if (!player.metiers[id]) {
      player.metiers[id] = { level: 1, xp: 0, xpNext: 100 };
    }
    const state = player.metiers[id];
    const level = state.level ?? 1;
    const xp = state.xp ?? 0;
    const xpNext = state.xpNext ?? level * 100;
    return { level, xp, xpNext };
  };

  const renderMetiersList = () => {
    listEl.innerHTML = "";
    Object.values(METIERS_DEFS).forEach((metierDef) => {
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
    const def = METIERS_DEFS[metierId];
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
      detailXpBarFillEl.style.setProperty(
        "--metier-xp-percent",
        `${percent}%`
      );
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

  buttonEl.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = !document.body.classList.contains("hud-metiers-open");
    document.body.classList.toggle("hud-metiers-open", willOpen);
    if (willOpen) {
      updatePanel();
    }
  });
}

