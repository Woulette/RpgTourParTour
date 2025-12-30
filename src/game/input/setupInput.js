import { enableClickToMove } from "../../entities/playerMovement.js";
import { attachCombatPreview } from "../../features/ui/combatPreview.js";
import { attachMonsterTooltip } from "../../features/ui/monsterTooltip.js";
import { attachCombatTileHover } from "../../features/ui/combatTileHover.js";
import { attachLosDebug } from "../../features/ui/losDebug.js";

export function setupSceneInput(scene, hudY, map, groundLayer) {
  enableClickToMove(scene, scene.player, hudY, map, groundLayer);

  attachCombatPreview(scene);
  attachMonsterTooltip(scene);
  attachCombatTileHover(scene, hudY);
  attachLosDebug(scene);

  scene.input.on("gameobjectdown", (pointer, gameObject) => {
    if (!gameObject.monsterId) return;
    if (scene.combatState && scene.combatState.enCours) return;
    scene.pendingCombatTarget = gameObject;
  });
}
