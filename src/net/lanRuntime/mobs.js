import {
  getNetClient,
  getNetIsHost,
  getNetPlayerId,
} from "../../app/session.js";
import {
  buildInitialMonsterEntries,
  planMonsterRoamPath,
  spawnMonstersFromEntries,
} from "../../features/monsters/runtime/index.js";
import {
  playMonsterMoveAnimation,
  stopMonsterMoveAnimation,
} from "../../features/monsters/runtime/animations.js";
import { PLAYER_SPEED } from "../../config/constants.js";

export function createMobHandlers(ctx) {
  const {
    scene,
    player,
    map,
    groundLayer,
    getCurrentMapKey,
    getCurrentMapDef,
    getCurrentMapObj,
    getCurrentGroundLayer,
  } = ctx;

  const MOB_STEP_DURATION_MS = 550;
  const MOB_PENDING_TIMEOUT_MS = 3000;
  const MOB_INFLIGHT_TIMEOUT_MS = 5500;
  const USE_SERVER_MOB_AI = false;

  const clearWorldMonsters = () => {
    if (!Array.isArray(scene.monsters)) {
      scene.monsters = [];
      return;
    }
    scene.monsters.forEach((monster) => {
      if (!monster) return;
      if (monster.roamTimer?.remove) monster.roamTimer.remove(false);
      if (monster.roamTween?.stop) monster.roamTween.stop();
      if (monster.destroy) monster.destroy();
    });
    scene.monsters = [];
  };

  const findWorldMonsterByEntityId = (entityId) => {
    if (!Number.isInteger(entityId)) return null;
    const list = Array.isArray(scene.monsters) ? scene.monsters : [];
    return list.find((m) => m && m.entityId === entityId) || null;
  };

  const removeWorldMonsterByEntityId = (entityId) => {
    if (!Number.isInteger(entityId)) return;
    if (!Array.isArray(scene.monsters)) return;
    const idx = scene.monsters.findIndex((m) => m && m.entityId === entityId);
    if (idx < 0) return;
    const monster = scene.monsters[idx];
    if (monster.__lanMoveTween) {
      monster.__lanMoveTween.stop();
      monster.__lanMoveTween = null;
    }
    if (monster.destroy) monster.destroy();
    scene.monsters.splice(idx, 1);
  };

  const placeMonsterOnTile = (monster, tileX, tileY) => {
    if (!monster || !Number.isInteger(tileX) || !Number.isInteger(tileY)) return;
    const currentMap = getCurrentMapObj();
    const currentLayer = getCurrentGroundLayer();
    if (!currentMap || !currentLayer) return;
    const wp = currentMap.tileToWorldXY(
      tileX,
      tileY,
      undefined,
      undefined,
      currentLayer
    );
    if (!wp) return;
    const offX = typeof monster.renderOffsetX === "number" ? monster.renderOffsetX : 0;
    const offY = typeof monster.renderOffsetY === "number" ? monster.renderOffsetY : 0;
    monster.x = wp.x + currentMap.tileWidth / 2 + offX;
    monster.y = wp.y + currentMap.tileHeight + offY;
    monster.tileX = tileX;
    monster.tileY = tileY;
    monster.currentTileX = tileX;
    monster.currentTileY = tileY;
    monster.isMoving = false;
    if (monster.__lanMoveTween) {
      monster.__lanMoveTween.stop();
      monster.__lanMoveTween = null;
    }
    stopMonsterMoveAnimation(monster);
  };

  const moveMonsterAlongPathNetwork = (monster, steps, onComplete) => {
    if (!monster || !Array.isArray(steps) || steps.length === 0) {
      if (onComplete) onComplete();
      return;
    }
    if (!monster.scene || !monster.scene.tweens) {
      if (onComplete) onComplete();
      return;
    }

    const currentMap = getCurrentMapObj();
    const currentLayer = getCurrentGroundLayer();
    if (!currentMap || !currentLayer) {
      if (onComplete) onComplete();
      return;
    }

    const next = steps[0];
    if (!next || !Number.isInteger(next.x) || !Number.isInteger(next.y)) {
      if (onComplete) onComplete();
      return;
    }

    const wp = currentMap.tileToWorldXY(
      next.x,
      next.y,
      undefined,
      undefined,
      currentLayer
    );
    if (!wp) {
      if (onComplete) onComplete();
      return;
    }

    const offX = typeof monster.renderOffsetX === "number" ? monster.renderOffsetX : 0;
    const offY = typeof monster.renderOffsetY === "number" ? monster.renderOffsetY : 0;
    const targetX = wp.x + currentMap.tileWidth / 2 + offX;
    const targetY = wp.y + currentMap.tileHeight + offY;

    if (monster.__lanMoveTween) {
      monster.__lanMoveTween.stop();
      monster.__lanMoveTween = null;
    }

    monster.isMoving = true;
    playMonsterMoveAnimation(scene, monster, targetX - monster.x, targetY - monster.y);

    monster.__lanMoveTween = scene.tweens.add({
      targets: monster,
      x: targetX,
      y: targetY,
      duration: MOB_STEP_DURATION_MS,
      ease: "Linear",
      onComplete: () => {
        monster.tileX = next.x;
        monster.tileY = next.y;
        monster.currentTileX = next.x;
        monster.currentTileY = next.y;
        if (steps.length > 1) {
          moveMonsterAlongPathNetwork(monster, steps.slice(1), onComplete);
          return;
        }
        monster.__lanMoveTween = null;
        monster.isMoving = false;
        stopMonsterMoveAnimation(monster);
        if (onComplete) onComplete();
      },
      onStop: () => {
        monster.__lanMoveTween = null;
        monster.isMoving = false;
        stopMonsterMoveAnimation(monster);
        if (onComplete) onComplete();
      },
    });
  };

  const shouldIgnoreMobMove = (monster, msg) => {
    if (!monster || !msg) return true;
    if (!Number.isInteger(msg.seq)) return false;
    const lastSeq = monster.__lanLastMoveSeq || 0;
    if (msg.seq <= lastSeq) return true;
    monster.__lanLastMoveSeq = msg.seq;
    return false;
  };

  const sendMapMonstersSnapshot = () => {
    const client = getNetClient();
    if (!client) return;
    const playerId = getNetPlayerId();
    if (!playerId) return;
    if (!getNetIsHost()) return;
    const currentMap = getCurrentMapKey();
    if (!currentMap) return;
    const mapDef = getCurrentMapDef();
    const currentMapObj = scene.map;
    const currentGround = scene.groundLayer;
    if (!mapDef || !currentMapObj || !currentGround) return;

    const centerTileX = Math.floor(currentMapObj.width / 2);
    const centerTileY = Math.floor(currentMapObj.height / 2);
    const entries = buildInitialMonsterEntries(
      currentMapObj,
      currentGround,
      centerTileX,
      centerTileY,
      mapDef
    ).map((entry) => ({
      ...entry,
      spawnMapKey: currentMap,
    }));

    client.sendCmd("CmdMapMonsters", {
      playerId,
      mapId: currentMap,
      mapWidth: currentMapObj.width,
      mapHeight: currentMapObj.height,
      monsters: entries,
    });
  };

  const requestMapMonsters = () => {
    const client = getNetClient();
    if (!client) return;
    const playerId = getNetPlayerId();
    if (!playerId) return;
    if (getNetIsHost()) return;
    const currentMap = getCurrentMapKey();
    if (!currentMap) return;
    client.sendCmd("CmdRequestMapMonsters", {
      playerId,
      mapId: currentMap,
    });
  };

  const refreshMapMonstersFromServer = () => {
    if (getNetIsHost()) {
      sendMapMonstersSnapshot();
      return;
    }
    requestMapMonsters();
  };

  const sendMobMoveStart = (monster, steps) => {
    const client = getNetClient();
    if (!client) return;
    if (!getNetIsHost()) return;
    const playerId = getNetPlayerId();
    if (!playerId) return;
    const currentMap = getCurrentMapKey();
    if (!currentMap) return;
    if (!monster || !Number.isInteger(monster.entityId)) return;
    if (!Array.isArray(steps) || steps.length === 0) return;

    const seq = (monster.__lanMoveSeq || 0) + 1;
    monster.__lanMoveSeq = seq;
    monster.__lanMovePending = true;
    monster.__lanMovePendingAt = Date.now();

    client.sendCmd("CmdMobMoveStart", {
      playerId,
      mapId: currentMap,
      entityId: monster.entityId,
      seq,
      path: steps.map((step) => ({ x: step.x, y: step.y })),
    });
  };

  const tickHostMobRoam = () => {
    if (!getNetIsHost()) return;
    const currentMap = getCurrentMapKey();
    if (!currentMap) return;
    if (!scene?.monsters || !Array.isArray(scene.monsters)) return;

    scene.monsters.forEach((monster) => {
      if (!monster || !monster.active) return;
      if (monster.isCombatMember) return;
      if (monster.__lanMoveInFlight) {
        if (Date.now() - (monster.__lanMoveInFlightAt || 0) > MOB_INFLIGHT_TIMEOUT_MS) {
          monster.__lanMoveInFlight = false;
          monster.__lanMoveInFlightAt = null;
        } else {
          return;
        }
      }
      if (monster.__lanMovePending) {
        if (Date.now() - (monster.__lanMovePendingAt || 0) > MOB_PENDING_TIMEOUT_MS) {
          monster.__lanMovePending = false;
        } else {
          return;
        }
      }

      const path = planMonsterRoamPath(scene, map, monster);
      if (!path || path.length === 0) return;
      sendMobMoveStart(monster, path);
    });
  };

  const startHostMobScheduler = () => {
    if (!USE_SERVER_MOB_AI) return;
    if (scene.__lanHostMobTick) return;
    scene.__lanHostMobTick = scene.time.addEvent({
      delay: 700,
      loop: true,
      callback: () => tickHostMobRoam(),
    });
  };

  const stopHostMobScheduler = () => {
    if (scene.__lanHostMobTick?.remove) {
      scene.__lanHostMobTick.remove(false);
    }
    scene.__lanHostMobTick = null;
  };

  const updateHostMobScheduler = () => {
    if (!USE_SERVER_MOB_AI) {
      stopHostMobScheduler();
      return;
    }
    if (getNetIsHost()) {
      startHostMobScheduler();
    } else {
      stopHostMobScheduler();
    }
  };

  const handleMobMoveStart = (msg) => {
    const currentMap = getCurrentMapKey();
    if (!currentMap || msg.mapId !== currentMap) return;
    const entityId = Number.isInteger(msg.entityId) ? msg.entityId : null;
    if (!entityId) return;
    const monster = findWorldMonsterByEntityId(entityId);
    if (!monster) return;
    if (shouldIgnoreMobMove(monster, msg)) return;
    monster.__lanMovePending = false;
    monster.__lanMoveInFlight = true;
    monster.__lanMoveInFlightAt = Date.now();

    const raw = Array.isArray(msg.path) ? msg.path : [];
    const steps = raw
      .map((step) => ({
        x: Number.isInteger(step?.x) ? step.x : null,
        y: Number.isInteger(step?.y) ? step.y : null,
      }))
      .filter((step) => step.x !== null && step.y !== null);

    if (steps.length === 0) {
      const toX = Number.isInteger(msg.toX) ? msg.toX : monster.tileX;
      const toY = Number.isInteger(msg.toY) ? msg.toY : monster.tileY;
      placeMonsterOnTile(monster, toX, toY);
      monster.__lanMoveInFlight = false;
      monster.__lanMoveInFlightAt = null;
      return;
    }

    const first = steps[0];
    if (
      first &&
      Number.isInteger(monster.tileX) &&
      Number.isInteger(monster.tileY) &&
      first.x === monster.tileX &&
      first.y === monster.tileY
    ) {
      steps.shift();
    }

    if (steps.length === 0) {
      const last = raw[raw.length - 1] || null;
      if (last) {
        placeMonsterOnTile(monster, last.x, last.y);
      }
      monster.__lanMoveInFlight = false;
      monster.__lanMoveInFlightAt = null;
      return;
    }

    moveMonsterAlongPathNetwork(monster, steps, () => {
      monster.__lanMoveInFlight = false;
      monster.__lanMovePending = false;
      monster.__lanMoveInFlightAt = null;
    });
  };

  const handleMobMoveEnd = (msg) => {
    const currentMap = getCurrentMapKey();
    if (!currentMap || msg.mapId !== currentMap) return;
    const entityId = Number.isInteger(msg.entityId) ? msg.entityId : null;
    if (!entityId) return;
    const monster = findWorldMonsterByEntityId(entityId);
    if (!monster) return;
    const seq = Number.isInteger(msg.seq) ? msg.seq : null;
    if (seq !== null) {
      const lastSeq = monster.__lanLastMoveSeq || 0;
      if (seq < lastSeq) return;
      monster.__lanLastMoveSeq = seq;
    }
    const toX = Number.isInteger(msg.toX) ? msg.toX : monster.tileX;
    const toY = Number.isInteger(msg.toY) ? msg.toY : monster.tileY;
    monster.__lanMovePending = false;
    monster.__lanMoveInFlight = false;
    monster.__lanMoveInFlightAt = null;
    placeMonsterOnTile(monster, toX, toY);
  };

  return {
    clearWorldMonsters,
    findWorldMonsterByEntityId,
    removeWorldMonsterByEntityId,
    sendMapMonstersSnapshot,
    requestMapMonsters,
    refreshMapMonstersFromServer,
    updateHostMobScheduler,
    handleMobMoveStart,
    handleMobMoveEnd,
  };
}
