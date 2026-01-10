const { getMapCollision } = require("./mapCollision");
const {
  clampNonNegative,
  applyFixedResistanceToDamage,
  applyShieldToDamage,
  computeSpellDamageWithCrit,
  ensureEryonChargeState,
  applyEryonElementAfterCast,
  resolveDamageSpell,
} = require("./spells/utils");
const {
  buildPatternTiles,
  isAlive,
  getOccupiedMap,
  findTargetAtTile,
  isTileAvailable,
  hasLineOfSight,
} = require("./spells/validate");
const { createSpellResolveHelpers } = require("./spells/resolve");
const { createSpellEffectsHelpers } = require("./spells/effects");

function createSpellResolver(ctx, helpers) {
  const {
    state,
    broadcast,
    getSpellDef,
    getMonsterDef,
    getMonsterCombatStats,
    getNextSummonId,
    isMonsterCapturable,
  } = ctx;
  const { ensureCombatSnapshot } = helpers;

  const getActorKey = (actor) => {
    if (actor.kind === "player") return `p:${actor.playerId}`;
    if (actor.kind === "summon") return `s:${actor.summonId}`;
    if (Number.isInteger(actor.entityId)) return `m:${actor.entityId}`;
    if (Number.isInteger(actor.combatIndex)) return `m:i:${actor.combatIndex}`;
    return "m:0";
  };

  const ensureSpellState = (combat, actorKey) => {
    combat.spellState = combat.spellState || {};
    if (!combat.spellState[actorKey]) {
      combat.spellState[actorKey] = {
        cooldowns: {},
        castsThisTurn: {},
        castsThisTurnTargets: {},
      };
    }
    return combat.spellState[actorKey];
  };

  const resetSpellStateForActor = (combat, actorKey) => {
    const st = ensureSpellState(combat, actorKey);
    st.castsThisTurn = {};
    st.castsThisTurnTargets = {};
    Object.keys(st.cooldowns).forEach((spellId) => {
      const cur = st.cooldowns[spellId] || 0;
      st.cooldowns[spellId] = Math.max(0, cur - 1);
    });
  };

  const findSnapshotPlayer = (snapshot, playerId) =>
    snapshot.players.find((p) => p && p.playerId === playerId) || null;

  const findSnapshotMonster = (snapshot, actor) => {
    if (Number.isInteger(actor.entityId)) {
      return snapshot.monsters.find((m) => m && m.entityId === actor.entityId) || null;
    }
    if (Number.isInteger(actor.combatIndex)) {
      return snapshot.monsters.find((m) => m && m.combatIndex === actor.combatIndex) || null;
    }
    return null;
  };

  const findSnapshotSummon = (snapshot, summonId) => {
    if (!snapshot || !Number.isInteger(summonId)) return null;
    return (
      (Array.isArray(snapshot.summons)
        ? snapshot.summons.find((s) => s && s.summonId === summonId)
        : null) || null
    );
  };

  const resolveHelpers = createSpellResolveHelpers({
    state,
    ctx,
    ensureCombatSnapshot,
    applyShieldToDamage,
    clampNonNegative,
    findSnapshotPlayer,
    findSnapshotMonster,
  });
  const {
    applyDamageToEntry,
    applyLifeSteal,
    removeStatusEffect,
    resolveCaptureOnMonsterDeath,
    getMonsterLevelFromEntry,
  } = resolveHelpers;
  const effectsHelpers = createSpellEffectsHelpers({
    state,
    getMonsterDef,
    getMonsterCombatStats,
    getNextSummonId,
    getMapCollision,
    ensureCombatSnapshot,
    isTileAvailable,
    getOccupiedMap,
    isAlive,
    clampNonNegative,
    applyDamageToEntry,
    ensureEryonChargeState,
    findSnapshotMonster,
  });
  const {
    applyStatusEffect,
    applyAreaBuff,
    tryPushTarget,
    tryPullCasterToMelee,
    spawnCapturedSummon,
    hasAliveSummonForOwner,
    convertEryonChargesToPuissance,
  } = effectsHelpers;

  const getCasterInfo = (combat, actor) => {
    const snapshot = ensureCombatSnapshot(combat);
    if (!snapshot) return null;
    if (actor.kind === "player") {
      const player = state.players[actor.playerId];
      if (!player) return null;
      const entry = findSnapshotPlayer(snapshot, actor.playerId);
      if (!entry || !isAlive(entry)) return null;
      if (player.classId === "eryon" || player.classId === "assassin") {
        ensureEryonChargeState(player);
      }
      return {
        kind: "player",
        key: getActorKey(actor),
        playerId: actor.playerId,
        classId: player.classId || null,
        stats: player.stats || null,
        eryonChargeState: player.eryonChargeState || null,
        statusEffects: entry.statusEffects || null,
        entry,
        tileX: entry.tileX,
        tileY: entry.tileY,
      };
    }
    if (actor.kind === "summon") {
      const entry =
        (Number.isInteger(actor.summonId)
          ? snapshot.summons?.find((s) => s && s.summonId === actor.summonId)
          : null) || null;
      if (!entry || !isAlive(entry)) return null;
      const def = entry.monsterId ? getMonsterDef(entry.monsterId) : null;
      const level = Number.isFinite(entry.level) ? entry.level : 1;
      const stats =
        typeof getMonsterCombatStats === "function"
          ? getMonsterCombatStats(def, level)
          : null;
      return {
        kind: "summon",
        key: getActorKey(actor),
        summonId: entry.summonId ?? null,
        monsterId: entry.monsterId ?? null,
        stats,
        statusEffects: entry.statusEffects || null,
        entry,
        tileX: entry.tileX,
        tileY: entry.tileY,
      };
    }
    const entry = findSnapshotMonster(snapshot, actor);
    if (!entry || !isAlive(entry)) return null;
    const def = entry.monsterId ? getMonsterDef(entry.monsterId) : null;
    const mobEntry = Array.isArray(combat.mobEntries)
      ? combat.mobEntries.find((m) => {
          if (!m) return false;
          if (Number.isInteger(entry.entityId) && Number.isInteger(m.entityId)) {
            return m.entityId === entry.entityId;
          }
          if (Number.isInteger(entry.combatIndex) && Number.isInteger(m.combatIndex)) {
            return m.combatIndex === entry.combatIndex;
          }
          return false;
        }) || null
      : null;
    const level =
      Number.isInteger(mobEntry?.level) ? mobEntry.level : Number.isInteger(entry.level) ? entry.level : 1;
    const stats =
      typeof getMonsterCombatStats === "function"
        ? getMonsterCombatStats(def, level)
        : null;
    return {
      kind: "monster",
      key: getActorKey(actor),
      entityId: entry.entityId ?? null,
      combatIndex: entry.combatIndex ?? null,
      monsterId: entry.monsterId ?? null,
      stats,
      statusEffects: entry.statusEffects || null,
      entry,
      tileX: entry.tileX,
      tileY: entry.tileY,
    };
  };

  const resolveSpellCast = (combat, actor, spellId, targetX, targetY) => {
    if (!combat) return { ok: false };
    const snapshot = ensureCombatSnapshot(combat);
    if (!snapshot) return { ok: false };
    const spell = getSpellDef(spellId);
    if (!spell) return { ok: false };
    const caster = getCasterInfo(combat, actor);
    if (!caster || !caster.stats) return { ok: false };
    const mapInfo = getMapCollision(combat.mapId);
    const occupied = getOccupiedMap(snapshot);

    if (!Number.isInteger(targetX) || !Number.isInteger(targetY)) return { ok: false };
    if (!isTileAvailable(mapInfo, targetX, targetY)) return { ok: false };

    const st = ensureSpellState(combat, caster.key);
    const cooldown = st.cooldowns[spellId] || 0;
    if (cooldown > 0) return { ok: false };
    const maxCasts = spell.maxCastsPerTurn ?? null;
    const used = st.castsThisTurn[spellId] || 0;
    if (maxCasts && used >= maxCasts) return { ok: false };

    const spellCost = spell.paCost ?? 0;
    if (caster.kind === "player") {
      combat.paRemainingByPlayer = combat.paRemainingByPlayer || {};
      const current =
        Number.isFinite(combat.paRemainingByPlayer[caster.playerId])
          ? combat.paRemainingByPlayer[caster.playerId]
          : Number.isFinite(state.players[caster.playerId]?.pa)
            ? state.players[caster.playerId].pa
            : 0;
      if (current < spellCost) return { ok: false };
      combat.paRemainingByPlayer[caster.playerId] = Math.max(0, current - spellCost);
    }

    const originX = caster.tileX;
    const originY = caster.tileY;
    const dist = Math.abs(targetX - originX) + Math.abs(targetY - originY);
    const minRange = spell.rangeMin ?? 0;
    const maxRange = spell.rangeMax ?? 0;
    if (dist < minRange || dist > maxRange) return { ok: false };
    if (spell.castPattern === "line4") {
      if (!(targetX === originX || targetY === originY)) return { ok: false };
    }
    if (spell.lineOfSight) {
      if (!hasLineOfSight(mapInfo, occupied, originX, originY, targetX, targetY)) {
        return { ok: false };
      }
    }

    const targetInfo = findTargetAtTile(snapshot, targetX, targetY, caster.kind);
    const tileBlocked = mapInfo?.blocked?.has(`${targetX},${targetY}`);
    if (tileBlocked && !targetInfo && !(targetX === originX && targetY === originY)) {
      return { ok: false };
    }

    const maxPerTarget = spell.maxCastsPerTargetPerTurn ?? null;
    if (maxPerTarget && targetInfo) {
      const key =
        targetInfo.kind === "player"
          ? `p:${targetInfo.entry.playerId}`
          : `m:${targetInfo.entry.entityId ?? targetInfo.entry.combatIndex}`;
      const perSpell = st.castsThisTurnTargets[spellId] || {};
      if ((perSpell[key] || 0) >= maxPerTarget) return { ok: false };
      perSpell[key] = (perSpell[key] || 0) + 1;
      st.castsThisTurnTargets[spellId] = perSpell;
    }

    st.castsThisTurn[spellId] = used + 1;
    if (spell.cooldownTurns) {
      st.cooldowns[spellId] = Math.max(st.cooldowns[spellId] || 0, spell.cooldownTurns);
    }

    broadcast({
      t: "EvSpellCast",
      combatId: combat.id,
      authoritative: true,
      casterKind:
        caster.kind === "player" ? "player" : caster.kind === "summon" ? "summon" : "monster",
      casterId:
        caster.kind === "player"
          ? caster.playerId
          : caster.kind === "summon"
            ? caster.summonId
            : caster.entityId,
      casterIndex: caster.kind === "monster" ? caster.combatIndex : null,
      spellId: spell.id,
      targetX,
      targetY,
    });

    let lastDamage = null;
    const effects = Array.isArray(spell.effects) ? spell.effects : [];
    effects.forEach((effect) => {
      if (!effect || !effect.type) return;
      if (effect.type === "damage") {
        if (spell.damageOnHit === false) return;
        const target = targetInfo;
        if (!target) return;
        const dmgSpell = resolveDamageSpell(spell, effect);
        const dmgRes = computeSpellDamageWithCrit(caster, dmgSpell);
        const reduced = applyFixedResistanceToDamage(
          dmgRes.damage,
          target.kind === "player" ? state.players[target.entry.playerId]?.stats : null,
          dmgSpell.element
        );
        if (reduced <= 0) return;
        applyDamageToEntry(combat, caster, target, dmgSpell, reduced, caster.kind);
        lastDamage = { raw: dmgRes.damage, final: reduced, isCrit: dmgRes.isCrit };
        return;
      }
      if (effect.type === "patternDamage") {
        const dmgSpell = resolveDamageSpell(spell, effect);
        const tiles = buildPatternTiles(effect.pattern, targetX, targetY, originX, originY);
        tiles.forEach((t) => {
          if (!isTileAvailable(mapInfo, t.x, t.y)) return;
          const target = findTargetAtTile(snapshot, t.x, t.y, caster.kind);
          if (!target) return;
          const dmgRes = computeSpellDamageWithCrit(caster, dmgSpell);
          const reduced = applyFixedResistanceToDamage(
            dmgRes.damage,
            target.kind === "player" ? state.players[target.entry.playerId]?.stats : null,
            dmgSpell.element
          );
          if (reduced <= 0) return;
          applyDamageToEntry(combat, caster, target, dmgSpell, reduced, caster.kind);
          lastDamage = { raw: dmgRes.damage, final: reduced, isCrit: dmgRes.isCrit };
        });
        return;
      }
      if (effect.type === "lifeSteal") {
        const amount = lastDamage?.final ?? lastDamage?.raw ?? 0;
        applyLifeSteal(combat, caster, amount);
        return;
      }
      if (effect.type === "push") {
        if (!targetInfo) return;
        const dist = Number.isFinite(effect.distance) ? effect.distance : 0;
        tryPushTarget(combat, caster, targetInfo, dist, mapInfo, occupied);
        return;
      }
      if (effect.type === "pullCasterToMelee") {
        if (!targetInfo) return;
        tryPullCasterToMelee(combat, caster, targetInfo, mapInfo, occupied);
        return;
      }
      if (effect.type === "status") {
        if (!targetInfo) return;
        const status = effect.useSpellStatus ? spell.statusEffect : effect.status;
        const sourceName =
          caster.kind === "player"
            ? state.players[caster.playerId]?.displayName || "Joueur"
            : getMonsterDef(caster.monsterId)?.label || "Monstre";
        applyStatusEffect(targetInfo.entry, status, sourceName);
        return;
      }
      if (effect.type === "areaBuff") {
        const buff = effect.useSpellAreaBuff ? spell.areaBuff : effect.areaBuff;
        applyAreaBuff(combat, caster, buff);
        return;
      }
      if (effect.type === "capture") {
        if (caster.kind !== "player" || !targetInfo || targetInfo.kind !== "monster") return;
        const monsterId = targetInfo.entry.monsterId;
        if (!monsterId) return;
        if (typeof isMonsterCapturable === "function" && !isMonsterCapturable(monsterId)) return;
        const player = state.players[caster.playerId];
        if (!player) return;
        const playerLevel = Number.isFinite(player.level) ? player.level : 1;
        const monsterLevel = getMonsterLevelFromEntry(combat, targetInfo.entry);
        if (playerLevel < monsterLevel) return;
        const turns =
          typeof effect.playerTurns === "number"
            ? Math.max(1, Math.floor(effect.playerTurns))
            : 2;
        player.captureState = {
          targetEntityId: Number.isInteger(targetInfo.entry.entityId)
            ? targetInfo.entry.entityId
            : null,
          targetCombatIndex: Number.isInteger(targetInfo.entry.combatIndex)
            ? targetInfo.entry.combatIndex
            : null,
          targetMonsterId: monsterId,
          turnsLeft: turns,
        };
        applyStatusEffect(
          targetInfo.entry,
          { id: "capture_essence", type: "capture", label: "Capture", turns },
          player.displayName || "Joueur"
        );
        return;
      }
      if (effect.type === "summonCaptured") {
        if (caster.kind !== "player") return;
        if (hasAliveSummonForOwner(combat, caster.playerId)) return;
        spawnCapturedSummon(combat, caster, targetX, targetY);
        return;
      }
    });

    if (
      caster.kind === "player" &&
      (caster.classId === "eryon" || caster.classId === "assassin") &&
      spell.eryonCharges
    ) {
      const isSelfCast =
        targetX === originX &&
        targetY === originY &&
        (!targetInfo ||
          (targetInfo.kind === "player" && targetInfo.entry?.playerId === caster.playerId));
      const sourceName = state.players[caster.playerId]?.displayName || "Eryon";
      if (isSelfCast) {
        const targetEntry = targetInfo?.entry || caster.entry;
        convertEryonChargesToPuissance(caster, targetEntry, sourceName);
      } else {
        const gain = spell.eryonCharges.chargeGain ?? 1;
        const element = spell.eryonCharges.element ?? spell.element;
        applyEryonElementAfterCast(caster, element, gain);
      }
    }

    return { ok: true };
  };

  return {
    resolveSpellCast,
    resetSpellStateForActor,
  };
}

module.exports = {
  createSpellResolver,
};
