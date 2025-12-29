import { blockTile, isTileBlocked, unblockTile } from "../../../../collision/collisionGrid.js";
import { isTileOccupiedByMonster } from "../../../monsters/ai/aiUtils.js";
import { endCombat } from "../../runtime/runtime.js";
import { showFloatingTextOverEntity } from "../../runtime/floatingText.js";
import { isTileAvailableForSpell } from "../util.js";
import { getEntityTile } from "./castPosition.js";

function isPlayerAtTile(scene, map, groundLayer, tileX, tileY) {
  const player = scene?.combatState?.joueur;
  if (!player) return false;
  const pos = getEntityTile(player, map, groundLayer);
  if (!pos) return false;
  return pos.x === tileX && pos.y === tileY;
}

function applyPushbackDamage(scene, caster, target, blockedCells) {
  if (!scene || !target || !caster) return false;
  const cells = Math.max(0, blockedCells | 0);
  if (cells <= 0) return false;

  const stats = target.stats || {};
  const currentHp = typeof stats.hp === "number" ? stats.hp : stats.hpMax ?? 0;
  if (currentHp <= 0) return false;

  const casterBonus =
    typeof caster.stats?.pushDamage === "number" ? caster.stats.pushDamage : 0;
  const damage = Math.max(0, cells * 9 + casterBonus);
  if (damage <= 0) return false;

  const newHp = Math.max(0, currentHp - damage);
  stats.hp = newHp;

  showFloatingTextOverEntity(scene, target, `-${damage}`, { color: "#ff4444" });

  const isPlayerTarget = target === scene?.combatState?.joueur;
  if (isPlayerTarget && typeof target.updateHudHp === "function") {
    const hpMax = stats.hpMax ?? newHp;
    target.updateHudHp(newHp, hpMax);
  }
  if (scene && typeof scene.updateCombatUi === "function") {
    scene.updateCombatUi();
  }

  if (newHp > 0) return true;

  if (isPlayerTarget) {
    if (scene.combatState) {
      scene.combatState.issue = "defaite";
    }
    endCombat(scene);
    return true;
  }

  if (typeof target.onKilled === "function") {
    target.onKilled(scene, caster);
  }
  if (target.blocksMovement && target._blockedTile) {
    unblockTile(scene, target._blockedTile.x, target._blockedTile.y);
    target._blockedTile = null;
  }
  if (typeof target.destroy === "function") {
    target.destroy();
  }
  if (scene.monsters) {
    scene.monsters = scene.monsters.filter((m) => m !== target);
  }
  if (scene.combatMonsters && Array.isArray(scene.combatMonsters)) {
    scene.combatMonsters = scene.combatMonsters.filter((m) => m && m !== target);
  }
  return true;
}

export function tryPushEntity(scene, map, groundLayer, caster, target, distance) {
  if (!scene || !map || !caster || !target) return false;
  const dist = typeof distance === "number" ? Math.max(0, distance) : 0;
  if (dist <= 0) return false;

  const origin = getEntityTile(caster, map, groundLayer);
  const targetPos = getEntityTile(target, map, groundLayer);
  if (!origin || !targetPos) return false;

  const dx = targetPos.x - origin.x;
  const dy = targetPos.y - origin.y;
  const stepX = dx === 0 ? 0 : Math.sign(dx);
  const stepY = dy === 0 ? 0 : Math.sign(dy);
  if (stepX === 0 && stepY === 0) return false;

  let moved = 0;
  let last = null;
  for (let i = 1; i <= dist; i += 1) {
    const nx = targetPos.x + stepX * i;
    const ny = targetPos.y + stepY * i;
    if (!isTileAvailableForSpell(map, nx, ny)) break;
    if (isTileBlocked(scene, nx, ny)) break;
    if (isTileOccupiedByMonster(scene, nx, ny, target)) break;
    if (
      isPlayerAtTile(scene, map, groundLayer, nx, ny) &&
      target !== scene?.combatState?.joueur
    ) {
      break;
    }
    last = { x: nx, y: ny };
    moved = i;
  }

  const blockedCells = dist - moved;
  if (blockedCells > 0) {
    applyPushbackDamage(scene, caster, target, blockedCells);
  }

  if (!last) return blockedCells > 0;

  const wp = map.tileToWorldXY(last.x, last.y, undefined, undefined, groundLayer);
  const isPlayerTarget = target === scene?.combatState?.joueur;
  const offX = !isPlayerTarget && typeof target.renderOffsetX === "number" ? target.renderOffsetX : 0;
  const offY = !isPlayerTarget && typeof target.renderOffsetY === "number" ? target.renderOffsetY : 0;
  const prevBlocked = target._blockedTile;
  target.x = wp.x + map.tileWidth / 2 + offX;
  target.y = wp.y + (isPlayerTarget ? map.tileHeight / 2 : map.tileHeight) + offY;
  if (typeof target.setDepth === "function") {
    const depthY = wp.y + map.tileHeight;
    target.setDepth(depthY);
  }
  if (typeof target.tileX === "number") target.tileX = last.x;
  if (typeof target.tileY === "number") target.tileY = last.y;
  if (typeof target.currentTileX === "number") target.currentTileX = last.x;
  if (typeof target.currentTileY === "number") target.currentTileY = last.y;
  if (target === scene?.combatState?.joueur) {
    target.currentTileX = last.x;
    target.currentTileY = last.y;
  }
  if (target.blocksMovement) {
    if (prevBlocked && typeof prevBlocked.x === "number" && typeof prevBlocked.y === "number") {
      unblockTile(scene, prevBlocked.x, prevBlocked.y);
    }
    blockTile(scene, last.x, last.y);
    target._blockedTile = { x: last.x, y: last.y };
  }
  return true;
}

