import { getNetPlayerId } from "../../../app/session.js";
import { createMonster } from "../../../entities/monster.js";
import { blockTile, unblockTile } from "../../../collision/collisionGrid.js";
import {
  playMonsterMoveAnimation,
  stopMonsterMoveAnimation,
} from "../../../features/monsters/runtime/animations.js";
import { PLAYER_SPEED } from "../../../config/constants.js";

export function createCombatHelpers(ctx) {
  const {
    scene,
    player,
    getCurrentMapObj,
    getCurrentGroundLayer,
    findWorldMonsterByEntityId,
  } = ctx;

  const buildCombatLeaderFromEntry = (entry) => {
    if (!entry || typeof entry.monsterId !== "string") return null;
    const currentMap = getCurrentMapObj();
    const currentLayer = getCurrentGroundLayer();
    if (!currentMap || !currentLayer) return null;
    const tileX = Number.isInteger(entry.tileX) ? entry.tileX : null;
    const tileY = Number.isInteger(entry.tileY) ? entry.tileY : null;
    if (tileX === null || tileY === null) return null;

    const existing =
      Number.isInteger(entry.entityId) && findWorldMonsterByEntityId(entry.entityId);
    if (existing) return existing;

    const wp = currentMap.tileToWorldXY(
      tileX,
      tileY,
      undefined,
      undefined,
      currentLayer
    );
    if (!wp) return null;

    let monster = null;
    try {
      monster = createMonster(
        scene,
        wp.x + currentMap.tileWidth / 2,
        wp.y + currentMap.tileHeight,
        entry.monsterId,
        entry.level
      );
    } catch {
      return null;
    }

    const offX = typeof monster.renderOffsetX === "number" ? monster.renderOffsetX : 0;
    const offY = typeof monster.renderOffsetY === "number" ? monster.renderOffsetY : 0;
    monster.x += offX;
    monster.y += offY;

    monster.entityId = Number.isInteger(entry.entityId) ? entry.entityId : null;
    monster.tileX = tileX;
    monster.tileY = tileY;
    monster.groupId = Number.isInteger(entry.groupId) ? entry.groupId : null;
    monster.groupSize = Number.isInteger(entry.groupSize) ? entry.groupSize : 1;
    monster.groupMonsterIds = Array.isArray(entry.groupMonsterIds)
      ? entry.groupMonsterIds.slice()
      : null;
    monster.groupLevels = Array.isArray(entry.groupLevels)
      ? entry.groupLevels.slice()
      : null;
    monster.groupLevelTotal = Number.isInteger(entry.groupLevelTotal)
      ? entry.groupLevelTotal
      : null;
    monster.spawnMapKey = typeof entry.spawnMapKey === "string" ? entry.spawnMapKey : null;
    monster.respawnTemplate =
      entry.respawnTemplate && typeof entry.respawnTemplate === "object"
        ? {
            groupPool: Array.isArray(entry.respawnTemplate.groupPool)
              ? entry.respawnTemplate.groupPool.slice()
              : [],
            groupSizeMin: entry.respawnTemplate.groupSizeMin ?? null,
            groupSizeMax: entry.respawnTemplate.groupSizeMax ?? null,
            forceMixedGroup: entry.respawnTemplate.forceMixedGroup === true,
          }
        : null;
    monster.isCombatMember = true;

    scene.monsters = scene.monsters || [];
    scene.monsters.push(monster);
    return monster;
  };

  const getEntityTile = (entity) => {
    if (!entity) return null;
    const tx =
      typeof entity.currentTileX === "number"
        ? entity.currentTileX
        : typeof entity.tileX === "number"
          ? entity.tileX
          : null;
    const ty =
      typeof entity.currentTileY === "number"
        ? entity.currentTileY
        : typeof entity.tileY === "number"
          ? entity.tileY
          : null;
    if (tx !== null && ty !== null) return { x: tx, y: ty };

    const mapForCast = scene.combatMap || scene.map;
    const layerForCast = scene.combatGroundLayer || scene.groundLayer;
    if (
      mapForCast &&
      layerForCast &&
      typeof mapForCast.worldToTileXY === "function"
    ) {
      try {
        const t = mapForCast.worldToTileXY(
          entity.x,
          entity.y,
          true,
          undefined,
          undefined,
          layerForCast
        );
        if (t && typeof t.x === "number" && typeof t.y === "number") {
          return { x: t.x, y: t.y };
        }
      } catch {
        // ignore
      }
    }

    return null;
  };

  const updateBlockedTile = (entity, tileX, tileY) => {
    if (!entity) return;
    if (!Number.isInteger(tileX) || !Number.isInteger(tileY)) return;
    entity.blocksMovement = true;
    if (entity._blockedTile) {
      unblockTile(scene, entity._blockedTile.x, entity._blockedTile.y);
    }
    blockTile(scene, tileX, tileY);
    entity._blockedTile = { x: tileX, y: tileY };
  };

  const findCombatMonsterByEntityId = (entityId) => {
    if (!Number.isInteger(entityId)) return null;
    const list = Array.isArray(scene.combatMonsters)
      ? scene.combatMonsters
      : scene.monsters || [];
    return list.find((m) => m && m.entityId === entityId) || null;
  };

  const findCombatMonsterByIndex = (combatIndex) => {
    if (!Number.isInteger(combatIndex)) return null;
    const list = Array.isArray(scene.combatMonsters) ? scene.combatMonsters : [];
    if (combatIndex < 0 || combatIndex >= list.length) return null;
    return list[combatIndex] || null;
  };

  const buildLanActorsOrder = (entry) => {
    if (!entry || !scene?.combatState?.enCours) return null;
    const participantIds = Array.isArray(entry.participantIds)
      ? entry.participantIds.map((id) => Number(id)).filter((id) => Number.isInteger(id))
      : [];
    if (participantIds.length === 0) return null;

    const localId = getNetPlayerId();
    const allies = Array.isArray(scene.combatAllies) ? scene.combatAllies : [];
    const players = participantIds
      .map((id) => {
        if (localId && id === localId) return scene.combatState?.joueur || player;
        return allies.find((ally) => ally?.isPlayerAlly && Number(ally.netId) === id) || null;
      })
      .filter((p) => p);

    const monsters = Array.isArray(scene.combatMonsters)
      ? scene.combatMonsters.slice()
      : [];
    monsters.sort((a, b) => {
      const ia = a?.stats?.initiative ?? 0;
      const ib = b?.stats?.initiative ?? 0;
      if (ib !== ia) return ib - ia;
      const ea = Number.isInteger(a?.entityId) ? a.entityId : 0;
      const eb = Number.isInteger(b?.entityId) ? b.entityId : 0;
      return ea - eb;
    });

    const actors = [];
    let pIdx = 0;
    let mIdx = 0;
    let nextSide = "joueur";

    while (pIdx < players.length || mIdx < monsters.length) {
      if (nextSide === "joueur" && pIdx < players.length) {
        actors.push({ kind: "joueur", entity: players[pIdx] });
        pIdx += 1;
        nextSide = "monstre";
        continue;
      }
      if (nextSide === "monstre" && mIdx < monsters.length) {
        actors.push({ kind: "monstre", entity: monsters[mIdx] });
        mIdx += 1;
        nextSide = "joueur";
        continue;
      }
      if (pIdx < players.length) {
        actors.push({ kind: "joueur", entity: players[pIdx] });
        pIdx += 1;
      } else if (mIdx < monsters.length) {
        actors.push({ kind: "monstre", entity: monsters[mIdx] });
        mIdx += 1;
      }
    }

    return actors.length > 0 ? actors : null;
  };

  const moveCombatMonsterAlongPathNetwork = (monster, steps) => {
    if (!monster || !Array.isArray(steps) || steps.length === 0) return;
    if (!scene?.tweens) return;
    const mapForMove = scene.combatMap || scene.map;
    const layerForMove = scene.combatGroundLayer || scene.groundLayer;
    if (!mapForMove || !layerForMove) return;

    const next = steps[0];
    if (!next || !Number.isInteger(next.x) || !Number.isInteger(next.y)) return;

    const wp = mapForMove.tileToWorldXY(
      next.x,
      next.y,
      undefined,
      undefined,
      layerForMove
    );
    if (!wp) return;

    const offX = typeof monster.renderOffsetX === "number" ? monster.renderOffsetX : 0;
    const offY = typeof monster.renderOffsetY === "number" ? monster.renderOffsetY : 0;
    const targetX = wp.x + mapForMove.tileWidth / 2 + offX;
    const targetY = wp.y + mapForMove.tileHeight + offY;

    if (monster.__lanCombatMoveTween) {
      monster.__lanCombatMoveTween.stop();
      monster.__lanCombatMoveTween = null;
    }

    monster.isMoving = true;
    playMonsterMoveAnimation(scene, monster, targetX - monster.x, targetY - monster.y);

    const dist = Phaser.Math.Distance.Between(
      monster.x,
      monster.y,
      targetX,
      targetY
    );
    const duration = (dist / PLAYER_SPEED) * 1000;

    monster.__lanCombatMoveTween = scene.tweens.add({
      targets: monster,
      x: targetX,
      y: targetY,
      duration,
      ease: "Linear",
      onComplete: () => {
        monster.x = targetX;
        monster.y = targetY;
        monster.tileX = next.x;
        monster.tileY = next.y;
        monster.currentTileX = next.x;
        monster.currentTileY = next.y;
        if (typeof monster.setDepth === "function") {
          monster.setDepth(wp.y + mapForMove.tileHeight);
        }
        if (steps.length > 1) {
          moveCombatMonsterAlongPathNetwork(monster, steps.slice(1));
          return;
        }
        monster.__lanCombatMoveTween = null;
        monster.isMoving = false;
        stopMonsterMoveAnimation(monster);
      },
      onStop: () => {
        monster.__lanCombatMoveTween = null;
        monster.isMoving = false;
        stopMonsterMoveAnimation(monster);
      },
    });
  };

  const findActorIndexByPlayerId = (actors, playerId) => {
    if (!Array.isArray(actors) || !Number.isInteger(playerId)) return -1;
    return actors.findIndex((actor) => {
      if (!actor || actor.kind !== "joueur") return false;
      const ent = actor.entity;
      if (!ent) return false;
      const id =
        Number.isInteger(ent.netId) ? ent.netId : Number.isInteger(ent.id) ? ent.id : null;
      return id === playerId;
    });
  };

  const findNextActorIndexByKind = (actors, startIndex, kind) => {
    if (!Array.isArray(actors) || actors.length === 0) return -1;
    const total = actors.length;
    const start = Number.isInteger(startIndex) ? startIndex : -1;
    for (let step = 1; step <= total; step += 1) {
      const idx = (start + step) % total;
      const actor = actors[idx];
      if (!actor || actor.kind !== kind) continue;
      const hp =
        typeof actor.entity?.stats?.hp === "number"
          ? actor.entity.stats.hp
          : actor.entity?.stats?.hpMax ?? 0;
      if (hp <= 0) continue;
      return idx;
    }
    return -1;
  };

  return {
    buildCombatLeaderFromEntry,
    getEntityTile,
    updateBlockedTile,
    findCombatMonsterByEntityId,
    findCombatMonsterByIndex,
    buildLanActorsOrder,
    moveCombatMonsterAlongPathNetwork,
    findActorIndexByPlayerId,
    findNextActorIndexByKind,
  };
}
