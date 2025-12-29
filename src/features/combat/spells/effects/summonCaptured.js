import { getAliveSummon, spawnSummonFromCaptured } from "../../summons/summon.js";

export function applySummonCapturedEffect(ctx, effect) {
  const { scene, caster, map, groundLayer, tileX, tileY, spell } = ctx;
  if (!scene || !caster || !map) return false;
  if (!caster.capturedMonsterId) return false;
  if (getAliveSummon(scene, caster)) return false;

  const summon = spawnSummonFromCaptured(scene, caster, map, groundLayer, {
    preferTile: { x: tileX, y: tileY },
  });
  if (!summon) return false;

  const cooldownAfterDeathTurns =
    effect?.cooldownAfterDeathTurns ??
    spell?.summon?.cooldownAfterDeathTurns ??
    2;

  summon.onKilled = (sceneArg) => {
    const owner = summon.owner;
    if (owner) {
      owner.hasAliveSummon = false;
      owner.spellCooldowns = owner.spellCooldowns || {};
      owner.spellCooldowns[spell.id] = Math.max(0, cooldownAfterDeathTurns | 0);
    }
    if (sceneArg?.combatSummons && Array.isArray(sceneArg.combatSummons)) {
      sceneArg.combatSummons = sceneArg.combatSummons.filter((s) => s !== summon);
    }
  };

  if (scene && typeof scene.updateCombatUi === "function") {
    scene.updateCombatUi();
  }

  return true;
}
