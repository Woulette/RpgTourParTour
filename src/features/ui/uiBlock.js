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
