import { initStore, resetStore } from "../../state/store.js";
import {
  initQuestRuntime,
  resetQuestRuntime,
} from "../../features/quests/runtime/init.js";
import {
  initAchievementRuntime,
  resetAchievementRuntime,
} from "../../features/achievements/runtime/init.js";
import { initDevCheats } from "../../dev/cheats.js";

export function resetRuntime() {
  resetQuestRuntime();
  resetAchievementRuntime();
  resetStore();
}

export function initRuntime(scene, player) {
  resetRuntime();
  initStore(player);

  initQuestRuntime(player);
  initAchievementRuntime(player);
  initDevCheats(scene);
}
