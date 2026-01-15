import { getNetPlayerId } from "../../../../app/session.js";
import { createPlayer } from "../../../../entities/player.js";
import { buildTurnOrder } from "../../../../features/combat/runtime/state.js";
import { isTileBlocked, unblockTile } from "../../../../collision/collisionGrid.js";

export function createCombatPrepAlliesHandlers(ctx, helpers) {
  const {
    scene,
    player,
    remotePlayersData,
    isSceneReady,
  } = ctx;
  const { updateBlockedTile } = helpers;

  const syncCombatPlayerAllies = (entry) => {
    if (!entry || !Number.isInteger(entry.combatId)) return;
    if (!isSceneReady()) {
      if (!scene.__lanPrepSyncPending) {
        scene.__lanPrepSyncPending = true;
        if (scene.time && typeof scene.time.delayedCall === "function") {
          scene.time.delayedCall(50, () => {
            scene.__lanPrepSyncPending = false;
            syncCombatPlayerAllies(entry);
          });
        } else {
          scene.__lanPrepSyncPending = false;
        }
      }
      return;
    }
    const mapForSpawn = scene.combatMap || scene.map;
    const layerForSpawn = scene.combatGroundLayer || scene.groundLayer;
    if (!mapForSpawn || !layerForSpawn || !layerForSpawn.layer) {
      if (!scene.__lanPrepSyncPending) {
        scene.__lanPrepSyncPending = true;
        if (scene.time && typeof scene.time.delayedCall === "function") {
          scene.time.delayedCall(100, () => {
            scene.__lanPrepSyncPending = false;
            syncCombatPlayerAllies(entry);
          });
        } else {
          scene.__lanPrepSyncPending = false;
        }
      }
      return;
    }
    const localId = getNetPlayerId();
    if (!localId) return;
    const participantIds = Array.isArray(entry.participantIds)
      ? entry.participantIds
      : [];
    if (!participantIds.includes(localId)) return;
    if (!scene.prepState?.actif && !scene.combatState?.enCours) return;

    const allyIds = participantIds.filter((id) => Number(id) !== localId);
    const allies = Array.isArray(scene.combatAllies) ? scene.combatAllies : [];
    const kept = [];
    allies.forEach((ally) => {
      if (!ally || !ally.isPlayerAlly) {
        kept.push(ally);
        return;
      }
      const netId = Number(ally.netId);
      if (allyIds.includes(netId)) {
        const remoteInfo = remotePlayersData.get(netId) || {};
        if (
          typeof remoteInfo.classId === "string" &&
          remoteInfo.classId &&
          ally.classId &&
          ally.classId !== remoteInfo.classId
        ) {
          if (ally.blocksMovement && ally._blockedTile) {
            unblockTile(scene, ally._blockedTile.x, ally._blockedTile.y);
            ally._blockedTile = null;
          }
          if (ally.destroy) ally.destroy();
          return;
        }
        if (!Number.isInteger(ally.netId)) ally.netId = netId;
        if (!Number.isInteger(ally.id)) ally.id = netId;
        if (typeof remoteInfo.displayName === "string" && remoteInfo.displayName) {
          ally.displayName = remoteInfo.displayName;
        }
        kept.push(ally);
        return;
      }
      if (ally.blocksMovement && ally._blockedTile) {
        unblockTile(scene, ally._blockedTile.x, ally._blockedTile.y);
        ally._blockedTile = null;
      }
      if (ally.destroy) ally.destroy();
    });
    scene.combatAllies = kept;

    const existingIds = new Set(
      kept
        .filter((ally) => ally && ally.isPlayerAlly)
        .map((ally) => Number(ally.netId))
        .filter((id) => Number.isInteger(id))
    );

    const allowedTiles = scene.prepState?.allowedTiles || [];

    const placementMap = new Map();
    const serverPlacementMap = new Map();
    if (scene.prepState && scene.prepState.actif) {
      const ordered = participantIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id))
        .sort((a, b) => a - b);
      const placementKey = ordered.join(",");
      const serverPlacements =
        scene.__lanPrepServerPlacements instanceof Map
          ? scene.__lanPrepServerPlacements
          : null;
      if (serverPlacements) {
        ordered.forEach((id) => {
          const tile = serverPlacements.get(id) || null;
          if (
            tile &&
            Number.isInteger(tile.x) &&
            Number.isInteger(tile.y) &&
            allowedTiles.some((t) => t && t.x === tile.x && t.y === tile.y)
          ) {
            placementMap.set(id, { x: tile.x, y: tile.y });
            serverPlacementMap.set(id, { x: tile.x, y: tile.y });
          }
        });
      }
      ordered.forEach((id, idx) => {
        if (placementMap.has(id)) return;
        const tile = allowedTiles[idx] || null;
        if (tile && Number.isInteger(tile.x) && Number.isInteger(tile.y)) {
          placementMap.set(id, { x: tile.x, y: tile.y });
        }
      });

      if (scene.prepState.__lanPlacementKey !== placementKey) {
        scene.prepState.__lanPlacementKey = placementKey;
        const localTile = placementMap.get(localId) || null;
        const hasCurrentTile =
          Number.isInteger(player?.currentTileX) &&
          Number.isInteger(player?.currentTileY);
        const currentAllowed =
          hasCurrentTile &&
          allowedTiles.some(
            (t) =>
              t &&
              t.x === player.currentTileX &&
              t.y === player.currentTileY
          );
        const manualTile = scene.prepState?.__lanManualPlacement || null;
        const manualAllowed =
          manualTile &&
          Number.isInteger(manualTile.x) &&
          Number.isInteger(manualTile.y) &&
          allowedTiles.some(
            (t) => t && t.x === manualTile.x && t.y === manualTile.y
          );
        if (
          localTile &&
          mapForSpawn &&
          layerForSpawn &&
          (!hasCurrentTile || (!currentAllowed && !manualAllowed))
        ) {
          const wp = mapForSpawn.tileToWorldXY(
            localTile.x,
            localTile.y,
            undefined,
            undefined,
            layerForSpawn
          );
          if (wp) {
            player.x = wp.x + mapForSpawn.tileWidth / 2;
            player.y = wp.y + mapForSpawn.tileHeight / 2;
            player.currentTileX = localTile.x;
            player.currentTileY = localTile.y;
            if (player.setDepth) player.setDepth(player.y);
            updateBlockedTile(player, localTile.x, localTile.y);
          }
        }
      }
    }

    const takenTiles = new Set();
    if (
      Number.isInteger(player?.currentTileX) &&
      Number.isInteger(player?.currentTileY)
    ) {
      takenTiles.add(`${player.currentTileX},${player.currentTileY}`);
    }
    kept.forEach((ally) => {
      if (
        Number.isInteger(ally?.currentTileX) &&
        Number.isInteger(ally?.currentTileY)
      ) {
        takenTiles.add(`${ally.currentTileX},${ally.currentTileY}`);
      }
    });

    const pickTile = () => {
      if (!Array.isArray(allowedTiles) || allowedTiles.length === 0) return null;
      for (const tile of allowedTiles) {
        if (!tile || !Number.isInteger(tile.x) || !Number.isInteger(tile.y)) continue;
        const key = `${tile.x},${tile.y}`;
        if (takenTiles.has(key)) continue;
        if (isTileBlocked(scene, tile.x, tile.y)) continue;
        takenTiles.add(key);
        return tile;
      }
      return null;
    };

    allyIds.forEach((id) => {
      const playerId = Number(id);
      if (!Number.isInteger(playerId)) return;
      const reserved = placementMap.get(playerId) || null;
      if (existingIds.has(playerId)) {
        const existing = kept.find(
          (ally) => ally?.isPlayerAlly && Number(ally.netId) === playerId
        );
        if (!existing) return;
        const hasCurrentTile =
          Number.isInteger(existing.currentTileX) &&
          Number.isInteger(existing.currentTileY);
        const currentAllowed =
          hasCurrentTile &&
          allowedTiles.some(
            (t) => t && t.x === existing.currentTileX && t.y === existing.currentTileY
          );
        const hasServerPlacement = serverPlacementMap.has(playerId);
        const shouldSnapToServer =
          hasServerPlacement &&
          reserved &&
          (!hasCurrentTile ||
            existing.currentTileX !== reserved.x ||
            existing.currentTileY !== reserved.y);
        const tile =
          reserved ||
          (!hasCurrentTile || !currentAllowed ? pickTile() : null);
        if (shouldSnapToServer) {
          // Server placement wins during prep to avoid desync.
          if (reserved) {
            if (mapForSpawn && layerForSpawn) {
              const wp = mapForSpawn.tileToWorldXY(
                reserved.x,
                reserved.y,
                undefined,
                undefined,
                layerForSpawn
              );
              if (wp) {
                existing.x = wp.x + mapForSpawn.tileWidth / 2;
                existing.y = wp.y + mapForSpawn.tileHeight / 2;
                existing.currentTileX = reserved.x;
                existing.currentTileY = reserved.y;
                if (existing.setDepth) existing.setDepth(existing.y);
                updateBlockedTile(existing, reserved.x, reserved.y);
              }
            }
          }
          return;
        }
        if (tile && mapForSpawn && layerForSpawn) {
          const wp = mapForSpawn.tileToWorldXY(
            tile.x,
            tile.y,
            undefined,
            undefined,
            layerForSpawn
          );
          if (wp) {
            existing.x = wp.x + mapForSpawn.tileWidth / 2;
            existing.y = wp.y + mapForSpawn.tileHeight / 2;
            existing.currentTileX = tile.x;
            existing.currentTileY = tile.y;
            if (existing.setDepth) existing.setDepth(existing.y);
            updateBlockedTile(existing, tile.x, tile.y);
          }
        }
        return;
      }
      const remote = remotePlayersData.get(playerId) || {};
      const classId = remote.classId || "archer";
      const ally = createPlayer(scene, 0, 0, classId);
      ally.isCombatAlly = true;
      ally.isPlayerAlly = true;
      ally.netId = playerId;
      ally.displayName = remote.displayName || `Joueur ${playerId}`;
      ally.isRemote = true;

      const tile = reserved || pickTile();
      if (tile && mapForSpawn && layerForSpawn) {
        const wp = mapForSpawn.tileToWorldXY(
          tile.x,
          tile.y,
          undefined,
          undefined,
          layerForSpawn
        );
        if (wp) {
          ally.x = wp.x + mapForSpawn.tileWidth / 2;
          ally.y = wp.y + mapForSpawn.tileHeight / 2;
          ally.currentTileX = tile.x;
          ally.currentTileY = tile.y;
          if (ally.setDepth) ally.setDepth(ally.y);
        }
      }

      if (tile) {
        updateBlockedTile(ally, tile.x, tile.y);
      }

      scene.combatAllies = scene.combatAllies || [];
      scene.combatAllies.push(ally);
    });

    if (scene.prepState && scene.prepState.actif) {
      scene.prepState.spawnedAllies = true;
    }

    if (scene.combatState && scene.combatState.enCours) {
      buildTurnOrder(scene);
    }

    if (typeof scene.updateCombatUi === "function") {
      scene.updateCombatUi();
    }
  };

  return { syncCombatPlayerAllies };
}
