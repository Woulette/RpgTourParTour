function createSpellResolveHelpers({
  state,
  ctx,
  ensureCombatSnapshot,
  applyShieldToDamage,
  clampNonNegative,
  findSnapshotPlayer,
  findSnapshotMonster,
}) {
  const getMonsterLevelFromEntry = (combat, entry) => {
    if (!entry) return 1;
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
    if (Number.isInteger(mobEntry?.level)) return mobEntry.level;
    if (Number.isInteger(entry.level)) return entry.level;
    return 1;
  };

  const removeStatusEffect = (targetEntry, id) => {
    if (!targetEntry || !Array.isArray(targetEntry.statusEffects)) return;
    targetEntry.statusEffects = targetEntry.statusEffects.filter((e) => e && e.id !== id);
  };

  const resolveCaptureOnMonsterDeath = (combat, entry) => {
    if (!combat || !entry || !entry.monsterId) return;
    const participants = Array.isArray(combat.participantIds)
      ? combat.participantIds
      : [];
    const matchPlayer = participants.find((id) => {
      const p = state.players[id];
      if (!p || !p.captureState) return false;
      const cap = p.captureState;
      if (cap.turnsLeft <= 0) return false;
      if (Number.isInteger(cap.targetEntityId) && Number.isInteger(entry.entityId)) {
        return cap.targetEntityId === entry.entityId;
      }
      if (
        Number.isInteger(cap.targetCombatIndex) &&
        Number.isInteger(entry.combatIndex)
      ) {
        return cap.targetCombatIndex === entry.combatIndex;
      }
      if (cap.targetMonsterId && entry.monsterId) {
        return cap.targetMonsterId === entry.monsterId;
      }
      return false;
    });
    if (!matchPlayer) return;
    const player = state.players[matchPlayer];
    if (!player) return;
    player.capturedMonsterId = entry.monsterId;
    player.capturedMonsterLevel = getMonsterLevelFromEntry(combat, entry);
    player.captureState = null;
    removeStatusEffect(entry, "capture_essence");
  };

  const applyDamageToEntry = (combat, caster, target, spell, damage, source) => {
    if (!target || damage <= 0) return false;
    const targetKind = target.kind;
    const entry = target.entry;
    const shielded = applyShieldToDamage(entry, damage);
    const finalDamage = Math.max(0, shielded.damage);
    if (finalDamage <= 0) return false;
    const payload = {
      t: "EvDamageApplied",
      combatId: combat.id,
      casterId:
        caster.kind === "player"
          ? caster.playerId
          : caster.kind === "summon"
            ? caster.summonId
            : caster.entityId,
      spellId: spell?.id ?? null,
      targetX: entry.tileX,
      targetY: entry.tileY,
      targetKind,
      targetId:
        targetKind === "player"
          ? entry.playerId
          : targetKind === "summon"
            ? entry.summonId
            : entry.entityId,
      targetIndex: targetKind === "monster" ? entry.combatIndex : null,
      damage: finalDamage,
      source,
    };
    ctx.broadcast(payload);
    entry.hp = Math.max(0, (entry.hp ?? entry.hpMax ?? 0) - finalDamage);
    entry.hpMax = entry.hpMax ?? entry.hp ?? 0;
    if (targetKind === "player") {
      const p = state.players[entry.playerId];
      if (p) {
        p.hp = entry.hp;
        if (p.stats) {
          p.stats.hp = entry.hp;
          if (!Number.isFinite(p.stats.hpMax)) {
            p.stats.hpMax = entry.hpMax;
          }
        }
      }
    }
    if (targetKind === "player" && entry.hp <= 0) {
      combat.summons = Array.isArray(combat.summons)
        ? combat.summons.filter((s) => s && s.ownerPlayerId !== entry.playerId)
        : [];
      if (combat.stateSnapshot) {
        combat.stateSnapshot.summons = Array.isArray(combat.stateSnapshot.summons)
          ? combat.stateSnapshot.summons.filter((s) => s && s.ownerPlayerId !== entry.playerId)
          : [];
      }
      const p = state.players[entry.playerId];
      if (p) {
        p.hasAliveSummon = false;
        if (typeof ctx.persistPlayerState === "function") {
          ctx.persistPlayerState(p);
        }
      }
    }
    if (targetKind === "monster" && entry.hp <= 0) {
      resolveCaptureOnMonsterDeath(combat, entry);
    }
    if (targetKind === "summon" && entry.hp <= 0) {
      combat.summons = Array.isArray(combat.summons)
        ? combat.summons.filter((s) => s && s.summonId !== entry.summonId)
        : [];
      if (combat.stateSnapshot) {
        combat.stateSnapshot.summons = Array.isArray(combat.stateSnapshot.summons)
          ? combat.stateSnapshot.summons.filter((s) => s && s.summonId !== entry.summonId)
          : [];
      }
      const ownerId = Number.isInteger(entry.ownerPlayerId) ? entry.ownerPlayerId : null;
      if (ownerId && state.players[ownerId]) {
        state.players[ownerId].hasAliveSummon = false;
      }
    }
    if (typeof ctx.finalizeCombat === "function") {
      const players = Array.isArray(combat.stateSnapshot?.players)
        ? combat.stateSnapshot.players
        : [];
      const monsters = Array.isArray(combat.stateSnapshot?.monsters)
        ? combat.stateSnapshot.monsters
        : [];
      const livingPlayers = players.filter((p) => (p?.hp ?? p?.hpMax ?? 0) > 0).length;
      const livingMonsters = monsters.filter((m) => (m?.hp ?? m?.hpMax ?? 0) > 0).length;
      if (livingMonsters <= 0) {
        ctx.finalizeCombat(combat.id, "victoire");
      } else if (livingPlayers <= 0) {
        ctx.finalizeCombat(combat.id, "defaite");
      }
    }
    return payload;
  };

  const applyLifeSteal = (combat, caster, amount) => {
    if (amount <= 0) return false;
    const snapshot = ensureCombatSnapshot(combat);
    if (!snapshot) return false;
    if (caster.kind === "player") {
      const entry = findSnapshotPlayer(snapshot, caster.playerId);
      if (!entry) return false;
      const p = state.players[caster.playerId];
      const hpMax = Number.isFinite(entry.hpMax)
        ? entry.hpMax
        : Number.isFinite(p?.hpMax)
          ? p.hpMax
          : 0;
      entry.hp = Math.min(hpMax, (entry.hp ?? 0) + amount);
      entry.hpMax = hpMax;
      if (p) {
        p.hp = entry.hp;
        p.hpMax = hpMax;
        if (p.stats) {
          p.stats.hp = entry.hp;
          p.stats.hpMax = hpMax;
        }
      }
      return true;
    }
    const entry = findSnapshotMonster(snapshot, caster);
    if (!entry) return false;
    const hpMax = Number.isFinite(entry.hpMax) ? entry.hpMax : 0;
    entry.hp = Math.min(hpMax, (entry.hp ?? 0) + amount);
    entry.hpMax = hpMax;
    return true;
  };

  return {
    applyDamageToEntry,
    applyLifeSteal,
    removeStatusEffect,
    resolveCaptureOnMonsterDeath,
    getMonsterLevelFromEntry,
  };
}

module.exports = {
  createSpellResolveHelpers,
};
