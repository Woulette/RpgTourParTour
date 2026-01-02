import { findMonsterAtTile } from "../../../monsters/runtime/index.js";
import { getEffectHandler } from "../core/registry.js";
import {
  findAliveCombatAllyAtTile,
  findAliveSummonAtTile,
} from "../../summons/summon.js";

function resolveTargetAtTile(scene, tileX, tileY, map, groundLayer) {
  const state = scene?.combatState;
  const player = state?.joueur || null;
  if (player) {
    const px =
      typeof player.currentTileX === "number" ? player.currentTileX : player.tileX ?? null;
    const py =
      typeof player.currentTileY === "number" ? player.currentTileY : player.tileY ?? null;
    if (px === tileX && py === tileY) return player;
  }

  const monster = findMonsterAtTile(scene, tileX, tileY);
  if (monster) return monster;

  const ally = findAliveCombatAllyAtTile(scene, tileX, tileY);
  if (ally) return ally;

  const summon = findAliveSummonAtTile(scene, tileX, tileY);
  if (summon) return summon;

  return null;
}

export function executeSpellEffectsAtTile(
  scene,
  caster,
  spell,
  tileX,
  tileY,
  map,
  groundLayer,
  options = {}
) {
  if (!scene || !caster || !spell || !Array.isArray(spell.effects)) return false;

  const state = scene.combatState;
  const target = resolveTargetAtTile(scene, tileX, tileY, map, groundLayer);
  const ctx = {
    scene,
    state,
    caster,
    spell,
    map,
    groundLayer,
    tileX,
    tileY,
    target,
    isPlayerCaster: state?.joueur === caster,
    isAllyCaster: caster?.isCombatAlly === true,
    impactDelayMs:
      typeof options?.impactDelayMs === "number" ? options.impactDelayMs : 0,
  };

  let didAnything = false;

  for (const effect of spell.effects) {
    if (!effect || !effect.type) continue;
    const handler = getEffectHandler(effect.type);
    if (!handler) continue;
    const res = handler(ctx, effect);
    if (res !== false) didAnything = true;
  }

  return didAnything;
}
