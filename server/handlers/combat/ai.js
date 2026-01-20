const { createAiUtils } = require("./ai/utils");
const { createAiTargets } = require("./ai/targets");
const { createAiOrder } = require("./ai/order");

function createCombatAiHandlers(ctx, helpers) {
  const {
    state,
    broadcast,
    getMonsterDef,
    getSpellDef,
    rollSpellDamage,
    getMonsterCombatStats,
    debugLog,
    serializeActorOrder,
  } = ctx;
  const {
    ensureCombatSnapshot,
    upsertSnapshotMonster,
    upsertSnapshotSummon,
    applyDamageToCombatSnapshot,
    resolveSpellCast,
  } = helpers;

  const COMBAT_STEP_MS = 350;

  const aiUtils = createAiUtils({
    state,
    getMonsterDef,
    getMonsterCombatStats,
  });
  const {
    getMonsterStats,
    getPlayerCombatStats,
    isAliveMonster,
    isAlivePlayer,
    isAliveSummon,
    compareByInitLevel,
    getActorKey,
  } = aiUtils;

  const aiTargets = createAiTargets({
    isAlivePlayer,
    isAliveMonster,
    isAliveSummon,
  });
  const {
    buildBlockedTiles,
    findNearestPlayer,
    findNearestMonster,
    pickAdjacentTargetTile,
    buildMovePath,
  } = aiTargets;

  const aiOrder = createAiOrder({
    state,
    ensureCombatSnapshot,
    getMonsterStats,
    getPlayerCombatStats,
    isAlivePlayer,
    isAliveMonster,
    isAliveSummon,
    compareByInitLevel,
    getActorKey,
  });
  const { buildCombatActorOrder } = aiOrder;


  const runMonsterAiTurn = (combat, onComplete) => {
    if (!combat || combat.phase !== "combat") {
      onComplete?.();
      return;
    }
    if (combat.aiRunning) return;
    const snapshot = ensureCombatSnapshot(combat);
    if (!snapshot) {
      onComplete?.();
      return;
    }
    const bounds = state.mapMeta[combat.mapId];
    if (!bounds) {
      onComplete?.();
      return;
    }

    const actors = Array.isArray(combat.actorOrder) ? combat.actorOrder : buildCombatActorOrder(combat);
    const actorIndex = Number.isInteger(combat.actorIndex) ? combat.actorIndex : 0;
    const actor = actors[actorIndex];
    if (!actor || actor.kind !== "monstre") {
      onComplete?.();
      return;
    }

    const monsterEntry =
      (Number.isInteger(actor.entityId)
        ? snapshot.monsters.find((m) => m && m.entityId === actor.entityId)
        : null) ||
      (Number.isInteger(actor.combatIndex)
        ? snapshot.monsters.find((m) => m && m.combatIndex === actor.combatIndex)
        : null) ||
      null;

    if (!monsterEntry || !isAliveMonster(monsterEntry)) {
      onComplete?.();
      return;
    }

    const monsterId = monsterEntry.monsterId || actor.monsterId;
    const stats = getMonsterStats(monsterId);
    const fromX = Number.isInteger(monsterEntry.tileX) ? monsterEntry.tileX : null;
    const fromY = Number.isInteger(monsterEntry.tileY) ? monsterEntry.tileY : null;
    if (fromX === null || fromY === null) {
      onComplete?.();
      return;
    }

    const target = findNearestPlayer(snapshot, fromX, fromY);
    if (!target) {
      onComplete?.();
      return;
    }

    const blocked = buildBlockedTiles(snapshot, monsterEntry.entityId);
    const targetTile = pickAdjacentTargetTile(target, fromX, fromY, bounds, blocked);
    const path = targetTile
      ? buildMovePath(fromX, fromY, targetTile.x, targetTile.y, stats.pm, bounds, blocked)
      : [];

    const doFinish = () => {
      combat.aiRunning = false;
      onComplete?.();
    };

    const afterMove = () => {
      const mx = Number.isInteger(monsterEntry.tileX) ? monsterEntry.tileX : fromX;
      const my = Number.isInteger(monsterEntry.tileY) ? monsterEntry.tileY : fromY;
      const tx = Number.isInteger(target.tileX) ? target.tileX : null;
      const ty = Number.isInteger(target.tileY) ? target.tileY : null;
      if (tx === null || ty === null) {
        doFinish();
        return;
      }
      const dist = Math.abs(tx - mx) + Math.abs(ty - my);
      const def = typeof getMonsterDef === "function" ? getMonsterDef(monsterId) : null;
      const spellId = Array.isArray(def?.spells) ? def.spells[0] : null;
      const spell = spellId ? getSpellDef(spellId) : null;
      const rangeMin = Number.isFinite(spell?.rangeMin) ? spell.rangeMin : 1;
      const rangeMax = Number.isFinite(spell?.rangeMax) ? spell.rangeMax : 1;

      if (spell && dist >= rangeMin && dist <= rangeMax) {
        if (typeof resolveSpellCast === "function") {
          resolveSpellCast(
            combat,
            {
              kind: "monster",
              entityId: Number.isInteger(monsterEntry.entityId) ? monsterEntry.entityId : null,
              combatIndex: Number.isInteger(monsterEntry.combatIndex)
                ? monsterEntry.combatIndex
                : null,
            },
            spellId,
            tx,
            ty
          );
          if (combat.stateSnapshot) {
            broadcast({
              t: "EvCombatState",
              combatId: combat.id,
              mapId: combat.mapId || null,
              turn: combat.turn || null,
              round: Number.isInteger(combat.round) ? combat.round : null,
              activePlayerId: Number.isInteger(combat.activePlayerId)
                ? combat.activePlayerId
                : null,
              activeMonsterId: Number.isInteger(combat.activeMonsterId)
                ? combat.activeMonsterId
                : null,
              activeMonsterIndex: Number.isInteger(combat.activeMonsterIndex)
                ? combat.activeMonsterIndex
                : null,
              activeSummonId: Number.isInteger(combat.activeSummonId)
                ? combat.activeSummonId
                : null,
              actorOrder: serializeActorOrder ? serializeActorOrder(combat) : undefined,
              players: Array.isArray(combat.stateSnapshot.players)
                ? combat.stateSnapshot.players
                : [],
              monsters: Array.isArray(combat.stateSnapshot.monsters)
                ? combat.stateSnapshot.monsters
                : [],
              summons: Array.isArray(combat.stateSnapshot.summons)
                ? combat.stateSnapshot.summons
                : [],
            });
          }
        } else {
          const damage = rollSpellDamage(spell);
          broadcast({
            t: "EvSpellCast",
            combatId: combat.id,
            mapId: combat.mapId || null,
            casterKind: "monster",
            casterId: Number.isInteger(monsterEntry.entityId) ? monsterEntry.entityId : null,
            casterIndex: Number.isInteger(monsterEntry.combatIndex) ? monsterEntry.combatIndex : null,
            spellId,
            targetX: tx,
            targetY: ty,
            authoritative: true,
          });
          broadcast({
            t: "EvDamageApplied",
            combatId: combat.id,
            source: "monster",
            casterId: Number.isInteger(monsterEntry.entityId) ? monsterEntry.entityId : null,
            spellId,
            targetX: tx,
            targetY: ty,
            targetKind: "player",
            targetId: Number.isInteger(target.playerId) ? target.playerId : null,
            damage,
          });
          applyDamageToCombatSnapshot(combat, {
            targetKind: "player",
            targetId: Number.isInteger(target.playerId) ? target.playerId : null,
            targetX: tx,
            targetY: ty,
            damage,
          });
        }
      }

      doFinish();
    };

    combat.aiRunning = true;

    if (path.length > 0) {
      const last = path[path.length - 1];
      upsertSnapshotMonster(combat, {
        entityId: Number.isInteger(monsterEntry.entityId) ? monsterEntry.entityId : null,
        combatIndex: Number.isInteger(monsterEntry.combatIndex) ? monsterEntry.combatIndex : null,
        monsterId,
        tileX: last.x,
        tileY: last.y,
      });
      combat.aiMoveSeq = Number.isInteger(combat.aiMoveSeq) ? combat.aiMoveSeq + 1 : 1;
      broadcast({
        t: "EvCombatMonsterMoveStart",
        combatId: combat.id,
        mapId: combat.mapId || null,
        entityId: Number.isInteger(monsterEntry.entityId) ? monsterEntry.entityId : null,
        combatIndex: Number.isInteger(monsterEntry.combatIndex) ? monsterEntry.combatIndex : null,
        seq: combat.aiMoveSeq,
        path,
      });
      const delayMs = path.length * COMBAT_STEP_MS;
      if (combat.aiTimer) {
        clearTimeout(combat.aiTimer);
      }
      combat.aiTimer = setTimeout(afterMove, delayMs);
      return;
    }

    afterMove();
  };

  return {
    buildCombatActorOrder,
    runMonsterAiTurn,
    runSummonAiTurn: (combat, onComplete) => {
      if (!combat || combat.phase !== "combat") {
        onComplete?.();
        return;
      }
      if (combat.aiRunning) return;
      const snapshot = ensureCombatSnapshot(combat);
      if (!snapshot) {
        onComplete?.();
        return;
      }
      const bounds = state.mapMeta[combat.mapId];
      if (!bounds) {
        onComplete?.();
        return;
      }

      const actors = Array.isArray(combat.actorOrder) ? combat.actorOrder : buildCombatActorOrder(combat);
      const actorIndex = Number.isInteger(combat.actorIndex) ? combat.actorIndex : 0;
      const actor = actors[actorIndex];
      if (!actor || actor.kind !== "invocation") {
        onComplete?.();
        return;
      }

      const summonEntry =
        (Number.isInteger(actor.summonId)
          ? snapshot.summons?.find((s) => s && s.summonId === actor.summonId)
          : null) || null;
      if (!summonEntry || !isAliveSummon(summonEntry)) {
        onComplete?.();
        return;
      }

      const stats = getMonsterStats(summonEntry.monsterId, summonEntry.level ?? null);
      const fromX = Number.isInteger(summonEntry.tileX) ? summonEntry.tileX : null;
      const fromY = Number.isInteger(summonEntry.tileY) ? summonEntry.tileY : null;
      if (fromX === null || fromY === null) {
        onComplete?.();
        return;
      }

      const target = findNearestMonster(snapshot, fromX, fromY);
      if (!target) {
        onComplete?.();
        return;
      }

      const blocked = buildBlockedTiles(snapshot);
      const targetTile = pickAdjacentTargetTile(target, fromX, fromY, bounds, blocked);
      const path = targetTile
        ? buildMovePath(fromX, fromY, targetTile.x, targetTile.y, stats.pm, bounds, blocked)
        : [];

      const doFinish = () => {
        combat.aiRunning = false;
        onComplete?.();
      };

      const afterMove = () => {
        const sx = Number.isInteger(summonEntry.tileX) ? summonEntry.tileX : fromX;
        const sy = Number.isInteger(summonEntry.tileY) ? summonEntry.tileY : fromY;
        const tx = Number.isInteger(target.tileX) ? target.tileX : null;
        const ty = Number.isInteger(target.tileY) ? target.tileY : null;
        if (tx === null || ty === null) {
          doFinish();
          return;
        }
        const dist = Math.abs(tx - sx) + Math.abs(ty - sy);
        const def = typeof getMonsterDef === "function" ? getMonsterDef(summonEntry.monsterId) : null;
        const spellId = Array.isArray(def?.spells) ? def.spells[0] : null;
        const spell = spellId ? getSpellDef(spellId) : null;
        const rangeMin = Number.isFinite(spell?.rangeMin) ? spell.rangeMin : 1;
        const rangeMax = Number.isFinite(spell?.rangeMax) ? spell.rangeMax : 1;

        if (spell && dist >= rangeMin && dist <= rangeMax) {
          if (typeof resolveSpellCast === "function") {
            resolveSpellCast(
              combat,
              {
                kind: "summon",
                summonId: Number.isInteger(summonEntry.summonId) ? summonEntry.summonId : null,
              },
              spellId,
              tx,
              ty
            );
            if (combat.stateSnapshot) {
              broadcast({
                t: "EvCombatState",
                combatId: combat.id,
                mapId: combat.mapId || null,
                turn: combat.turn || null,
                round: Number.isInteger(combat.round) ? combat.round : null,
                activePlayerId: Number.isInteger(combat.activePlayerId)
                  ? combat.activePlayerId
                  : null,
                activeMonsterId: Number.isInteger(combat.activeMonsterId)
                  ? combat.activeMonsterId
                  : null,
                activeMonsterIndex: Number.isInteger(combat.activeMonsterIndex)
                  ? combat.activeMonsterIndex
                  : null,
                activeSummonId: Number.isInteger(combat.activeSummonId)
                  ? combat.activeSummonId
                  : null,
                actorOrder: serializeActorOrder ? serializeActorOrder(combat) : undefined,
                players: Array.isArray(combat.stateSnapshot.players)
                  ? combat.stateSnapshot.players
                  : [],
                monsters: Array.isArray(combat.stateSnapshot.monsters)
                  ? combat.stateSnapshot.monsters
                  : [],
                summons: Array.isArray(combat.stateSnapshot.summons)
                  ? combat.stateSnapshot.summons
                  : [],
              });
            }
          } else {
            const damage = rollSpellDamage(spell);
            broadcast({
              t: "EvSpellCast",
              combatId: combat.id,
              mapId: combat.mapId || null,
              casterKind: "summon",
              casterId: Number.isInteger(summonEntry.summonId) ? summonEntry.summonId : null,
              spellId,
              targetX: tx,
              targetY: ty,
              authoritative: true,
            });
            broadcast({
              t: "EvDamageApplied",
              combatId: combat.id,
              source: "summon",
              casterId: Number.isInteger(summonEntry.summonId) ? summonEntry.summonId : null,
              spellId,
              targetX: tx,
              targetY: ty,
              targetKind: "monster",
              targetId: Number.isInteger(target.entityId) ? target.entityId : null,
              targetIndex: Number.isInteger(target.combatIndex) ? target.combatIndex : null,
              damage,
            });
            applyDamageToCombatSnapshot(combat, {
              targetKind: "monster",
              targetId: Number.isInteger(target.entityId) ? target.entityId : null,
              targetIndex: Number.isInteger(target.combatIndex) ? target.combatIndex : null,
              targetX: tx,
              targetY: ty,
              damage,
            });
          }
        }

        doFinish();
      };

      combat.aiRunning = true;

      if (path.length > 0) {
        const last = path[path.length - 1];
        if (typeof upsertSnapshotSummon === "function") {
          upsertSnapshotSummon(combat, {
            summonId: summonEntry.summonId,
            ownerPlayerId: summonEntry.ownerPlayerId,
            monsterId: summonEntry.monsterId,
            tileX: last.x,
            tileY: last.y,
            hp: summonEntry.hp,
            hpMax: summonEntry.hpMax,
            level: summonEntry.level,
            statusEffects: summonEntry.statusEffects,
          });
        }
        combat.aiSummonMoveSeq = Number.isInteger(combat.aiSummonMoveSeq)
          ? combat.aiSummonMoveSeq + 1
          : 1;
        broadcast({
          t: "EvCombatMonsterMoveStart",
          combatId: combat.id,
          mapId: combat.mapId || null,
          summonId: Number.isInteger(summonEntry.summonId) ? summonEntry.summonId : null,
          seq: combat.aiSummonMoveSeq,
          path,
        });
        if (combat.stateSnapshot) {
          broadcast({
            t: "EvCombatState",
            combatId: combat.id,
            mapId: combat.mapId || null,
            turn: combat.turn || null,
            round: Number.isInteger(combat.round) ? combat.round : null,
            activePlayerId: Number.isInteger(combat.activePlayerId)
              ? combat.activePlayerId
              : null,
            activeMonsterId: Number.isInteger(combat.activeMonsterId)
              ? combat.activeMonsterId
              : null,
            activeMonsterIndex: Number.isInteger(combat.activeMonsterIndex)
              ? combat.activeMonsterIndex
              : null,
            activeSummonId: Number.isInteger(combat.activeSummonId)
              ? combat.activeSummonId
              : null,
            actorOrder: serializeActorOrder ? serializeActorOrder(combat) : undefined,
            players: Array.isArray(combat.stateSnapshot.players)
              ? combat.stateSnapshot.players
              : [],
            monsters: Array.isArray(combat.stateSnapshot.monsters)
              ? combat.stateSnapshot.monsters
              : [],
            summons: Array.isArray(combat.stateSnapshot.summons)
              ? combat.stateSnapshot.summons
              : [],
          });
        }
        const delayMs = path.length * COMBAT_STEP_MS;
        if (combat.aiTimer) {
          clearTimeout(combat.aiTimer);
        }
        combat.aiTimer = setTimeout(afterMove, delayMs);
        return;
      }

      afterMove();
    },
  };
}

module.exports = {
  createCombatAiHandlers,
};
