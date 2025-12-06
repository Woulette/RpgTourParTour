import { getAllQuestStates, QUEST_STATES } from "../quests/index.js";

let domQuestsInitialized = false;

export function initDomQuests(player) {
  if (domQuestsInitialized) return;
  const buttonEl = document.getElementById("hud-quests-button");
  const panelEl = document.getElementById("hud-quests-panel");

  if (!buttonEl || !panelEl || !player) return;

  const listAvailable = panelEl.querySelector("#quests-list-available");
  const listActive = panelEl.querySelector("#quests-list-active");
  const listCompleted = panelEl.querySelector("#quests-list-completed");

  const detailTitleEl = panelEl.querySelector("#quest-detail-title");
  const detailDescEl = panelEl.querySelector("#quest-detail-desc");
  const detailProgressEl = panelEl.querySelector("#quest-detail-progress");
  const detailRewardsEl = panelEl.querySelector("#quest-detail-rewards");

  let detailProgressBarFillEl = panelEl.querySelector(
    "#quest-detail-progress-bar-fill"
  );
  if (!detailProgressBarFillEl && detailProgressEl && detailProgressEl.parentNode) {
    const bar = document.createElement("div");
    bar.className = "quest-detail-progress-bar";
    const fill = document.createElement("div");
    fill.id = "quest-detail-progress-bar-fill";
    fill.className = "quest-detail-progress-bar-fill";
    bar.appendChild(fill);
    detailProgressEl.parentNode.insertBefore(bar, detailRewardsEl);
    detailProgressBarFillEl = fill;
  }

  const filtersContainer =
    panelEl.querySelector(".quests-filters") || document.createElement("div");

  if (!filtersContainer.classList.contains("quests-filters")) {
    filtersContainer.className = "quests-filters";
    filtersContainer.innerHTML = `
      <button type="button"
              class="quests-filter-button quests-filter-button-active"
              data-filter="all">
        <span class="quests-filter-label">Toutes</span>
        <span class="quests-filter-count" data-filter-count="all">0</span>
      </button>
      <button type="button"
              class="quests-filter-button"
              data-filter="available">
        <span class="quests-filter-label">Disponibles</span>
        <span class="quests-filter-count" data-filter-count="available">0</span>
      </button>
      <button type="button"
              class="quests-filter-button"
              data-filter="active">
        <span class="quests-filter-label">En cours</span>
        <span class="quests-filter-count" data-filter-count="active">0</span>
      </button>
      <button type="button"
              class="quests-filter-button"
              data-filter="completed">
        <span class="quests-filter-label">Terminées</span>
        <span class="quests-filter-count" data-filter-count="completed">0</span>
      </button>
    `;

    const bodyEl = panelEl.querySelector(".quests-body");
    if (bodyEl && bodyEl.parentNode) {
      bodyEl.parentNode.insertBefore(filtersContainer, bodyEl);
    } else {
      panelEl.insertBefore(filtersContainer, panelEl.firstChild.nextSibling);
    }
  }

  const filterButtons = Array.from(
    panelEl.querySelectorAll(".quests-filter-button")
  );
  const filterCounts = {
    all: panelEl.querySelector('[data-filter-count="all"]'),
    available: panelEl.querySelector('[data-filter-count="available"]'),
    active: panelEl.querySelector('[data-filter-count="active"]'),
    completed: panelEl.querySelector('[data-filter-count="completed"]'),
  };

  const columnAvailable = listAvailable
    ? listAvailable.closest(".quests-column")
    : null;
  const columnActive = listActive ? listActive.closest(".quests-column") : null;
  const columnCompleted = listCompleted
    ? listCompleted.closest(".quests-column")
    : null;

  let currentFilter = "all";
  let activeItemEl = null;

  const renderLists = () => {
    if (!listAvailable || !listActive || !listCompleted) return;
    listAvailable.innerHTML = "";
    listActive.innerHTML = "";
    listCompleted.innerHTML = "";

    const all = getAllQuestStates(player);

    const counts = {
      all: all.length,
      available: 0,
      active: 0,
      completed: 0,
    };

    all.forEach(({ def, state }) => {
      const li = document.createElement("li");
      li.className = "quest-item";
      li.textContent = def.title;
      li.dataset.questId = def.id;

      li.addEventListener("click", (event) => {
        event.stopPropagation();
        if (activeItemEl) {
          activeItemEl.classList.remove("quest-item-active");
        }
        activeItemEl = li;
        li.classList.add("quest-item-active");
        renderDetail(def, state);
      });

      if (state.state === QUEST_STATES.NOT_STARTED) {
        listAvailable.appendChild(li);
        counts.available += 1;
      } else if (state.state === QUEST_STATES.IN_PROGRESS) {
        listActive.appendChild(li);
        counts.active += 1;
      } else if (state.state === QUEST_STATES.COMPLETED) {
        listCompleted.appendChild(li);
        counts.completed += 1;
      }
    });

    if (filterCounts.all) filterCounts.all.textContent = counts.all;
    if (filterCounts.available)
      filterCounts.available.textContent = counts.available;
    if (filterCounts.active) filterCounts.active.textContent = counts.active;
    if (filterCounts.completed)
      filterCounts.completed.textContent = counts.completed;

    applyFilter(currentFilter, { columnAvailable, columnActive, columnCompleted });
  };

  const renderDetail = (def, state) => {
    if (!def || !state) {
      if (detailTitleEl) detailTitleEl.textContent = "";
      if (detailDescEl) detailDescEl.textContent = "";
      if (detailProgressEl) detailProgressEl.textContent = "";
      if (detailRewardsEl) detailRewardsEl.textContent = "";
      return;
    }

    if (detailTitleEl) {
      detailTitleEl.textContent = def.title;
    }

    if (detailDescEl) {
      detailDescEl.textContent = def.description || "";
    }

    if (detailProgressEl) {
      if (def.objective && def.objective.type === "kill_monster") {
        const required = def.objective.requiredCount || 1;
        const current = state.progress.currentCount || 0;
        detailProgressEl.textContent = `${def.objective.label}: ${current}/${required}`;

        const percent = Math.max(
          0,
          Math.min(100, (current / required) * 100)
        );
        if (detailProgressBarFillEl) {
          detailProgressBarFillEl.style.setProperty(
            "--quest-progress-percent",
            `${percent}%`
          );
        }
      } else {
        detailProgressEl.textContent = "";
        if (detailProgressBarFillEl) {
          detailProgressBarFillEl.style.setProperty(
            "--quest-progress-percent",
            "0%"
          );
        }
      }
    }

    if (detailRewardsEl) {
      const rewards = def.rewards || {};
      const parts = [];
      if (rewards.xpPlayer) {
        parts.push(`${rewards.xpPlayer} XP`);
      }
      if (rewards.gold) {
        parts.push(`${rewards.gold} or`);
      }
      // Affiche les récompenses séparées par un séparateur lisible
      // Separateur lisible et ASCII
      detailRewardsEl.textContent = parts.join(" / ");
    }
  };

  const refreshPanel = () => {
    renderLists();
  };

  const applyFilter = (filter, columns) => {
    currentFilter = filter;

    filterButtons.forEach((btn) => {
      const value = btn.getAttribute("data-filter");
      btn.classList.toggle("quests-filter-button-active", value === filter);
    });

    if (!columns) return;

    const { columnAvailable, columnActive, columnCompleted } = columns;

    const showAvailable = filter === "all" || filter === "available";
    const showActive = filter === "all" || filter === "active";
    const showCompleted = filter === "all" || filter === "completed";

    if (columnAvailable) {
      columnAvailable.style.display = showAvailable ? "" : "none";
    }
    if (columnActive) {
      columnActive.style.display = showActive ? "" : "none";
    }
    if (columnCompleted) {
      columnCompleted.style.display = showCompleted ? "" : "none";
    }
  };

  buttonEl.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = !document.body.classList.contains("hud-quests-open");
    document.body.classList.toggle("hud-quests-open", willOpen);
    if (willOpen) {
      refreshPanel();
    }
  });

  filterButtons.forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const filter = btn.getAttribute("data-filter") || "all";
      applyFilter(filter, {
        columnAvailable,
        columnActive,
        columnCompleted,
      });
    });
  });

  domQuestsInitialized = true;
}
