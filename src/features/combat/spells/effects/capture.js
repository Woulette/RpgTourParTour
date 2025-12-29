import { findMonsterAtTile } from "../../../monsters/runtime/index.js";
import { canApplyCapture, startCaptureAttempt } from "../../summons/capture.js";

export function applyCaptureEffect(ctx, effect) {
  const { scene, caster, tileX, tileY, spell } = ctx;
  if (!scene || !caster) return false;

  const target = findMonsterAtTile(scene, tileX, tileY);
  if (!target) return false;

  const check = canApplyCapture(scene, caster, target);
  if (!check?.ok) return false;

  const playerTurns =
    effect?.playerTurns ??
    spell?.capture?.playerTurns ??
    2;

  startCaptureAttempt(scene, caster, target, { playerTurns });

  if (scene && typeof scene.updateCombatUi === "function") {
    scene.updateCombatUi();
  }

  return true;
}
