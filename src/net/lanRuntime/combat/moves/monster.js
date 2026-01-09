export function createCombatMonsterMoveHandlers(ctx, helpers) {
  const { scene, getCurrentMapKey } = ctx;
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
    const summonId = Number.isInteger(msg.summonId) ? msg.summonId : null;
    const monster = entityId ? findCombatMonsterByEntityId(entityId) : null;
    const monsterFallback =
      !monster && combatIndex !== null ? findCombatMonsterByIndex(combatIndex) : null;
    const summon =
      !monster && !monsterFallback && summonId !== null
        ? Array.isArray(scene.combatSummons)
          ? scene.combatSummons.find((s) => s && s.id === summonId) || null
          : null
        : null;
    const target = monster || monsterFallback || summon;
    if (!target) {
      debugLog("EvCombatMonsterMoveStart drop: no target", {
        combatId: msg.combatId ?? null,
        entityId,
        combatIndex,
        summonId,
        mapId: msg.mapId ?? null,
        monsters: Array.isArray(scene.combatMonsters)
          ? scene.combatMonsters.length
          : null,
      });
      return;
    }

    if (Number.isInteger(msg.seq)) {
      const lastSeq = target.__lanCombatLastMoveSeq || 0;
      if (msg.seq <= lastSeq) {
        debugLog("EvCombatMonsterMoveStart drop: seq", {
          entityId,
          combatIndex,
          summonId,
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
        summonId,
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
        summonId,
      });
      return;
    }

    debugLog("EvCombatMonsterMoveStart apply", {
      combatId: msg.combatId ?? null,
      entityId,
      combatIndex,
      summonId,
      steps: steps.length,
      targetId: target.entityId ?? null,
      targetIndex: target.combatIndex ?? null,
    });
    moveCombatMonsterAlongPathNetwork(target, steps);
  };

  return { handleCombatMonsterMoveStart };
}
