import { createPlayer } from "../../entities/player.js";
import {
  setupPlayerAnimations,
  setupCharacterAnimations,
} from "../../entities/animation.js";
import { setupMonsterAnimations } from "../../features/monsters/runtime/index.js";
import { setupSpellAnimations } from "../../features/spells/runtime/animations.js";
import { recalcDepths } from "../../features/maps/world.js";
import { applySnapshotToPlayer } from "../../save/index.js";
import { defaultClassId } from "../../config/classes.js";
import { startOutOfCombatRegen } from "../../core/regen.js";

export function setupPlayerForScene(scene, options) {
  const { startX, startY, startTileX, startTileY, snapshot, selected } = options;

  const classId = selected?.classId || snapshot?.classId || defaultClassId;
  const displayName = selected?.name || snapshot?.name || "Joueur";

  const player = createPlayer(scene, startX, startY, classId);
  player.characterId = selected?.id || snapshot?.id || null;
  player.displayName = displayName;
  player.currentTileX = startTileX;
  player.currentTileY = startTileY;
  player.currentMapKey = scene.currentMapKey || snapshot?.mapKey || null;

  setupPlayerAnimations(scene);
  setupCharacterAnimations(scene, "tank");
  setupCharacterAnimations(scene, "animiste");
  setupCharacterAnimations(scene, "eryon");
  setupMonsterAnimations(scene);
  setupSpellAnimations(scene);

  if (typeof player.setDepth === "function") {
    player.setDepth(startY);
  }

  recalcDepths(scene);

  if (snapshot) {
    applySnapshotToPlayer(player, snapshot);
    if (Number.isFinite(snapshot.tileX) && Number.isFinite(snapshot.tileY)) {
      player.currentTileX = snapshot.tileX;
      player.currentTileY = snapshot.tileY;
    }
  }

  scene.player = player;
  startOutOfCombatRegen(scene, player);
  return player;
}
