import { monsters } from "../../../content/monsters/index.js";
import { createCharacter } from "../../../entities/character.js";
import { createStats } from "../../../core/stats.js";
import { isTileBlocked } from "../../../collision/collisionGrid.js";
import { getAliveCombatMonsters } from "../../../monsters/aiUtils.js";

function getPlayerLevel(player) {
  return player?.levelState?.niveau ?? player?.level ?? 1;
}

function getCapturedMonsterLevel(owner, def) {
  return owner?.capturedMonsterLevel ?? def?.baseLevel ?? 1;
}

function clampNonNegative(n) {
  return typeof n === "number" && Number.isFinite(n) ? Math.max(0, n) : 0;
}

function scaleStat(value, mult) {
  if (typeof value !== "number" || !Number.isFinite(value)) return value;
  return Math.max(0, Math.round(value * mult));
}

function applySummonScaling(stats, owner, capturedLevel) {
  if (!stats || !owner) return stats;

  const playerLevel = getPlayerLevel(owner);
  const levelGap = Math.max(0, (playerLevel ?? 1) - (capturedLevel ?? 1));

  // Option A : 5% de base + 1% par niveau d'écart (pas de cap pour l'instant).
  const bonus = 0.05 + 0.01 * levelGap;
  const mult = 1 + bonus;

  // Scale des stats de base du monstre (PV + initiative + 4 stats élémentaires).
  stats.hpMax = scaleStat(stats.hpMax ?? stats.hp ?? 1, mult);
  stats.initiative = scaleStat(stats.initiative ?? 0, mult);
  stats.force = scaleStat(stats.force ?? 0, mult);
  stats.agilite = scaleStat(stats.agilite ?? 0, mult);
  stats.intelligence = scaleStat(stats.intelligence ?? 0, mult);
  stats.chance = scaleStat(stats.chance ?? 0, mult);

  // Transfert : +50% des PV max du joueur.
  const p = owner.stats || {};
  const pHpMax = p.hpMax ?? p.hp ?? 0;
  stats.hpMax = clampNonNegative(stats.hpMax) + Math.floor(clampNonNegative(pHpMax) * 0.5);
  stats.hp = stats.hpMax;

  // Transfert : +50% des 4 stats du joueur (force/agi/int/chance) uniquement.
  stats.force =
    clampNonNegative(stats.force) + Math.floor(clampNonNegative(p.force) * 0.5);
  stats.agilite =
    clampNonNegative(stats.agilite) +
    Math.floor(clampNonNegative(p.agilite) * 0.5);
  stats.intelligence =
    clampNonNegative(stats.intelligence) +
    Math.floor(clampNonNegative(p.intelligence) * 0.5);
  stats.chance =
    clampNonNegative(stats.chance) + Math.floor(clampNonNegative(p.chance) * 0.5);

  return stats;
}

function getCasterOriginTile(caster) {
  const x =
    typeof caster?.currentTileX === "number"
      ? caster.currentTileX
      : typeof caster?.tileX === "number"
        ? caster.tileX
        : 0;
  const y =
    typeof caster?.currentTileY === "number"
      ? caster.currentTileY
      : typeof caster?.tileY === "number"
        ? caster.tileY
        : 0;
  return { x, y };
}

function isTileOccupiedByPlayerOrSummon(scene, tileX, tileY) {
  const state = scene?.combatState;
  const p = state?.joueur ? getCasterOriginTile(state.joueur) : null;
  if (p && p.x === tileX && p.y === tileY) return true;

  const summons =
    scene?.combatSummons && Array.isArray(scene.combatSummons)
      ? scene.combatSummons
      : [];
  return summons.some((s) => s && s.tileX === tileX && s.tileY === tileY && (s.stats?.hp ?? 0) > 0);
}

function isTileOccupiedByEnemyMonster(scene, tileX, tileY) {
  const alive = getAliveCombatMonsters(scene);
  return alive.some((m) => m && m.tileX === tileX && m.tileY === tileY);
}

function findNearestFreeSpawnTile(scene, map, fromX, fromY) {
  const candidates = [
    { x: fromX, y: fromY },
    { x: fromX + 1, y: fromY },
    { x: fromX - 1, y: fromY },
    { x: fromX, y: fromY + 1 },
    { x: fromX, y: fromY - 1 },
    { x: fromX + 1, y: fromY + 1 },
    { x: fromX - 1, y: fromY + 1 },
    { x: fromX + 1, y: fromY - 1 },
    { x: fromX - 1, y: fromY - 1 },
  ];

  for (const c of candidates) {
    if (!c) continue;
    if (c.x < 0 || c.y < 0 || c.x >= map.width || c.y >= map.height) continue;
    if (isTileBlocked(scene, c.x, c.y)) continue;
    if (isTileOccupiedByEnemyMonster(scene, c.x, c.y)) continue;
    if (isTileOccupiedByPlayerOrSummon(scene, c.x, c.y)) continue;
    return c;
  }
  return null;
}

export function getAliveSummon(scene, owner) {
  const list =
    scene?.combatSummons && Array.isArray(scene.combatSummons)
      ? scene.combatSummons
      : [];
  const alive = list.find((s) => {
    if (!s || s.owner !== owner || !s.stats) return false;
    const hp = typeof s.stats.hp === "number" ? s.stats.hp : s.stats.hpMax ?? 0;
    return hp > 0;
  });
  return alive || null;
}

