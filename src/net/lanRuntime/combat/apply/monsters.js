import { createMonster } from "../../../../entities/monster.js";
import { unblockTile } from "../../../../collision/collisionGrid.js";

export function applyCombatMonstersState({
  scene,
  updateBlockedTile,
  buildEntityWorldPosition,
  msg,
}) {
  if (!Array.isArray(msg.monsters)) return;
  const nextMonsters = [];
  const kept = new Set();
  msg.monsters.forEach((m, idx) => {
    const combatIndex = Number.isInteger(m?.combatIndex) ? m.combatIndex : idx;
    const tileX = Number.isInteger(m.tileX) ? m.tileX : null;
    const tileY = Number.isInteger(m.tileY) ? m.tileY : null;
    if (tileX === null || tileY === null) return;
    let target = null;
    if (Number.isInteger(m?.entityId) && Array.isArray(scene.combatMonsters)) {
      target =
        scene.combatMonsters.find((entry) => entry?.entityId === m.entityId) || null;
    }
    if (!target && Number.isInteger(combatIndex) && Array.isArray(scene.combatMonsters)) {
      target = scene.combatMonsters[combatIndex] || null;
    }
    if (!target && typeof m.monsterId === "string") {
      const mapForMove = scene.combatMap || scene.map;
      const layerForMove = scene.combatGroundLayer || scene.groundLayer;
      if (!mapForMove || !layerForMove) return;
      const wp = mapForMove.tileToWorldXY(
        tileX,
        tileY,
        undefined,
        undefined,
        layerForMove
      );
      if (!wp) return;
      const created = createMonster(
        scene,
        wp.x + mapForMove.tileWidth / 2,
        wp.y + mapForMove.tileHeight,
        m.monsterId,
        null
      );
      if (!created) return;
      const offX = typeof created.renderOffsetX === "number" ? created.renderOffsetX : 0;
      const offY = typeof created.renderOffsetY === "number" ? created.renderOffsetY : 0;
      created.x += offX;
      created.y += offY;
      created.tileX = tileX;
      created.tileY = tileY;
      created.currentTileX = tileX;
      created.currentTileY = tileY;
      created.entityId = Number.isInteger(m.entityId) ? m.entityId : null;
      created.combatIndex = Number.isInteger(combatIndex) ? combatIndex : null;
      created.isCombatMember = true;
      created.isCombatOnly = true;
      if (Number.isInteger(m.level)) {
        created.level = m.level;
      }
      if (created.stats) {
        created.stats.hp = Number.isFinite(m.hp) ? m.hp : created.stats.hp;
        created.stats.hpMax = Number.isFinite(m.hpMax) ? m.hpMax : created.stats.hpMax;
      }
      if (!Array.isArray(scene.combatMonsters)) {
        scene.combatMonsters = [];
      }
      if (!Array.isArray(scene.monsters)) {
        scene.monsters = [];
      }
      scene.monsters.push(created);
      target = created;
    }
    if (!target) return;
    if (Number.isInteger(combatIndex)) {
      target.combatIndex = combatIndex;
    }
    const isMoving =
      target.isMoving === true ||
      !!target.currentMoveTween ||
      !!target.__lanCombatMoveTween ||
      !!target.__lanMoveTween;
    if (!isMoving || msg.resync === true || scene.prepState?.actif) {
      const pos = buildEntityWorldPosition(target, tileX, tileY);
      if (!pos) return;
      target.x = pos.x;
      target.y = pos.y;
      target.tileX = tileX;
      target.tileY = tileY;
      target.currentTileX = tileX;
      target.currentTileY = tileY;
      if (typeof target.setDepth === "function") {
        target.setDepth(target.y);
      }
      target.__lanCombatPlaced = true;
      if (scene.prepState?.actif && typeof updateBlockedTile === "function") {
        updateBlockedTile(target, tileX, tileY);
      }
    }
    if (target.stats) {
      target.stats.hp = Number.isFinite(m.hp) ? m.hp : target.stats.hp;
      target.stats.hpMax = Number.isFinite(m.hpMax) ? m.hpMax : target.stats.hpMax;
    }
    if (Number.isInteger(m.level)) {
      target.level = m.level;
    }
    if (Array.isArray(m.statusEffects)) {
      target.statusEffects = m.statusEffects.slice();
    }
    if (target.stats && typeof target.stats.hp === "number" && target.stats.hp <= 0) {
      target._deathHandled = true;
      if (target.blocksMovement && target._blockedTile) {
        unblockTile(scene, target._blockedTile.x, target._blockedTile.y);
        target._blockedTile = null;
      }
      if (typeof target.destroy === "function") {
        target.destroy();
      }
      if (Array.isArray(scene.combatMonsters)) {
        scene.combatMonsters = scene.combatMonsters.filter((mInner) => mInner && mInner !== target);
      }
      if (Array.isArray(scene.monsters)) {
        scene.monsters = scene.monsters.filter((mInner) => mInner && mInner !== target);
      }
      return;
    }
    if (Number.isInteger(m?.entityId) && !Number.isInteger(target.entityId)) {
      target.entityId = m.entityId;
    }
    if (Number.isInteger(combatIndex)) {
      nextMonsters[combatIndex] = target;
    } else {
      nextMonsters.push(target);
    }
    kept.add(target);
  });

  if (Array.isArray(scene.combatMonsters)) {
    scene.combatMonsters.forEach((monster) => {
      if (!monster || kept.has(monster)) return;
      if (monster.isCombatOnly && typeof monster.destroy === "function") {
        monster.destroy();
      }
      if (monster.blocksMovement && monster._blockedTile) {
        unblockTile(scene, monster._blockedTile.x, monster._blockedTile.y);
        monster._blockedTile = null;
      }
      if (Array.isArray(scene.monsters)) {
        scene.monsters = scene.monsters.filter((m) => m && m !== monster);
      }
      monster.isCombatMember = false;
    });
  }

  scene.combatMonsters = nextMonsters;
}
