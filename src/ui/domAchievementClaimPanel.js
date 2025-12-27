import { on as onStoreEvent } from "../state/store.js";
import { claimAchievement, getAchievementProgress } from "../achievements/runtime.js";
import { achievementDefs } from "../achievements/defs/index.js";
import { getItemDef } from "../inventory/inventoryCore.js";

let initialized = false;
let unsubscribeAchievements = null;
let achievementsUiPlayer = null;

function buildClaimableList(player) {
  return achievementDefs
    .map((def) => getAchievementProgress(player, def.id))
    .filter((p) => p && p.unlocked && !p.claimed);
}

function openPanel() {
  document.body.classList.add("hud-claim-open");
}

function closePanel() {
  document.body.classList.remove("hud-claim-open");
}

function renderRewardSummary(container, rewards) {
  if (!container) return;
  const r = rewards || {};
  container.innerHTML = "";

  const parts = [];
  if (r.xpPlayer) parts.push(`+${r.xpPlayer} XP`);
  if (r.gold) parts.push(`+${r.gold} or`);
  if (r.honorPoints) parts.push(`+${r.honorPoints} honneur`);

  if (parts.length > 0) {
    const text = document.createElement("span");
    text.className = "claim-reward-text";
    text.textContent = parts.join(" \u2022 ");
    container.appendChild(text);
  }

  const items = Array.isArray(r.items) ? r.items : [];
  if (items.length > 0) {
    const wrap = document.createElement("div");
    wrap.className = "claim-reward-items";

    items.forEach((item) => {
      if (!item || !item.itemId) return;
      const def = getItemDef(item.itemId);
      const label = def?.label || item.itemId;
      const qty = item.qty || 1;

      const entry = document.createElement("div");
      entry.className = "claim-reward-item";
      entry.title = label;

      if (def?.icon) {
        const img = document.createElement("img");
        img.className = "claim-reward-icon";
        img.src = def.icon;
        img.alt = label;
        img.loading = "lazy";
        entry.appendChild(img);
      } else {
        const fallback = document.createElement("span");
        fallback.className = "claim-reward-fallback";
        fallback.textContent = label;
        entry.appendChild(fallback);
      }

      if (qty > 1) {
        const qtyEl = document.createElement("span");
        qtyEl.className = "claim-reward-qty";
        qtyEl.textContent = `x${qty}`;
        entry.appendChild(qtyEl);
      }

      wrap.appendChild(entry);
    });

    container.appendChild(wrap);
  }

  if (parts.length === 0 && items.length === 0) {
    const empty = document.createElement("span");
    empty.className = "claim-reward-text";
    empty.textContent = "Aucune recompense";
    container.appendChild(empty);
  }
}

function renderClaimList(listEl, claimAllBtn, player) {
  if (!listEl) return;
  const claimables = buildClaimableList(player);
  listEl.innerHTML = "";

  if (claimables.length === 0) {
    const empty = document.createElement("div");
    empty.className = "claim-empty";
    empty.textContent = "Aucun succes a reclamer.";
    listEl.appendChild(empty);
    if (claimAllBtn) claimAllBtn.disabled = true;
    return;
  }

  if (claimAllBtn) claimAllBtn.disabled = false;

  claimables.forEach((entry) => {
    const wrapper = document.createElement("div");
    wrapper.className = "claim-item";

    const left = document.createElement("div");
    const title = document.createElement("div");
    title.className = "claim-item-title";
    title.textContent = entry.def.title || entry.def.id;
    const desc = document.createElement("div");
    desc.className = "claim-item-desc";
    renderRewardSummary(desc, entry.def.rewards);
    left.appendChild(title);
    left.appendChild(desc);

    const actions = document.createElement("div");
    actions.className = "claim-item-actions";
    const claimBtn = document.createElement("button");
    claimBtn.className = "claim-btn";
    claimBtn.type = "button";
    claimBtn.textContent = "Reclamer";
    claimBtn.onclick = () => {
      const result = claimAchievement(player, entry.def.id);
      if (result?.ok) {
        renderClaimList(listEl, claimAllBtn, player);
      }
    };
    actions.appendChild(claimBtn);

    wrapper.appendChild(left);
    wrapper.appendChild(actions);
    listEl.appendChild(wrapper);
  });
}

export function openAchievementClaimPanel(player) {
  if (!player) return false;
  const listEl = document.getElementById("hud-claim-list");
  const claimAllBtn = document.getElementById("hud-claim-all");
  const closeBtn = document.getElementById("hud-claim-close");
  if (!listEl) return false;
  if (closeBtn) closeBtn.onclick = () => closePanel();
  openPanel();
  renderClaimList(listEl, claimAllBtn, player);
  return true;
}

export function initDomAchievementClaimPanel(player) {
  if (initialized) return;
  if (!player) return;

  achievementsUiPlayer = player;

  const closeBtn = document.getElementById("hud-claim-close");
  const listEl = document.getElementById("hud-claim-list");
  const claimAllBtn = document.getElementById("hud-claim-all");

  if (closeBtn) {
    closeBtn.onclick = () => closePanel();
  }

  if (claimAllBtn) {
    claimAllBtn.onclick = () => {
      const claimables = buildClaimableList(player);
      claimables.forEach((entry) => {
        claimAchievement(player, entry.def.id);
      });
      renderClaimList(listEl, claimAllBtn, player);
    };
  }

  unsubscribeAchievements = onStoreEvent("achievements:updated", () => {
    if (!document.body.classList.contains("hud-claim-open")) return;
    renderClaimList(listEl, claimAllBtn, achievementsUiPlayer);
  });

  initialized = true;
}

export function teardownDomAchievementClaimPanel() {
  if (unsubscribeAchievements) unsubscribeAchievements();
  unsubscribeAchievements = null;
  achievementsUiPlayer = null;
  initialized = false;
}