export function findAliveSummonAtTile(scene, tileX, tileY) {
  const list =
    scene?.combatSummons && Array.isArray(scene.combatSummons)
      ? scene.combatSummons
      : [];
  return (
    list.find((s) => {
      if (!s || !s.stats) return false;
      const hp = typeof s.stats.hp === "number" ? s.stats.hp : s.stats.hpMax ?? 0;
      return hp > 0 && s.tileX === tileX && s.tileY === tileY;
    }) || null
  );
}

export function spawnSummonFromCaptured(
  scene,
  owner,
  map,
  groundLayer,
  { preferTile = null } = {}
) {
  const state = scene?.combatState;
  if (!state || !state.enCours || !owner || !map || !groundLayer) return null;

  const capturedId = owner.capturedMonsterId;
  if (!capturedId) return null;

  const def = monsters[capturedId];
  if (!def) return null;

  const { x: ox, y: oy } = getCasterOriginTile(owner);
  const preferX = typeof preferTile?.x === "number" ? preferTile.x : null;
  const preferY = typeof preferTile?.y === "number" ? preferTile.y : null;

  // On essaye d'abord de spawn autour de la case ciblée (si fournie),
  // sinon autour du lanceur.
  const spawnTile =
    (typeof preferX === "number" && typeof preferY === "number"
      ? findNearestFreeSpawnTile(scene, map, preferX, preferY)
      : null) || findNearestFreeSpawnTile(scene, map, ox, oy);
  if (!spawnTile) return null;

  const wp = map.tileToWorldXY(spawnTile.x, spawnTile.y, undefined, undefined, groundLayer);
  const render = def.render || {};
  const offX = typeof render.offsetX === "number" ? render.offsetX : 0;
  const offY = typeof render.offsetY === "number" ? render.offsetY : 0;

  const sx = wp.x + map.tileWidth / 2 + offX;
  const sy = wp.y + map.tileHeight + offY;

  const stats = createStats(def.statsOverrides || {});
  // S'assure qu'on a hp/hpMax cohérents
  const hpMax = stats.hpMax ?? stats.hp ?? 1;
  stats.hpMax = hpMax;
  stats.hp = hpMax;

  const capturedLevel = getCapturedMonsterLevel(owner, def);
  applySummonScaling(stats, owner, capturedLevel);

  const summon = createCharacter(scene, sx, sy, {
    textureKey: def.textureKey,
    classId: capturedId,
    stats,
  });

  // Meta
  summon.monsterId = capturedId;
  summon.isSummon = true;
  summon.owner = owner;
  summon.spellIds = def.spells || [];
  summon.displayName = def.displayName || def.label || capturedId;
  summon.level = capturedLevel;

  // Render
  summon.renderOffsetX = offX;
  summon.renderOffsetY = offY;
  if (summon.setOrigin) {
    const rx = typeof render.originX === "number" ? render.originX : 0.5;
    const ry = typeof render.originY === "number" ? render.originY : 1;
    summon.setOrigin(rx, ry);
  }
  summon.setDepth(2);
  if (scene.hudCamera) scene.hudCamera.ignore(summon);

  summon.tileX = spawnTile.x;
  summon.tileY = spawnTile.y;
  summon.currentTileX = spawnTile.x;
  summon.currentTileY = spawnTile.y;

  // Survol direct sur le sprite (plus fiable que le calcul par tuile)
  // pour afficher la bulle + panneau cible.
  if (typeof summon.setInteractive === "function") {
    const w = (summon.displayWidth ?? summon.width ?? 48) * 1.35;
    const h = (summon.displayHeight ?? summon.height ?? 48) * 1.35;
    const ox = typeof summon.originX === "number" ? summon.originX : 0.5;
    const oy = typeof summon.originY === "number" ? summon.originY : 1;
    const rect = new Phaser.Geom.Rectangle(-w * ox, -h * oy, w, h);
    summon.setInteractive(rect, Phaser.Geom.Rectangle.Contains);

    summon.on("pointerover", (pointer) => {
      const cs = scene?.combatState;
      if (!cs || !cs.enCours) return;

      if (typeof scene.showDamagePreview === "function") {
        scene.showDamagePreview(summon);
      }
      if (typeof scene.showMonsterTooltip === "function") {
        scene.showMonsterTooltip(summon);
      }
      if (typeof scene.showCombatTargetPanel === "function") {
        scene.showCombatTargetPanel(summon);
      }
    });

    summon.on("pointerout", () => {
      if (typeof scene.clearDamagePreview === "function") {
        scene.clearDamagePreview();
      }
      if (typeof scene.hideMonsterTooltip === "function") {
        scene.hideMonsterTooltip();
      }
      if (typeof scene.hideCombatTargetPanel === "function") {
        scene.hideCombatTargetPanel();
      }
    });
  }

  scene.combatSummons = scene.combatSummons || [];
  scene.combatSummons.push(summon);

  return summon;
}

export function clearAllSummons(scene) {
  const list =
    scene?.combatSummons && Array.isArray(scene.combatSummons)
      ? scene.combatSummons
      : [];
  list.forEach((s) => {
    if (!s) return;
    if (typeof s.destroy === "function") {
      s.destroy();
    }
  });
  if (scene) scene.combatSummons = [];
}
