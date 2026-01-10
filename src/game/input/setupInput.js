import { enableClickToMove } from "../../entities/playerMovement.js";
import { attachCombatPreview } from "../../features/ui/combatPreview.js";
import { attachMonsterTooltip } from "../../features/ui/monsterTooltip.js";
import { attachCombatTileHover } from "../../features/ui/combatTileHover.js";

export function setupSceneInput(scene, hudY, map, groundLayer) {
  scene.__moveInputConfig = { hudY, map, groundLayer };
  scene.__rebindMoveInput = () =>
    enableClickToMove(scene, scene.player, hudY, map, groundLayer);

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
