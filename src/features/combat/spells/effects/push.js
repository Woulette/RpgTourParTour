import { tryPushEntity } from "../cast/castMovement.js";

export function applyPushEffect(ctx, effect) {
  const { scene, map, groundLayer, caster, target } = ctx;
  if (!scene || !map || !caster || !target) return false;
  const distance =
    typeof effect?.distance === "number" ? effect.distance : 0;
  if (distance <= 0) return false;
  return tryPushEntity(scene, map, groundLayer, caster, target, distance);
}
