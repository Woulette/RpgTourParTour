import { getNetPlayerId } from "../../../app/session.js";
import { unblockTile } from "../../../collision/collisionGrid.js";
import { startCombatFromPrep } from "../../../features/combat/runtime/prep.js";
import { endCombat } from "../../../core/combat.js";

export function createCombatLifecycleHandlers(
  ctx,
  helpers,
  prepHandlers,
  syncHandlers
) {
  const {
    scene,
    player,
    activeCombats,
    remotePlayersData,
    remotePlayers,
    getCurrentMapKey,
    removeWorldMonsterByEntityId,
    refreshRemoteSprites,
    updateCombatWatchUi,
    refreshMapMonstersFromServer,
    removeCombatJoinMarker,
  } = ctx;
  const { buildLanActorsOrder, shouldApplyCombatEvent } = helpers;
  const { syncCombatPlayerAllies, startJoinCombatPrep } = prepHandlers;
  const { startCombatSync, stopCombatSync, sendCombatState } = syncHandlers;

  const applyCombatCreated = (entry) => {
    if (!entry || !Number.isInteger(entry.combatId)) return;
    if (!shouldApplyCombatEvent(entry.combatId, entry.eventId, entry.combatSeq)) return;
    activeCombats.set(entry.combatId, entry);

    const participantIds = Array.isArray(entry.participantIds)
      ? entry.participantIds
      : [];
    participantIds.forEach((id) => {
      const playerId = Number(id);
      if (!Number.isInteger(playerId)) return;
      const prev = remotePlayersData.get(playerId) || { id: playerId };
      remotePlayersData.set(playerId, {
        ...prev,
        inCombat: true,
        combatId: entry.combatId,
      });
      const remote = remotePlayers.get(playerId);
      if (remote) {
        remote.inCombat = true;
        remote.combatId = entry.combatId;
      }
    });

    const localId = getNetPlayerId();
    if (localId && participantIds.includes(localId)) {
      scene.__lanCombatId = entry.combatId;
      if (Number.isInteger(entry.aiDriverId)) {
        scene.__lanCombatAiDriverId = entry.aiDriverId;
      }
    }

    const currentMap = getCurrentMapKey();
    if (entry.mapId && entry.mapId === currentMap) {
      const mobIds = Array.isArray(entry.mobEntityIds) ? entry.mobEntityIds : [];
      const isLocalParticipant = localId && participantIds.includes(localId);
      if (!isLocalParticipant) {
        mobIds.forEach((id) => removeWorldMonsterByEntityId(id));
      }
    }

    refreshRemoteSprites();
    updateCombatWatchUi();
  };

  const applyCombatUpdated = (entry) => {
    if (!entry || !Number.isInteger(entry.combatId)) return;
    if (!shouldApplyCombatEvent(entry.combatId, entry.eventId, entry.combatSeq)) return;
    activeCombats.set(entry.combatId, entry);

    const participantIds = Array.isArray(entry.participantIds)
      ? entry.participantIds
      : [];
    participantIds.forEach((id) => {
      const playerId = Number(id);
      if (!Number.isInteger(playerId)) return;
      const prev = remotePlayersData.get(playerId) || { id: playerId };
      remotePlayersData.set(playerId, {
        ...prev,
        inCombat: true,
        combatId: entry.combatId,
      });
      const remote = remotePlayers.get(playerId);
      if (remote) {
        remote.inCombat = true;
        remote.combatId = entry.combatId;
      }
    });

    const localId = getNetPlayerId();
    if (localId && participantIds.includes(localId)) {
      scene.__lanCombatId = entry.combatId;
      if (Number.isInteger(entry.aiDriverId)) {
        scene.__lanCombatAiDriverId = entry.aiDriverId;
      }
    }

    const currentMap = getCurrentMapKey();
    if (entry.mapId && entry.mapId === currentMap) {
      const mobIds = Array.isArray(entry.mobEntityIds) ? entry.mobEntityIds : [];
      const isLocalParticipant = localId && participantIds.includes(localId);
      if (!isLocalParticipant) {
        mobIds.forEach((id) => removeWorldMonsterByEntityId(id));
      }
    }

    refreshRemoteSprites();
    updateCombatWatchUi();
    syncCombatPlayerAllies(entry);

    if (
      entry.phase === "combat" &&
      localId &&
      participantIds.includes(localId) &&
      scene.prepState &&
      scene.prepState.actif
    ) {
      // eslint-disable-next-line no-console
      console.log("[LAN] Combat start from prep", {
        combatId: entry.combatId,
        mapId: entry.mapId,
        participants: entry.participantIds,
        phase: entry.phase,
      });
      startCombatFromPrep(scene);
    }

    if (
      scene.combatState &&
      scene.combatState.enCours &&
      scene.__lanCombatId === entry.combatId
    ) {
      if (Number.isInteger(entry.activePlayerId)) {
        scene.combatState.activePlayerId = entry.activePlayerId;
      }
      if (Number.isInteger(entry.activeMonsterId)) {
        scene.combatState.activeMonsterId = entry.activeMonsterId;
      }
      if (Number.isInteger(entry.activeMonsterIndex)) {
        scene.combatState.activeMonsterIndex = entry.activeMonsterIndex;
      }
      if (entry.turn === "monster") {
        scene.combatState.tour = "monstre";
      } else if (entry.turn === "player") {
        scene.combatState.tour = "joueur";
      }
      if (Number.isInteger(entry.round)) {
        scene.combatState.round = entry.round;
      }
      const lanActors = buildLanActorsOrder(entry);
      if (lanActors) {
        scene.combatState.actors = lanActors;
        if (Number.isInteger(scene.combatState.activePlayerId)) {
          const idx = lanActors.findIndex((a) => {
            if (!a || a.kind !== "joueur") return false;
            const ent = a.entity;
            const id =
              Number.isInteger(ent?.netId) ? ent.netId : Number.isInteger(ent?.id) ? ent.id : null;
            return id === scene.combatState.activePlayerId;
          });
          if (idx >= 0) {
            scene.combatState.actorIndex = idx;
          }
        } else if (
          Number.isInteger(scene.combatState.activeMonsterId) ||
          Number.isInteger(scene.combatState.activeMonsterIndex)
        ) {
          const idx = lanActors.findIndex((a) => {
            if (!a || a.kind !== "monstre") return false;
            const ent = a.entity;
            if (
              Number.isInteger(scene.combatState.activeMonsterId) &&
              Number.isInteger(ent?.entityId)
            ) {
              return ent.entityId === scene.combatState.activeMonsterId;
            }
            if (
              Number.isInteger(scene.combatState.activeMonsterIndex) &&
              Number.isInteger(ent?.combatIndex)
            ) {
              return ent.combatIndex === scene.combatState.activeMonsterIndex;
            }
            return false;
          });
          if (idx >= 0) {
            scene.combatState.actorIndex = idx;
          }
        }
      }
      if (typeof scene.updateCombatUi === "function") {
        scene.updateCombatUi();
      }
    }

    if (
      entry.phase === "combat" &&
      scene.__lanCombatId === entry.combatId &&
      scene.combatState?.enCours
    ) {
      startCombatSync();
      sendCombatState();
    }
  };

  const applyCombatEnded = (entry) => {
    if (!entry || !Number.isInteger(entry.combatId)) return;
    if (!shouldApplyCombatEvent(entry.combatId, entry.eventId, entry.combatSeq)) return;
    const stateCombatId = scene?.combatState?.combatId ?? null;
    const shouldEndLocal =
      scene?.combatState?.enCours === true &&
      (Number.isInteger(stateCombatId)
        ? stateCombatId === entry.combatId
        : scene.__lanCombatId === entry.combatId);
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
    if (shouldEndLocal) {
      endCombat(scene);
    }

    const currentMap = getCurrentMapKey();
    if (entry.mapId && entry.mapId === currentMap) {
      refreshMapMonstersFromServer();
    }

    refreshRemoteSprites();
    updateCombatWatchUi();
  };

  const handleCombatJoinReady = (msg) => {
    if (!msg || !msg.combat) return;
    if (!shouldApplyCombatEvent(msg.combat.combatId, msg.eventId, msg.combatSeq)) return;
    const entry = msg.combat;
    applyCombatUpdated(entry);
    const mobEntries = Array.isArray(msg.mobEntries) ? msg.mobEntries : [];
    startJoinCombatPrep(entry, mobEntries);
  };

  return {
    applyCombatCreated,
    applyCombatUpdated,
    applyCombatEnded,
    handleCombatJoinReady,
  };
}
