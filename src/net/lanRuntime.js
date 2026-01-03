import {
  getNetClient,
  getNetPlayerId,
  setNetEventHandler,
} from "../app/session.js";
import { createPlayer } from "../entities/player.js";
import { findPathForPlayer } from "../entities/movement/pathfinding.js";
import { movePlayerAlongPathNetwork } from "../entities/playerMovement.js";
import { movePlayerAlongPath } from "../entities/movement/runtime.js";
import { recalcDepths } from "../features/maps/world/decor.js";
import { createCalibratedWorldToTile } from "../features/maps/world/util.js";
import { PLAYER_SPEED } from "../config/constants.js";

export function initLanRuntime(scene, player, map, groundLayer) {
  const client = getNetClient();
  if (!client) return;

  const remotePlayers = new Map();
  scene.__lanRemotePlayers = remotePlayers;
  const worldToTile = createCalibratedWorldToTile(map, groundLayer);

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

  const shouldIgnoreMove = (entity, msg) => {
    if (!entity || !msg) return true;
    if (Number.isInteger(msg.eventId)) {
      const lastEventId = entity.__lanLastMoveEventId || 0;
      if (msg.eventId <= lastEventId) return true;
      entity.__lanLastMoveEventId = msg.eventId;
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
    placeEntityOnTile(remote, spawnX, spawnY);
    remotePlayers.set(playerId, remote);
    return remote;
  };

  const removeRemotePlayer = (playerId) => {
    const remote = remotePlayers.get(playerId);
    if (!remote) return;
    if (remote.destroy) remote.destroy();
    remotePlayers.delete(playerId);
  };

  const initialSync = () => {
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
  };

  initialSync();

  setNetEventHandler((msg) => {
    if (!msg || !player) return;

    if (msg.t === "EvMoved") {
      const playerId = getNetPlayerId();
      if (!Number.isInteger(msg.toX) || !Number.isInteger(msg.toY)) return;

      if (playerId && msg.playerId === playerId) {
        if (player.currentMoveTween) {
          player.currentMoveTween.stop();
          player.currentMoveTween = null;
          player.isMoving = false;
          resetEntityIdle(player);
        }
        const currentTile = worldToTile(player.x, player.y);
        if (currentTile) {
          player.currentTileX = currentTile.x;
          player.currentTileY = currentTile.y;
        }
        if (shouldIgnoreMove(player, msg)) {
          return;
        }
        const allowDiagonal = !(scene?.combatState && scene.combatState.enCours);
        const path = findPathForPlayer(
          scene,
          map,
          player.currentTileX,
          player.currentTileY,
          msg.toX,
          msg.toY,
          allowDiagonal
        );

        if (path && path.length > 0) {
          const first = path[0];
          if (
            first &&
            first.x === player.currentTileX &&
            first.y === player.currentTileY
          ) {
            path.shift();
          }
          if (path.length === 0) {
            forceMoveToTile(player, msg.toX, msg.toY);
            return;
          }
          movePlayerAlongPathNetwork(scene, player, map, groundLayer, path);
          return;
        }

        forceMoveToTile(player, msg.toX, msg.toY);
        return;
      }

      const remote = ensureRemotePlayer({ id: msg.playerId });
      if (!remote) return;
      if (shouldIgnoreMove(remote, msg)) return;
      const allowDiagonal = !(scene?.combatState && scene.combatState.enCours);
      const path = findPathForPlayer(
        scene,
        map,
        remote.currentTileX,
        remote.currentTileY,
        msg.toX,
        msg.toY,
        allowDiagonal
      );

      if (path && path.length > 0) {
        const first = path[0];
        if (
          first &&
          first.x === remote.currentTileX &&
          first.y === remote.currentTileY
        ) {
          path.shift();
        }
        if (path.length === 0) {
          forceMoveToTile(remote, msg.toX, msg.toY);
          return;
        }
        movePlayerAlongPath(scene, remote, map, groundLayer, path, 0);
        return;
      }

      forceMoveToTile(remote, msg.toX, msg.toY);
      return;
    }

    if (msg.t === "EvWelcome") {
      const snapshot = msg.snapshot || null;
      const players = snapshot?.players || [];
      players.forEach((entry) => {
        ensureRemotePlayer(entry);
      });
      return;
    }

    if (msg.t === "EvPlayerJoined") {
      ensureRemotePlayer(msg.player);
      return;
    }

    if (msg.t === "EvPlayerLeft") {
      removeRemotePlayer(msg.playerId);
    }
  });
}
