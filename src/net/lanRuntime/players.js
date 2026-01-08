import { createPlayer } from "../../entities/player.js";
import { findPathForPlayer } from "../../entities/movement/pathfinding.js";
import { movePlayerAlongPathNetwork } from "../../entities/playerMovement.js";
import { recalcDepths } from "../../features/maps/world/decor.js";
import { PLAYER_SPEED } from "../../config/constants.js";
import { getNetPlayerId } from "../../app/session.js";

export function createPlayerHandlers(ctx) {
  const {
    scene,
    player,
    map,
    groundLayer,
    worldToTile,
    remotePlayers,
    remotePlayersData,
    getCurrentMapKey,
    isSceneReady,
  } = ctx;

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
    remote.displayName = entry.displayName || remote.displayName || "Joueur";
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
    const displayName = entry.displayName || prev.displayName || null;
    const inCombat = entry.inCombat === true ? true : prev.inCombat === true;
    const combatId = Number.isInteger(entry.combatId) ? entry.combatId : prev.combatId || null;
    remotePlayersData.set(playerId, {
      id: playerId,
      mapId,
      x,
      y,
      classId,
      displayName,
      inCombat,
      combatId,
    });
  };

  const refreshRemoteSprites = () => {
    if (!isSceneReady()) return;
    const currentMap = getCurrentMapKey();
    remotePlayersData.forEach((data, id) => {
      const shouldShow = data.mapId && data.mapId === currentMap && !data.inCombat;
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
    if (remoteData?.inCombat) {
      const existing = remotePlayers.get(msg.playerId) || null;
      if (existing?.destroy) {
        existing.destroy();
        remotePlayers.delete(msg.playerId);
      }
      return;
    }
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

  return {
    ensureRemotePlayer,
    removeRemotePlayer,
    upsertRemoteData,
    refreshRemoteSprites,
    handleMoveEvent,
    stopEntityMovement,
  };
}
