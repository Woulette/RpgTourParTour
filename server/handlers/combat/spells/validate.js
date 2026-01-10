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

function isAlive(entry) {
  if (!entry) return false;
  const hp = Number.isFinite(entry.hp) ? entry.hp : Number.isFinite(entry.hpMax) ? entry.hpMax : 0;
  return hp > 0;
}

function getOccupiedMap(snapshot) {
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
}

function findTargetAtTile(snapshot, tileX, tileY, casterKind) {
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
}

function isTileAvailable(mapInfo, x, y) {
  if (!mapInfo || !Number.isInteger(mapInfo.width) || !Number.isInteger(mapInfo.height)) {
    return true;
  }
  if (x < 0 || y < 0 || x >= mapInfo.width || y >= mapInfo.height) return false;
  return true;
}

function hasLineOfSight(mapInfo, occupied, fromX, fromY, toX, toY) {
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
}

module.exports = {
  buildPatternTiles,
  isAlive,
  getOccupiedMap,
  findTargetAtTile,
  isTileAvailable,
  hasLineOfSight,
};
