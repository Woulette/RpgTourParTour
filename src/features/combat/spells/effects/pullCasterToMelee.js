import { isTileBlocked } from "../../../../collision/collisionGrid.js";
import { isTileOccupiedByMonster } from "../../../../features/monsters/ai/aiUtils.js";
import { isTileAvailableForSpell } from "../utils/util.js";

export function applyPullCasterToMeleeEffect(ctx) {
  const { scene, caster, target, tileX, tileY, map, groundLayer } = ctx;
  if (!scene || !caster || !target || !map) return false;

  const casterTileX =
    typeof caster.currentTileX === "number"
      ? caster.currentTileX
      : typeof caster.tileX === "number"
      ? caster.tileX
      : null;
  const casterTileY =
    typeof caster.currentTileY === "number"
      ? caster.currentTileY
      : typeof caster.tileY === "number"
      ? caster.tileY
      : null;
  const targetTileX = typeof target.tileX === "number" ? target.tileX : tileX;
  const targetTileY = typeof target.tileY === "number" ? target.tileY : tileY;

  if (
    typeof casterTileX !== "number" ||
    typeof casterTileY !== "number" ||
    typeof targetTileX !== "number" ||
    typeof targetTileY !== "number"
  ) {
    return false;
  }

  const dx = targetTileX - casterTileX;
  const dy = targetTileY - casterTileY;
  const stepX = dx === 0 ? 0 : Math.sign(dx);
  const stepY = dy === 0 ? 0 : Math.sign(dy);

  const preferred = { x: targetTileX - stepX, y: targetTileY - stepY };
  const candidates = [
    preferred,
    { x: targetTileX + 1, y: targetTileY },
    { x: targetTileX - 1, y: targetTileY },
    { x: targetTileX, y: targetTileY + 1 },
    { x: targetTileX, y: targetTileY - 1 },
  ];

  const isFree = (tx, ty) => {
    if (!isTileAvailableForSpell(map, tx, ty)) return false;
    if (isTileBlocked(scene, tx, ty)) return false;
    if (isTileOccupiedByMonster(scene, tx, ty, null)) return false;
    if (tx === targetTileX && ty === targetTileY) return false;
    return true;
  };

  const chosen = candidates.find((c) => isFree(c.x, c.y));
  if (!chosen) return false;

  const wp = map.tileToWorldXY(chosen.x, chosen.y, undefined, undefined, groundLayer);
  const cx = wp.x + map.tileWidth / 2;
  const cy = wp.y + map.tileHeight / 2;

  if (caster.currentMoveTween) {
    caster.currentMoveTween.stop();
    caster.currentMoveTween = null;
  }
  caster.isMoving = false;

  caster.x = cx;
  caster.y = cy;
  caster.currentTileX = chosen.x;
  caster.currentTileY = chosen.y;
  if (typeof caster.setDepth === "function") {
    caster.setDepth(caster.y);
  }
  return true;
}
