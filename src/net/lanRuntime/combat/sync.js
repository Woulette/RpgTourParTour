import { getNetPlayerId } from "../../../app/session.js";
import { createCombatState } from "../../../features/combat/runtime/state.js";
import { applyCombatPlayersState } from "./apply/players.js";
import { applyCombatMonstersState } from "./apply/monsters.js";
import { applyCombatSummonsState } from "./apply/summons.js";
import { applyCombatActorsState } from "./apply/actors.js";

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
    const localIdForJoin = getNetPlayerId();
    const isLocalParticipant =
      Number.isInteger(localIdForJoin) &&
      Array.isArray(msg.players) &&
      msg.players.some((p) => Number(p?.playerId) === localIdForJoin);
    if (!shouldApplyCombatEvent(msg.combatId, msg.eventId, msg.combatSeq)) {
      if (!(msg.resync === true || isLocalParticipant)) return;
    }
    scene.__lanCombatStateSeen = true;
    if (Number.isInteger(msg.combatId) && scene.__lanCombatId) {
      if (msg.combatId !== scene.__lanCombatId) return;
    }
    const mapId = typeof msg.mapId === "string" ? msg.mapId : null;
    if (mapId) {
      const currentMap = getCurrentMapKey();
      if (currentMap && mapId !== currentMap) return;
    }
    const mapReady = (() => {
      const map = scene.combatMap || scene.map;
      const layer = scene.combatGroundLayer || scene.groundLayer;
      if (!map || !layer || !layer.layer) return false;
      if (!scene.combatMap) scene.combatMap = map;
      if (!scene.combatGroundLayer) scene.combatGroundLayer = layer;
      return true;
    })();
    if (!mapReady) {
      const retry = Number.isInteger(scene.__lanCombatStateRetry)
        ? scene.__lanCombatStateRetry + 1
        : 1;
      scene.__lanCombatStateRetry = retry;
      if (retry > 50) return;
      if (!scene.__lanCombatStatePendingTimer) {
        const schedule = (fn) =>
          scene.time && typeof scene.time.delayedCall === "function"
            ? scene.time.delayedCall(100, fn)
            : setTimeout(fn, 100);
        scene.__lanCombatStatePendingTimer = schedule(() => {
          scene.__lanCombatStatePendingTimer = null;
          applyCombatState(msg);
        });
      }
      return;
    }
    scene.__lanCombatStateRetry = 0;
    if (
      !scene.combatState?.enCours &&
      !scene.prepState?.actif &&
      (msg.resync === true || isLocalParticipant)
    ) {
      scene.combatMap = scene.combatMap || scene.map;
      scene.combatGroundLayer = scene.combatGroundLayer || scene.groundLayer;
      const dummyMonster = { stats: {} };
      scene.combatState = createCombatState(player, dummyMonster);
      scene.combatState.combatId = msg.combatId;
      if (msg.turn === "monster" || msg.turn === "summon") {
        scene.combatState.tour = "monstre";
        scene.combatState.summonActing = msg.turn === "summon";
      } else if (msg.turn === "player") {
        scene.combatState.tour = "joueur";
        scene.combatState.summonActing = false;
      }
      if (Number.isInteger(msg.round)) {
        scene.combatState.round = msg.round;
      }
      if (Number.isInteger(msg.activePlayerId)) {
        scene.combatState.activePlayerId = msg.activePlayerId;
      }
      if (Number.isInteger(msg.activeMonsterId)) {
        scene.combatState.activeMonsterId = msg.activeMonsterId;
      }
      if (Number.isInteger(msg.activeMonsterIndex)) {
        scene.combatState.activeMonsterIndex = msg.activeMonsterIndex;
      }
      if (Number.isInteger(msg.activeSummonId)) {
        scene.combatState.activeSummonId = msg.activeSummonId;
      }
      scene.__lanCombatId = msg.combatId;
      scene.__lanCombatStartSent = true;
      document.body.classList.add("combat-active");
    }

    const state = scene.combatState;
    const inCombat = state?.enCours === true;
    const inPrep = scene.prepState?.actif === true;
    if (!inCombat && !inPrep) return;
    const localPlayer = state?.joueur || player;

    if (isLocalParticipant && inCombat && !scene.__lanWorldMobsHidden) {
      if (Array.isArray(scene.monsters)) {
        scene.monsters = scene.monsters.filter((monster) => {
          if (!monster) return false;
          if (monster.isCombatOnly || monster.isCombatMember || monster.isSummon) {
            return true;
          }
          if (monster.roamTimer?.remove) monster.roamTimer.remove(false);
          if (monster.roamTween?.stop) monster.roamTween.stop();
          if (monster.destroy) monster.destroy();
          return false;
        });
      } else {
        scene.monsters = [];
      }
      scene.__lanWorldMobsHidden = true;
    }

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

    applyCombatPlayersState({
      scene,
      player,
      remotePlayersData,
      updateBlockedTile,
      buildEntityWorldPosition,
      state,
      localPlayer,
      msg,
    });

    applyCombatMonstersState({
      scene,
      updateBlockedTile,
      buildEntityWorldPosition,
      msg,
    });

    applyCombatSummonsState({
      scene,
      player,
      state,
      buildEntityWorldPosition,
      msg,
    });

    if (state && state.enCours) {
      let nextActive = null;
      if (Number.isInteger(state.activeSummonId)) {
        nextActive =
          Array.isArray(scene.combatSummons)
            ? scene.combatSummons.find((s) => s && s.id === state.activeSummonId) || null
            : null;
      }
      if (!nextActive && Number.isInteger(state.activeMonsterId)) {
        nextActive =
          Array.isArray(scene.combatMonsters)
            ? scene.combatMonsters.find((m) => m && m.entityId === state.activeMonsterId) || null
            : null;
      }
      if (!nextActive && Number.isInteger(state.activeMonsterIndex)) {
        nextActive =
          Array.isArray(scene.combatMonsters)
            ? scene.combatMonsters.find((m) => m && m.combatIndex === state.activeMonsterIndex) || null
            : null;
      }
      if (nextActive) {
        state.monstre = nextActive;
      }
    }

    applyCombatActorsState({
      scene,
      activeCombats,
      remotePlayersData,
      buildLanActorsOrder,
      state,
      localPlayer,
      msg,
    });

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
