function createCombatAiHandlers(ctx, helpers) {
  const {
    state,
    broadcast,
    getMonsterDef,
    getSpellDef,
    rollSpellDamage,
    debugLog,
  } = ctx;
  const { ensureCombatSnapshot, upsertSnapshotMonster, applyDamageToCombatSnapshot } =
    helpers;

  const COMBAT_STEP_MS = 350;

  const getMonsterStats = (monsterId) => {
    const def = typeof getMonsterDef === "function" ? getMonsterDef(monsterId) : null;
    const stats = def?.statsOverrides || {};
    return {
      initiative: Number.isFinite(stats.initiative) ? stats.initiative : 0,
      pm: Number.isFinite(stats.pm) ? stats.pm : 3,
    };
  };

  const isAliveMonster = (entry) => {
    if (!entry) return false;
    const hp = Number.isFinite(entry.hp) ? entry.hp : Number.isFinite(entry.hpMax) ? entry.hpMax : 0;
    return hp > 0;
  };

  const isAlivePlayer = (entry) => {
    if (!entry) return false;
    const hp = Number.isFinite(entry.hp) ? entry.hp : Number.isFinite(entry.hpMax) ? entry.hpMax : 0;
    return hp > 0;
  };

  const buildCombatActorOrder = (combat) => {
    if (!combat) return [];
    const snapshot = ensureCombatSnapshot(combat);
    if (!snapshot) return [];

    const participants = Array.isArray(combat.participantIds)
      ? combat.participantIds.map((id) => Number(id)).filter((id) => Number.isInteger(id))
      : [];
    const players = participants.map((id) => ({ kind: "joueur", playerId: id }));

    const monsters = (Array.isArray(snapshot.monsters) ? snapshot.monsters : [])
      .filter((m) => isAliveMonster(m))
      .map((m, idx) => {
        const stats = getMonsterStats(m.monsterId);
        return {
          kind: "monstre",
          entityId: Number.isInteger(m.entityId) ? m.entityId : null,
          combatIndex: Number.isInteger(m.combatIndex) ? m.combatIndex : idx,
          monsterId: m.monsterId || null,
          initiative: stats.initiative,
        };
      })
      .sort((a, b) => {
        if (b.initiative !== a.initiative) return b.initiative - a.initiative;
        const ea = Number.isInteger(a.entityId) ? a.entityId : 0;
        const eb = Number.isInteger(b.entityId) ? b.entityId : 0;
        return ea - eb;
      });

    const actors = [];
    let pIdx = 0;
    let mIdx = 0;
    let nextSide = "joueur";
    while (pIdx < players.length || mIdx < monsters.length) {
      if (nextSide === "joueur" && pIdx < players.length) {
        actors.push(players[pIdx]);
        pIdx += 1;
        nextSide = "monstre";
        continue;
      }
      if (nextSide === "monstre" && mIdx < monsters.length) {
        actors.push(monsters[mIdx]);
        mIdx += 1;
        nextSide = "joueur";
        continue;
      }
      if (pIdx < players.length) {
        actors.push(players[pIdx]);
        pIdx += 1;
      } else if (mIdx < monsters.length) {
        actors.push(monsters[mIdx]);
        mIdx += 1;
      } else {
        break;
      }
    }

    combat.actorOrder = actors;
    return actors;
  };

  const buildBlockedTiles = (snapshot, exceptEntityId) => {
    const blocked = new Set();
    const players = Array.isArray(snapshot.players) ? snapshot.players : [];
    const monsters = Array.isArray(snapshot.monsters) ? snapshot.monsters : [];

    players.forEach((p) => {
      if (!isAlivePlayer(p)) return;
      if (!Number.isInteger(p.tileX) || !Number.isInteger(p.tileY)) return;
      blocked.add(`${p.tileX},${p.tileY}`);
    });

    monsters.forEach((m) => {
      if (!isAliveMonster(m)) return;
      if (!Number.isInteger(m.tileX) || !Number.isInteger(m.tileY)) return;
      if (Number.isInteger(exceptEntityId) && m.entityId === exceptEntityId) return;
      blocked.add(`${m.tileX},${m.tileY}`);
    });

    return blocked;
  };

  const isTileBlocked = (blocked, x, y) => blocked.has(`${x},${y}`);

  const findNearestPlayer = (snapshot, fromX, fromY) => {
    const players = Array.isArray(snapshot.players) ? snapshot.players : [];
    let best = null;
    let bestDist = Infinity;
    players.forEach((p) => {
      if (!isAlivePlayer(p)) return;
      if (!Number.isInteger(p.tileX) || !Number.isInteger(p.tileY)) return;
      const d = Math.abs(p.tileX - fromX) + Math.abs(p.tileY - fromY);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    });
    return best;
  };

  const pickAdjacentTargetTile = (target, fromX, fromY, bounds, blocked) => {
    const dirs = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];
    let best = null;
    let bestDist = Infinity;
    dirs.forEach(({ dx, dy }) => {
      const x = target.tileX + dx;
      const y = target.tileY + dy;
      if (x < 0 || y < 0 || x >= bounds.width || y >= bounds.height) return;
      if (isTileBlocked(blocked, x, y)) return;
      const d = Math.abs(x - fromX) + Math.abs(y - fromY);
      if (d < bestDist) {
        bestDist = d;
        best = { x, y };
      }
    });
    return best;
  };

  const buildMovePath = (fromX, fromY, toX, toY, maxSteps, bounds, blocked) => {
    const steps = [];
    let x = fromX;
    let y = fromY;
    for (let i = 0; i < maxSteps; i += 1) {
      if (x === toX && y === toY) break;
      const dx = toX - x;
      const dy = toY - y;
      const candidates = [];
      if (dx !== 0) candidates.push({ x: x + Math.sign(dx), y });
      if (dy !== 0) candidates.push({ x, y: y + Math.sign(dy) });
      if (candidates.length === 0) break;

      let next = null;
      for (const cand of candidates) {
        if (cand.x < 0 || cand.y < 0 || cand.x >= bounds.width || cand.y >= bounds.height) {
          continue;
        }
        if (isTileBlocked(blocked, cand.x, cand.y)) continue;
        next = cand;
        break;
      }
      if (!next) break;
      steps.push(next);
      blocked.add(`${next.x},${next.y}`);
      x = next.x;
      y = next.y;
    }
    return steps;
  };

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
  };
}

module.exports = {
  createCombatAiHandlers,
};
