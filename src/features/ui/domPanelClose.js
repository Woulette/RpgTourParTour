let initialized = false;

const OPEN_CLASSES = [
  "hud-inventory-open",
  "hud-quests-open",
  "hud-metiers-open",
  "hud-friends-open",
  "hud-map-open",
  "hud-spells-open",
  "hud-stats-open",
  "hud-achievements-open",
  "hud-claim-open",
  "hud-trade-open",
  "shop-open",
  "npc-dialog-open",
];

export function closeAllHudPanels() {
  if (document.body.classList.contains("hud-trade-open")) {
    const closer = window.__tradeCloseRequest;
    if (typeof closer === "function") {
      closer();
    }
  }
  OPEN_CLASSES.forEach((cls) => document.body.classList.remove(cls));
  // NPC dialog also uses aria-hidden; click its close if present.
  const npcClose = document.getElementById("npc-dialog-close");
  if (npcClose && typeof npcClose.click === "function") {
    npcClose.click();
  }
}

export function initDomPanelClose() {
  if (initialized) return;

  // Escape closes the currently opened HUD panel(s)
  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" && event.code !== "Escape") return;

    // If achievements icon hint is clicked via keyboard somehow, keep it simple: close all.
    closeAllHudPanels();
  });

  initialized = true;
}
