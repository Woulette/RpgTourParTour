import { getNetPlayerId } from "../../../../app/session.js";
import { movePlayerAlongPathNetworkCombat } from "../../../../entities/playerMovement.js";

export function createCombatPlayerMoveHandlers(ctx, helpers) {
  const { scene, player, stopEntityMovement } = ctx;
  const { shouldApplyCombatEvent } = helpers;

  const handleCombatMoveStart = (msg) => {
    if (!msg || !player) return;
    if (!shouldApplyCombatEvent(msg.combatId, msg.eventId, msg.combatSeq)) return;
    const localId = getNetPlayerId();
    if (!localId || !Number.isInteger(msg.playerId)) return;
    const isLocal = msg.playerId === localId;
    const ally = !isLocal
      ? (Array.isArray(scene.combatAllies)
          ? scene.combatAllies.find(
              (entry) => entry?.isPlayerAlly && Number(entry.netId) === msg.playerId
            )
          : null)
      : null;
    const mover = isLocal ? player : ally;
    if (!mover) return;
    if (Number.isInteger(msg.combatId) && scene.__lanCombatId) {
      if (msg.combatId !== scene.__lanCombatId) return;
    }
    const inCombatOrPrep =
      (scene.combatState && scene.combatState.enCours) ||
      (scene.prepState && scene.prepState.actif);
    if (!inCombatOrPrep) return;
    const mapForMove = scene.combatMap || scene.map;
    const layerForMove = scene.combatGroundLayer || scene.groundLayer;
    if (!mapForMove || !layerForMove) return;

    const raw = Array.isArray(msg.path) ? msg.path : [];
    let steps = raw
      .map((step) => ({
        x: Number.isInteger(step?.x) ? step.x : null,
        y: Number.isInteger(step?.y) ? step.y : null,
      }))
      .filter((step) => step.x !== null && step.y !== null);
    if (steps.length === 0) return;

    if (
      typeof mover.currentTileX === "number" &&
      typeof mover.currentTileY === "number"
    ) {
      const first = steps[0];
      if (
        first &&
        first.x === mover.currentTileX &&
        first.y === mover.currentTileY
      ) {
        steps = steps.slice(1);
      }
    }
    if (steps.length === 0) return;

    stopEntityMovement(mover);
    movePlayerAlongPathNetworkCombat(
      scene,
      mover,
      mapForMove,
      layerForMove,
      steps,
      msg.moveCost
    );
  };

  return { handleCombatMoveStart };
}
