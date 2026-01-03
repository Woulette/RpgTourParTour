import {
  getNetClient,
  getNetIsHost,
  getNetPlayerId,
  setNetEventHandler,
  setNetIsHost,
} from "../app/session.js";
import { createPlayer } from "../entities/player.js";
import { findPathForPlayer } from "../entities/movement/pathfinding.js";
import { movePlayerAlongPathNetwork } from "../entities/playerMovement.js";
import {
  buildInitialMonsterEntries,
  planMonsterRoamPath,
  spawnMonstersFromEntries,
} from "../features/monsters/runtime/index.js";
import {
  applyTreeHarvested,
  applyTreeRespawn,
  spawnTreesFromEntries,
  TREE_REGROW_DURATION_MS,
  TREE_RESOURCE_KIND,
} from "../features/metier/bucheron/trees.js";
import {
  applyHerbHarvested,
  applyHerbRespawn,
  spawnHerbsFromEntries,
  HERB_REGROW_DURATION_MS,
  HERB_RESOURCE_KIND,
} from "../features/metier/alchimiste/plants.js";
import {
  applyWellHarvested,
  applyWellRespawn,
  spawnWellsFromEntries,
  WELL_COOLDOWN_MS,
  WELL_RESOURCE_KIND,
} from "../features/maps/world/wells.js";
import {
  playMonsterMoveAnimation,
  stopMonsterMoveAnimation,
} from "../features/monsters/runtime/animations.js";
import { recalcDepths } from "../features/maps/world/decor.js";
import { createCalibratedWorldToTile } from "../features/maps/world/util.js";
import { PLAYER_SPEED } from "../config/constants.js";
import { on as onStoreEvent } from "../state/store.js";

