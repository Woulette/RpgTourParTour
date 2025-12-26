let initialized = false;

const OPEN_CLASSES = [
  "hud-inventory-open",
  "hud-quests-open",
  "hud-metiers-open",
  "hud-map-open",
  "hud-spells-open",
  "hud-stats-open",
  "hud-achievements-open",
  "shop-open",
  "npc-dialog-open",
];

function closeAllPanels() {
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
    closeAllPanels();
  });

  initialized = true;
}
