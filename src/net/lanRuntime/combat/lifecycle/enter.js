import { getNetPlayerId } from "../../../../app/session.js";
import { startCombatFromPrep } from "../../../../features/combat/runtime/prep.js";

export function createCombatEnterHandlers({
  ctx,
  helpers,
  prepHandlers,
  syncHandlers,
}) {
  const {
    scene,
    activeCombats,
    remotePlayersData,
    remotePlayers,
    getCurrentMapKey,
    removeWorldMonsterByEntityId,
    refreshRemoteSprites,
    updateCombatWatchUi,
  } = ctx;
  const { buildLanActorsOrder, shouldApplyCombatEvent } = helpers;
  const { syncCombatPlayerAllies } = prepHandlers;
  const { startCombatSync, sendCombatState } = syncHandlers;

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
        scene.combatState.summonActing = false;
      } else if (entry.turn === "summon") {
        scene.combatState.tour = "monstre";
        scene.combatState.summonActing = true;
      } else if (entry.turn === "player") {
        scene.combatState.tour = "joueur";
        scene.combatState.summonActing = false;
      }
      if (Number.isInteger(entry.round)) {
        scene.combatState.round = entry.round;
      }
      if (Number.isInteger(entry.activeSummonId)) {
        scene.combatState.activeSummonId = entry.activeSummonId;
      }
      const lanActors = buildLanActorsOrder(entry);
      if (lanActors) {
        scene.combatState.actors = lanActors;
        if (Number.isInteger(scene.combatState.activePlayerId)) {
          const idx = lanActors.findIndex((a) => {
            if (!a || a.kind !== "joueur") return false;
            const ent = a.entity;
            const id =
              Number.isInteger(ent?.netId)
                ? ent.netId
                : Number.isInteger(ent?.id)
                  ? ent.id
                  : null;
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

  return { applyCombatCreated, applyCombatUpdated };
}
