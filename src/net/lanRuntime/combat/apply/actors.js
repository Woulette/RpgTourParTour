import { getNetPlayerId } from "../../../../app/session.js";

export function applyCombatActorsState({
  scene,
  activeCombats,
  remotePlayersData,
  buildLanActorsOrder,
  state,
  localPlayer,
  msg,
}) {
  if (!state?.enCours || !Number.isInteger(msg.combatId)) return;
  let resolvedActors = null;
  if (Array.isArray(msg.actorOrder) && msg.actorOrder.length > 0) {
    const combatEntry = activeCombats.get(msg.combatId) || { combatId: msg.combatId };
    combatEntry.actorOrder = msg.actorOrder;
    activeCombats.set(msg.combatId, combatEntry);
    const localId = getNetPlayerId();
    const placeholderCache =
      scene.__lanCombatPlaceholders || (scene.__lanCombatPlaceholders = new Map());
    const actors = [];
    msg.actorOrder.forEach((entry) => {
      if (!entry || !entry.kind) return;
      if (entry.kind === "joueur") {
        let ent = null;
        if (localId && entry.playerId === localId) {
          ent = localPlayer;
        } else if (Array.isArray(scene.combatAllies)) {
          ent =
            scene.combatAllies.find(
              (ally) => ally?.isPlayerAlly && Number(ally.netId) === entry.playerId
            ) || null;
        }
        if (!ent && Number.isInteger(entry.playerId)) {
          const cached = placeholderCache.get(entry.playerId) || null;
          if (cached) {
            ent = cached;
          } else {
            const remote = remotePlayersData?.get(entry.playerId) || {};
            const hp = Number.isFinite(remote.combatHp)
              ? remote.combatHp
              : Number.isFinite(remote.hp)
                ? remote.hp
                : Number.isFinite(remote.combatHpMax)
                  ? remote.combatHpMax
                  : 1;
            const hpMax = Number.isFinite(remote.combatHpMax)
              ? remote.combatHpMax
              : Number.isFinite(remote.hpMax)
                ? remote.hpMax
                : Number.isFinite(remote.combatHp)
                  ? remote.combatHp
                  : 1;
            const placeholder = {
              isCombatAlly: true,
              isPlayerAlly: true,
              isRemote: true,
              netId: entry.playerId,
              id: entry.playerId,
              classId: remote.classId || "archer",
              displayName: remote.displayName || `Joueur ${entry.playerId}`,
              stats: { hp, hpMax },
            };
            placeholderCache.set(entry.playerId, placeholder);
            ent = placeholder;
          }
        }
        if (ent) actors.push({ kind: "joueur", entity: ent });
        return;
      }
      if (entry.kind === "monstre") {
        let ent = null;
        if (Number.isInteger(entry.entityId) && Array.isArray(scene.combatMonsters)) {
          ent =
            scene.combatMonsters.find((m) => m && m.entityId === entry.entityId) || null;
        }
        if (!ent && Number.isInteger(entry.combatIndex) && Array.isArray(scene.combatMonsters)) {
          ent = scene.combatMonsters[entry.combatIndex] || null;
        }
        if (ent) actors.push({ kind: "monstre", entity: ent });
      }
    });
    if (actors.length > 0) {
      resolvedActors = actors;
      if (!scene.__lanCombatActorsCache) {
        scene.__lanCombatActorsCache = new Map();
      }
      scene.__lanCombatActorsCache.set(msg.combatId, actors);
    }
  }

  if (!resolvedActors) {
    const entry = activeCombats?.get(msg.combatId) || null;
    resolvedActors = entry ? buildLanActorsOrder(entry) : null;
  }

  if (!resolvedActors) return;
  state.actors = resolvedActors;
  if (Number.isInteger(state.activePlayerId)) {
    const idx = resolvedActors.findIndex((a) => {
      if (!a || a.kind !== "joueur") return false;
      const ent = a.entity;
      const id =
        Number.isInteger(ent?.netId) ? ent.netId : Number.isInteger(ent?.id) ? ent.id : null;
      return id === state.activePlayerId;
    });
    if (idx >= 0) {
      state.actorIndex = idx;
    }
  } else if (
    Number.isInteger(state.activeMonsterId) ||
    Number.isInteger(state.activeMonsterIndex)
  ) {
    const idx = resolvedActors.findIndex((a) => {
      if (!a || a.kind !== "monstre") return false;
      const ent = a.entity;
      if (Number.isInteger(state.activeMonsterId) && Number.isInteger(ent?.entityId)) {
        return ent.entityId === state.activeMonsterId;
      }
      if (Number.isInteger(state.activeMonsterIndex) && Number.isInteger(ent?.combatIndex)) {
        return ent.combatIndex === state.activeMonsterIndex;
      }
      return false;
    });
    if (idx >= 0) {
      state.actorIndex = idx;
    }
  }
}
