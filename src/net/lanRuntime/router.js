import {
  getNetClient,
  getNetIsHost,
  getNetPlayerId,
  setNetIsHost,
} from "../../app/session.js";
import { spawnMonstersFromEntries } from "../../features/monsters/runtime/index.js";
import { maps } from "../../features/maps/index.js";
import { loadMapLikeMain } from "../../features/maps/world/load.js";
import { emit as emitStoreEvent } from "../../state/store.js";
import { addChatMessage } from "../../chat/chat.js";
import { openFriendInvite } from "../../features/ui/domFriendInvite.js";
import { showToast } from "../../features/ui/domToasts.js";
import {
  handleTradeInvite,
  handleTradeStarted,
  handleTradeUpdated,
  handleTradeCancelled,
  handleTradeComplete,
  handleTradeError,
} from "../../features/ui/domTrade.js";

export function createLanRouter(ctx) {
  const {
    scene,
    player,
    ui,
    players,
    mobs,
    resources,
    combat,
    groups,
    sendMapChange,
    getCurrentMapKey,
    isMapReady,
    netDebugLog,
    onWelcomeReady,
  } = ctx;

  let lastEventId = 0;
  let pendingAckEventId = 0;
  let ackTimer = null;
  const combatSeqState = new Map();
  const combatEventTypes = new Set([
    "EvCombatCreated",
    "EvCombatUpdated",
    "EvCombatJoinReady",
    "EvCombatState",
    "EvCombatMoveStart",
    "EvCombatMonsterMoveStart",
    "EvCombatTurnStarted",
    "EvCombatTurnEnded",
    "EvCombatEnded",
    "EvSpellCast",
    "EvDamageApplied",
  ]);

  const scheduleAck = () => {
    if (ackTimer) return;
    ackTimer = setTimeout(() => {
      ackTimer = null;
      const client = getNetClient();
      if (!client || pendingAckEventId <= 0) return;
      client.sendCmd("CmdAck", { lastEventId: pendingAckEventId });
    }, 200);
  };

  const applyCombatEvent = (msg) => {
    if (msg.t === "EvCombatMoveStart") {
      combat.handleCombatMoveStart(msg);
      combat.requestCombatStateFlush();
      return;
    }

    if (msg.t === "EvCombatMonsterMoveStart") {
      combat.handleCombatMonsterMoveStart(msg);
      combat.requestCombatStateFlush();
      return;
    }

    if (msg.t === "EvCombatState") {
      combat.applyCombatState(msg);
      groups?.handleCombatState?.(msg);
      return;
    }

    if (msg.t === "EvSpellCast") {
      combat.handleCombatSpellCast(msg);
      combat.requestCombatStateFlush();
      return;
    }

    if (msg.t === "EvDamageApplied") {
      combat.handleCombatDamageApplied(msg);
      combat.requestCombatStateFlush();
      return;
    }

    if (msg.t === "EvCombatTurnStarted") {
      combat.applyCombatTurnStarted(msg);
      combat.requestCombatStateFlush();
      return;
    }

    if (msg.t === "EvCombatTurnEnded") {
      combat.applyCombatTurnEnded(msg);
      combat.requestCombatStateFlush();
      return;
    }

    if (msg.t === "EvCombatUpdated") {
      combat.applyCombatUpdated(msg);
      combat.requestCombatStateFlush();
      return;
    }

    if (msg.t === "EvCombatJoinReady") {
      combat.handleCombatJoinReady(msg);
      combat.requestCombatStateFlush();
      return;
    }

    if (msg.t === "EvCombatCreated") {
      combat.applyCombatCreated(msg);
      return;
    }

    if (msg.t === "EvCombatEnded") {
      combat.applyCombatEnded(msg);
      if (Number.isInteger(msg.combatId)) {
        combatSeqState.delete(msg.combatId);
      }
      if (groups && typeof groups.handleCombatEnded === "function") {
        groups.handleCombatEnded(msg);
      }
    }
  };

  const handleCombatSequencedEvent = (msg) => {
    const combatId = Number.isInteger(msg.combatId) ? msg.combatId : null;
    if (combatId === null || !Number.isInteger(msg.combatSeq)) {
      applyCombatEvent(msg);
      return;
    }
    if (msg.t === "EvCombatEnded") {
      const localId = getNetPlayerId();
      const participantIds = Array.isArray(msg.participantIds) ? msg.participantIds : [];
      if (!localId || !participantIds.includes(localId)) {
        applyCombatEvent(msg);
        return;
      }
    }
    const state = combatSeqState.get(combatId) || {
      expected: null,
      pending: new Map(),
      replayRequested: false,
    };
    if (state.expected === null) {
      state.expected = msg.combatSeq;
    }
    if (msg.combatSeq < state.expected) {
      combatSeqState.set(combatId, state);
      return;
    }
    if (msg.combatSeq > state.expected) {
      if (state.pending.size < 200) {
        state.pending.set(msg.combatSeq, msg);
      }
      if (!state.replayRequested) {
        const client = getNetClient();
        if (client) {
          client.sendCmd("CmdCombatReplay", { combatId, fromSeq: state.expected });
          state.replayRequested = true;
        }
      }
      combatSeqState.set(combatId, state);
      return;
    }

    let nextMsg = msg;
    while (nextMsg) {
      applyCombatEvent(nextMsg);
      state.pending.delete(state.expected);
      state.expected += 1;
      nextMsg = state.pending.get(state.expected) || null;
    }
    if (state.replayRequested && state.pending.size === 0) {
      state.replayRequested = false;
    }
    combatSeqState.set(combatId, state);
  };

  const scheduleMapRetry = (key, msg, handler) => {
    const timerKey = `__lanPending${key}Timer`;
    const dataKey = `__lanPending${key}`;
    scene[dataKey] = msg;
    if (scene[timerKey]) return;
    const schedule = (fn) =>
      scene.time && typeof scene.time.delayedCall === "function"
        ? scene.time.delayedCall(100, fn)
        : setTimeout(fn, 100);
    scene[timerKey] = schedule(() => {
      scene[timerKey] = null;
      const pending = scene[dataKey];
      if (pending) {
        scene[dataKey] = null;
        handler(pending);
      }
    });
  };

  const handleMapMonsters = (msg) => {
    if (scene?.combatState?.enCours || scene?.prepState?.actif) {
      scene.__lanMobsRefreshNeeded = true;
      scene.__lanPendingMapMonsters = msg;
      return;
    }
    if (!isMapReady()) {
      scheduleMapRetry("MapMonsters", msg, handleMapMonsters);
      return;
    }
    const currentMap = getCurrentMapKey();
    if (!currentMap || msg.mapId !== currentMap) return;
    mobs.clearWorldMonsters();
    const entries = Array.isArray(msg.monsters) ? msg.monsters : [];
    spawnMonstersFromEntries(scene, scene.map, scene.groundLayer, entries, {
      disableRoam: true,
    });
    mobs.updateHostMobScheduler();
  };

  if (scene) {
    scene.__lanApplyMapMonsters = handleMapMonsters;
  }

  const handleMapResources = (msg) => {
    if (!isMapReady()) {
      scheduleMapRetry("MapResources", msg, handleMapResources);
      return;
    }
    const currentMap = getCurrentMapKey();
    if (!currentMap || msg.mapId !== currentMap) return;
    const entries = Array.isArray(msg.resources) ? msg.resources : [];
    resources.spawnResourcesFromEntries(entries);
  };

  const handleMapPlayers = (msg) => {
    if (scene?.combatState?.enCours || scene?.prepState?.actif) {
      scene.__lanPendingMapPlayers = msg;
      return;
    }
    players.handleMapPlayers(msg);
  };

  const showChatBubble = (entity, text) => {
    if (!scene || !entity || !text) return;
    if (entity.__chatBubbleTimer?.remove) {
      entity.__chatBubbleTimer.remove(false);
    } else if (entity.__chatBubbleTimer) {
      clearTimeout(entity.__chatBubbleTimer);
    }
    if (entity.__chatBubble) {
      entity.__chatBubble.setText(text);
      entity.__chatBubble.setVisible(true);
    } else if (scene.add) {
      const bubble = scene.add.text(0, 0, text, {
        fontFamily: "Tahoma, Arial, sans-serif",
        fontSize: "12px",
        color: "#ffffff",
        backgroundColor: "rgba(20, 28, 40, 0.85)",
        padding: { left: 6, right: 6, top: 3, bottom: 3 },
      });
      bubble.setOrigin(0.5, 1);
      bubble.setDepth((entity.depth || 0) + 5);
      entity.__chatBubble = bubble;
    }

    const update = () => {
      if (!entity || entity.destroyed || !entity.scene || !entity.__chatBubble) {
        if (entity?.__chatBubble) {
          entity.__chatBubble.destroy();
          entity.__chatBubble = null;
        }
        if (entity?.__chatBubbleUpdate) {
          scene.events.off("postupdate", entity.__chatBubbleUpdate);
          entity.__chatBubbleUpdate = null;
        }
        return;
      }
      const bounds = entity.getBounds ? entity.getBounds() : null;
      const x = bounds ? bounds.centerX : entity.x;
      const y = bounds ? bounds.top - 8 : entity.y - 36;
      entity.__chatBubble.setPosition(x, y);
    };

    update();
    if (!entity.__chatBubbleUpdate) {
      entity.__chatBubbleUpdate = update;
      scene.events.on("postupdate", entity.__chatBubbleUpdate);
    }

    const schedule = (fn) =>
      scene.time && typeof scene.time.delayedCall === "function"
        ? scene.time.delayedCall(2400, fn)
        : setTimeout(fn, 2400);
    entity.__chatBubbleTimer = schedule(() => {
      if (entity.__chatBubble) {
        entity.__chatBubble.destroy();
        entity.__chatBubble = null;
      }
      if (entity.__chatBubbleUpdate) {
        scene.events.off("postupdate", entity.__chatBubbleUpdate);
        entity.__chatBubbleUpdate = null;
      }
      entity.__chatBubbleTimer = null;
    });
  };

  const applyServerPlayerSnapshot = (entry) => {
    if (!entry || !player) return;
    if (entry.displayName) player.displayName = entry.displayName;
    if (entry.classId) player.classId = entry.classId;
    if (Number.isFinite(entry.level)) player.level = entry.level;
    if (entry.baseStats) player.baseStats = entry.baseStats;
    if (entry.levelState) player.levelState = entry.levelState;
    if (entry.inventory) player.inventory = entry.inventory;
    if (entry.trash) player.trash = entry.trash;
    if (entry.equipment) player.equipment = entry.equipment;
    if (entry.quests) player.quests = entry.quests;
    if (entry.achievements) player.achievements = entry.achievements;
    if (entry.metiers) player.metiers = entry.metiers;
    if (entry.spellParchments) player.spellParchments = entry.spellParchments;
    if (Number.isFinite(entry.gold)) player.gold = entry.gold;
    if (Number.isFinite(entry.honorPoints)) player.honorPoints = entry.honorPoints;

    const tileX = Number.isInteger(entry.x)
      ? entry.x
      : Number.isInteger(entry.tileX)
        ? entry.tileX
        : null;
    const tileY = Number.isInteger(entry.y)
      ? entry.y
      : Number.isInteger(entry.tileY)
        ? entry.tileY
        : null;
    if (
      tileX !== null &&
      tileY !== null &&
      scene?.map &&
      scene?.groundLayer &&
      scene.groundLayer.layer
    ) {
      const wp = scene.map.tileToWorldXY(
        tileX,
        tileY,
        undefined,
        undefined,
        scene.groundLayer
      );
      if (wp) {
        player.currentTileX = tileX;
        player.currentTileY = tileY;
        player.x = wp.x + scene.map.tileWidth / 2;
        player.y = wp.y + scene.map.tileHeight / 2;
        if (typeof player.setDepth === "function") {
          player.setDepth(player.y);
        }
        if (player.isMoving) {
          player.isMoving = false;
          player.movePath = [];
          if (player.currentMoveTween && player.currentMoveTween.stop) {
            player.currentMoveTween.stop();
          }
          player.currentMoveTween = null;
        }
      }
    }

    if (typeof player.recomputeStatsWithEquipment === "function") {
      player.recomputeStatsWithEquipment();
    }

    if (player.stats && (Number.isFinite(entry.hp) || Number.isFinite(entry.hpMax))) {
      const hpMax = Number.isFinite(entry.hpMax)
        ? entry.hpMax
        : Number.isFinite(player.stats.hpMax)
          ? player.stats.hpMax
          : player.stats.hp ?? 0;
      const hp = Number.isFinite(entry.hp) ? entry.hp : hpMax;
      player.stats.hpMax = hpMax;
      player.stats.hp = Math.min(hp, hpMax);
      if (typeof player.updateHudHp === "function") {
        player.updateHudHp(player.stats.hp, player.stats.hpMax);
      }
    }

    emitStoreEvent("player:updated", player);
    emitStoreEvent("inventory:updated", { container: player.inventory });
    emitStoreEvent("equipment:updated", { slot: null });
    if (entry.quests) {
      emitStoreEvent("quest:updated", { questId: null, state: null });
    }
    if (entry.achievements) {
      emitStoreEvent("achievements:updated", { progress: player.achievements });
    }
    if (entry.metiers) {
      emitStoreEvent("metier:updated", { id: null, state: player.metiers });
    }
  };

  return (msg) => {
    if (!msg || !player) return;
    if (Number.isInteger(msg.eventId)) {
      if (msg.eventId === lastEventId + 1) {
        lastEventId = msg.eventId;
        pendingAckEventId = lastEventId;
        scheduleAck();
      }
    }
    if (msg.t === "EvCombatMonsterMoveStart") {
      netDebugLog("recv EvCombatMonsterMoveStart", {
        combatId: msg.combatId ?? null,
        entityId: msg.entityId ?? null,
        combatIndex: msg.combatIndex ?? null,
        steps: Array.isArray(msg.path) ? msg.path.length : null,
        mapId: msg.mapId ?? null,
      });
    }

    if (msg.t === "EvMoveStart" || msg.t === "EvMoved") {
      players.handleMoveEvent(msg);
      return;
    }

    if (msg.t === "EvWelcome") {
      if (typeof msg.isHost === "boolean") {
        setNetIsHost(msg.isHost);
      }
      if (player && Number.isInteger(msg.playerId)) {
        player.netId = msg.playerId;
      }
      const snapshot = msg.snapshot || null;
      const playersSnapshot = snapshot?.players || [];
      if (player && Number.isInteger(msg.playerId)) {
        const localEntry = playersSnapshot.find((p) => Number(p?.id) === msg.playerId) || null;
        if (localEntry && player.stats) {
          applyServerPlayerSnapshot(localEntry);
          const hpMax = Number.isFinite(localEntry.hpMax)
            ? localEntry.hpMax
            : Number.isFinite(localEntry.hp)
              ? localEntry.hp
              : null;
          if (Number.isFinite(hpMax)) {
            const hp = Number.isFinite(localEntry.hp) ? localEntry.hp : hpMax;
            player.stats.hpMax = hpMax;
            player.stats.hp = Math.min(hp, hpMax);
            if (typeof player.updateHudHp === "function") {
              player.updateHudHp(player.stats.hp, player.stats.hpMax);
            }
          }
        }
        if (localEntry?.mapId) {
          const currentMap = getCurrentMapKey();
          const mapDef = maps[localEntry.mapId] || null;
          if (mapDef && currentMap !== localEntry.mapId) {
            const startTile =
              Number.isInteger(localEntry.x) && Number.isInteger(localEntry.y)
                ? { x: localEntry.x, y: localEntry.y }
                : null;
            loadMapLikeMain(scene, mapDef, startTile ? { startTile } : undefined);
          }
        }
      }
      playersSnapshot.forEach((entry) => players.upsertRemoteData(entry));
      const combats = Array.isArray(snapshot?.combats) ? snapshot.combats : [];
      combats.forEach((entry) => combat.applyCombatCreated(entry));
      players.refreshRemoteSprites();
      ui.updateCombatWatchUi();
      sendMapChange();
      if (getNetIsHost()) {
        mobs.sendMapMonstersSnapshot();
        resources.sendMapResourcesSnapshot();
      }
      mobs.requestMapMonsters();
      resources.requestMapResources();
      mobs.updateHostMobScheduler();
      if (typeof onWelcomeReady === "function") {
        onWelcomeReady();
      }
      return;
    }

    if (msg.t === "EvPlayerJoined") {
      players.upsertRemoteData(msg.player);
      players.refreshRemoteSprites();
      return;
    }

    if (msg.t === "EvPlayerSync") {
      const playerId = getNetPlayerId();
      if (Number.isInteger(msg.playerId) && playerId === msg.playerId) {
        const shouldIgnoreEquipment =
          msg.reason === "inventory" || msg.reason === "inventory_migration";
        const snapshot = shouldIgnoreEquipment ? { ...msg, equipment: null } : msg;
        applyServerPlayerSnapshot(snapshot);
      }
      return;
    }

    if (msg.t === "EvCraftCompleted") {
      if (Number.isInteger(msg.playerId) && msg.playerId === getNetPlayerId()) {
        emitStoreEvent("craft:completed", {
          metierId: msg.metierId || null,
          recipeId: msg.recipeId || null,
          itemId: msg.itemId || null,
          qty: Number.isInteger(msg.qty) ? msg.qty : 0,
          xpGain: Number.isFinite(msg.xpGain) ? msg.xpGain : 0,
        });
      }
      return;
    }

    if (msg.t === "EvPlayerLeft") {
      players.removeRemotePlayer(msg.playerId);
      return;
    }

    if (msg.t === "EvPlayerMap") {
      players.upsertRemoteData({
        id: msg.playerId,
        mapId: msg.mapId,
        x: msg.tileX,
        y: msg.tileY,
        inCombat: false,
        combatId: null,
      });
      const remote = ctx.remotePlayers?.get(msg.playerId) || null;
      if (remote) remote.mapId = msg.mapId || null;
      players.refreshRemoteSprites();
      return;
    }

    if (msg.t === "EvHostChanged") {
      const playerId = getNetPlayerId();
      if (Number.isInteger(msg.hostId) && playerId) {
        setNetIsHost(msg.hostId === playerId);
      } else {
        setNetIsHost(false);
      }
      if (getNetIsHost()) {
        mobs.sendMapMonstersSnapshot();
        resources.sendMapResourcesSnapshot();
      }
      mobs.requestMapMonsters();
      resources.requestMapResources();
      mobs.updateHostMobScheduler();
      return;
    }

    if (msg.t === "EvMapMonsters") {
      handleMapMonsters(msg);
      return;
    }

    if (msg.t === "EvMapResources") {
      handleMapResources(msg);
      return;
    }

    if (msg.t === "EvMapPlayers") {
      handleMapPlayers(msg);
      return;
    }

    if (msg.t === "EvGroupUpdate") {
      groups?.handleGroupUpdate?.(msg);
      return;
    }

    if (msg.t === "EvGroupDisband") {
      groups?.handleGroupDisband?.(msg);
      return;
    }

    if (msg.t === "EvGroupInvite") {
      groups?.handleGroupInvite?.(msg);
      return;
    }

    if (msg.t === "EvGroupCombatInvite") {
      groups?.handleGroupCombatInvite?.(msg);
      return;
    }

    if (msg.t === "EvFriendsSync") {
      emitStoreEvent("friends:updated", {
        friends: Array.isArray(msg.friends) ? msg.friends : [],
        ignored: Array.isArray(msg.ignored) ? msg.ignored : [],
      });
      return;
    }

    if (msg.t === "EvFriendInvite") {
      const inviterAccountId = msg.inviterAccountId || null;
      if (!inviterAccountId) return;
      openFriendInvite(
        {
          inviterAccountId,
          inviterName: msg.inviterName || "Un joueur",
        },
        {
          onAccept: (invite) => {
            const client = getNetClient();
            const playerId = getNetPlayerId();
            if (!client || !playerId) return;
            client.sendCmd("CmdFriendAccept", {
              playerId,
              inviterAccountId: invite.inviterAccountId,
            });
            showToast({ title: "Amis", text: "Demande acceptee." });
          },
          onDecline: (invite) => {
            const client = getNetClient();
            const playerId = getNetPlayerId();
            if (!client || !playerId) return;
            client.sendCmd("CmdFriendDecline", {
              playerId,
              inviterAccountId: invite.inviterAccountId,
            });
            showToast({ title: "Amis", text: "Demande refusee." });
          },
        }
      );
      return;
    }

    if (msg.t === "EvFriendInviteResult") {
      const targetName = msg.targetName || "joueur";
      if (msg.status === "accepted") {
        showToast({ title: "Amis", text: `${targetName} a accepte.` });
      } else if (msg.status === "declined") {
        showToast({ title: "Amis", text: `${targetName} a refuse.` });
      } else if (msg.status === "offline") {
        showToast({ title: "Amis", text: `${targetName} est hors ligne.` });
      } else if (msg.status === "blocked") {
        showToast({ title: "Amis", text: "Demande refusee." });
      } else if (msg.status === "already_friends") {
        showToast({ title: "Amis", text: "Deja dans tes amis." });
      } else if (msg.status === "not_found") {
        showToast({ title: "Amis", text: "Joueur introuvable." });
      }
      return;
    }

    if (msg.t === "EvTradeInvite") {
      handleTradeInvite(msg);
      return;
    }

    if (msg.t === "EvTradeStarted") {
      handleTradeStarted(msg);
      return;
    }

    if (msg.t === "EvTradeUpdate") {
      handleTradeUpdated(msg);
      return;
    }

    if (msg.t === "EvTradeCancelled") {
      handleTradeCancelled(msg);
      return;
    }

    if (msg.t === "EvTradeComplete") {
      handleTradeComplete(msg);
      return;
    }

    if (msg.t === "EvTradeError") {
      handleTradeError(msg);
      return;
    }

    if (msg.t === "EvMarketList") {
      emitStoreEvent("market:list", msg);
      return;
    }

    if (msg.t === "EvMarketMine") {
      emitStoreEvent("market:mine", msg);
      return;
    }

    if (msg.t === "EvMarketBalance") {
      emitStoreEvent("market:balance", msg);
      return;
    }

    if (msg.t === "EvMarketNotice") {
      emitStoreEvent("market:notice", msg);
      return;
    }

    if (msg.t === "EvChatMessage") {
      const playerRef = player || null;
      if (!playerRef) return;
      const author =
        Number.isInteger(msg.playerId) && msg.playerId === getNetPlayerId()
          ? "Vous"
          : typeof msg.author === "string" && msg.author
            ? msg.author
            : "Joueur";
      const channel = msg.channel || "global";
      const text = typeof msg.text === "string" ? msg.text : "";
      if (!text) return;
      addChatMessage(
        {
          kind: "player",
          author,
          text,
          channel,
        },
        { player: playerRef }
      );
      if (channel === "global") {
        const currentMap = getCurrentMapKey();
        if (msg.mapId && currentMap && msg.mapId !== currentMap) return;
        let target = null;
        if (Number.isInteger(msg.playerId) && msg.playerId === getNetPlayerId()) {
          target = player;
        } else if (scene?.__lanRemotePlayers?.get) {
          target = scene.__lanRemotePlayers.get(msg.playerId) || null;
        }
        if (target) {
          showChatBubble(target, text);
        }
      }
      return;
    }

    if (msg.t === "EvMobMoveStart") {
      mobs.handleMobMoveStart(msg);
      return;
    }

    if (msg.t === "EvMobMoveEnd") {
      mobs.handleMobMoveEnd(msg);
      return;
    }

    if (msg.t === "EvMobDeath") {
      const currentMap = getCurrentMapKey();
      if (!currentMap || msg.mapId !== currentMap) return;
      mobs.removeWorldMonsterByEntityId(msg.entityId);
      return;
    }

    if (msg.t === "EvMobRespawn") {
      if (scene?.combatState?.enCours || scene?.prepState?.actif) {
        scene.__lanMobsRefreshNeeded = true;
        return;
      }
      const currentMap = getCurrentMapKey();
      if (!currentMap || msg.mapId !== currentMap) return;
      const entry = msg.monster || null;
      if (!entry || !Number.isInteger(entry.entityId)) return;
      if (entry && Number.isInteger(entry.entityId)) {
        mobs.removeWorldMonsterByEntityId(entry.entityId);
      }
      spawnMonstersFromEntries(scene, scene.map, scene.groundLayer, [entry], {
        disableRoam: true,
      });
      return;
    }

    if (msg.t === "EvResourceHarvested") {
      resources.handleResourceHarvested(msg);
      return;
    }

    if (msg.t === "EvResourceRespawned") {
      resources.handleResourceRespawned(msg);
      return;
    }

    if (msg.t === "EvEnsureMapInit") {
      const mapId = typeof msg.mapId === "string" ? msg.mapId : null;
      if (!mapId) return;
      const currentMap = getCurrentMapKey();
      if (currentMap !== mapId) return;
      mobs.sendMapMonstersSnapshot();
      resources.sendMapResourcesSnapshot();
      return;
    }

    if (combatEventTypes.has(msg.t)) {
      handleCombatSequencedEvent(msg);
      return;
    }
  };

  if (scene) {
    scene.__lanApplyMapPlayers = handleMapPlayers;
    if (players?.refreshRemoteSprites) {
      scene.__lanRefreshRemoteSprites = players.refreshRemoteSprites;
    }
  }
}
