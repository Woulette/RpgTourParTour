import { initStore } from "../../state/store.js";
import { initAutosave } from "../../save/autosave.js";
import {
  buildSnapshotFromPlayer,
  saveCharacterSnapshot,
} from "../../save/index.js";
import { initQuestRuntime } from "../../quests/runtime/init.js";
import { initAchievementRuntime } from "../../achievements/runtime/init.js";
import { initDevCheats } from "../../dev/cheats.js";

export function initRuntime(scene, player) {
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
