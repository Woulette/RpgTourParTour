import { findMonsterAtTile } from "../../../monsters/runtime/index.js";
import { computeDamageForSpell } from "../cast/castEryon.js";
import { applyDamageEffect } from "./damage.js";
import { getCasterOriginTile, isTileAvailableForSpell } from "../utils/util.js";

function resolveDamageSpell(spell, effect) {
  if (!spell || !effect) return spell;
  const hasMin = typeof effect.min === "number";
  const hasMax = typeof effect.max === "number";
  const hasElement = typeof effect.element === "string";
  if (!hasMin && !hasMax && !hasElement) return spell;
  return {
    ...spell,
    damageMin: hasMin ? effect.min : spell.damageMin,
    damageMax: hasMax ? effect.max : spell.damageMax,
    element: hasElement ? effect.element : spell.element,
  };
}

function getPatternTiles(pattern, ctx) {
  const { tileX, tileY, caster } = ctx;
  if (pattern === "cross1") {
    return [
      { x: tileX, y: tileY },
      { x: tileX + 1, y: tileY },
      { x: tileX - 1, y: tileY },
      { x: tileX, y: tileY + 1 },
      { x: tileX, y: tileY - 1 },
    ];
  }

  if (pattern === "front_cross") {
    const { x: originX, y: originY } = getCasterOriginTile(caster);
    const dx = tileX === originX ? 0 : Math.sign(tileX - originX);
    const dy = tileY === originY ? 0 : Math.sign(tileY - originY);
    const perpX = dx !== 0 ? 0 : 1;
    const perpY = dx !== 0 ? 1 : 0;

    return [
      { x: tileX, y: tileY },
      { x: tileX + dx, y: tileY + dy },
      { x: tileX + perpX, y: tileY + perpY },
      { x: tileX - perpX, y: tileY - perpY },
    ];
  }

  return [];
}

function showPatternTileFx(scene, map, groundLayer, tile) {
  if (!scene || !map) return;
  const zoneWorld = map.tileToWorldXY(tile.x, tile.y, undefined, undefined, groundLayer);
  const zx = zoneWorld.x + map.tileWidth / 2;
  const zy = zoneWorld.y + map.tileHeight / 2;
  const size = Math.min(map.tileWidth, map.tileHeight);
  const fxZone = scene.add.rectangle(zx, zy, size, size, 0xff5533, 0.22);
  if (scene.hudCamera) {
    scene.hudCamera.ignore(fxZone);
  }
  scene.time.delayedCall(220, () => fxZone.destroy());
}

export function applyPatternDamageEffect(ctx, effect) {
  const { scene, map, groundLayer, caster } = ctx;
  if (!scene || !map || !caster || !effect?.pattern) return false;

  const damageSpell = resolveDamageSpell(ctx.spell, effect);
  const damageResult = computeDamageForSpell(caster, damageSpell);
  const damage = damageResult?.damage ?? 0;
  const forceCrit = damageResult?.isCrit === true;

  const tiles = getPatternTiles(effect.pattern, ctx);
  if (!tiles.length) return false;

  let didAnything = false;

  for (const t of tiles) {
    if (!isTileAvailableForSpell(map, t.x, t.y)) continue;
    showPatternTileFx(scene, map, groundLayer, t);

    const victim = findMonsterAtTile(scene, t.x, t.y);
    if (!victim || !victim.stats) continue;

    const nextCtx = {
      ...ctx,
      target: victim,
      tileX: t.x,
      tileY: t.y,
      forceCrit,
    };
    const res = applyDamageEffect(nextCtx, { ...effect, fixedDamage: damage });
    if (nextCtx.lastDamage) {
      ctx.lastDamage = nextCtx.lastDamage;
    }
    if (res !== false) didAnything = true;
  }

  return didAnything;
}
