export function getEntityTile(entity, map, groundLayer) {
  const tx =
    typeof entity?.tileX === "number"
      ? entity.tileX
      : typeof entity?.currentTileX === "number"
        ? entity.currentTileX
        : null;
  const ty =
    typeof entity?.tileY === "number"
      ? entity.tileY
      : typeof entity?.currentTileY === "number"
        ? entity.currentTileY
        : null;
  if (typeof tx === "number" && typeof ty === "number") {
    return { x: tx, y: ty };
  }
  if (!map || !groundLayer || typeof map.worldToTileXY !== "function") return null;
  const t = map.worldToTileXY(entity.x, entity.y, true, undefined, undefined, groundLayer);
  return t ? { x: t.x, y: t.y } : null;
}

function getDirectionName(dx, dy) {
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDx < 1e-3 && absDy < 1e-3) {
    return null;
  }

  if (dx >= 0 && dy < 0) return "north-east";
  if (dx < 0 && dy < 0) return "north-west";
  if (dx >= 0 && dy >= 0) return "south-east";
  return "south-west";
}

function resolveMonsterFacing(dx, dy) {
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? "east" : "west";
  }
  return dy > 0 ? "south" : "north";
}

export function applyCasterFacing(scene, caster, originTile, targetTile, isPlayerCaster, map, groundLayer) {
  if (!scene || !caster || !originTile || !targetTile || !map || !groundLayer) return;
  const originWorld = map.tileToWorldXY(
    originTile.x,
    originTile.y,
    undefined,
    undefined,
    groundLayer
  );
  const targetWorld = map.tileToWorldXY(
    targetTile.x,
    targetTile.y,
    undefined,
    undefined,
    groundLayer
  );
  if (!originWorld || !targetWorld) return;

  const originX = originWorld.x + map.tileWidth / 2;
  const originY = originWorld.y + map.tileHeight / 2;
  const targetX = targetWorld.x + map.tileWidth / 2;
  const targetY = targetWorld.y + map.tileHeight / 2;
  const dx = targetX - originX;
  const dy = targetY - originY;
  const useDiagonalFacing = isPlayerCaster || caster?.useDiagonalFacing === true;
  const dir = useDiagonalFacing ? getDirectionName(dx, dy) : resolveMonsterFacing(dx, dy);
  if (!dir) return;

  caster.lastDirection = dir;
  if (typeof caster?.setTexture !== "function") return;

  const prefix = caster.animPrefix || caster.baseTextureKey;
  if (!prefix) return;

  const idleKey = `${prefix}_idle_${dir}`;
  if (scene?.textures?.exists?.(idleKey)) {
    caster.setTexture(idleKey);
  }
}