export function tryPullEntity(scene, map, groundLayer, caster, target, distance, toMelee = false) {
  if (!scene || !map || !caster || !target) return false;
  if (!distance && !toMelee) return false;

  const origin = getEntityTile(caster, map, groundLayer);
  const targetPos = getEntityTile(target, map, groundLayer);
  if (!origin || !targetPos) return false;

  const dx = origin.x - targetPos.x;
  const dy = origin.y - targetPos.y;
  const stepX = dx === 0 ? 0 : Math.sign(dx);
  const stepY = dy === 0 ? 0 : Math.sign(dy);
  if (stepX === 0 && stepY === 0) return false;

  let dist = typeof distance === "number" ? Math.max(0, distance) : 0;
  if (toMelee) {
    const manhattan = Math.abs(dx) + Math.abs(dy);
    dist = Math.max(dist, Math.max(0, manhattan - 1));
  }
  if (dist <= 0) return false;

  let last = null;
  for (let i = 1; i <= dist; i += 1) {
    const nx = targetPos.x + stepX * i;
    const ny = targetPos.y + stepY * i;
    if (!isTileAvailableForSpell(map, nx, ny)) break;
    if (isTileBlocked(scene, nx, ny)) break;
    if (isTileOccupiedByMonster(scene, nx, ny, target)) break;
    if (nx === origin.x && ny === origin.y) break;
    if (
      isPlayerAtTile(scene, map, groundLayer, nx, ny) &&
      target !== scene?.combatState?.joueur
    ) {
      break;
    }
    last = { x: nx, y: ny };
  }

  if (!last) return false;

  const wp = map.tileToWorldXY(last.x, last.y, undefined, undefined, groundLayer);
  const isPlayerTarget = target === scene?.combatState?.joueur;
  const offX = !isPlayerTarget && typeof target.renderOffsetX === "number" ? target.renderOffsetX : 0;
  const offY = !isPlayerTarget && typeof target.renderOffsetY === "number" ? target.renderOffsetY : 0;
  const prevBlocked = target._blockedTile;
  target.x = wp.x + map.tileWidth / 2 + offX;
  target.y = wp.y + (isPlayerTarget ? map.tileHeight / 2 : map.tileHeight) + offY;
  if (typeof target.setDepth === "function") {
    const depthY = wp.y + map.tileHeight;
    target.setDepth(depthY);
  }
  if (typeof target.tileX === "number") target.tileX = last.x;
  if (typeof target.tileY === "number") target.tileY = last.y;
  if (typeof target.currentTileX === "number") target.currentTileX = last.x;
  if (typeof target.currentTileY === "number") target.currentTileY = last.y;
  if (target === scene?.combatState?.joueur) {
    target.currentTileX = last.x;
    target.currentTileY = last.y;
  }
  if (target.blocksMovement) {
    if (prevBlocked && typeof prevBlocked.x === "number" && typeof prevBlocked.y === "number") {
      unblockTile(scene, prevBlocked.x, prevBlocked.y);
    }
    blockTile(scene, last.x, last.y);
    target._blockedTile = { x: last.x, y: last.y };
  }
  return true;
}
