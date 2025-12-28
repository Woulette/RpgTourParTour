import { enableClickToMove } from "../../entities/playerMovement.js";
import { attachCombatPreview } from "../../ui/combatPreview.js";
import { attachMonsterTooltip } from "../../ui/monsterTooltip.js";
import { attachCombatTileHover } from "../../ui/combatTileHover.js";

export function setupSceneInput(scene, hudY, map, groundLayer) {
  enableClickToMove(scene, scene.player, hudY, map, groundLayer);

  attachCombatPreview(scene);
  attachMonsterTooltip(scene);
  attachCombatTileHover(scene, hudY);

  scene.input.on("gameobjectdown", (pointer, gameObject) => {
    if (!gameObject.monsterId) return;
    if (scene.combatState && scene.combatState.enCours) return;
    scene.pendingCombatTarget = gameObject;
  });
}
