const DEFAULT_RESPAWN_DELAY_MS = 5000;

function ensureRespawnState(scene) {
  if (!scene) return null;
  if (!scene.respawnsByMapKey) {
    scene.respawnsByMapKey = {};
  }
  return scene.respawnsByMapKey;
}

export function queueMonsterRespawn(scene, monster, delayMs = DEFAULT_RESPAWN_DELAY_MS) {
  if (!scene || !monster) return false;
  if (monster.respawnEnabled === false) return false;

  const mapKey = monster.spawnMapKey || scene.currentMapKey || null;
  if (!mapKey) return false;

  const tileX = monster.tileX;
  const tileY = monster.tileY;
  if (typeof tileX !== "number" || typeof tileY !== "number") return false;

  const state = ensureRespawnState(scene);
  if (!state) return false;

  const now = Date.now();
  const entry = {
    mapKey,
    monsterId: monster.monsterId,
    tileX,
    tileY,
    atTime: now + Math.max(0, delayMs),
    // If we're in a dungeon, tie respawns to the current run to avoid carry-over.
    dungeonRunId: scene.dungeonState?.active ? scene.dungeonState.runId ?? null : null,
    // Preserve group metadata if present
    groupSize: monster.groupSize ?? 1,
    groupLevels: Array.isArray(monster.groupLevels) ? monster.groupLevels.slice() : null,
    groupLevelTotal: typeof monster.groupLevelTotal === "number" ? monster.groupLevelTotal : null,
    level: typeof monster.level === "number" ? monster.level : null,
  };

  if (!Array.isArray(state[mapKey])) {
    state[mapKey] = [];
  }

  state[mapKey].push(entry);
  return true;
}

export function getRespawnsForMap(scene, mapKey) {
  const state = ensureRespawnState(scene);
  if (!state || !mapKey) return [];
  const list = state[mapKey];
  return Array.isArray(list) ? list : [];
}

export function setRespawnsForMap(scene, mapKey, list) {
  const state = ensureRespawnState(scene);
  if (!state || !mapKey) return;
  state[mapKey] = Array.isArray(list) ? list : [];
}
