import { getNetClient, getNetPlayerId } from "../../../../app/session.js";

export function createCombatTurnEndHandlers(ctx, helpers) {
  const { scene, activeCombats } = ctx;
  const { shouldApplyCombatEvent, computeCombatChecksum } = helpers;

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

  return { applyCombatTurnEnded };
}
