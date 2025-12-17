import { maps } from "../maps/index.js";
import { loadMapLikeMain } from "../maps/world/load.js";
import { isTileBlocked } from "../collision/collisionGrid.js";
import { createCalibratedWorldToTile } from "../maps/world/util.js";
import { setRespawnsForMap } from "../monsters/respawnState.js";

function computePlayerTile(scene) {
  if (!scene?.map || !scene?.groundLayer || !scene?.player) return null;
  const worldToTile = createCalibratedWorldToTile(scene.map, scene.groundLayer);
  const t = worldToTile(scene.player.x, scene.player.y);
  if (!t) return null;
  if (typeof t.x !== "number" || typeof t.y !== "number") return null;
  return { x: t.x, y: t.y };
}

function pickFallbackReturnTile(scene) {
  const fallback = {
    x: scene?.player?.currentTileX ?? 0,
    y: scene?.player?.currentTileY ?? 0,
  };

  const mapDef = scene?.currentMapDef || null;
  const preferred =
    mapDef &&
    mapDef.dungeonReturnTile &&
    typeof mapDef.dungeonReturnTile.x === "number" &&
    typeof mapDef.dungeonReturnTile.y === "number"
      ? mapDef.dungeonReturnTile
      : mapDef &&
        mapDef.entranceNpcTile &&
        typeof mapDef.entranceNpcTile.x === "number" &&
        typeof mapDef.entranceNpcTile.y === "number"
        ? mapDef.entranceNpcTile
        : null;

  if (!preferred || !scene?.map) return fallback;

  const candidates = [
    { x: preferred.x, y: preferred.y + 1 },
    { x: preferred.x + 1, y: preferred.y },
    { x: preferred.x - 1, y: preferred.y },
    { x: preferred.x, y: preferred.y - 1 },
    { x: preferred.x + 1, y: preferred.y + 1 },
    { x: preferred.x - 1, y: preferred.y + 1 },
    { x: preferred.x + 1, y: preferred.y - 1 },
    { x: preferred.x - 1, y: preferred.y - 1 },
    { x: preferred.x, y: preferred.y },
  ];

  for (const c of candidates) {
    if (c.x < 0 || c.y < 0 || c.x >= scene.map.width || c.y >= scene.map.height) {
      continue;
    }
    if (isTileBlocked(scene, c.x, c.y)) continue;
    return c;
  }

  return fallback;
}

function resetDungeonRespawns(scene, dungeonDef) {
  if (!scene || !dungeonDef || !Array.isArray(dungeonDef.rooms)) return;
  dungeonDef.rooms.forEach((roomKey) => {
    setRespawnsForMap(scene, roomKey, []);
  });
}

const DUNGEONS = {
  aluineeks: {
    id: "aluineeks",
    label: "Donjon Aluineeks",
    rooms: [
      "Map1DonjonAluineeks",
      "Map2DonjonAluineeks",
      "Map3DonjonAluineeks",
      "Map4DonjonAluineeks",
    ],
  },
};

function getDungeonDef(dungeonId) {
  return DUNGEONS[dungeonId] || null;
}

function getAliveWorldMonsters(scene) {
  const list = scene && Array.isArray(scene.monsters) ? scene.monsters : [];
  return list.filter((m) => {
    if (!m || !m.active || !m.stats) return false;
    const hp = typeof m.stats.hp === "number" ? m.stats.hp : m.stats.hpMax ?? 0;
    return hp > 0;
  });
}

export function isInDungeon(scene) {
  return !!(scene && scene.dungeonState && scene.dungeonState.active);
}

export function isDungeonRoomCleared(scene) {
  return getAliveWorldMonsters(scene).length === 0;
}

