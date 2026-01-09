import { getNetPlayerId } from "../../../../app/session.js";
import { buildTurnOrder } from "../../../../features/combat/runtime/state.js";
import { runMonsterTurn } from "../../../../features/monsters/ai/ai.js";
import { runSummonTurn } from "../../../../features/combat/summons/turn.js";

export function createCombatTurnStartHandlers(ctx, helpers) {
  const { scene, activeCombats } = ctx;
  const {
    buildLanActorsOrder,
    findActorIndexByPlayerId,
    findNextActorIndexByKind,
    shouldApplyCombatEvent,
    findCombatMonsterByEntityId,
    findCombatMonsterByIndex,
  } = helpers;

  const applyCombatTurnStarted = (msg) => {
    const combatId = Number.isInteger(msg?.combatId) ? msg.combatId : null;
    if (!combatId) return;
    if (!shouldApplyCombatEvent(combatId, msg.eventId, msg.combatSeq)) return;
    const entry = activeCombats.get(combatId) || { combatId };
    entry.turn =
      msg.actorType === "monster"
        ? "monster"
        : msg.actorType === "summon"
          ? "summon"
          : "player";
    if (Array.isArray(msg.actorOrder) && msg.actorOrder.length > 0) {
      entry.actorOrder = msg.actorOrder;
    }
    if (Number.isInteger(msg.round)) entry.round = msg.round;
    if (Number.isInteger(msg.activePlayerId)) {
      entry.activePlayerId = msg.activePlayerId;
    }
    if (Number.isInteger(msg.activeSummonId)) {
      entry.activeSummonId = msg.activeSummonId;
    }
    activeCombats.set(combatId, entry);

    if (scene.__lanCombatId !== combatId) return;
    const state = scene.combatState;
    if (!state || !state.enCours) return;

    const lanEntry = activeCombats.get(combatId);
    const shouldRebuild =
      !Array.isArray(state.actors) ||
      state.actors.length === 0 ||
      (Array.isArray(msg.actorOrder) && msg.actorOrder.length > 0);
    if (shouldRebuild) {
      const lanActors = buildLanActorsOrder(lanEntry);
      if (lanActors) {
        state.actors = lanActors;
      }
    }

    if (Number.isInteger(msg.activePlayerId)) {
      state.activePlayerId = msg.activePlayerId;
      state.activeMonsterId = null;
      state.activeMonsterIndex = null;
      state.activeSummonId = null;
    } else if (
      Number.isInteger(msg.activeMonsterId) ||
      Number.isInteger(msg.activeMonsterIndex)
    ) {
      state.activePlayerId = null;
      if (Number.isInteger(msg.activeMonsterId)) {
        state.activeMonsterId = msg.activeMonsterId;
      }
      if (Number.isInteger(msg.activeMonsterIndex)) {
        state.activeMonsterIndex = msg.activeMonsterIndex;
      }
      state.activeSummonId = null;
    } else if (Number.isInteger(msg.activeSummonId)) {
      state.activePlayerId = null;
      state.activeMonsterId = null;
      state.activeMonsterIndex = null;
      state.activeSummonId = msg.activeSummonId;
    }
    const targetTour =
      msg.actorType === "monster"
        ? "monstre"
        : msg.actorType === "summon"
          ? "monstre"
          : "joueur";
    if (!Array.isArray(state.actors) || state.actors.length === 0) {
      buildTurnOrder(scene);
    }

    state.summonActing = msg.actorType === "summon";

    if (targetTour === "joueur") {
      const idx = findActorIndexByPlayerId(state.actors, msg.activePlayerId);
      if (idx >= 0) {
        state.actorIndex = idx;
      }
      state.tour = "joueur";
      state.monstre = null;
      state.summonActing = false;
      if (
        Number.isInteger(msg.activePlayerId) &&
        msg.activePlayerId === getNetPlayerId()
      ) {
        state.paRestants = state.paBaseJoueur;
        state.pmRestants = state.pmBaseJoueur;
        state.castsThisTurn = {};
        state.castsThisTurnTargets = {};
        if (state.joueur?.updateHudApMp) {
          state.joueur.updateHudApMp(state.paRestants, state.pmRestants);
        }
      }
    } else {
      const nextIdx = findNextActorIndexByKind(
        state.actors,
        state.actorIndex,
        "monstre"
      );
      let targetMonster = null;
      if (Number.isInteger(msg.activeMonsterId)) {
        targetMonster = findCombatMonsterByEntityId(msg.activeMonsterId);
      } else if (Number.isInteger(msg.activeMonsterIndex)) {
        targetMonster = findCombatMonsterByIndex(msg.activeMonsterIndex);
      }
      if (!targetMonster && Number.isInteger(msg.activeSummonId)) {
        targetMonster =
          Array.isArray(scene.combatSummons)
            ? scene.combatSummons.find((s) => s && s.id === msg.activeSummonId) ||
              null
            : null;
      }
      if (targetMonster) {
        state.monstre = targetMonster;
        const idx = Array.isArray(state.actors)
          ? state.actors.findIndex(
              (a) => a?.kind === "monstre" && a.entity === targetMonster
            )
          : -1;
        if (idx >= 0) state.actorIndex = idx;
        if (msg.actorType === "summon") {
          const sIdx = Array.isArray(state.actors)
            ? state.actors.findIndex(
                (a) => a?.kind === "invocation" && a.entity === targetMonster
              )
            : -1;
          if (sIdx >= 0) state.actorIndex = sIdx;
        }
      } else if (nextIdx >= 0) {
        state.actorIndex = nextIdx;
        state.monstre = state.actors[nextIdx].entity || null;
      } else {
        state.monstre =
          state.monstre ||
          state.actors?.find((a) => a?.kind === "monstre")?.entity ||
          null;
      }
      state.tour = "monstre";
      state.paRestants = state.monstre?.stats?.pa ?? state.paBaseMonstre;
      state.pmRestants = state.monstre?.stats?.pm ?? state.pmBaseMonstre;
      state.castsThisTurn = {};
      state.castsThisTurnTargets = {};
    }
    if (Number.isInteger(msg.round)) {
      state.round = msg.round;
    }

    if (typeof scene.updateCombatUi === "function") {
      scene.updateCombatUi();
    }

    if (targetTour === "monstre") {
      if (!scene.__lanCombatId) {
        runSummonTurn(scene, () => runMonsterTurn(scene));
      }
    }
  };

  return { applyCombatTurnStarted };
}
