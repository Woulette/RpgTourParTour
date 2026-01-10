function createAiTargets({ isAlivePlayer, isAliveMonster, isAliveSummon }) {
  const buildBlockedTiles = (snapshot, exceptEntityId) => {
    const blocked = new Set();
    const players = Array.isArray(snapshot.players) ? snapshot.players : [];
    const monsters = Array.isArray(snapshot.monsters) ? snapshot.monsters : [];
    const summons = Array.isArray(snapshot.summons) ? snapshot.summons : [];

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

    summons.forEach((s) => {
      if (!isAliveSummon(s)) return;
      if (!Number.isInteger(s.tileX) || !Number.isInteger(s.tileY)) return;
      blocked.add(`${s.tileX},${s.tileY}`);
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

  const findNearestMonster = (snapshot, fromX, fromY) => {
    const monsters = Array.isArray(snapshot.monsters) ? snapshot.monsters : [];
    let best = null;
    let bestDist = Infinity;
    monsters.forEach((m) => {
      if (!isAliveMonster(m)) return;
      if (!Number.isInteger(m.tileX) || !Number.isInteger(m.tileY)) return;
      const d = Math.abs(m.tileX - fromX) + Math.abs(m.tileY - fromY);
      if (d < bestDist) {
        bestDist = d;
        best = m;
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

  return {
    buildBlockedTiles,
    isTileBlocked,
    findNearestPlayer,
    findNearestMonster,
    pickAdjacentTargetTile,
    buildMovePath,
  };
}

module.exports = {
  createAiTargets,
};
