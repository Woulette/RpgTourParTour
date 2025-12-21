import { on as onStoreEvent } from "../state/store.js";
import { getAchievementProgress } from "../achievements/runtime.js";
import { achievementPackDefs } from "../achievements/defs/index.js";
import { openAchievementsTo } from "./domAchievements.js";

let initialized = false;
let hintButtonEl = null;
let hintBadgeEl = null;
let unsubscribeAchievements = null;

function ensureHintButton() {
  if (hintButtonEl) return hintButtonEl;

  hintButtonEl = document.getElementById("hud-claim-hint-button");
  if (hintButtonEl) {
    hintBadgeEl = hintButtonEl.querySelector(".hud-claim-hint-badge");
    return hintButtonEl;
  }

  hintButtonEl = document.createElement("button");
  hintButtonEl.id = "hud-claim-hint-button";
  hintButtonEl.type = "button";
  hintButtonEl.className = "hud-claim-hint hud-claim-hint-hidden";
  hintButtonEl.setAttribute("aria-label", "R\u00e9compenses d'accomplissements disponibles");

  const icon = document.createElement("span");
  icon.className = "hud-claim-hint-icon";
  icon.textContent = "!";

  hintBadgeEl = document.createElement("span");
  hintBadgeEl.className = "hud-claim-hint-badge";
  hintBadgeEl.textContent = "0";

  hintButtonEl.appendChild(icon);
  hintButtonEl.appendChild(hintBadgeEl);
  document.body.appendChild(hintButtonEl);

  return hintButtonEl;
}

function computeClaimable(player) {
  const claimables = [];

  achievementPackDefs.forEach((pack) => {
    const ids = Array.isArray(pack.objectiveAchievementIds) ? pack.objectiveAchievementIds : [];
    ids.forEach((id) => {
      const p = getAchievementProgress(player, id);
      if (!p) return;
      if (p.unlocked && !p.claimed) {
        claimables.push({ packId: pack.id, achievementId: id });
      }
    });
  });

  return claimables;
}

function pickBestTarget(claimables, player) {
  // Priorité : dans l'ordre du pack, et plutôt micro avant la récompense globale.
  for (const pack of achievementPackDefs) {
    const ids = Array.isArray(pack.objectiveAchievementIds) ? pack.objectiveAchievementIds : [];
    const microIds = ids.filter((id) => id !== pack.rewardAchievementId);
    const ordered = [...microIds, pack.rewardAchievementId].filter(Boolean);
    for (const id of ordered) {
      const progress = getAchievementProgress(player, id);
      if (progress?.unlocked && !progress?.claimed) {
        return { packId: pack.id, achievementId: id };
      }
    }
  }

  return claimables[0] || null;
}

function update(player) {
  if (!player) return;
  const btn = ensureHintButton();
  if (!btn) return;

  const claimables = computeClaimable(player);
  const count = claimables.length;

  if (hintBadgeEl) hintBadgeEl.textContent = String(count);
  btn.classList.toggle("hud-claim-hint-hidden", count === 0);

  btn.onclick = () => {
    const target = pickBestTarget(claimables, player);
    if (!target) return;
    openAchievementsTo(target);
  };
}

export function initAchievementClaimHint(player) {
  if (initialized) return;
  if (!player) return;

  ensureHintButton();
  update(player);

  unsubscribeAchievements = onStoreEvent("achievements:updated", () => update(player));
  initialized = true;
}

export function teardownAchievementClaimHint() {
  if (unsubscribeAchievements) unsubscribeAchievements();
  unsubscribeAchievements = null;
  initialized = false;
}

