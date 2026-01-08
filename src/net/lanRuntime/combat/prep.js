import { getNetPlayerId } from "../../../app/session.js";
import { createPlayer } from "../../../entities/player.js";
import { startPrep } from "../../../features/combat/runtime/prep.js";
import { buildTurnOrder } from "../../../features/combat/runtime/state.js";
import { isTileBlocked, unblockTile } from "../../../collision/collisionGrid.js";

export function createCombatPrepHandlers(ctx, helpers) {
  const {
    scene,
    player,
    remotePlayersData,
    remotePlayers,
    getCurrentMapObj,
    getCurrentGroundLayer,
    isSceneReady,
  } = ctx;
  const { buildCombatLeaderFromEntry, getEntityTile, updateBlockedTile } = helpers;

  const assignCombatMonstersFromEntries = (mobEntries) => {
    if (!Array.isArray(mobEntries) || mobEntries.length === 0) return;
    if (!Array.isArray(scene.combatMonsters) || scene.combatMonsters.length === 0) {
      return;
    }

    const existingEntityIds = new Set(
      scene.combatMonsters
        .map((m) => (m && Number.isInteger(m.entityId) ? m.entityId : null))
        .filter((id) => Number.isInteger(id))
    );

    const unassigned = scene.combatMonsters.filter(
      (m) => m && !Number.isInteger(m.entityId)
    );
    if (unassigned.length === 0) return;

    const byMonsterId = new Map();
    unassigned.forEach((m) => {
      const key = m.monsterId || "__unknown";
      if (!byMonsterId.has(key)) byMonsterId.set(key, []);
      byMonsterId.get(key).push(m);
    });

    mobEntries.forEach((entry) => {
      const entityId = Number.isInteger(entry?.entityId) ? entry.entityId : null;
      if (!entityId) return;
      if (existingEntityIds.has(entityId)) return;
      const combatIndex = Number.isInteger(entry?.combatIndex) ? entry.combatIndex : null;
      let target = null;
      if (combatIndex !== null && scene.combatMonsters[combatIndex]) {
        target = scene.combatMonsters[combatIndex];
      }
      if (!target) {
        const monsterId = entry.monsterId || "__unknown";
        const bucket = byMonsterId.get(monsterId) || [];
        target = bucket.length > 0 ? bucket.shift() : unassigned.shift() || null;
      }
      if (!target) return;
      target.entityId = entityId;
      if (combatIndex !== null) {
        target.combatIndex = combatIndex;
      }
      existingEntityIds.add(entityId);
      if (typeof entry.spawnMapKey === "string") {
        target.spawnMapKey = entry.spawnMapKey;
      }
      target.isCombatMember = true;
    });
  };

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

    const mapForSpawn = scene.combatMap || scene.map;
    const layerForSpawn = scene.combatGroundLayer || scene.groundLayer;
    const allowedTiles = scene.prepState?.allowedTiles || [];

    const placementMap = new Map();
    if (scene.prepState && scene.prepState.actif) {
      const ordered = participantIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id))
        .sort((a, b) => a - b);
      const placementKey = ordered.join(",");
      ordered.forEach((id, idx) => {
        const tile = allowedTiles[idx] || null;
        if (tile && Number.isInteger(tile.x) && Number.isInteger(tile.y)) {
          placementMap.set(id, { x: tile.x, y: tile.y });
        }
      });

      if (scene.prepState.__lanPlacementKey !== placementKey) {
        scene.prepState.__lanPlacementKey = placementKey;
        const localTile = placementMap.get(localId) || null;
        if (localTile && mapForSpawn && layerForSpawn) {
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
        const tile =
          reserved ||
          (!Number.isInteger(existing.currentTileX) ||
          !Number.isInteger(existing.currentTileY)
            ? pickTile()
            : null);
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
      ally.displayName = `Joueur ${playerId}`;
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

  const startJoinCombatPrep = (entry, mobEntries) => {
    if (!entry || !Number.isInteger(entry.combatId)) return;
    if (scene.combatState?.enCours || scene.prepState?.actif) return;
    const localId = getNetPlayerId();
    if (!localId) return;
    const participantIds = Array.isArray(entry.participantIds)
      ? entry.participantIds
      : [];
    if (!participantIds.includes(localId)) return;
    const leaderEntry = Array.isArray(mobEntries) ? mobEntries[0] : null;
    if (!leaderEntry) return;
    const leader = buildCombatLeaderFromEntry(leaderEntry);
    if (!leader) return;
    const currentMap = getCurrentMapObj();
    const currentLayer = getCurrentGroundLayer();
    if (!currentMap || !currentLayer) return;

    // eslint-disable-next-line no-console
    console.log("[LAN] JoinCombat prep start", {
      combatId: entry.combatId,
      mapId: entry.mapId,
      participants: entry.participantIds,
      phase: entry.phase,
    });

    scene.__lanCombatId = entry.combatId;
    scene.__lanCombatStartSent = true;
    startPrep(scene, player, leader, currentMap, currentLayer, {
      allowLanLocalStart: true,
    });
    assignCombatMonstersFromEntries(mobEntries);
    const localTile = getEntityTile(player);
    if (localTile) {
      updateBlockedTile(player, localTile.x, localTile.y);
    }
    syncCombatPlayerAllies(entry);
  };

  return {
    syncCombatPlayerAllies,
    startJoinCombatPrep,
  };
}
