import { initStore, resetStore } from "../../state/store.js";
import { initAutosave, resetAutosave } from "../../save/autosave.js";
import {
  buildSnapshotFromPlayer,
  saveCharacterSnapshot,
} from "../../save/index.js";
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
  resetAutosave();
  resetStore();
}

export function initRuntime(scene, player) {
  resetRuntime();
  initStore(player);
  initAutosave();

  if (player && player.characterId) {
    const first = buildSnapshotFromPlayer(player);
    if (first) saveCharacterSnapshot(player.characterId, first);
  }

  initQuestRuntime(player);
  initAchievementRuntime(player);
  initDevCheats(scene);
}
