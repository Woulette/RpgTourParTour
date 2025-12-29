import { spawnSummonMonster } from "../../summons/summon.js";

export function applySummonMonsterEffect(ctx, effect) {
  const { scene, caster, spell, map, groundLayer, tileX, tileY } = ctx;
  if (!scene || !caster || !map || !groundLayer) return false;
  const monsterId = effect?.monsterId || spell?.summonMonster?.monsterId;
  if (!monsterId) return false;

  const summon = spawnSummonMonster(scene, caster, map, groundLayer, {
    monsterId,
    preferTile: { x: tileX, y: tileY },
  });
  if (!summon) return false;

  if (scene && typeof scene.updateCombatUi === "function") {
    scene.updateCombatUi();
  }
  return true;
}
