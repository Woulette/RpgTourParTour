import { getAllQuestStates, QUEST_STATES } from "../quests/index.js";
import { on as onStoreEvent } from "../state/store.js";
import { countItemInInventory } from "../quests/runtime/objectives.js";

let domQuestsInitialized = false;
let unsubscribeQuests = null;
let unsubscribeQuestsInventory = null;

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
  let selectedQuestId = null;

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

  const renderDetail = (def, state, stage) => {
    if (!def || !state) {
      if (detailTitleEl) detailTitleEl.textContent = "";
      if (detailDescEl) detailDescEl.textContent = "";
      if (detailProgressEl) detailProgressEl.textContent = "";
      if (detailRewardsEl) detailRewardsEl.textContent = "";
      if (detailProgressBarFillEl) {
        detailProgressBarFillEl.style.setProperty(
          "--quest-progress-percent",
          "0%"
        );
      }
      return;
    }

    if (detailTitleEl) {
      detailTitleEl.textContent = def.title;
    }

    if (detailDescEl) {
      const stageDesc = stage?.description;
      detailDescEl.textContent = stageDesc || def.description || "";
    }

    if (detailProgressEl) {
      const objective = stage?.objective;
      if (objective && objective.type === "kill_monster") {
        const required = objective.requiredCount || 1;
        const current = state.progress?.currentCount || 0;
        detailProgressEl.textContent = `${objective.label}: ${current}/${required}`;

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
      } else if (objective && objective.type === "talk_to_npc") {
        const required = objective.requiredCount || 1;
        const current = Math.min(
          required,
          state.progress?.currentCount || 0
        );
        detailProgressEl.textContent = `${objective.label}: ${current}/${required}`;
        if (detailProgressBarFillEl) {
          const percent = (current / required) * 100;
          detailProgressBarFillEl.style.setProperty(
            "--quest-progress-percent",
            `${percent}%`
          );
        }
      } else if (objective && objective.type === "deliver_item") {
        const required = objective.qty || 1;
        const current = Math.min(
          required,
          countItemInInventory(player, objective.itemId)
        );
        detailProgressEl.textContent = `${objective.label}: ${current}/${required}`;
        if (detailProgressBarFillEl) {
          const percent = (current / required) * 100;
          detailProgressBarFillEl.style.setProperty(
            "--quest-progress-percent",
            `${percent}%`
          );
        }
      } else if (objective && objective.type === "craft_items") {
        const items = Array.isArray(objective.items) ? objective.items : [];
        const required = items.reduce((acc, it) => acc + (it?.qty || 1), 0);
        const current = Math.min(required, state.progress?.currentCount || 0);
        detailProgressEl.textContent = `${objective.label}: ${current}/${required}`;
        if (detailProgressBarFillEl) {
          const percent = required > 0 ? (current / required) * 100 : 0;
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
      detailRewardsEl.textContent = parts.join(" / ");
    }
  };

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

    let selectedEntry = null;

    all.forEach(({ def, state, stage }) => {
      if (!def) return;

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
        selectedQuestId = def.id;
        renderDetail(def, state, stage);
      });

      if (selectedQuestId && selectedQuestId === def.id) {
        selectedEntry = { def, state, stage, li };
      }

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

    if (selectedEntry) {
      if (activeItemEl) {
        activeItemEl.classList.remove("quest-item-active");
      }
      activeItemEl = selectedEntry.li;
      activeItemEl.classList.add("quest-item-active");
      renderDetail(selectedEntry.def, selectedEntry.state, selectedEntry.stage);
    } else {
      if (activeItemEl) {
        activeItemEl.classList.remove("quest-item-active");
      }
      activeItemEl = null;
      selectedQuestId = null;
      renderDetail(null, null, null);
    }
  };

  const refreshPanel = () => {
    renderLists();
  };

  buttonEl.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = !document.body.classList.contains("hud-quests-open");
    document.body.classList.toggle("hud-quests-open", willOpen);
    if (willOpen) {
      refreshPanel();
    }
  });

  unsubscribeQuests = onStoreEvent("quest:updated", () => {
    if (document.body.classList.contains("hud-quests-open")) {
      refreshPanel();
    }
  });

  unsubscribeQuestsInventory = onStoreEvent("inventory:updated", () => {
    if (document.body.classList.contains("hud-quests-open")) {
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
