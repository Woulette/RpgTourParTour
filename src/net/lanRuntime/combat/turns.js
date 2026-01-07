import { getNetIsHost, getNetPlayerId } from "../../../app/session.js";
import { buildTurnOrder } from "../../../features/combat/runtime/state.js";
import { runMonsterTurn } from "../../../features/monsters/ai/ai.js";
import { runSummonTurn } from "../../../features/combat/summons/turn.js";

export function createCombatTurnHandlers(ctx, helpers) {
  const { scene, activeCombats } = ctx;
  const {
    buildLanActorsOrder,
    findActorIndexByPlayerId,
    findNextActorIndexByKind,
  } = helpers;

  const applyCombatTurnStarted = (msg) => {
    const combatId = Number.isInteger(msg?.combatId) ? msg.combatId : null;
    if (!combatId) return;
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
      if (nextIdx >= 0) {
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

    if (targetTour === "monstre" && getNetIsHost()) {
      runSummonTurn(scene, () => runMonsterTurn(scene));
    }
  };

  const applyCombatTurnEnded = (msg) => {
    const combatId = Number.isInteger(msg?.combatId) ? msg.combatId : null;
    if (!combatId) return;
    const entry = activeCombats.get(combatId) || { combatId };
    entry.turn = msg.actorType === "monster" ? "monster" : "player";
    activeCombats.set(combatId, entry);
  };

  return {
    applyCombatTurnStarted,
    applyCombatTurnEnded,
  };
}