export function enterDungeon(scene, dungeonId) {
  if (!scene || !scene.player) return false;
  if (scene.combatState && scene.combatState.enCours) return false;

  const def = getDungeonDef(dungeonId);
  if (!def) return false;

  // New run: clear pending respawns from previous runs for these rooms.
  resetDungeonRespawns(scene, def);
  scene._dungeonRunCounter = (scene._dungeonRunCounter ?? 0) + 1;
  const runId = scene._dungeonRunCounter;

  scene.dungeonState = {
    active: true,
    dungeonId: def.id,
    roomIndex: 0,
    returnMapKey: scene.currentMapKey || (scene.currentMapDef && scene.currentMapDef.key) || null,
    // On mémorise la position exacte du joueur (tuiles) au moment de l'entrée,
    // pour revenir au même endroit (et donc recentrer correctement la caméra).
    returnTile: computePlayerTile(scene) || pickFallbackReturnTile(scene),
    runId,
  };

  const roomKey = def.rooms[0];
  const mapDef = maps[roomKey];
  if (!mapDef) return false;

  loadMapLikeMain(scene, mapDef);
  scene.dungeonState.roomIndex = 0;
  return true;
}

export function exitDungeon(scene) {
  if (!scene || !scene.dungeonState) return false;
  const state = scene.dungeonState;
  const returnKey = state.returnMapKey;
  const returnTile = state.returnTile;
  scene.dungeonState = null;

  const mapDef = returnKey ? maps[returnKey] : null;
  if (!mapDef) return false;

  const startTile =
    returnTile &&
    typeof returnTile.x === "number" &&
    typeof returnTile.y === "number"
      ? returnTile
      : mapDef.dungeonReturnTile &&
        typeof mapDef.dungeonReturnTile.x === "number" &&
        typeof mapDef.dungeonReturnTile.y === "number"
        ? mapDef.dungeonReturnTile
        : null;

  loadMapLikeMain(scene, mapDef, startTile ? { startTile } : {});
  return true;
}

export function maybeHandleDungeonExit(scene) {
  if (!isInDungeon(scene)) return false;
  if (!scene.player) return false;
  if (scene.combatState && scene.combatState.enCours) return false;

  const exitTiles = Array.isArray(scene.dungeonExitTiles)
    ? scene.dungeonExitTiles
    : [];
  if (exitTiles.length === 0) return false;

  const px = scene.player.currentTileX;
  const py = scene.player.currentTileY;
  if (typeof px !== "number" || typeof py !== "number") return false;

  const onExit = exitTiles.some((t) => t.x === px && t.y === py);
  if (!onExit) return false;

  if (!isDungeonRoomCleared(scene)) {
    // Exit is locked while monsters remain.
    return true;
  }

  const state = scene.dungeonState;
  const def = getDungeonDef(state.dungeonId);
  if (!def) return false;

  const isLast = state.roomIndex >= def.rooms.length - 1;
  if (isLast) {
    return exitDungeon(scene);
  }

  const nextIndex = state.roomIndex + 1;
  const nextKey = def.rooms[nextIndex];
  const nextMap = maps[nextKey];
  if (!nextMap) return false;

  state.roomIndex = nextIndex;
  loadMapLikeMain(scene, nextMap);
  return true;
}

export function onAfterCombatEnded(scene, result) {
  if (!isInDungeon(scene)) return;
  if (scene._dungeonAutoAdvanceInFlight) return;
  const state = scene.dungeonState;
  const def = state ? getDungeonDef(state.dungeonId) : null;
  if (!def) return;

  if (result && result.issue && result.issue !== "victoire") return;
  if (!isDungeonRoomCleared(scene)) return;

  const isLast = state.roomIndex >= def.rooms.length - 1;

  const doTransition = () => {
    if (!scene.dungeonState) return;

    if (isLast) {
      // Eject the player after the boss room is cleared.
      exitDungeon(scene);
      return;
    }

    const nextIndex = state.roomIndex + 1;
    const nextKey = def.rooms[nextIndex];
    const nextMap = maps[nextKey];
    if (!nextMap) return;

    state.roomIndex = nextIndex;
    loadMapLikeMain(scene, nextMap);
  };

  scene._dungeonAutoAdvanceInFlight = true;
  try {
    doTransition();
  } finally {
    // Reset after a short delay to avoid double triggers during UI callbacks.
    if (scene.time?.delayedCall) {
      scene.time.delayedCall(500, () => {
        scene._dungeonAutoAdvanceInFlight = false;
      });
    } else {
      scene._dungeonAutoAdvanceInFlight = false;
    }
  }
}
