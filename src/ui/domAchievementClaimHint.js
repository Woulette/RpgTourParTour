import { on as onStoreEvent } from "../state/store.js";
import { getAchievementProgress } from "../achievements/runtime.js";
import { achievementPackDefs } from "../achievements/defs/index.js";
import { openAchievementClaimPanel } from "./domAchievementClaimPanel.js";

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

function update(player) {
  if (!player) return;
  const btn = ensureHintButton();
  if (!btn) return;

  const claimables = computeClaimable(player);
  const count = claimables.length;

  if (hintBadgeEl) hintBadgeEl.textContent = String(count);
  btn.classList.toggle("hud-claim-hint-hidden", count === 0);

  btn.onclick = () => {
    if (document.body.classList.contains("hud-claim-open")) {
      document.body.classList.remove("hud-claim-open");
      return;
    }
    openAchievementClaimPanel(player);
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
