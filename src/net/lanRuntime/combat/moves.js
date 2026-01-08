import { getNetPlayerId } from "../../../app/session.js";
import { movePlayerAlongPathNetworkCombat } from "../../../entities/playerMovement.js";

export function createCombatMoveHandlers(ctx, helpers) {
  const { scene, player, getCurrentMapKey, stopEntityMovement } = ctx;
  const {
    findCombatMonsterByEntityId,
    findCombatMonsterByIndex,
    moveCombatMonsterAlongPathNetwork,
    shouldApplyCombatEvent,
  } = helpers;
  const debugLog = (...args) => {
    if (
      typeof window === "undefined" ||
      (window.LAN_COMBAT_DEBUG !== true && window.LAN_COMBAT_DEBUG !== "1")
    ) {
      return;
    }
    // eslint-disable-next-line no-console
    console.log("[LAN][Combat]", ...args);
  };

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

  const handleCombatMonsterMoveStart = (msg) => {
    if (!msg) return;
    if (!shouldApplyCombatEvent(msg.combatId, msg.eventId, msg.combatSeq)) return;
    if (Number.isInteger(msg.combatId) && scene.__lanCombatId) {
      if (msg.combatId !== scene.__lanCombatId) {
        debugLog("EvCombatMonsterMoveStart drop: combatId mismatch", {
          msgCombatId: msg.combatId,
          localCombatId: scene.__lanCombatId,
        });
        return;
      }
    }
    const mapId = typeof msg.mapId === "string" ? msg.mapId : null;
    if (mapId) {
      const currentMap = getCurrentMapKey();
      if (currentMap && mapId !== currentMap) {
        debugLog("EvCombatMonsterMoveStart drop: map mismatch", {
          msgMapId: mapId,
          currentMap,
        });
        return;
      }
    }

    const entityId = Number.isInteger(msg.entityId) ? msg.entityId : null;
    const combatIndex = Number.isInteger(msg.combatIndex) ? msg.combatIndex : null;
    const monster = entityId ? findCombatMonsterByEntityId(entityId) : null;
    const monsterFallback =
      !monster && combatIndex !== null
        ? findCombatMonsterByIndex(combatIndex)
        : null;
    const target = monster || monsterFallback;
    if (!target) {
      debugLog("EvCombatMonsterMoveStart drop: no target", {
        combatId: msg.combatId ?? null,
        entityId,
        combatIndex,
        mapId: msg.mapId ?? null,
        monsters: Array.isArray(scene.combatMonsters) ? scene.combatMonsters.length : null,
      });
      return;
    }

    if (Number.isInteger(msg.seq)) {
      const lastSeq = target.__lanCombatLastMoveSeq || 0;
      if (msg.seq <= lastSeq) {
        debugLog("EvCombatMonsterMoveStart drop: seq", {
          entityId,
          combatIndex,
          msgSeq: msg.seq,
          lastSeq,
        });
        return;
      }
      target.__lanCombatLastMoveSeq = msg.seq;
    }

    const raw = Array.isArray(msg.path) ? msg.path : [];
    let steps = raw
      .map((step) => ({
        x: Number.isInteger(step?.x) ? step.x : null,
        y: Number.isInteger(step?.y) ? step.y : null,
      }))
      .filter((step) => step.x !== null && step.y !== null);
    if (steps.length === 0) {
      debugLog("EvCombatMonsterMoveStart drop: empty path", {
        entityId,
        combatIndex,
      });
      return;
    }

    const first = steps[0];
    if (
      first &&
      Number.isInteger(target.tileX) &&
      Number.isInteger(target.tileY) &&
      first.x === target.tileX &&
      first.y === target.tileY
    ) {
      steps = steps.slice(1);
    }
    if (steps.length === 0) {
      debugLog("EvCombatMonsterMoveStart drop: trimmed path empty", {
        entityId,
        combatIndex,
      });
      return;
    }

    debugLog("EvCombatMonsterMoveStart apply", {
      combatId: msg.combatId ?? null,
      entityId,
      combatIndex,
      steps: steps.length,
      targetId: target.entityId ?? null,
      targetIndex: target.combatIndex ?? null,
    });
    moveCombatMonsterAlongPathNetwork(target, steps);
  };

  return {
    handleCombatMoveStart,
    handleCombatMonsterMoveStart,
  };
}
