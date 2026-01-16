export function isCraftPanelOpen() {
  if (typeof document === "undefined") return false;
  return Boolean(document.querySelector(".craft-panel.open"));
}

export function isUiBlockingOpen() {
  if (typeof document === "undefined") return false;

  if (isCraftPanelOpen()) return true;

  const body = document.body;
  const blockingClasses = [
    "hud-inventory-open",
    "hud-stats-open",
    "hud-metiers-open",
    "hud-map-open",
    "hud-quests-open",
    "hud-achievements-open",
    "hud-spells-open",
    "hud-claim-open",
    "hud-trade-open",
    "shop-open",
    "npc-dialog-open",
    "menu-open",
  ];

  if (body) {
    for (const cls of blockingClasses) {
      if (body.classList.contains(cls)) return true;
    }
  }

  const combatOverlay = document.getElementById("combat-result-overlay");
  if (combatOverlay && !combatOverlay.classList.contains("combat-result-hidden")) {
    return true;
  }

  const levelupOverlay = document.getElementById("levelup-overlay");
  if (levelupOverlay && !levelupOverlay.classList.contains("levelup-hidden")) {
    return true;
  }

  return false;
}

let uiBlockerInterval = null;

export function mountUiInputBlocker() {
  if (typeof document === "undefined" || uiBlockerInterval) return;
  const blocker = document.getElementById("ui-input-blocker");
  if (!blocker) return;

  const update = () => {
    const shouldBlock = isUiBlockingOpen();
    document.body.classList.toggle("ui-blocking-open", shouldBlock);
    blocker.setAttribute("aria-hidden", shouldBlock ? "false" : "true");
  };

  update();
  uiBlockerInterval = window.setInterval(update, 100);
}
