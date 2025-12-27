import { getAllQuestStates, QUEST_STATES } from "../quests/index.js";
import { on as onStoreEvent } from "../state/store.js";
import {
  countItemInInventory,
  getCraftedCount,
  hasAppliedParchment,
} from "../quests/runtime/objectives.js";
import { getItemDef } from "../inventory/inventoryCore.js";

let trackerInitialized = false;
let unsubscribeTracker = null;
let unsubscribeTrackerInventory = null;

function pickObjectiveText(stage, state, questDef, player) {
  const objective = stage?.objective;
  if (objective && objective.type === "kill_monster") {
    const required = objective.requiredCount || 1;
    const current = state.progress?.currentCount || 0;
    return `${objective.label}: ${current}/${required}`;
  }
  if (objective && objective.type === "kill_monsters") {
    const list = Array.isArray(objective.monsters) ? objective.monsters : [];
    if (list.length === 0) return stage?.description || questDef?.description || "";
    const kills = state.progress?.kills || {};
    const parts = list
      .filter((entry) => entry && entry.monsterId)
      .map((entry) => {
        const required = entry.requiredCount || 1;
        const current = Math.min(required, kills[entry.monsterId] || 0);
        const label = entry.label || entry.monsterId;
        return `${label}: ${current}/${required}`;
      });
    return parts.join(" | ");
  }
  if (objective && objective.type === "talk_to_npc") {
    const required = objective.requiredCount || 1;
    const isParchmentStep =
      questDef?.id === "alchimiste_marchand_5" && stage?.id === "apply_parchemin";
    const current = isParchmentStep
      ? hasAppliedParchment(player, state)
        ? 1
        : 0
      : Math.min(required, state.progress?.currentCount || 0);
    return `${objective.label}: ${current}/${required}`;
  }
  if (objective && objective.type === "deliver_item") {
    const required = objective.qty || 1;
    const current = Math.min(required, countItemInInventory(player, objective.itemId));
    return `${objective.label}: ${current}/${required}`;
  }
  if (objective && objective.type === "deliver_items") {
    const items = Array.isArray(objective.items) ? objective.items : [];
    if (items.length === 0) return stage?.description || questDef?.description || "";
    const parts = items
      .filter((it) => it && it.itemId)
      .map((it) => {
        const required = it.qty || 1;
        const current = Math.min(required, countItemInInventory(player, it.itemId));
        const label = it.label || getItemDef(it.itemId)?.label || it.itemId;
        return `${label}: ${current}/${required}`;
      });
    return parts.join(" | ");
  }
  if (objective && objective.type === "craft_items") {
    const items = Array.isArray(objective.items) ? objective.items : [];
    const required = items.reduce((acc, it) => acc + (it?.qty || 1), 0);
    const current = Math.min(
      required,
      items.reduce((acc, it) => {
        if (!it || !it.itemId) return acc;
        const req = it.qty || 1;
        const cur = Math.min(req, getCraftedCount(player, state, it.itemId));
        return acc + cur;
      }, 0)
    );
    return `${objective.label}: ${current}/${required}`;
  }
  if (objective && objective.type === "craft_set") {
    const requiredSlots = Array.isArray(objective.requiredSlots)
      ? objective.requiredSlots.filter(Boolean)
      : [];
    const required =
      requiredSlots.length > 0 ? requiredSlots.length : objective.requiredCount || 1;
    const current = Math.min(required, state.progress?.currentCount || 0);
    return `${objective.label}: ${current}/${required}`;
  }
  return stage?.description || questDef?.description || "";
}

export function initQuestTracker(player) {
  if (trackerInitialized) return;
  const root = document.getElementById("quest-tracker");
  const toggleBtn = document.getElementById("quest-tracker-toggle");
  const listEl = document.getElementById("quest-tracker-list");
  const toggleIcon = root ? root.querySelector(".quest-tracker-toggle-icon") : null;

  if (!root || !toggleBtn || !listEl || !player) return;

  let collapsed = false;
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };

  const setCollapsed = (value) => {
    collapsed = value;
    root.classList.toggle("quest-tracker-collapsed", value);
    toggleBtn.setAttribute("aria-expanded", (!value).toString());
    if (toggleIcon) {
      toggleIcon.textContent = value ? "›" : "‹";
    }
  };

  const render = () => {
    listEl.innerHTML = "";
    const quests = getAllQuestStates(player).filter(
      ({ state }) => state.state === QUEST_STATES.IN_PROGRESS
    );

    if (quests.length === 0) {
      const empty = document.createElement("div");
      empty.className = "quest-tracker-empty";
      empty.textContent = "Aucune quete en cours";
      listEl.appendChild(empty);
      return;
    }

    quests.forEach(({ def, state, stage }) => {
      if (!def || !state) return;
      const item = document.createElement("div");
      item.className = "quest-tracker-item";

      const title = document.createElement("div");
      title.className = "quest-tracker-item-title";
      title.textContent = def.title;

      const objective = document.createElement("div");
      objective.className = "quest-tracker-item-objective";
      objective.textContent = pickObjectiveText(stage, state, def, player);

      item.appendChild(title);
      item.appendChild(objective);
      listEl.appendChild(item);
    });
  };

  toggleBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    setCollapsed(!collapsed);
  });

  const onMouseMove = (event) => {
    if (!isDragging) return;
    const nextLeft = event.clientX - dragOffset.x;
    const nextTop = event.clientY - dragOffset.y;
    root.style.left = `${nextLeft}px`;
    root.style.top = `${nextTop}px`;
  };

  const stopDrag = () => {
    if (!isDragging) return;
    isDragging = false;
    root.classList.remove("quest-tracker-dragging");
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", stopDrag);
  };

  root.addEventListener("mousedown", (event) => {
    const isToggle = event.target === toggleBtn || toggleBtn.contains(event.target);
    if (isToggle) return;
    isDragging = true;
    const rect = root.getBoundingClientRect();
    dragOffset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    root.classList.add("quest-tracker-dragging");
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", stopDrag);
  });

  setCollapsed(false);
  render();

  unsubscribeTracker = onStoreEvent("quest:updated", () => {
    render();
  });

  unsubscribeTrackerInventory = onStoreEvent("inventory:updated", () => {
    render();
  });

  trackerInitialized = true;
}