export function initLanRuntime(scene, player, map, groundLayer) {

  const remotePlayers = new Map();
  const remotePlayersData = new Map();
  scene.__lanRemotePlayers = remotePlayers;
  const resourceNodes = new Map();
  scene.__lanResourceNodes = resourceNodes;
  const worldToTile = createCalibratedWorldToTile(map, groundLayer);
  const getCurrentMapKey = () => scene?.currentMapKey || null;
  const getCurrentMapDef = () => scene?.currentMapDef || null;
  const getCurrentMapObj = () => scene?.map || null;
  const getCurrentGroundLayer = () => scene?.groundLayer || null;
  const MOB_STEP_DURATION_MS = 550;
  const MOB_PENDING_TIMEOUT_MS = 3000;
  const MOB_INFLIGHT_TIMEOUT_MS = 5500;
  const USE_SERVER_MOB_AI = true;
  const isSceneReady = () =>
    !!(scene && scene.sys && !scene.sys.isDestroyed && scene.add && scene.physics);

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

  const clearResourceNodes = () => {
    const keys = ["bucheronNodes", "alchimisteNodes", "wellNodes"];
    keys.forEach((key) => {
      const list = scene[key];
      if (!Array.isArray(list)) return;
      list.forEach((node) => {
        if (!node) return;
        if (node.hoverHighlight?.destroy) node.hoverHighlight.destroy();
        if (node.sprite?.destroy) node.sprite.destroy();
      });
      scene[key] = [];
    });
    resourceNodes.clear();
  };

  const registerResourceNodes = (nodes) => {
    if (!Array.isArray(nodes)) return;
    nodes.forEach((node) => {
      if (!node || !Number.isInteger(node.entityId)) return;
      resourceNodes.set(node.entityId, node);
    });
  };

  const findResourceNodeByEntityId = (entityId) => {
    if (!Number.isInteger(entityId)) return null;
    return resourceNodes.get(entityId) || null;
  };

  const buildResourceEntriesForMap = () => {
    const mapDef = getCurrentMapDef();
    if (!mapDef) return [];
    const entries = [];

    const trees = Array.isArray(mapDef.treePositions) ? mapDef.treePositions : [];
    trees.forEach((pos) => {
      if (typeof pos.tileX !== "number" || typeof pos.tileY !== "number") return;
      entries.push({
        kind: TREE_RESOURCE_KIND,
        tileX: pos.tileX,
        tileY: pos.tileY,
        offsetX: typeof pos.offsetX === "number" ? pos.offsetX : 0,
        offsetY: typeof pos.offsetY === "number" ? pos.offsetY : 0,
        resourceId: typeof pos.resourceId === "string" ? pos.resourceId : "chene",
        respawnMs: TREE_REGROW_DURATION_MS,
        harvested: false,
      });
    });

    const herbs = Array.isArray(mapDef.herbPositions) ? mapDef.herbPositions : [];
    herbs.forEach((pos) => {
      if (typeof pos.tileX !== "number" || typeof pos.tileY !== "number") return;
      entries.push({
        kind: HERB_RESOURCE_KIND,
        tileX: pos.tileX,
        tileY: pos.tileY,
        offsetX: typeof pos.offsetX === "number" ? pos.offsetX : 0,
        offsetY: typeof pos.offsetY === "number" ? pos.offsetY : 0,
        resourceId: typeof pos.resourceId === "string" ? pos.resourceId : "ortie",
        respawnMs: HERB_REGROW_DURATION_MS,
        harvested: false,
      });
    });

    const wells = Array.isArray(mapDef.wellPositions) ? mapDef.wellPositions : [];
    wells.forEach((pos) => {
      if (typeof pos.tileX !== "number" || typeof pos.tileY !== "number") return;
      entries.push({
        kind: WELL_RESOURCE_KIND,
        tileX: pos.tileX,
        tileY: pos.tileY,
        offsetX: typeof pos.offsetX === "number" ? pos.offsetX : 0,
        offsetY: typeof pos.offsetY === "number" ? pos.offsetY : 0,
        resourceId: "eau",
        respawnMs: WELL_COOLDOWN_MS,
        harvested: false,
      });
    });

    return entries;
  };

  const spawnResourcesFromEntries = (entries) => {
    const currentMap = getCurrentMapObj();
    if (!currentMap || !Array.isArray(entries)) return;
    clearResourceNodes();

    const treeEntries = entries.filter((e) => e && e.kind === TREE_RESOURCE_KIND);
    const herbEntries = entries.filter((e) => e && e.kind === HERB_RESOURCE_KIND);
    const wellEntries = entries.filter((e) => e && e.kind === WELL_RESOURCE_KIND);

    const treeNodes = spawnTreesFromEntries(scene, currentMap, player, treeEntries);
    const herbNodes = spawnHerbsFromEntries(scene, currentMap, player, herbEntries);
    const wellNodes = spawnWellsFromEntries(scene, currentMap, player, wellEntries);

    registerResourceNodes(treeNodes);
    registerResourceNodes(herbNodes);
    registerResourceNodes(wellNodes);
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

  const placeEntityOnTile = (entity, tileX, tileY) => {
    const worldPos = map.tileToWorldXY(
      tileX,
      tileY,
      undefined,
      undefined,
      groundLayer
    );
    if (!worldPos) return;
    entity.currentTileX = tileX;
    entity.currentTileY = tileY;
    entity.x = worldPos.x + map.tileWidth / 2;
    entity.y = worldPos.y + map.tileHeight / 2;
    entity.isMoving = false;
    entity.currentMoveTween = null;
    resetEntityIdle(entity);
    if (entity.setDepth) entity.setDepth(entity.y);
    recalcDepths(scene);
  };

  const getDirectionName = (dx, dy) => {
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (absDx < 1e-3 && absDy < 1e-3) return "south-east";
    if (absDx > absDy * 2) return dx > 0 ? "east" : "west";
    if (absDy > absDx * 2) return dy > 0 ? "south" : "north";
    if (dx > 0 && dy < 0) return "north-east";
    if (dx > 0 && dy > 0) return "south-east";
    if (dx < 0 && dy > 0) return "south-west";
    return "north-west";
  };

  const forceMoveToTile = (entity, tileX, tileY) => {
    const worldPos = map.tileToWorldXY(
      tileX,
      tileY,
      undefined,
      undefined,
      groundLayer
    );
    if (!worldPos) return;
    const targetX = worldPos.x + map.tileWidth / 2;
    const targetY = worldPos.y + map.tileHeight / 2;

    if (entity.currentMoveTween) {
      entity.currentMoveTween.stop();
      entity.currentMoveTween = null;
    }
    entity.isMoving = true;

    const dxWorld = targetX - entity.x;
    const dyWorld = targetY - entity.y;
    const dir = getDirectionName(dxWorld, dyWorld);
    const animPrefix = entity.animPrefix || "player";
    entity.lastDirection = dir;
    if (
      entity.anims &&
      scene.anims &&
      scene.anims.exists &&
      scene.anims.exists(`${animPrefix}_run_${dir}`)
    ) {
      entity.anims.play(`${animPrefix}_run_${dir}`, true);
    }

    const distance = Phaser.Math.Distance.Between(
      entity.x,
      entity.y,
      targetX,
      targetY
    );
    const duration = (distance / PLAYER_SPEED) * 1000;

    entity.currentMoveTween = scene.tweens.add({
      targets: entity,
      x: targetX,
      y: targetY,
      duration,
      ease: "Linear",
      onComplete: () => {
        entity.x = targetX;
        entity.y = targetY;
        entity.currentTileX = tileX;
        entity.currentTileY = tileY;
        entity.isMoving = false;
        entity.currentMoveTween = null;
        resetEntityIdle(entity);
        recalcDepths(scene);
      },
    });
  };

  const resetEntityIdle = (entity) => {
    if (!entity || !entity.anims || !entity.anims.currentAnim) return;
    entity.anims.stop();
    const animPrefix = entity.animPrefix || "player";
    const idleKey = `${animPrefix}_idle_${entity.lastDirection || "south-east"}`;
    if (scene.textures?.exists && scene.textures.exists(idleKey)) {
      entity.setTexture(idleKey);
    } else {
      entity.setTexture(entity.baseTextureKey || animPrefix);
    }
  };

  const stopEntityMovement = (entity) => {
    if (!entity) return;
    if (entity.currentMoveTween) {
      entity.currentMoveTween.stop();
      entity.currentMoveTween = null;
    }
    entity.isMoving = false;
    resetEntityIdle(entity);
  };

  const moveEntityAlongPathNoCollision = (entity, path) => {
    if (!entity || !Array.isArray(path)) return;
    if (path.length === 0) {
      stopEntityMovement(entity);
      return;
    }
    const step = path.shift();
    if (!step || !Number.isInteger(step.x) || !Number.isInteger(step.y)) {
      stopEntityMovement(entity);
      return;
    }
    const worldPos = map.tileToWorldXY(
      step.x,
      step.y,
      undefined,
      undefined,
      groundLayer
    );
    if (!worldPos) {
      stopEntityMovement(entity);
      return;
    }
    const targetX = worldPos.x + map.tileWidth / 2;
    const targetY = worldPos.y + map.tileHeight / 2;

    if (entity.currentMoveTween) {
      entity.currentMoveTween.stop();
      entity.currentMoveTween = null;
    }

    entity.isMoving = true;
    const dxWorld = targetX - entity.x;
    const dyWorld = targetY - entity.y;
    const dir = getDirectionName(dxWorld, dyWorld);
    const animPrefix = entity.animPrefix || "player";
    entity.lastDirection = dir;
    if (
      entity.anims &&
      scene.anims &&
      scene.anims.exists &&
      scene.anims.exists(`${animPrefix}_run_${dir}`)
    ) {
      entity.anims.play(`${animPrefix}_run_${dir}`, true);
    }

    const distance = Phaser.Math.Distance.Between(
      entity.x,
      entity.y,
      targetX,
      targetY
    );
    const duration = (distance / PLAYER_SPEED) * 1000;

    entity.currentMoveTween = scene.tweens.add({
      targets: entity,
      x: targetX,
      y: targetY,
      duration,
      ease: "Linear",
      onComplete: () => {
        entity.x = targetX;
        entity.y = targetY;
        entity.currentTileX = step.x;
        entity.currentTileY = step.y;
        recalcDepths(scene);
        if (path.length > 0) {
          moveEntityAlongPathNoCollision(entity, path);
          return;
        }
        entity.currentMoveTween = null;
        entity.isMoving = false;
        resetEntityIdle(entity);
      },
    });
  };

  const shouldIgnoreMove = (entity, msg) => {
    if (!entity || !msg) return true;
    if (Number.isInteger(msg.eventId)) {
      const lastEventId = entity.__lanLastMoveEventId || 0;
      if (msg.eventId <= lastEventId) return true;
      entity.__lanLastMoveEventId = msg.eventId;
    }
    if (Number.isInteger(msg.seq)) {
      const lastSeq = entity.__lanLastMoveSeq || 0;
      if (msg.seq <= lastSeq) return true;
      entity.__lanLastMoveSeq = msg.seq;
    }
    if (
      Number.isInteger(entity.currentTileX) &&
      Number.isInteger(entity.currentTileY) &&
      entity.currentTileX === msg.toX &&
      entity.currentTileY === msg.toY
    ) {
      const wp = map.tileToWorldXY(
        msg.toX,
        msg.toY,
        undefined,
        undefined,
        groundLayer
      );
      if (!wp) return true;
      const cx = wp.x + map.tileWidth / 2;
      const cy = wp.y + map.tileHeight / 2;
      const dx = entity.x - cx;
      const dy = entity.y - cy;
      const dist2 = dx * dx + dy * dy;
      if (dist2 < 4) {
        return true;
      }
    }
    return false;
  };

  const ensureRemotePlayer = (entry) => {
    if (!entry) return null;
    if (!isSceneReady()) return null;
    const playerId = Number(entry.id);
    if (!Number.isFinite(playerId)) return null;
    const localId = getNetPlayerId();
    if (localId && playerId === localId) return null;

    if (remotePlayers.has(playerId)) {
      return remotePlayers.get(playerId);
    }

    const spawnX = Number.isFinite(entry.x) ? entry.x : 0;
    const spawnY = Number.isFinite(entry.y) ? entry.y : 0;
    const remote = createPlayer(scene, 0, 0, entry.classId || "archer");
    remote.isRemote = true;
    remote.netId = playerId;
    remote.mapId = entry.mapId || entry.mapKey || null;
    placeEntityOnTile(remote, spawnX, spawnY);
    remotePlayers.set(playerId, remote);
    return remote;
  };

  const removeRemotePlayer = (playerId) => {
    const remote = remotePlayers.get(playerId);
    if (!remote) return;
    if (remote.destroy) remote.destroy();
    remotePlayers.delete(playerId);
    remotePlayersData.delete(playerId);
  };

  const upsertRemoteData = (entry) => {
    if (!entry) return;
    const playerId = Number(entry.id);
    if (!Number.isFinite(playerId)) return;
    if (getNetPlayerId() === playerId) return;
    const prev = remotePlayersData.get(playerId) || {};
    const mapId = entry.mapId || entry.mapKey || prev.mapId || null;
    const x = Number.isFinite(entry.x) ? entry.x : prev.x;
    const y = Number.isFinite(entry.y) ? entry.y : prev.y;
    const classId = entry.classId || prev.classId || "archer";
    remotePlayersData.set(playerId, { id: playerId, mapId, x, y, classId });
  };

  const refreshRemoteSprites = () => {
    if (!isSceneReady()) return;
    const currentMap = getCurrentMapKey();
    remotePlayersData.forEach((data, id) => {
      const shouldShow = data.mapId && data.mapId === currentMap;
      const existing = remotePlayers.get(id) || null;
      if (shouldShow && !existing) {
        ensureRemotePlayer(data);
        return;
      }
      if (!shouldShow && existing) {
        if (existing.destroy) existing.destroy();
        remotePlayers.delete(id);
      }
    });
  };

  const sendMapChange = () => {
    const client = getNetClient();
    if (!client) return;
    const playerId = getNetPlayerId();
    if (!playerId) return;
    const currentMap = getCurrentMapKey();
    if (!currentMap) return;
    if (!Number.isInteger(player?.currentTileX) || !Number.isInteger(player?.currentTileY)) {
      return;
    }
    client.sendCmd("CmdMapChange", {
      playerId,
      mapId: currentMap,
      tileX: player.currentTileX,
      tileY: player.currentTileY,
    });
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

  const sendMapResourcesSnapshot = () => {
    const client = getNetClient();
    if (!client) return;
    const playerId = getNetPlayerId();
    if (!playerId) return;
    if (!getNetIsHost()) return;
    const currentMap = getCurrentMapKey();
    if (!currentMap) return;
    const entries = buildResourceEntriesForMap();

    client.sendCmd("CmdMapResources", {
      playerId,
      mapId: currentMap,
      resources: entries,
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

  const requestMapResources = () => {
    const client = getNetClient();
    if (!client) return;
    const playerId = getNetPlayerId();
    if (!playerId) return;
    if (getNetIsHost()) return;
    const currentMap = getCurrentMapKey();
    if (!currentMap) return;
    client.sendCmd("CmdRequestMapResources", {
      playerId,
      mapId: currentMap,
    });
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
    if (scene.combatState?.enCours || scene.prepState?.actif) return;
    const list = Array.isArray(scene.monsters) ? scene.monsters : [];
    const currentMap = getCurrentMapObj();
    if (!currentMap) return;
    if (list.length === 0) return;

    const now = Date.now();
    list.forEach((monster) => {
      if (!monster || !monster.active) return;
      if (monster.__lanMovePending && now - (monster.__lanMovePendingAt || 0) > MOB_PENDING_TIMEOUT_MS) {
        monster.__lanMovePending = false;
      }
      if (monster.__lanMoveInFlight && now - (monster.__lanMoveInFlightAt || 0) > MOB_INFLIGHT_TIMEOUT_MS) {
        monster.__lanMoveInFlight = false;
      }
      if (monster.isMoving || monster.__lanMovePending || monster.__lanMoveInFlight) return;
      if (typeof monster.tileX !== "number" || typeof monster.tileY !== "number") return;

      const nextAt = monster.__lanNextRoamAt || 0;
      if (now < nextAt) return;

      const path = planMonsterRoamPath(scene, currentMap, monster);
      const delayMs = Phaser.Math.Between(8000, 25000);
      monster.__lanNextRoamAt = now + delayMs;
      if (!path || path.length === 0) return;

      sendMobMoveStart(monster, path);
    });
  };

  const startHostMobScheduler = () => {
    if (!scene.time?.addEvent) return;
    if (scene.__lanHostMobTick) return;
    scene.__lanHostMobTick = scene.time.addEvent({
      delay: 500,
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
    if (USE_SERVER_MOB_AI) {
      stopHostMobScheduler();
      return;
    }
    if (getNetIsHost()) {
      startHostMobScheduler();
    } else {
      stopHostMobScheduler();
    }
  };

  const initialSync = () => {
    const client = getNetClient();
    if (!client) return;
    const playerId = getNetPlayerId();
    if (!playerId) return;
    if (!Number.isInteger(player?.currentTileX) || !Number.isInteger(player?.currentTileY)) {
      return;
    }
    client.sendCmd("CmdMove", {
      playerId,
      toX: player.currentTileX,
      toY: player.currentTileY,
    });
    sendMapChange();
    sendMapMonstersSnapshot();
    requestMapMonsters();
    sendMapResourcesSnapshot();
    requestMapResources();
  };

  initialSync();

  const handleMoveEvent = (msg) => {
    if (!msg || !player) return;
    const playerId = getNetPlayerId();
    if (!Number.isInteger(msg.toX) || !Number.isInteger(msg.toY)) return;
    const path = Array.isArray(msg.path) ? msg.path : null;

    if (playerId && msg.playerId === playerId) {
      stopEntityMovement(player);
      const currentTile = worldToTile(player.x, player.y);
      if (currentTile) {
        player.currentTileX = currentTile.x;
        player.currentTileY = currentTile.y;
      }
      if (shouldIgnoreMove(player, msg)) {
        return;
      }
      let finalPath = path ? [...path] : null;
      if (!finalPath) {
        const allowDiagonal = !(scene?.combatState && scene.combatState.enCours);
        finalPath = findPathForPlayer(
          scene,
          map,
          player.currentTileX,
          player.currentTileY,
          msg.toX,
          msg.toY,
          allowDiagonal
        );
      }

      if (finalPath && finalPath.length > 0) {
        const first = finalPath[0];
        if (
          first &&
          first.x === player.currentTileX &&
          first.y === player.currentTileY
        ) {
          finalPath.shift();
        }
        if (finalPath.length === 0) {
          forceMoveToTile(player, msg.toX, msg.toY);
          return;
        }
        movePlayerAlongPathNetwork(scene, player, map, groundLayer, finalPath);
        return;
      }

      forceMoveToTile(player, msg.toX, msg.toY);
      return;
    }

    const currentMap = getCurrentMapKey();
    upsertRemoteData({
      id: msg.playerId,
      mapId: msg.mapId || null,
      x: msg.toX,
      y: msg.toY,
    });
    const remoteData = remotePlayersData.get(msg.playerId) || null;
    if (!remoteData || !remoteData.mapId || remoteData.mapId !== currentMap) {
      const existing = remotePlayers.get(msg.playerId) || null;
      if (existing?.destroy) {
        existing.destroy();
        remotePlayers.delete(msg.playerId);
      }
      return;
    }
    const remote = ensureRemotePlayer(remoteData);
    if (!remote) return;
    if (shouldIgnoreMove(remote, msg)) return;
    stopEntityMovement(remote);
    let finalPath = path ? [...path] : null;
    if (!finalPath) {
      const allowDiagonal = !(scene?.combatState && scene.combatState.enCours);
      finalPath = findPathForPlayer(
        scene,
        map,
        remote.currentTileX,
        remote.currentTileY,
        msg.toX,
        msg.toY,
        allowDiagonal
      );
    }

    if (finalPath && finalPath.length > 0) {
      const first = finalPath[0];
      if (
        first &&
        first.x === remote.currentTileX &&
        first.y === remote.currentTileY
      ) {
        finalPath.shift();
      }
      if (finalPath.length === 0) {
        forceMoveToTile(remote, msg.toX, msg.toY);
        return;
      }
      moveEntityAlongPathNoCollision(remote, finalPath);
      return;
    }

    forceMoveToTile(remote, msg.toX, msg.toY);
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

  setNetEventHandler((msg) => {
    if (!msg || !player) return;

    if (msg.t === "EvMoveStart" || msg.t === "EvMoved") {
      handleMoveEvent(msg);
      return;
    }

    if (msg.t === "EvWelcome") {
      if (typeof msg.isHost === "boolean") {
        setNetIsHost(msg.isHost);
      }
      const snapshot = msg.snapshot || null;
      const players = snapshot?.players || [];
      players.forEach((entry) => upsertRemoteData(entry));
      refreshRemoteSprites();
      sendMapChange();
      if (getNetIsHost()) {
        sendMapMonstersSnapshot();
        sendMapResourcesSnapshot();
      }
      requestMapMonsters();
      requestMapResources();
      updateHostMobScheduler();
      return;
    }

    if (msg.t === "EvPlayerJoined") {
      upsertRemoteData(msg.player);
      refreshRemoteSprites();
      return;
    }

    if (msg.t === "EvPlayerLeft") {
      removeRemotePlayer(msg.playerId);
    }

    if (msg.t === "EvPlayerMap") {
      upsertRemoteData({
        id: msg.playerId,
        mapId: msg.mapId,
        x: msg.tileX,
        y: msg.tileY,
      });
      const remote = remotePlayers.get(msg.playerId) || null;
      if (remote) remote.mapId = msg.mapId || null;
      refreshRemoteSprites();
    }

    if (msg.t === "EvHostChanged") {
      const playerId = getNetPlayerId();
      if (Number.isInteger(msg.hostId) && playerId) {
        setNetIsHost(msg.hostId === playerId);
      } else {
        setNetIsHost(false);
      }
      if (getNetIsHost()) {
        sendMapMonstersSnapshot();
        sendMapResourcesSnapshot();
      }
      requestMapMonsters();
      requestMapResources();
      updateHostMobScheduler();
    }

    if (msg.t === "EvMapMonsters") {
      const currentMap = getCurrentMapKey();
      if (!currentMap || msg.mapId !== currentMap) return;
      clearWorldMonsters();
      const entries = Array.isArray(msg.monsters) ? msg.monsters : [];
      spawnMonstersFromEntries(scene, scene.map, scene.groundLayer, entries, {
        disableRoam: true,
      });
      updateHostMobScheduler();
    }

    if (msg.t === "EvMapResources") {
      const currentMap = getCurrentMapKey();
      if (!currentMap || msg.mapId !== currentMap) return;
      const entries = Array.isArray(msg.resources) ? msg.resources : [];
      spawnResourcesFromEntries(entries);
      return;
    }

    if (msg.t === "EvMobMoveStart") {
      handleMobMoveStart(msg);
      return;
    }

    if (msg.t === "EvMobMoveEnd") {
      handleMobMoveEnd(msg);
      return;
    }

    if (msg.t === "EvMobDeath") {
      const currentMap = getCurrentMapKey();
      if (!currentMap || msg.mapId !== currentMap) return;
      removeWorldMonsterByEntityId(msg.entityId);
      return;
    }

    if (msg.t === "EvMobRespawn") {
      const currentMap = getCurrentMapKey();
      if (!currentMap || msg.mapId !== currentMap) return;
      const entry = msg.monster || null;
      if (!entry || !Number.isInteger(entry.entityId)) return;
      if (entry && Number.isInteger(entry.entityId)) {
        removeWorldMonsterByEntityId(entry.entityId);
      }
      spawnMonstersFromEntries(scene, scene.map, scene.groundLayer, [entry], {
        disableRoam: true,
      });
      return;
    }

    if (msg.t === "EvResourceHarvested") {
      const currentMap = getCurrentMapKey();
      if (!currentMap || msg.mapId !== currentMap) return;
      const node = findResourceNodeByEntityId(msg.entityId);
      if (!node) return;
      const isLocal = getNetPlayerId() === msg.harvesterId;
      if (node.kind === TREE_RESOURCE_KIND) {
        applyTreeHarvested(scene, player, node, isLocal);
      } else if (node.kind === HERB_RESOURCE_KIND) {
        applyHerbHarvested(scene, player, node, isLocal);
      } else if (node.kind === WELL_RESOURCE_KIND) {
        applyWellHarvested(scene, player, node, isLocal);
      }
      return;
    }

    if (msg.t === "EvResourceRespawned") {
      const currentMap = getCurrentMapKey();
      if (!currentMap || msg.mapId !== currentMap) return;
      const node = findResourceNodeByEntityId(msg.entityId);
      if (!node) return;
      if (node.kind === TREE_RESOURCE_KIND) {
        applyTreeRespawn(scene, node);
      } else if (node.kind === HERB_RESOURCE_KIND) {
        applyHerbRespawn(scene, node);
      } else if (node.kind === WELL_RESOURCE_KIND) {
        applyWellRespawn(scene, node);
      }
      return;
    }
  });

  onStoreEvent("map:changed", (payload) => {
    if (!payload?.mapKey) return;
    sendMapChange();
    refreshRemoteSprites();
    sendMapMonstersSnapshot();
    requestMapMonsters();
    clearResourceNodes();
    sendMapResourcesSnapshot();
    requestMapResources();
    updateHostMobScheduler();
  });
}
