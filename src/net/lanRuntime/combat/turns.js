import { getNetClient, getNetPlayerId } from "../../../app/session.js";
import { buildTurnOrder } from "../../../features/combat/runtime/state.js";
import { runMonsterTurn } from "../../../features/monsters/ai/ai.js";
import { runSummonTurn } from "../../../features/combat/summons/turn.js";

export function createCombatTurnHandlers(ctx, helpers) {
  const { scene, activeCombats } = ctx;
  const {
    buildLanActorsOrder,
    findActorIndexByPlayerId,
    findNextActorIndexByKind,
    shouldApplyCombatEvent,
    findCombatMonsterByEntityId,
    findCombatMonsterByIndex,
    computeCombatChecksum,
  } = helpers;

  const applyCombatTurnStarted = (msg) => {
    const combatId = Number.isInteger(msg?.combatId) ? msg.combatId : null;
    if (!combatId) return;
    if (!shouldApplyCombatEvent(combatId, msg.eventId, msg.combatSeq)) return;
    const entry = activeCombats.get(combatId) || { combatId };
    entry.turn = msg.actorType === "monster" ? "monster" : "player";
    if (Number.isInteger(msg.round)) entry.round = msg.round;
    if (Number.isInteger(msg.activePlayerId)) {
      entry.activePlayerId = msg.activePlayerId;
    }
    activeCombats.set(combatId, entry);

    if (scene.__lanCombatId !== combatId) return;
    const state = scene.combatState;
    if (!state || !state.enCours) return;

    const lanEntry = activeCombats.get(combatId);
    const lanActors = buildLanActorsOrder(lanEntry);
    if (lanActors) {
      state.actors = lanActors;
    }

    if (Number.isInteger(msg.activePlayerId)) {
      state.activePlayerId = msg.activePlayerId;
    }
    const targetTour = msg.actorType === "monster" ? "monstre" : "joueur";
    if (!Array.isArray(state.actors) || state.actors.length === 0) {
      buildTurnOrder(scene);
    }

    if (targetTour === "joueur") {
      const idx = findActorIndexByPlayerId(state.actors, msg.activePlayerId);
      if (idx >= 0) {
        state.actorIndex = idx;
      }
      state.tour = "joueur";
      state.monstre = null;
      if (Number.isInteger(msg.activePlayerId) && msg.activePlayerId === getNetPlayerId()) {
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
      if (targetMonster) {
        state.monstre = targetMonster;
        const idx = Array.isArray(state.actors)
          ? state.actors.findIndex((a) => a?.kind === "monstre" && a.entity === targetMonster)
          : -1;
        if (idx >= 0) state.actorIndex = idx;
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

  const applyCombatTurnEnded = (msg) => {
    const combatId = Number.isInteger(msg?.combatId) ? msg.combatId : null;
    if (!combatId) return;
    if (!shouldApplyCombatEvent(combatId, msg.eventId, msg.combatSeq)) return;
    const entry = activeCombats.get(combatId) || { combatId };
    entry.turn = msg.actorType === "monster" ? "monster" : "player";
    activeCombats.set(combatId, entry);

    if (scene.__lanCombatId !== combatId) return;
    const state = scene.combatState;
    if (!state || !state.enCours) return;
    const client = getNetClient();
    const playerId = getNetPlayerId();
    if (!client || !playerId) return;

    let attempts = 0;
    const trySend = () => {
      const moving =
        state.joueur?.isMoving ||
        state.joueur?.__lanMoveTween ||
        state.joueur?.currentMoveTween ||
        (Array.isArray(scene.combatMonsters) &&
          scene.combatMonsters.some(
            (m) => m?.isMoving || m?.__lanCombatMoveTween || m?.currentMoveTween
          )) ||
        (Array.isArray(scene.combatAllies) &&
          scene.combatAllies.some(
            (a) => a?.isMoving || a?.__lanMoveTween || a?.currentMoveTween
          ));
      if (moving && attempts < 5) {
        attempts += 1;
        setTimeout(trySend, 120);
        return;
      }
      const hash = computeCombatChecksum();
      client.sendCmd("CmdCombatChecksum", {
        playerId,
        combatId,
        hash,
      });
    };

    setTimeout(trySend, 120);
  };

  return {
    applyCombatTurnStarted,
    applyCombatTurnEnded,
  };
}
