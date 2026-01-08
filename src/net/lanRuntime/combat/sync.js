import { getNetPlayerId } from "../../../app/session.js";
import { createMonster } from "../../../entities/monster.js";
import { spawnSummonFromCaptured } from "../../../features/combat/summons/summon.js";
import { unblockTile } from "../../../collision/collisionGrid.js";

export function createCombatSyncHandlers(ctx, helpers) {
  const { scene, player, getCurrentMapKey, activeCombats, remotePlayersData } = ctx;
  const {
    getEntityTile,
    shouldApplyCombatEvent,
    buildLanActorsOrder,
    updateBlockedTile,
  } = helpers;

  const buildEntityWorldPosition = (entity, tileX, tileY) => {
    const mapForMove = scene.combatMap || scene.map;
    const layerForMove = scene.combatGroundLayer || scene.groundLayer;
    if (!mapForMove || !layerForMove) return null;
    const wp = mapForMove.tileToWorldXY(
      tileX,
      tileY,
      undefined,
      undefined,
      layerForMove
    );
    if (!wp) return null;
    const isPlayerEntity =
      entity === scene.combatState?.joueur ||
      entity === player ||
      entity?.isPlayerAlly === true ||
      entity?.isCombatAlly === true;
    const offX = typeof entity?.renderOffsetX === "number" ? entity.renderOffsetX : 0;
    const offY = typeof entity?.renderOffsetY === "number" ? entity.renderOffsetY : 0;
    const baseY = isPlayerEntity ? mapForMove.tileHeight / 2 : mapForMove.tileHeight;
    return {
      x: wp.x + mapForMove.tileWidth / 2 + offX,
      y: wp.y + baseY + offY,
    };
  };

  const buildCombatStatePayload = () => {
    const combatId =
      Number.isInteger(scene.__lanCombatId) ? scene.__lanCombatId : null;
    if (!combatId) return null;
    const mapId = getCurrentMapKey();
    if (!mapId) return null;
    const state = scene.combatState;
    if (!state || !state.enCours) return null;

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

    const monsters = [];
    if (Array.isArray(scene.combatMonsters)) {
      scene.combatMonsters.forEach((m, idx) => {
        if (!m || !m.stats) return;
        const tile = getEntityTile(m);
        if (!tile) return;
        monsters.push({
          combatIndex: idx,
          entityId: Number.isInteger(m.entityId) ? m.entityId : null,
          monsterId: typeof m.monsterId === "string" ? m.monsterId : null,
          tileX: tile.x,
          tileY: tile.y,
          hp: m.stats.hp ?? m.stats.hpMax ?? 0,
          hpMax: m.stats.hpMax ?? m.stats.hp ?? 0,
        });
      });
    }

    return {
      combatId,
      mapId,
      players,
      monsters,
    };
  };

  const sendCombatState = () => {};

  const applyCombatState = (msg) => {
    if (!msg) return;
    if (!shouldApplyCombatEvent(msg.combatId, msg.eventId, msg.combatSeq)) return;
    scene.__lanCombatStateSeen = true;
    if (Number.isInteger(msg.combatId) && scene.__lanCombatId) {
      if (msg.combatId !== scene.__lanCombatId) return;
    }
    const mapId = typeof msg.mapId === "string" ? msg.mapId : null;
    if (mapId) {
      const currentMap = getCurrentMapKey();
      if (currentMap && mapId !== currentMap) return;
    }
    const state = scene.combatState;
    const inCombat = state?.enCours === true;
    const inPrep = scene.prepState?.actif === true;
    if (!inCombat && !inPrep) return;
    const localPlayer = state?.joueur || player;

    if (state && inCombat) {
      if (msg.turn === "monster") {
        state.tour = "monstre";
        state.summonActing = false;
      } else if (msg.turn === "summon") {
        state.tour = "monstre";
        state.summonActing = true;
      } else if (msg.turn === "player") {
        state.tour = "joueur";
        state.summonActing = false;
      }
      if (Number.isInteger(msg.round)) {
        state.round = msg.round;
      }
      if (Number.isInteger(msg.activePlayerId)) {
        state.activePlayerId = msg.activePlayerId;
      }
      if (Number.isInteger(msg.activeMonsterId)) {
        state.activeMonsterId = msg.activeMonsterId;
      }
      if (Number.isInteger(msg.activeMonsterIndex)) {
        state.activeMonsterIndex = msg.activeMonsterIndex;
      }
      if (Number.isInteger(msg.activeSummonId)) {
        state.activeSummonId = msg.activeSummonId;
      }
    }

    if (Array.isArray(msg.players)) {
      msg.players.forEach((p) => {
        if (!Number.isInteger(p?.playerId)) return;
        if (remotePlayersData) {
          const prev = remotePlayersData.get(p.playerId) || { id: p.playerId };
          remotePlayersData.set(p.playerId, {
            ...prev,
            combatHp: Number.isFinite(p.hp) ? p.hp : prev.combatHp,
            combatHpMax: Number.isFinite(p.hpMax) ? p.hpMax : prev.combatHpMax,
            classId:
              typeof p.classId === "string"
                ? p.classId
                : typeof prev.classId === "string"
                  ? prev.classId
                  : undefined,
            displayName:
              typeof p.displayName === "string"
                ? p.displayName
                : typeof prev.displayName === "string"
                  ? prev.displayName
                  : undefined,
          });
        }
        const tileX = Number.isInteger(p.tileX) ? p.tileX : null;
        const tileY = Number.isInteger(p.tileY) ? p.tileY : null;
        if (tileX === null || tileY === null) return;
        let target = null;
        const localId = getNetPlayerId();
        if (localId && p.playerId === localId) {
          target = localPlayer;
        } else if (Array.isArray(scene.combatAllies)) {
          target =
            scene.combatAllies.find(
              (ally) => ally?.isPlayerAlly && Number(ally.netId) === p.playerId
            ) || null;
        }
        if (!target && !state) return;
        if (!target) return;
        if (Number.isInteger(p.playerId)) {
          if (!Number.isInteger(target.netId)) target.netId = p.playerId;
          if (!Number.isInteger(target.id)) target.id = p.playerId;
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
          target.currentTileX = tileX;
          target.currentTileY = tileY;
          if (typeof target.setDepth === "function") {
            target.setDepth(target.y);
          }
          if (scene.prepState?.actif && typeof updateBlockedTile === "function") {
            updateBlockedTile(target, tileX, tileY);
          }
        }
        if (target.stats) {
          target.stats.hp = Number.isFinite(p.hp) ? p.hp : target.stats.hp;
          target.stats.hpMax = Number.isFinite(p.hpMax) ? p.hpMax : target.stats.hpMax;
        }
        if (typeof p.displayName === "string" && p.displayName) {
          target.displayName = p.displayName;
        }
        if (typeof p.capturedMonsterId === "string") {
          target.capturedMonsterId = p.capturedMonsterId;
        }
        if (Number.isFinite(p.capturedMonsterLevel)) {
          target.capturedMonsterLevel = p.capturedMonsterLevel;
        }
        if (Array.isArray(p.statusEffects)) {
          target.statusEffects = p.statusEffects.slice();
        }
        if (target === state?.joueur && typeof target.updateHudHp === "function") {
          const hpMax = target.stats?.hpMax ?? target.stats?.hp ?? 0;
          target.updateHudHp(target.stats?.hp ?? 0, hpMax);
        }
      });
    }

    if (Array.isArray(msg.monsters)) {
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

    if (Array.isArray(msg.summons)) {
      const nextSummons = [];
      const kept = new Set();
      const mapForMove = scene.combatMap || scene.map;
      const layerForMove = scene.combatGroundLayer || scene.groundLayer;

      const findOwner = (ownerPlayerId) => {
        if (!Number.isInteger(ownerPlayerId)) return null;
        const localId = getNetPlayerId();
        if (localId && ownerPlayerId === localId) {
          return state?.joueur || player || null;
        }
        if (Array.isArray(scene.combatAllies)) {
          return (
            scene.combatAllies.find(
              (ally) => ally?.isPlayerAlly && Number(ally.netId) === ownerPlayerId
            ) || null
          );
        }
        return null;
      };

      msg.summons.forEach((s) => {
        const summonId = Number.isInteger(s?.summonId) ? s.summonId : null;
        const tileX = Number.isInteger(s.tileX) ? s.tileX : null;
        const tileY = Number.isInteger(s.tileY) ? s.tileY : null;
        if (summonId === null || tileX === null || tileY === null) return;
        let target =
          Array.isArray(scene.combatSummons)
            ? scene.combatSummons.find((sum) => sum && sum.id === summonId) || null
            : null;
        if (!target && mapForMove && layerForMove) {
          const owner = findOwner(s.ownerPlayerId);
          if (!owner || typeof s.monsterId !== "string") return;
          owner.capturedMonsterId = s.monsterId;
          if (Number.isFinite(s.level)) {
            owner.capturedMonsterLevel = s.level;
          }
          const created = spawnSummonFromCaptured(scene, owner, mapForMove, layerForMove, {
            preferTile: { x: tileX, y: tileY },
          });
          if (!created) return;
          created.id = summonId;
          created.isSummon = true;
          created.owner = owner;
          target = created;
        }
        if (!target) return;
        const isMoving =
          target.isMoving === true ||
          !!target.currentMoveTween ||
          !!target.__lanCombatMoveTween ||
          !!target.__lanMoveTween;
        if (!isMoving || msg.resync === true) {
          const pos = buildEntityWorldPosition(target, tileX, tileY);
          if (pos) {
            target.x = pos.x;
            target.y = pos.y;
          }
        }
        if (target.stats) {
          target.stats.hp = Number.isFinite(s.hp) ? s.hp : target.stats.hp;
          target.stats.hpMax = Number.isFinite(s.hpMax) ? s.hpMax : target.stats.hpMax;
        }
        if (!isMoving || msg.resync === true) {
          target.tileX = tileX;
          target.tileY = tileY;
          target.currentTileX = tileX;
          target.currentTileY = tileY;
          if (typeof target.setDepth === "function") {
            target.setDepth(target.y);
          }
        }
        if (Array.isArray(s.statusEffects)) {
          target.statusEffects = s.statusEffects.slice();
        }
        nextSummons.push(target);
        kept.add(target);
      });

      if (Array.isArray(scene.combatSummons)) {
        scene.combatSummons.forEach((sum) => {
          if (!sum || kept.has(sum)) return;
          if (typeof sum.destroy === "function") {
            sum.destroy();
          }
        });
      }
      scene.combatSummons = nextSummons;
    }

    if (state?.enCours && Number.isInteger(msg.combatId)) {
      let resolvedActors = null;
      if (Array.isArray(msg.actorOrder) && msg.actorOrder.length > 0) {
        const combatEntry = activeCombats.get(msg.combatId) || { combatId: msg.combatId };
        combatEntry.actorOrder = msg.actorOrder;
        activeCombats.set(msg.combatId, combatEntry);
        const localId = getNetPlayerId();
        const placeholderCache =
          scene.__lanCombatPlaceholders || (scene.__lanCombatPlaceholders = new Map());
        const actors = [];
        msg.actorOrder.forEach((entry) => {
          if (!entry || !entry.kind) return;
          if (entry.kind === "joueur") {
            let ent = null;
            if (localId && entry.playerId === localId) {
              ent = localPlayer;
            } else if (Array.isArray(scene.combatAllies)) {
              ent =
                scene.combatAllies.find(
                  (ally) => ally?.isPlayerAlly && Number(ally.netId) === entry.playerId
                ) || null;
            }
            if (!ent && Number.isInteger(entry.playerId)) {
              const cached = placeholderCache.get(entry.playerId) || null;
              if (cached) {
                ent = cached;
              } else {
                const remote = remotePlayersData?.get(entry.playerId) || {};
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
                  netId: entry.playerId,
                  id: entry.playerId,
                  classId: remote.classId || "archer",
                  displayName: remote.displayName || `Joueur ${entry.playerId}`,
                  stats: { hp, hpMax },
                };
                placeholderCache.set(entry.playerId, placeholder);
                ent = placeholder;
              }
            }
            if (ent) actors.push({ kind: "joueur", entity: ent });
            return;
          }
          if (entry.kind === "monstre") {
            let ent = null;
            if (Number.isInteger(entry.entityId) && Array.isArray(scene.combatMonsters)) {
              ent =
                scene.combatMonsters.find((m) => m && m.entityId === entry.entityId) || null;
            }
            if (!ent && Number.isInteger(entry.combatIndex) && Array.isArray(scene.combatMonsters)) {
              ent = scene.combatMonsters[entry.combatIndex] || null;
            }
            if (ent) actors.push({ kind: "monstre", entity: ent });
          }
        });
        if (actors.length > 0) {
          resolvedActors = actors;
          if (!scene.__lanCombatActorsCache) {
            scene.__lanCombatActorsCache = new Map();
          }
          scene.__lanCombatActorsCache.set(msg.combatId, actors);
        }
      }

      if (!resolvedActors) {
        const entry = activeCombats?.get(msg.combatId) || null;
        resolvedActors = entry ? buildLanActorsOrder(entry) : null;
      }

      if (resolvedActors) {
        state.actors = resolvedActors;
        if (Number.isInteger(state.activePlayerId)) {
          const idx = resolvedActors.findIndex((a) => {
            if (!a || a.kind !== "joueur") return false;
            const ent = a.entity;
            const id =
              Number.isInteger(ent?.netId) ? ent.netId : Number.isInteger(ent?.id) ? ent.id : null;
            return id === state.activePlayerId;
          });
          if (idx >= 0) {
            state.actorIndex = idx;
          }
        } else if (
          Number.isInteger(state.activeMonsterId) ||
          Number.isInteger(state.activeMonsterIndex)
        ) {
          const idx = resolvedActors.findIndex((a) => {
            if (!a || a.kind !== "monstre") return false;
            const ent = a.entity;
            if (Number.isInteger(state.activeMonsterId) && Number.isInteger(ent?.entityId)) {
              return ent.entityId === state.activeMonsterId;
            }
            if (Number.isInteger(state.activeMonsterIndex) && Number.isInteger(ent?.combatIndex)) {
              return ent.combatIndex === state.activeMonsterIndex;
            }
            return false;
          });
          if (idx >= 0) {
            state.actorIndex = idx;
          }
        }
      }
    }

    if (typeof scene.updateCombatUi === "function") {
      scene.updateCombatUi();
    }
  };

  const startCombatSync = () => {
    // Server authoritative: no client-side snapshot sync.
  };

  const stopCombatSync = () => {
    if (scene.__lanCombatSyncTimer?.remove) {
      scene.__lanCombatSyncTimer.remove(false);
    }
    scene.__lanCombatSyncTimer = null;
    if (scene.__lanCombatStatePendingTimer?.remove) {
      scene.__lanCombatStatePendingTimer.remove(false);
    } else if (scene.__lanCombatStatePendingTimer) {
      clearTimeout(scene.__lanCombatStatePendingTimer);
    }
    scene.__lanCombatStatePendingTimer = null;
    scene.__lanCombatStatePending = false;
    scene.__lanCombatStateSeen = false;
  };

  const requestCombatStateFlush = () => {
    // Server authoritative: no client-side snapshot flush.
  };

  return {
    sendCombatState,
    applyCombatState,
    startCombatSync,
    stopCombatSync,
    requestCombatStateFlush,
  };
}
