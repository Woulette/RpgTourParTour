function createTurnHandlers(ctx, helpers) {
  const {
    state,
    broadcast,
    serializeActorOrder,
    getMonsterDef,
    getMonsterCombatStats,
    finalizeCombat,
  } = ctx;
  const {
    ensureCombatSnapshot,
    buildCombatActorOrder,
    runMonsterAiTurn,
    runSummonAiTurn,
    resetSpellStateForActor,
  } = helpers;
  const DEBUG_COMBAT = process.env.LAN_COMBAT_DEBUG === "1";
  const debugLog = (...args) => {
    if (!DEBUG_COMBAT) return;
    // eslint-disable-next-line no-console
    console.log("[LAN][Combat]", ...args);
  };

  const isMonsterAlive = (entry) => {
    if (!entry) return false;
    const hp = Number.isFinite(entry.hp) ? entry.hp : Number.isFinite(entry.hpMax) ? entry.hpMax : 0;
    return hp > 0;
  };

  const isPlayerAlive = (entry) => {
    if (!entry) return false;
    const hp = Number.isFinite(entry.hp) ? entry.hp : Number.isFinite(entry.hpMax) ? entry.hpMax : 0;
    return hp > 0;
  };

  const getActorOrder = (combat) => {
    const order = buildCombatActorOrder(combat);
    combat.actorOrder = order;
    return order;
  };

  const resolveActor = (combat, actor) => {
    const snapshot = ensureCombatSnapshot(combat);
    if (!snapshot) return null;
    if (actor.kind === "joueur") {
      const entry = snapshot.players.find((p) => p && p.playerId === actor.playerId) || null;
      if (!entry || !isPlayerAlive(entry)) return null;
      return { kind: "joueur", playerId: actor.playerId };
    }
    if (actor.kind === "invocation") {
      const entry =
        (Number.isInteger(actor.summonId)
          ? snapshot.summons?.find((s) => s && s.summonId === actor.summonId)
          : null) || null;
      if (!entry || !isMonsterAlive(entry)) return null;
      return {
        kind: "invocation",
        summonId: Number.isInteger(entry.summonId) ? entry.summonId : null,
        ownerPlayerId: Number.isInteger(entry.ownerPlayerId) ? entry.ownerPlayerId : null,
        monsterId: entry.monsterId || null,
      };
    }
    const monster =
      (Number.isInteger(actor.entityId)
        ? snapshot.monsters.find((m) => m && m.entityId === actor.entityId)
        : null) ||
      (Number.isInteger(actor.combatIndex)
        ? snapshot.monsters.find((m) => m && m.combatIndex === actor.combatIndex)
        : null) ||
      null;
    if (!monster || !isMonsterAlive(monster)) return null;
    return {
      kind: "monstre",
      entityId: Number.isInteger(monster.entityId) ? monster.entityId : null,
      combatIndex: Number.isInteger(monster.combatIndex) ? monster.combatIndex : null,
      monsterId: monster.monsterId || null,
    };
  };

  const findNextActorIndex = (combat, startIndex) => {
    const order = getActorOrder(combat);
    if (!order.length) return -1;
    const total = order.length;
    const start = Number.isInteger(startIndex) ? startIndex : -1;
    for (let step = 1; step <= total; step += 1) {
      const idx = (start + step) % total;
      const actor = order[idx];
      const resolved = actor ? resolveActor(combat, actor) : null;
      if (resolved) return idx;
    }
    return -1;
  };

  const applyActiveActor = (combat, actor) => {
    if (!actor) return;
    if (actor.kind === "invocation") {
      combat.turn = "summon";
    } else {
      combat.turn = actor.kind === "monstre" ? "monster" : "player";
    }
    if (actor.kind === "joueur") {
      combat.activePlayerId = actor.playerId;
      combat.activeMonsterId = null;
      combat.activeMonsterIndex = null;
      combat.activeSummonId = null;
      combat.paRemainingByPlayer = combat.paRemainingByPlayer || {};
      const p = state.players[actor.playerId];
      const basePa = Number.isFinite(p?.pa) ? p.pa : 6;
      combat.paRemainingByPlayer[actor.playerId] = basePa;
    } else if (actor.kind === "monstre") {
      combat.activePlayerId = null;
      combat.activeMonsterId = Number.isInteger(actor.entityId) ? actor.entityId : null;
      combat.activeMonsterIndex = Number.isInteger(actor.combatIndex) ? actor.combatIndex : null;
      combat.activeSummonId = null;
    } else if (actor.kind === "invocation") {
      combat.activePlayerId = null;
      combat.activeMonsterId = null;
      combat.activeMonsterIndex = null;
      combat.activeSummonId = Number.isInteger(actor.summonId) ? actor.summonId : null;
    }
  };

  const clampNonNegative = (n) => {
    if (typeof n !== "number" || !Number.isFinite(n)) return 0;
    return Math.max(0, n);
  };

  const getFixedResistanceForElement = (stats, element) => {
    const s = stats || {};
    switch (element) {
      case "force":
      case "terre":
        return clampNonNegative(s.resistanceFixeTerre ?? 0);
      case "intelligence":
      case "feu":
        return clampNonNegative(s.resistanceFixeFeu ?? 0);
      case "agilite":
      case "air":
        return clampNonNegative(s.resistanceFixeAir ?? 0);
      case "chance":
      case "eau":
        return clampNonNegative(s.resistanceFixeEau ?? 0);
      default:
        return 0;
    }
  };

  const applyFixedResistanceToDamage = (damage, stats, element) => {
    const safeDamage = clampNonNegative(damage);
    const resist = getFixedResistanceForElement(stats, element);
    return Math.max(0, safeDamage - resist);
  };

  const applyShieldToDamage = (entry, damage) => {
    if (!entry || !Array.isArray(entry.statusEffects)) {
      return { damage, absorbed: 0 };
    }
    let remaining = Math.max(0, damage);
    let absorbed = 0;
    let touched = false;

    entry.statusEffects.forEach((effect) => {
      if (!effect || effect.type !== "shield") return;
      if ((effect.turnsLeft ?? 0) <= 0) return;
      if (remaining <= 0) return;
      const amount = typeof effect.amount === "number" ? effect.amount : 0;
      if (amount <= 0) return;
      const used = Math.min(amount, remaining);
      effect.amount = amount - used;
      remaining -= used;
      absorbed += used;
      touched = true;
      if (effect.amount <= 0) {
        effect.turnsLeft = 0;
      }
    });

    if (touched) {
      entry.statusEffects = entry.statusEffects.filter(
        (effect) =>
          effect &&
          (effect.type !== "shield" ||
            ((effect.turnsLeft ?? 0) > 0 && (effect.amount ?? 0) > 0))
      );
    }

    return { damage: remaining, absorbed };
  };

  const getMonsterStatsFromEntry = (combat, entry) => {
    if (!entry) return null;
    const def = entry.monsterId ? getMonsterDef?.(entry.monsterId) : null;
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
    if (typeof getMonsterCombatStats === "function") {
      return getMonsterCombatStats(def, level);
    }
    return null;
  };

  const getSummonStatsFromEntry = (combat, entry) => {
    if (!entry || !entry.monsterId) return null;
    const def = entry.monsterId ? getMonsterDef?.(entry.monsterId) : null;
    const level = Number.isFinite(entry.level) ? entry.level : 1;
    if (typeof getMonsterCombatStats === "function") {
      return getMonsterCombatStats(def, level);
    }
    return null;
  };

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

  const applyStartOfTurnStatusEffects = (combat, actor) => {
    const snapshot = ensureCombatSnapshot(combat);
    if (!snapshot || !actor) return;
    let entry = null;
    let targetKind = null;
    let targetId = null;
    let targetIndex = null;
    let targetStats = null;

    if (actor.kind === "joueur") {
      entry = snapshot.players.find((p) => p && p.playerId === actor.playerId) || null;
      targetKind = "player";
      targetId = actor.playerId;
      targetStats = state.players[actor.playerId]?.stats || null;
    } else if (actor.kind === "invocation") {
      entry =
        (Number.isInteger(actor.summonId)
          ? snapshot.summons?.find((s) => s && s.summonId === actor.summonId)
          : null) || null;
      targetKind = "summon";
      targetId = Number.isInteger(actor.summonId) ? actor.summonId : null;
      targetStats = getSummonStatsFromEntry(combat, entry);
    } else {
      entry =
        (Number.isInteger(actor.entityId)
          ? snapshot.monsters.find((m) => m && m.entityId === actor.entityId)
          : null) ||
        (Number.isInteger(actor.combatIndex)
          ? snapshot.monsters.find((m) => m && m.combatIndex === actor.combatIndex)
          : null) ||
        null;
      targetKind = "monster";
      targetId = Number.isInteger(actor.entityId) ? actor.entityId : null;
      targetIndex = Number.isInteger(actor.combatIndex) ? actor.combatIndex : null;
      targetStats = getMonsterStatsFromEntry(combat, entry);
    }

    if (!entry || !Array.isArray(entry.statusEffects)) return;
    if (!isPlayerAlive(entry) && !isMonsterAlive(entry)) return;

    const removeStatusEffect = (targetEntry, id) => {
      if (!targetEntry || !Array.isArray(targetEntry.statusEffects)) return;
      targetEntry.statusEffects = targetEntry.statusEffects.filter((e) => e && e.id !== id);
    };

    const resolveCaptureOnMonsterDeath = () => {
      if (targetKind !== "monster") return;
      if (!entry.monsterId) return;
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
      const level = getMonsterLevelFromEntry(combat, entry);
      player.capturedMonsterId = entry.monsterId;
      player.capturedMonsterLevel = level;
      player.captureState = null;
      removeStatusEffect(entry, "capture_essence");
    };

    const keep = [];
    entry.statusEffects.forEach((effect) => {
      if (!effect || (effect.turnsLeft ?? 0) <= 0) return;
      if (effect.type !== "poison") {
        effect.turnsLeft = (effect.turnsLeft ?? 0) - 1;
        if ((effect.turnsLeft ?? 0) > 0) keep.push(effect);
        return;
      }

      const min = typeof effect.damageMin === "number" ? effect.damageMin : 0;
      const max = typeof effect.damageMax === "number" ? effect.damageMax : min;
      const safeMax = max >= min ? max : min;
      const rawDmg = min + Math.floor(Math.random() * (Math.max(0, safeMax - min) + 1));
      const reduced = applyFixedResistanceToDamage(rawDmg, targetStats, effect.element ?? null);
      const shielded = applyShieldToDamage(entry, reduced);
      const dmg = Math.max(0, shielded.damage);
      if (dmg > 0) {
        entry.hp = Math.max(0, (entry.hp ?? entry.hpMax ?? 0) - dmg);
        entry.hpMax = entry.hpMax ?? entry.hp ?? 0;
        if (targetKind === "player") {
          const p = state.players[actor.playerId];
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
        broadcast({
          t: "EvDamageApplied",
          combatId: combat.id,
          casterId: null,
          spellId: effect.id || "poison",
          targetX: entry.tileX,
          targetY: entry.tileY,
          targetKind,
          targetId,
          targetIndex,
          damage: dmg,
          source: "poison",
        });
      }

      effect.turnsLeft = (effect.turnsLeft ?? 0) - 1;
      if (effect.turnsLeft > 0) {
        keep.push(effect);
      }
    });

    entry.statusEffects = keep;
    debugLog("Status tick", {
      combatId: combat.id,
      actor: actor.kind,
      targetKind,
      targetId,
      statusCount: keep.length,
    });

    if (entry.hp <= 0) {
      if (targetKind === "player") {
        combat.summons = Array.isArray(combat.summons)
          ? combat.summons.filter((s) => s && s.ownerPlayerId !== entry.playerId)
          : [];
        if (combat.stateSnapshot) {
          combat.stateSnapshot.summons = Array.isArray(combat.stateSnapshot.summons)
            ? combat.stateSnapshot.summons.filter((s) => s && s.ownerPlayerId !== entry.playerId)
            : [];
        }
        const p = state.players[entry.playerId];
        if (p) p.hasAliveSummon = false;
      }
      resolveCaptureOnMonsterDeath();
    }
  };

  const tickCaptureStateForPlayer = (combat, playerId) => {
    if (!combat || !Number.isInteger(playerId)) return;
    const player = state.players[playerId];
    if (!player || !player.captureState) return;
    const cap = player.captureState;
    if ((cap.turnsLeft ?? 0) <= 0) {
      player.captureState = null;
      return;
    }
    cap.turnsLeft = (cap.turnsLeft ?? 0) - 1;
    const snapshot = ensureCombatSnapshot(combat);
    if (!snapshot) return;
    const target =
      (Number.isInteger(cap.targetEntityId)
        ? snapshot.monsters.find((m) => m && m.entityId === cap.targetEntityId)
        : null) ||
      (Number.isInteger(cap.targetCombatIndex)
        ? snapshot.monsters.find((m) => m && m.combatIndex === cap.targetCombatIndex)
        : null) ||
      null;
    if (target) {
      if (cap.turnsLeft > 0) {
        target.statusEffects = Array.isArray(target.statusEffects) ? target.statusEffects : [];
        const idx = target.statusEffects.findIndex((e) => e && e.id === "capture_essence");
        const next = {
          id: "capture_essence",
          type: "capture",
          label: "Capture",
          turnsLeft: cap.turnsLeft,
          sourceName: player.displayName || "Joueur",
        };
        if (idx >= 0) target.statusEffects[idx] = next;
        else target.statusEffects.push(next);
      } else {
        target.statusEffects = Array.isArray(target.statusEffects)
          ? target.statusEffects.filter((e) => e && e.id !== "capture_essence")
          : [];
      }
    }
    if (cap.turnsLeft <= 0) {
      player.captureState = null;
    }
  };

  const broadcastTurnStarted = (combat, actor) => {
    if (!combat || !actor) return;
    broadcast({
      t: "EvCombatTurnStarted",
      combatId: combat.id,
      actorType:
        actor.kind === "monstre" ? "monster" : actor.kind === "invocation" ? "summon" : "player",
      activePlayerId: actor.kind === "joueur" ? actor.playerId : null,
      activeMonsterId: actor.kind === "monstre" ? actor.entityId : null,
      activeMonsterIndex: actor.kind === "monstre" ? actor.combatIndex : null,
      activeSummonId: actor.kind === "invocation" ? actor.summonId : null,
      round: combat.round,
      actorOrder: serializeActorOrder ? serializeActorOrder(combat) : undefined,
    });
  };

  const broadcastTurnEnded = (combat, actorType) => {
    broadcast({
      t: "EvCombatTurnEnded",
      combatId: combat.id,
      actorType,
    });
  };

  const advanceCombatTurn = (combat, actorType) => {
    if (!combat) return;
    const order = getActorOrder(combat);
    if (!order.length) return;

    broadcastTurnEnded(combat, actorType);

    const nextIndex = findNextActorIndex(combat, combat.actorIndex);
    if (nextIndex < 0) return;
    const wrapped = Number.isInteger(combat.actorIndex) && nextIndex <= combat.actorIndex;
    combat.actorIndex = nextIndex;
    if (wrapped) {
      combat.round = (combat.round || 1) + 1;
    }

    const nextActor = resolveActor(combat, order[nextIndex]);
    if (!nextActor) return;
    applyActiveActor(combat, nextActor);
    if (typeof resetSpellStateForActor === "function") {
      const actorKey =
        nextActor.kind === "joueur"
          ? `p:${nextActor.playerId}`
          : nextActor.kind === "invocation"
            ? `s:${nextActor.summonId}`
            : Number.isInteger(nextActor.entityId)
              ? `m:${nextActor.entityId}`
              : Number.isInteger(nextActor.combatIndex)
                ? `m:i:${nextActor.combatIndex}`
                : null;
      if (actorKey) resetSpellStateForActor(combat, actorKey);
    }
    if (nextActor.kind === "joueur" && Number.isInteger(combat.activePlayerId)) {
      const p = state.players[combat.activePlayerId];
      const basePm = Number.isFinite(p?.pm) ? p.pm : 3;
      combat.pmRemainingByPlayer = combat.pmRemainingByPlayer || {};
      combat.pmRemainingByPlayer[combat.activePlayerId] = basePm;
    }
    applyStartOfTurnStatusEffects(combat, nextActor);
    if (nextActor.kind === "joueur") {
      tickCaptureStateForPlayer(combat, nextActor.playerId);
    }
    if (typeof finalizeCombat === "function") {
      const players = Array.isArray(combat.stateSnapshot?.players)
        ? combat.stateSnapshot.players
        : [];
      const monsters = Array.isArray(combat.stateSnapshot?.monsters)
        ? combat.stateSnapshot.monsters
        : [];
      const livingPlayers = players.filter((p) => (p?.hp ?? p?.hpMax ?? 0) > 0).length;
      const livingMonsters = monsters.filter((m) => (m?.hp ?? m?.hpMax ?? 0) > 0).length;
      if (livingMonsters <= 0) {
        finalizeCombat(combat.id, "victoire");
        return;
      }
      if (livingPlayers <= 0) {
        finalizeCombat(combat.id, "defaite");
        return;
      }
    }
    broadcastTurnStarted(combat, nextActor);

    if (nextActor.kind === "monstre") {
      runMonsterAiTurn(combat, () => {
        advanceCombatTurn(combat, "monster");
      });
    }
    if (nextActor.kind === "invocation") {
      if (typeof runSummonAiTurn === "function") {
        runSummonAiTurn(combat, () => {
          advanceCombatTurn(combat, "summon");
        });
      }
    }

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
  };

  function handleCmdEndTurnCombat(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const combatId = Number.isInteger(msg.combatId) ? msg.combatId : null;
    if (!combatId) return;
    const combat = state.combats[combatId];
    if (!combat) return;
    const actorType = msg.actorType === "monster" ? "monster" : "player";
    if (combat.turn !== actorType) return;
    if (actorType === "player") {
      if (
        Array.isArray(combat.participantIds) &&
        !combat.participantIds.includes(clientInfo.id)
      ) {
        return;
      }
      if (
        Number.isInteger(combat.activePlayerId) &&
        combat.activePlayerId !== clientInfo.id
      ) {
        return;
      }
    } else {
      return;
    }

    advanceCombatTurn(combat, "player");
  }

  return {
    handleCmdEndTurnCombat,
    advanceCombatTurn,
  };
}

module.exports = {
  createTurnHandlers,
};
