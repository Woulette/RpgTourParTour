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
    remotePlayersData,
    activeCombats,
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
    if (Number.isInteger(entry.combatIndex)) {
      monster.combatIndex = entry.combatIndex;
    }
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
    if (!scene.__lanCombatActorsCache) {
      scene.__lanCombatActorsCache = new Map();
    }
    const participantIds = Array.isArray(entry.participantIds)
      ? entry.participantIds.map((id) => Number(id)).filter((id) => Number.isInteger(id))
      : [];
    if (participantIds.length === 0) return null;

    const localId = getNetPlayerId();
    const allies = Array.isArray(scene.combatAllies) ? scene.combatAllies : [];
    const placeholderCache =
      scene.__lanCombatPlaceholders || (scene.__lanCombatPlaceholders = new Map());
    const getActorKey = (actor) => {
      const ent = actor?.entity;
      if (!ent) return "z:0";
      if (actor.kind === "joueur") {
        const id =
          Number.isInteger(ent.netId) ? ent.netId : Number.isInteger(ent.id) ? ent.id : 0;
        return `p:${id}`;
      }
      if (ent.isCombatAlly) {
        const id =
          Number.isInteger(ent.netId) ? ent.netId : Number.isInteger(ent.id) ? ent.id : 0;
        return `a:${id}`;
      }
      if (Number.isInteger(ent.entityId)) return `m:${ent.entityId}`;
      if (Number.isInteger(ent.combatIndex)) return `m:i:${ent.combatIndex}`;
      if (typeof ent.monsterId === "string") return `m:${ent.monsterId}`;
      return "m:0";
    };
    const isAlive = (actor) => {
      const stats = actor?.entity?.stats || {};
      const hp =
        typeof stats.hp === "number" ? stats.hp : stats.hpMax ?? 0;
      return hp > 0;
    };
    const cached = scene.__lanCombatActorsCache.get(entry.combatId) || null;
    const resolvePlayerEntity = (id) => {
      if (!Number.isInteger(id)) return null;
      if (localId && id === localId) return scene.combatState?.joueur || player;
      const ally =
        allies.find((entry) => entry?.isPlayerAlly && Number(entry.netId) === id) || null;
      if (ally) {
        if (!Number.isInteger(ally.netId)) ally.netId = id;
        if (!Number.isInteger(ally.id)) ally.id = id;
        return ally;
      }
      const cachedEntity = placeholderCache.get(id) || null;
      if (cachedEntity) return cachedEntity;
      const remote = remotePlayersData?.get(id) || {};
      const hp = Number.isFinite(remote.combatHp)
        ? remote.combatHp
        : Number.isFinite(remote.hp)
          ? remote.hp
          : Number.isFinite(remote.combatHpMax)
            ? remote.combatHpMax
            : 1;
      const hpMax = Number.isFinite(remote.combatHpMax)
        ? remote.combatHpMax
        : Number.isFinite(remote.hpMax)
          ? remote.hpMax
          : Number.isFinite(remote.combatHp)
            ? remote.combatHp
            : 1;
      const placeholder = {
        isCombatAlly: true,
        isPlayerAlly: true,
        isRemote: true,
        netId: id,
        id,
        classId: remote.classId || "archer",
        displayName: remote.displayName || `Joueur ${id}`,
        stats: { hp, hpMax },
      };
      placeholderCache.set(id, placeholder);
      return placeholder;
    };
    const players = participantIds.map((id) => resolvePlayerEntity(id)).filter((p) => p);

    const monsters = Array.isArray(scene.combatMonsters)
      ? scene.combatMonsters.filter((m) => {
          const hp =
            typeof m?.stats?.hp === "number" ? m.stats.hp : m?.stats?.hpMax ?? 0;
          return hp > 0;
        })
      : [];
    monsters.sort((a, b) => {
      const ia = a?.stats?.initiative ?? 0;
      const ib = b?.stats?.initiative ?? 0;
      if (ib !== ia) return ib - ia;
      const ea = Number.isInteger(a?.entityId) ? a.entityId : 0;
      const eb = Number.isInteger(b?.entityId) ? b.entityId : 0;
      return ea - eb;
    });

    if (Array.isArray(entry.actorOrder) && entry.actorOrder.length > 0) {
      const ordered = [];
      entry.actorOrder.forEach((actor) => {
        if (!actor) return;
        if (actor.kind === "joueur") {
          const ent = resolvePlayerEntity(actor.playerId);
          if (ent) ordered.push({ kind: "joueur", entity: ent });
          return;
        }
        const ent =
          (Number.isInteger(actor.entityId)
            ? scene.combatMonsters?.find((m) => m && m.entityId === actor.entityId)
            : null) ||
          (Number.isInteger(actor.combatIndex)
            ? scene.combatMonsters?.find((m) => m && m.combatIndex === actor.combatIndex)
            : null) ||
          null;
        if (ent) ordered.push({ kind: "monstre", entity: ent });
      });
      if (ordered.length > 0) {
        scene.__lanCombatActorsCache.set(entry.combatId, ordered);
        return ordered;
      }
    }

    if (cached && Array.isArray(cached) && cached.length > 0) {
      const kept = cached.filter((actor) => actor && isAlive(actor));
      const seen = new Set(kept.map((actor) => getActorKey(actor)));
      players.forEach((ent) => {
        const actor = { kind: "joueur", entity: ent };
        const key = getActorKey(actor);
        if (seen.has(key) || !isAlive(actor)) return;
        seen.add(key);
        kept.push(actor);
      });
      monsters.forEach((ent) => {
        const actor = { kind: "monstre", entity: ent };
        const key = getActorKey(actor);
        if (seen.has(key) || !isAlive(actor)) return;
        seen.add(key);
        kept.push(actor);
      });
      scene.__lanCombatActorsCache.set(entry.combatId, kept);
      return kept.length > 0 ? kept : null;
    }

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

    const initial = actors.length > 0 ? actors : null;
    if (initial) {
      scene.__lanCombatActorsCache.set(entry.combatId, initial);
    }
    return initial;
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

  const shouldApplyCombatEvent = (combatId, eventId, combatSeq) => {
    if (Number.isInteger(combatSeq) && Number.isInteger(combatId)) {
      const entry = activeCombats.get(combatId) || { combatId };
      const lastSeq = Number.isInteger(entry.lastCombatSeq) ? entry.lastCombatSeq : 0;
      if (combatSeq <= lastSeq) return false;
      entry.lastCombatSeq = combatSeq;
      activeCombats.set(combatId, entry);
      return true;
    }
    if (!Number.isInteger(eventId)) return true;
    if (!Number.isInteger(combatId)) return true;
    const entry = activeCombats.get(combatId) || { combatId };
    const lastEventId = Number.isInteger(entry.lastEventId) ? entry.lastEventId : 0;
    if (eventId <= lastEventId) return false;
    entry.lastEventId = eventId;
    activeCombats.set(combatId, entry);
    return true;
  };

  const computeCombatChecksum = () => {
    const state = scene.combatState;
    if (!state || !state.enCours) return 0;
    const parts = [];
    const turnValue = state.tour === "monstre" ? 2 : 1;
    parts.push(
      turnValue,
      Number.isFinite(state.round) ? Math.round(state.round) : 0,
      Number.isInteger(state.activePlayerId) ? state.activePlayerId : 0,
      Number.isInteger(state.monstre?.entityId) ? state.monstre.entityId : 0,
      Number.isInteger(state.monstre?.combatIndex) ? state.monstre.combatIndex : -1,
      Number.isInteger(state.actorIndex) ? state.actorIndex : -1
    );

    const players = [];
    const localId = getNetPlayerId();
    const localTile = getEntityTile(state.joueur);
    if (localId && localTile && state.joueur?.stats) {
      players.push({
        playerId: localId,
        tileX: localTile.x,
        tileY: localTile.y,
        hp: state.joueur.stats.hp ?? state.joueur.stats.hpMax ?? 0,
        hpMax: state.joueur.stats.hpMax ?? state.joueur.stats.hp ?? 0,
      });
    }
    if (Array.isArray(scene.combatAllies)) {
      scene.combatAllies.forEach((ally) => {
        if (!ally || !Number.isInteger(ally.netId) || !ally.stats) return;
        const tile = getEntityTile(ally);
        if (!tile) return;
        players.push({
          playerId: ally.netId,
          tileX: tile.x,
          tileY: tile.y,
          hp: ally.stats.hp ?? ally.stats.hpMax ?? 0,
          hpMax: ally.stats.hpMax ?? ally.stats.hp ?? 0,
        });
      });
    }
    players.sort((a, b) => a.playerId - b.playerId);
    players.forEach((p) => {
      parts.push(
        Number.isInteger(p.playerId) ? p.playerId : 0,
        Number.isInteger(p.tileX) ? p.tileX : -1,
        Number.isInteger(p.tileY) ? p.tileY : -1,
        Number.isFinite(p.hp) ? Math.round(p.hp) : 0,
        Number.isFinite(p.hpMax) ? Math.round(p.hpMax) : 0
      );
    });

    parts.push(999999);

    const monsters = Array.isArray(scene.combatMonsters) ? scene.combatMonsters : [];
    const monsterEntries = monsters
      .map((m) => {
        if (!m || !m.stats) return null;
        const tile = getEntityTile(m);
        if (!tile) return null;
        const key = Number.isInteger(m.entityId)
          ? m.entityId
          : Number.isInteger(m.combatIndex)
            ? 1000000 + m.combatIndex
            : 0;
        return {
          key,
          tileX: tile.x,
          tileY: tile.y,
          hp: m.stats.hp ?? m.stats.hpMax ?? 0,
          hpMax: m.stats.hpMax ?? m.stats.hp ?? 0,
        };
      })
      .filter(Boolean);
    monsterEntries.sort((a, b) => a.key - b.key);
    monsterEntries.forEach((m) => {
      parts.push(
        Number.isInteger(m.key) ? m.key : 0,
        Number.isInteger(m.tileX) ? m.tileX : -1,
        Number.isInteger(m.tileY) ? m.tileY : -1,
        Number.isFinite(m.hp) ? Math.round(m.hp) : 0,
        Number.isFinite(m.hpMax) ? Math.round(m.hpMax) : 0
      );
    });

    const data = parts.join("|");
    let hash = 2166136261;
    for (let i = 0; i < data.length; i += 1) {
      hash ^= data.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
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
    shouldApplyCombatEvent,
    computeCombatChecksum,
  };
}
