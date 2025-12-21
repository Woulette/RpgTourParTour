import { on as onStoreEvent } from "../../state/store.js";
import { refreshAchievements } from "../runtime.js";

let achievementRuntimeInitialized = false;

export function initAchievementRuntime(player) {
  if (achievementRuntimeInitialized) return;
  if (!player) return;

  // Initial render
  refreshAchievements(player);

  onStoreEvent("quest:updated", () => {
    refreshAchievements(player);
  });

  achievementRuntimeInitialized = true;
}

