import { createMonster } from "../../../entities/monster.js";
import { isTileBlocked } from "../../../collision/collisionGrid.js";
import { getAliveCombatMonsters } from "../../../features/monsters/ai/aiUtils.js";

function isTileOccupied(scene, tileX, tileY) {
  const state = scene?.combatState;
  const player = state?.joueur;
  if (player && player.currentTileX === tileX && player.currentTileY === tileY) {
    return true;
  }
  const alive = getAliveCombatMonsters(scene) || [];
  return alive.some((m) => m && m.tileX === tileX && m.tileY === tileY);
}

function findNearestFreeTile(scene, map, tile) {
  if (!map || !tile) return null;
  const { x, y } = tile;
  const candidates = [
    { x, y },
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
    { x: x + 1, y: y + 1 },
    { x: x - 1, y: y + 1 },
    { x: x + 1, y: y - 1 },
    { x: x - 1, y: y - 1 },
  ];
  for (const c of candidates) {
    if (c.x < 0 || c.y < 0 || c.x >= map.width || c.y >= map.height) continue;
    if (isTileBlocked(scene, c.x, c.y)) continue;
    if (isTileOccupied(scene, c.x, c.y)) continue;
    return c;
  }
  return null;
}

export function initRiftCombatWave(scene, config) {
  if (!scene || !scene.combatState || !config) return;
  const waveMonsters = Array.isArray(config.waveMonsters)
    ? config.waveMonsters.filter(Boolean)
    : [];
  const spawnTiles = Array.isArray(config.spawnTiles) ? config.spawnTiles : [];
  if (waveMonsters.length === 0 || spawnTiles.length === 0) return;

  scene.combatState.riftWave = {
    turn: typeof config.turn === "number" ? Math.max(1, config.turn) : 3,
    spawned: false,
    waveMonsters,
    spawnTiles,
  };
}

function spawnRiftWave(scene, wave) {
  if (!scene || !wave || wave.spawned) return false;
  const state = scene?.combatState;
  if (!state || !state.enCours) return false;

  const map = scene.combatMap;
  const groundLayer = scene.combatGroundLayer;
  if (!map || !groundLayer) return false;

  const spawned = [];
  if (!wave.spawnTiles || wave.spawnTiles.length === 0) return false;
  const count = wave.waveMonsters.length;
  for (let i = 0; i < count; i += 1) {
    const monsterId = wave.waveMonsters[i];
    const preferTile = wave.spawnTiles[i] || wave.spawnTiles[i % wave.spawnTiles.length];
    const tile = findNearestFreeTile(scene, map, preferTile);
    if (!tile) continue;

    const wp = map.tileToWorldXY(tile.x, tile.y, undefined, undefined, groundLayer);
    const m = createMonster(scene, wp.x + map.tileWidth / 2, wp.y + map.tileHeight, monsterId);
    m.tileX = tile.x;
    m.tileY = tile.y;
    m.currentTileX = tile.x;
    m.currentTileY = tile.y;
    m.isCombatMember = true;
    m.isCombatOnly = true;
    m.respawnEnabled = false;

    scene.monsters = scene.monsters || [];
    scene.monsters.push(m);
    scene.combatMonsters = scene.combatMonsters || [];
    scene.combatMonsters.push(m);

    if (state.actors && Array.isArray(state.actors)) {
      const insertAt = Math.max(0, (state.actorIndex ?? 0) + 1);
      state.actors.splice(insertAt, 0, { kind: "monstre", entity: m });
    }

    spawned.push(m);
  }

  wave.spawned = true;
  return spawned.length > 0;
}

export function maybeSpawnRiftWave(scene) {
  const state = scene?.combatState;
  if (!state || !state.enCours) return;
  const wave = state.riftWave;
  if (!wave || wave.spawned) return;
  const round = typeof state.round === "number" ? state.round : 1;
  if (round < wave.turn) return;
  spawnRiftWave(scene, wave);
}

export function maybeSpawnRiftWaveOnClear(scene) {
  const state = scene?.combatState;
  if (!state || !state.enCours) return false;
  const wave = state.riftWave;
  if (!wave || wave.spawned) return false;
  const alive = getAliveCombatMonsters(scene) || [];
  if (alive.length > 0) return false;
  return spawnRiftWave(scene, wave);
}
