import { tryPullEntity } from "../cast/castMovement.js";

export function applyPullEffect(ctx, effect) {
  const { scene, map, groundLayer, caster, target } = ctx;
  if (!scene || !map || !caster || !target) return false;
  const distance =
    typeof effect?.distance === "number" ? effect.distance : 0;
  const toMelee = effect?.toMelee === true;
  if (distance <= 0 && !toMelee) return false;
  return tryPullEntity(scene, map, groundLayer, caster, target, distance, toMelee);
}
