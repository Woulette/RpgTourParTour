import { getNetPlayerId } from "../../../../app/session.js";
import { unblockTile } from "../../../../collision/collisionGrid.js";
import { endCombat } from "../../../../core/combat.js";

export function createCombatExitHandlers({ ctx, helpers, syncHandlers }) {
  const {
    scene,
    player,
    activeCombats,
    remotePlayersData,
    getCurrentMapKey,
    refreshRemoteSprites,
    updateCombatWatchUi,
    refreshMapMonstersFromServer,
    requestMapPlayers,
    removeCombatJoinMarker,
  } = ctx;
  const { shouldApplyCombatEvent } = helpers;
  const { stopCombatSync } = syncHandlers;

  const applyCombatEnded = (entry) => {
    if (!entry || !Number.isInteger(entry.combatId)) return;
    if (!shouldApplyCombatEvent(entry.combatId, entry.eventId, entry.combatSeq)) return;
    const stateCombatId = scene?.combatState?.combatId ?? null;
    const shouldEndLocal =
      scene?.combatState?.enCours === true &&
      (Number.isInteger(stateCombatId)
        ? stateCombatId === entry.combatId
        : scene.__lanCombatId === entry.combatId);
    if (scene.__lanCombatActorsCache?.delete) {
      scene.__lanCombatActorsCache.delete(entry.combatId);
    }
    activeCombats.delete(entry.combatId);
    removeCombatJoinMarker(entry.combatId);

    const participantIds = Array.isArray(entry.participantIds)
      ? entry.participantIds
      : [];
    participantIds.forEach((id) => {
      const playerId = Number(id);
      if (!Number.isInteger(playerId)) return;
      const prev = remotePlayersData.get(playerId);
      if (!prev) return;
      remotePlayersData.set(playerId, {
        ...prev,
        inCombat: false,
        combatId: null,
      });
    });

    const localId = getNetPlayerId();
    if (localId && scene.__lanCombatId === entry.combatId) {
      scene.__lanCombatId = null;
      scene.__lanCombatAiDriverId = null;
      if (player?.blocksMovement && player._blockedTile) {
        unblockTile(scene, player._blockedTile.x, player._blockedTile.y);
        player._blockedTile = null;
      }
      stopCombatSync();
    }
    if (shouldEndLocal && scene.combatState) {
      if (typeof entry.issue === "string" && entry.issue) {
        scene.combatState.issue = entry.issue;
      }
      const localId = getNetPlayerId();
      if (localId && entry?.lootByPlayer && entry.lootByPlayer[localId]) {
        scene.combatState.serverLoot = entry.lootByPlayer[localId];
      }
      if (localId && entry?.xpByPlayer && Number.isFinite(entry.xpByPlayer[localId])) {
        scene.combatState.serverXp = entry.xpByPlayer[localId];
      }
      if (localId && entry?.goldByPlayer && Number.isFinite(entry.goldByPlayer[localId])) {
        scene.combatState.serverGold = entry.goldByPlayer[localId];
      }
      endCombat(scene);
    }
    scene.__lanWorldMobsHidden = false;

    const currentMap = getCurrentMapKey();
    if (entry.mapId && entry.mapId === currentMap) {
      refreshMapMonstersFromServer();
    }
    if (scene.__lanMobsRefreshNeeded) {
      scene.__lanMobsRefreshNeeded = false;
      refreshMapMonstersFromServer();
    }
    if (typeof requestMapPlayers === "function") {
      requestMapPlayers();
    }

    refreshRemoteSprites();
    updateCombatWatchUi();
  };

  return { applyCombatEnded };
}
