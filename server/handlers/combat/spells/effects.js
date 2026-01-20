function createSpellEffectsHelpers({
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
}) {
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
      const entry = ensureCombatSnapshot(combat)?.players.find(
        (pEntry) => pEntry && pEntry.playerId === caster.playerId
      );
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

  return {
    applyStatusEffect,
    applyAreaBuff,
    tryPushTarget,
    tryPullCasterToMelee,
    spawnCapturedSummon,
    hasAliveSummonForOwner,
    convertEryonChargesToPuissance,
  };
}

module.exports = {
  createSpellEffectsHelpers,
};
