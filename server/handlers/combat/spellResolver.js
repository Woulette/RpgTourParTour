const { getMapCollision } = require("./mapCollision");

function clampNonNegative(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function clampPct(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function normalizePctInput(value, fallbackPct) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return clampPct(fallbackPct ?? 0);
  }
  if (value > 1) return clampPct(value);
  return clampPct(value * 100);
}

function randomBetween(min, max) {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (hi <= lo) return lo;
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function getFixedResistanceForElement(stats, element) {
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
}

function applyFixedResistanceToDamage(damage, stats, element) {
  const safeDamage = clampNonNegative(damage);
  const resist = getFixedResistanceForElement(stats, element);
  return Math.max(0, safeDamage - resist);
}

function applyShieldToDamage(targetEntry, damage) {
  if (!targetEntry || !Array.isArray(targetEntry.statusEffects)) {
    return { damage, absorbed: 0 };
  }
  let remaining = Math.max(0, damage);
  let absorbed = 0;
  let touched = false;

  targetEntry.statusEffects.forEach((effect) => {
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
    targetEntry.statusEffects = targetEntry.statusEffects.filter(
      (effect) =>
        effect &&
        (effect.type !== "shield" ||
          ((effect.turnsLeft ?? 0) > 0 && (effect.amount ?? 0) > 0))
    );
  }

  return { damage: remaining, absorbed };
}

function getSpellCritChancePct(casterStats, spell) {
  const basePct = normalizePctInput(spell?.critChanceBasePct, 5);
  const bonusPct =
    typeof casterStats?.critChancePct === "number" ? casterStats.critChancePct : 0;
  return clampPct(basePct + bonusPct);
}

function rollSpellCrit(casterStats, spell) {
  const chancePct = getSpellCritChancePct(casterStats, spell);
  if (chancePct <= 0) return false;
  return Math.random() < chancePct / 100;
}

function getBonusPuissanceFromStatusEffects(caster) {
  const effects = Array.isArray(caster?.statusEffects) ? caster.statusEffects : [];
  if (effects.length === 0) return 0;
  let sum = 0;
  effects.forEach((eff) => {
    if (!eff || eff.type !== "puissance") return;
    if ((eff.turnsLeft ?? 0) <= 0) return;
    sum += clampNonNegative(eff.amount ?? 0);
  });
  return sum;
}

function getPuissanceForDamage(caster, casterStats) {
  const base = clampNonNegative(casterStats?.puissance ?? 0);
  return base + getBonusPuissanceFromStatusEffects(caster);
}

function getElementStatWithPuissance(caster, casterStats, spell) {
  if (!casterStats || !spell) return 0;
  const element = spell.element;
  const puissance = getPuissanceForDamage(caster, casterStats);

  switch (element) {
    case "force":
    case "terre":
      return (casterStats.force ?? 0) + puissance;
    case "intelligence":
    case "feu":
      return (casterStats.intelligence ?? 0) + puissance;
    case "agilite":
    case "air":
      return (casterStats.agilite ?? 0) + puissance;
    case "chance":
    case "eau":
      return (casterStats.chance ?? 0) + puissance;
    default:
      return 0;
  }
}

function getFlatDamageBonus(casterStats, spell) {
  if (!casterStats || !spell) return 0;
  const stats = casterStats;
  const element = spell.element;
  const all = stats.dommage ?? 0;

  switch (element) {
    case "force":
    case "terre":
      return all + (stats.dommageTerre ?? 0);
    case "intelligence":
    case "feu":
      return all + (stats.dommageFeu ?? 0);
    case "agilite":
    case "air":
      return all + (stats.dommageAir ?? 0);
    case "chance":
    case "eau":
      return all + (stats.dommageEau ?? 0);
    default:
      return all;
  }
}

function computeSpellDamageWithCrit(caster, spell, { forceCrit = null } = {}) {
  const casterStats = caster?.stats || null;
  const isCrit = typeof forceCrit === "boolean" ? forceCrit : rollSpellCrit(casterStats, spell);
  const baseMin = spell?.damageMin ?? 0;
  const baseMax = spell?.damageMax ?? baseMin;
  const critMin = spell?.damageCritMin ?? baseMin;
  const critMax = typeof spell?.damageCritMax === "number" ? spell.damageCritMax : critMin;
  const baseDamage = isCrit ? randomBetween(critMin, critMax) : randomBetween(baseMin, baseMax);
  const elemStat = getElementStatWithPuissance(caster, casterStats, spell);
  const bonusPercent = elemStat * 0.02;
  const multiplier = 1 + bonusPercent;
  const scaled = Math.round(baseDamage * multiplier);
  const flat = getFlatDamageBonus(casterStats, spell);
  const critFlat = isCrit ? clampNonNegative(casterStats?.dommagesCrit ?? 0) : 0;
  let total = Math.max(0, scaled + flat + critFlat);

  if (spell?.id === "surcharge_instable" && caster?.classId === "eryon") {
    const charges = clampNonNegative(caster?.eryonChargeState?.charges ?? 0);
    const consumed = Math.min(5, Math.floor(charges));
    if (consumed > 0) {
      total = Math.round(total * (1 + 0.1 * consumed));
      caster.eryonChargeState.charges = Math.max(0, charges - consumed);
    }
  }

  const damage = isCrit ? Math.ceil(total) : total;
  return { damage, isCrit };
}

function ensureEryonChargeState(player) {
  if (!player) return null;
  if (!player.eryonChargeState || typeof player.eryonChargeState !== "object") {
    player.eryonChargeState = { element: null, charges: 0 };
  }
  const element = player.eryonChargeState.element;
  if (!["feu", "eau", "terre", "air"].includes(element)) {
    player.eryonChargeState.element = null;
  }
  const charges = clampNonNegative(player.eryonChargeState.charges ?? 0);
  player.eryonChargeState.charges = Math.min(10, Math.floor(charges));
  return player.eryonChargeState;
}

function applyEryonElementAfterCast(player, element, gain) {
  const st = ensureEryonChargeState(player);
  if (!st) return null;
  const nextElement = ["feu", "eau", "terre", "air"].includes(element) ? element : null;
  const chargeGain = Math.min(10, Math.max(0, Math.floor(gain ?? 0)));
  if (!nextElement || chargeGain <= 0) return st;
  if (!st.element) {
    st.element = nextElement;
    st.charges = Math.min(10, st.charges + chargeGain);
    return st;
  }
  if (st.element === nextElement) {
    st.charges = Math.min(10, st.charges + chargeGain);
    return st;
  }
  st.element = nextElement;
  st.charges = chargeGain;
  return st;
}

function resolveDamageSpell(spell, effect) {
  if (!spell || !effect) return spell;
  const hasMin = typeof effect.min === "number";
  const hasMax = typeof effect.max === "number";
  const hasElement = typeof effect.element === "string";
  if (!hasMin && !hasMax && !hasElement) return spell;
  return {
    ...spell,
    damageMin: hasMin ? effect.min : spell.damageMin,
    damageMax: hasMax ? effect.max : spell.damageMax,
    damageCritMin: hasMin ? effect.min : spell.damageCritMin,
    damageCritMax: hasMax ? effect.max : spell.damageCritMax,
    element: hasElement ? effect.element : spell.element,
  };
}

function buildPatternTiles(pattern, tileX, tileY, originX, originY) {
  if (pattern === "cross1") {
    return [
      { x: tileX, y: tileY },
      { x: tileX + 1, y: tileY },
      { x: tileX - 1, y: tileY },
      { x: tileX, y: tileY + 1 },
      { x: tileX, y: tileY - 1 },
    ];
  }
  if (pattern === "front_cross") {
    const dx = tileX === originX ? 0 : Math.sign(tileX - originX);
    const dy = tileY === originY ? 0 : Math.sign(tileY - originY);
    const perpX = dx !== 0 ? 0 : 1;
    const perpY = dx !== 0 ? 1 : 0;
    return [
      { x: tileX, y: tileY },
      { x: tileX + dx, y: tileY + dy },
      { x: tileX + perpX, y: tileY + perpY },
      { x: tileX - perpX, y: tileY - perpY },
    ];
  }
  return [];
}

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

  const isAlive = (entry) => {
    if (!entry) return false;
    const hp = Number.isFinite(entry.hp) ? entry.hp : Number.isFinite(entry.hpMax) ? entry.hpMax : 0;
    return hp > 0;
  };

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

  const getOccupiedMap = (snapshot) => {
    const occupied = new Set();
    snapshot.players.forEach((p) => {
      if (!isAlive(p)) return;
      if (!Number.isInteger(p.tileX) || !Number.isInteger(p.tileY)) return;
      occupied.add(`${p.tileX},${p.tileY}`);
    });
    snapshot.monsters.forEach((m) => {
      if (!isAlive(m)) return;
      if (!Number.isInteger(m.tileX) || !Number.isInteger(m.tileY)) return;
      occupied.add(`${m.tileX},${m.tileY}`);
    });
    if (Array.isArray(snapshot.summons)) {
      snapshot.summons.forEach((s) => {
        if (!isAlive(s)) return;
        if (!Number.isInteger(s.tileX) || !Number.isInteger(s.tileY)) return;
        occupied.add(`${s.tileX},${s.tileY}`);
      });
    }
    return occupied;
  };

  const findTargetAtTile = (snapshot, tileX, tileY, casterKind) => {
    if (casterKind === "player") {
      const monster =
        snapshot.monsters.find(
          (m) => m && isAlive(m) && m.tileX === tileX && m.tileY === tileY
        ) || null;
      if (monster) return { kind: "monster", entry: monster };
      const player =
        snapshot.players.find(
          (p) => p && isAlive(p) && p.tileX === tileX && p.tileY === tileY
        ) || null;
      if (player) return { kind: "player", entry: player };
      const summon =
        Array.isArray(snapshot.summons)
          ? snapshot.summons.find(
              (s) => s && isAlive(s) && s.tileX === tileX && s.tileY === tileY
            ) || null
          : null;
      if (summon) return { kind: "summon", entry: summon };
    } else {
      const player =
        snapshot.players.find(
          (p) => p && isAlive(p) && p.tileX === tileX && p.tileY === tileY
        ) || null;
      if (player) return { kind: "player", entry: player };
      const monster =
        snapshot.monsters.find(
          (m) => m && isAlive(m) && m.tileX === tileX && m.tileY === tileY
        ) || null;
      if (monster) return { kind: "monster", entry: monster };
      const summon =
        Array.isArray(snapshot.summons)
          ? snapshot.summons.find(
              (s) => s && isAlive(s) && s.tileX === tileX && s.tileY === tileY
            ) || null
          : null;
      if (summon) return { kind: "summon", entry: summon };
    }
    return null;
  };

  const isTileAvailable = (mapInfo, x, y) => {
    if (!mapInfo || !Number.isInteger(mapInfo.width) || !Number.isInteger(mapInfo.height)) {
      return true;
    }
    if (x < 0 || y < 0 || x >= mapInfo.width || y >= mapInfo.height) return false;
    return true;
  };

  const hasLineOfSight = (mapInfo, occupied, fromX, fromY, toX, toY) => {
    if (!mapInfo) return true;
    if (fromX === toX && fromY === toY) return true;
    const startX = fromX + 0.5;
    const startY = fromY + 0.5;
    const endX = toX + 0.5;
    const endY = toY + 0.5;
    const dirX = endX - startX;
    const dirY = endY - startY;
    const stepX = dirX === 0 ? 0 : dirX > 0 ? 1 : -1;
    const stepY = dirY === 0 ? 0 : dirY > 0 ? 1 : -1;
    const tDeltaX = stepX === 0 ? Infinity : Math.abs(1 / dirX);
    const tDeltaY = stepY === 0 ? Infinity : Math.abs(1 / dirY);

    let x = fromX;
    let y = fromY;
    const nextBoundaryX = stepX > 0 ? Math.floor(startX) + 1 : Math.floor(startX);
    const nextBoundaryY = stepY > 0 ? Math.floor(startY) + 1 : Math.floor(startY);
    let tMaxX = stepX === 0 ? Infinity : Math.abs((nextBoundaryX - startX) / dirX);
    let tMaxY = stepY === 0 ? Infinity : Math.abs((nextBoundaryY - startY) / dirY);

    const isBlocking = (tx, ty) => {
      if (tx === fromX && ty === fromY) return false;
      if (tx === toX && ty === toY) return false;
      if (mapInfo.blocked?.has(`${tx},${ty}`)) return true;
      if (occupied.has(`${tx},${ty}`)) return true;
      return false;
    };

    while (!(x === toX && y === toY)) {
      if (tMaxX < tMaxY) {
        x += stepX;
        tMaxX += tDeltaX;
      } else if (tMaxY < tMaxX) {
        y += stepY;
        tMaxY += tDeltaY;
      } else {
        x += stepX;
        y += stepY;
        tMaxX += tDeltaX;
        tMaxY += tDeltaY;
      }
      if (x === toX && y === toY) break;
      if (isBlocking(x, y)) return false;
    }
    return true;
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
    broadcast(payload);
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
      const hpMax = Number.isFinite(entry.hpMax) ? entry.hpMax : Number.isFinite(p?.hpMax) ? p.hpMax : 0;
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

  const applyStatusEffect = (targetEntry, status, sourceName) => {
    if (!targetEntry || !status) return false;
    targetEntry.statusEffects = Array.isArray(targetEntry.statusEffects)
      ? targetEntry.statusEffects
      : [];
    const id = status.id || "status";
    const next = {
      id,
      type: status.type,
      label: status.label || id,
      turnsLeft: Math.max(0, status.turns ?? status.turnsLeft ?? 0),
      damageMin: status.damageMin ?? 0,
      damageMax: status.damageMax ?? status.damageMin ?? 0,
      amount: status.amount ?? status.bonus ?? 0,
      sourceName: sourceName || null,
      element: status.element ?? null,
    };
    const idx = targetEntry.statusEffects.findIndex((e) => e && e.id === id);
    if (idx >= 0) targetEntry.statusEffects[idx] = next;
    else targetEntry.statusEffects.push(next);
    return true;
  };

  const convertEryonChargesToPuissance = (caster, targetEntry, sourceName) => {
    const st = ensureEryonChargeState(caster);
    if (!st) return { consumed: 0, bonusPuissance: 0 };
    const consumed = clampNonNegative(st.charges ?? 0);
    const amount = Math.max(0, Math.min(100, Math.floor(consumed) * 10));
    st.charges = 0;
    if (amount > 0 && targetEntry) {
      applyStatusEffect(
        targetEntry,
        {
          id: "eryon_transition_puissance",
          type: "puissance",
          label: "Transition elementaire",
          turns: 3,
          amount,
        },
        sourceName
      );
    }
    return { consumed, bonusPuissance: amount };
  };

  function removeStatusEffect(targetEntry, id) {
    if (!targetEntry || !Array.isArray(targetEntry.statusEffects)) return;
    targetEntry.statusEffects = targetEntry.statusEffects.filter((e) => e && e.id !== id);
  }

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

  function resolveCaptureOnMonsterDeath(combat, entry) {
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
  }

  const findNearestFreeSpawnTile = (mapInfo, occupied, originX, originY, preferX, preferY) => {
    const candidates = [];
    if (Number.isInteger(preferX) && Number.isInteger(preferY)) {
      candidates.push({ x: preferX, y: preferY });
    }
    const deltas = [
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
      { dx: 1, dy: 1 },
      { dx: -1, dy: 1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: -1 },
    ];
    deltas.forEach((d) => {
      candidates.push({ x: originX + d.dx, y: originY + d.dy });
    });
    for (const c of candidates) {
      if (!Number.isInteger(c.x) || !Number.isInteger(c.y)) continue;
      if (!isTileAvailable(mapInfo, c.x, c.y)) continue;
      if (mapInfo?.blocked?.has(`${c.x},${c.y}`)) continue;
      if (occupied.has(`${c.x},${c.y}`)) continue;
      return c;
    }
    return null;
  };

  const spawnCapturedSummon = (combat, caster, preferX, preferY) => {
    if (caster.kind !== "player") return null;
    const player = state.players[caster.playerId];
    if (!player || !player.capturedMonsterId) return null;
    const monsterId = player.capturedMonsterId;
    const def = getMonsterDef ? getMonsterDef(monsterId) : null;
    if (!def) return null;
    const level = Number.isFinite(player.capturedMonsterLevel)
      ? player.capturedMonsterLevel
      : Number.isFinite(player.level)
        ? player.level
        : 1;
    const stats =
      typeof getMonsterCombatStats === "function"
        ? getMonsterCombatStats(def, level)
        : null;
    const hpMax =
      Number.isFinite(stats?.hpMax) ? stats.hpMax : Number.isFinite(stats?.hp) ? stats.hp : 50;
    const hp = Number.isFinite(stats?.hp) ? stats.hp : hpMax;
    const mapInfo = getMapCollision(combat.mapId);
    const snapshot = ensureCombatSnapshot(combat);
    if (!snapshot) return null;
    const occupied = getOccupiedMap(snapshot);
    const spawnTile = findNearestFreeSpawnTile(
      mapInfo,
      occupied,
      caster.tileX,
      caster.tileY,
      preferX,
      preferY
    );
    if (!spawnTile) return null;

    const summonId = typeof getNextSummonId === "function" ? getNextSummonId() : null;
    const entry = {
      summonId,
      ownerPlayerId: caster.playerId,
      monsterId,
      tileX: spawnTile.x,
      tileY: spawnTile.y,
      hp,
      hpMax,
      level,
      statusEffects: [],
    };
    combat.summons = Array.isArray(combat.summons) ? combat.summons : [];
    combat.summons.push(entry);
    const snapshotSummons = Array.isArray(snapshot.summons) ? snapshot.summons : [];
    snapshotSummons.push({ ...entry });
    snapshot.summons = snapshotSummons;
    player.hasAliveSummon = true;
    return entry;
  };

  const hasAliveSummonForOwner = (combat, ownerPlayerId) => {
    if (!combat || !Number.isInteger(ownerPlayerId)) return false;
    const list = Array.isArray(combat.summons) ? combat.summons : [];
    return list.some((s) => s && s.ownerPlayerId === ownerPlayerId && isAlive(s));
  };

  const tryPushTarget = (combat, caster, target, distance, mapInfo, occupied) => {
    if (!distance || distance <= 0) return false;
    const fromX = caster.tileX;
    const fromY = caster.tileY;
    const tx = target.entry.tileX;
    const ty = target.entry.tileY;
    const dx = tx - fromX;
    const dy = ty - fromY;
    const stepX = dx === 0 ? 0 : Math.sign(dx);
    const stepY = dy === 0 ? 0 : Math.sign(dy);
    if (stepX === 0 && stepY === 0) return false;

    let moved = 0;
    let last = null;
    for (let i = 1; i <= distance; i += 1) {
      const nx = tx + stepX * i;
      const ny = ty + stepY * i;
      if (!isTileAvailable(mapInfo, nx, ny)) break;
      if (mapInfo?.blocked?.has(`${nx},${ny}`)) break;
      if (occupied.has(`${nx},${ny}`)) break;
      last = { x: nx, y: ny };
      moved = i;
    }
    const blockedCells = distance - moved;
    if (blockedCells > 0) {
      const pushBonus = clampNonNegative(caster.stats?.pushDamage ?? 0);
      const pushDamage = Math.max(0, blockedCells * 9 + pushBonus);
      if (pushDamage > 0) {
        applyDamageToEntry(combat, caster, target, { id: "push" }, pushDamage, caster.kind);
      }
    }
    if (!last) return blockedCells > 0;

    occupied.delete(`${tx},${ty}`);
    occupied.add(`${last.x},${last.y}`);
    target.entry.tileX = last.x;
    target.entry.tileY = last.y;
    if (target.kind === "player") {
      const p = state.players[target.entry.playerId];
      if (p) {
        p.x = last.x;
        p.y = last.y;
      }
    }
    return true;
  };

  const tryPullCasterToMelee = (combat, caster, target, mapInfo, occupied) => {
    const fromX = caster.tileX;
    const fromY = caster.tileY;
    const tx = target.entry.tileX;
    const ty = target.entry.tileY;
    const dx = tx - fromX;
    const dy = ty - fromY;
    const stepX = dx === 0 ? 0 : Math.sign(dx);
    const stepY = dy === 0 ? 0 : Math.sign(dy);
    if (stepX === 0 && stepY === 0) return false;
    const dist = Math.max(0, Math.abs(dx) + Math.abs(dy) - 1);
    if (dist <= 0) return false;

    let last = null;
    for (let i = 1; i <= dist; i += 1) {
      const nx = fromX + stepX * i;
      const ny = fromY + stepY * i;
      if (!isTileAvailable(mapInfo, nx, ny)) break;
      if (mapInfo?.blocked?.has(`${nx},${ny}`)) break;
      if (occupied.has(`${nx},${ny}`)) break;
      if (nx === tx && ny === ty) break;
      last = { x: nx, y: ny };
    }
    if (!last) return false;
    occupied.delete(`${fromX},${fromY}`);
    occupied.add(`${last.x},${last.y}`);
    if (caster.kind === "player") {
      const p = state.players[caster.playerId];
      if (p) {
        p.x = last.x;
        p.y = last.y;
      }
      const entry = ensureCombatSnapshot(combat)?.players.find((pEntry) => pEntry && pEntry.playerId === caster.playerId);
      if (entry) {
        entry.tileX = last.x;
        entry.tileY = last.y;
      }
    } else {
      const entry = findSnapshotMonster(ensureCombatSnapshot(combat), caster);
      if (entry) {
        entry.tileX = last.x;
        entry.tileY = last.y;
      }
    }
    return true;
  };

  const applyAreaBuff = (combat, caster, buffDef) => {
    if (!buffDef || !Array.isArray(buffDef.effects)) return false;
    const snapshot = ensureCombatSnapshot(combat);
    if (!snapshot) return false;
    const radius =
      typeof buffDef.radius === "number" && buffDef.radius >= 0 ? buffDef.radius : 0;
    const originX = caster.tileX;
    const originY = caster.tileY;
    const targets =
      caster.kind === "player"
        ? [
            ...(Array.isArray(snapshot.players) ? snapshot.players : []),
            ...(Array.isArray(snapshot.summons) ? snapshot.summons : []),
          ]
        : snapshot.monsters;
    if (!Array.isArray(targets)) return false;
    const casterHpMax =
      Number.isFinite(caster.stats?.hpMax) ? caster.stats.hpMax : caster.entry?.hpMax ?? 0;
    const sourceName =
      caster.kind === "player"
        ? state.players[caster.playerId]?.displayName || "Joueur"
        : getMonsterDef(caster.monsterId)?.label || "Monstre";

    targets.forEach((target) => {
      if (!target || !Number.isInteger(target.tileX) || !Number.isInteger(target.tileY)) {
        return;
      }
      if (!isAlive(target)) return;
      const dist =
        Math.abs(target.tileX - originX) + Math.abs(target.tileY - originY);
      if (dist > radius) return;

      buffDef.effects.forEach((effect) => {
        if (!effect) return;
        let resolved = effect;
        if (effect.type === "shield") {
          const percent = typeof effect.percent === "number" ? effect.percent : null;
          const amount =
            typeof effect.amount === "number"
              ? effect.amount
              : percent !== null
                ? Math.round(casterHpMax * percent)
                : 0;
          resolved = {
            ...effect,
            amount,
            label: effect.label || `Bouclier ${amount}`,
          };
        }
        applyStatusEffect(target, resolved, sourceName);
      });
    });

    return true;
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
