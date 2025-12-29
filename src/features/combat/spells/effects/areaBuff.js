import { applyAreaBuffToAllies, applyAreaBuffToMonsters } from "../cast/castBuffs.js";

export function applyAreaBuffEffect(ctx, effect) {
  const { scene, map, groundLayer, caster, spell, isPlayerCaster, isAllyCaster } = ctx;
  if (!scene || !map || !groundLayer || !caster) return false;

  let buffDef = null;
  if (effect && (effect.radius != null || effect.effects)) {
    buffDef = effect;
  } else if (effect?.useSpellAreaBuff && spell?.areaBuff) {
    buffDef = spell.areaBuff;
  } else if (spell?.areaBuff) {
    buffDef = spell.areaBuff;
  }

  if (!buffDef) return false;

  if (isPlayerCaster || isAllyCaster) {
    applyAreaBuffToAllies(scene, map, groundLayer, caster, buffDef);
  } else {
    applyAreaBuffToMonsters(scene, map, groundLayer, caster, buffDef);
  }
  return true;
}
