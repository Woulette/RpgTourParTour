import { on as onStoreEvent } from "../../../state/store.js";
import { refreshAchievements } from "./index.js";

let achievementRuntimeInitialized = false;
let achievementRuntimeUnsubs = [];

export function initAchievementRuntime(player) {
  if (achievementRuntimeInitialized) return;
  if (!player) return;

  // Initial render
  refreshAchievements(player);

  const unsub = onStoreEvent("quest:updated", () => {
    refreshAchievements(player);
  });
  achievementRuntimeUnsubs.push(unsub);

  achievementRuntimeInitialized = true;
}

export function resetAchievementRuntime() {
  if (!achievementRuntimeInitialized) return;
  achievementRuntimeUnsubs.forEach((unsub) => {
    try {
      unsub();
    } catch (err) {
      // ignore cleanup errors
    }
  });
  achievementRuntimeUnsubs = [];
  achievementRuntimeInitialized = false;
}
