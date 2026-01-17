function createPlayerSyncHandlers({
  state,
  clients,
  send,
  persistPlayerState,
  computeFinalStats,
  getNextEventId,
  helpers,
}) {
  const {
    sanitizeInventorySnapshot,
    isInventoryEmpty,
    sanitizeLevel,
    sanitizeJsonPayload,
    sanitizeEquipment,
    sanitizeBaseStats,
    diffInventory,
    logAntiDup,
  } = helpers;

  function findClientByPlayerId(playerId) {
    if (!Number.isInteger(playerId)) return null;
    for (const [ws, info] of clients.entries()) {
      if (!info) continue;
      if (info.id === playerId) {
        return { ws, info };
      }
    }
    return null;
  }

  function sendPlayerSync(ws, player, reason) {
    if (!ws || !player) return;
    send(ws, {
      t: "EvPlayerSync",
      eventId: getNextEventId(),
      playerId: player.id,
      reason: reason || null,
      inventory: player.inventory || null,
      gold: Number.isFinite(player.gold) ? player.gold : 0,
      honorPoints: Number.isFinite(player.honorPoints) ? player.honorPoints : 0,
      equipment: player.equipment || null,
      levelState: player.levelState || null,
      quests: player.quests || {},
      achievements: player.achievements || null,
      metiers: player.metiers || null,
      baseStats: player.baseStats || null,
      hp: Number.isFinite(player.hp) ? player.hp : null,
      hpMax: Number.isFinite(player.hpMax) ? player.hpMax : null,
    });
  }

  function handleCmdPlayerSync(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const player = state.players[clientInfo.id];
    if (!player) return;

    const beforeInventory = player.inventory || null;
    const beforeGold = Number.isFinite(player.gold) ? player.gold : 0;
    const allowInventorySync = clientInfo.inventoryAuthority !== true;
    let shouldRecompute = false;

    if (!allowInventorySync) {
      if (msg?.migrateInventory === true) {
        if (player.inventoryMigrated) return;
        if (!isInventoryEmpty(player.inventory)) return;
        const inventory = sanitizeInventorySnapshot(msg.inventory);
        if (!inventory) return;
        player.inventory = inventory;
        if (Number.isFinite(msg.gold)) {
          player.gold = Math.max(0, Math.round(msg.gold));
        }
        player.inventoryMigrated = true;
        if (typeof persistPlayerState === "function") {
          persistPlayerState(player);
        }
        const afterInventory = player.inventory || null;
        const afterGold = Number.isFinite(player.gold) ? player.gold : 0;
        const goldDelta = afterGold - beforeGold;
        const itemDeltas = diffInventory(beforeInventory, afterInventory);
        if (goldDelta !== 0 || itemDeltas.length > 0) {
          logAntiDup({
            ts: Date.now(),
            reason: "InventoryMigration",
            accountId: player.accountId || null,
            characterId: player.characterId || null,
            playerId: player.id || null,
            mapId: player.mapId || null,
            goldDelta,
            itemDeltas: itemDeltas.slice(0, 20),
          });
        }
        const target = findClientByPlayerId(player.id);
        if (target?.ws) {
          sendPlayerSync(target.ws, player, "inventory_migration");
        }
      }
    } else {
      const inventory = sanitizeInventorySnapshot(msg.inventory);
      if (inventory) {
        player.inventory = inventory;
      }
      if (Number.isFinite(msg.gold)) {
        player.gold = Math.max(0, Math.round(msg.gold));
      }
      if (Number.isFinite(msg.honorPoints)) {
        player.honorPoints = Math.max(0, Math.round(msg.honorPoints));
      }

      const level = sanitizeLevel(msg.level);
      if (level !== null) {
        player.level = level;
      }
    }

    const baseStats = sanitizeBaseStats(msg.baseStats);
    if (baseStats) {
      player.baseStats = baseStats;
      shouldRecompute = true;
    }

    const levelState = sanitizeJsonPayload(msg.levelState, 50000);
    if (levelState) {
      player.levelState = levelState;
    }

    if (allowInventorySync) {
      const equipment = sanitizeEquipment(msg.equipment);
      if (equipment) {
        player.equipment = equipment;
        shouldRecompute = true;
      }
    }

    if (allowInventorySync) {
      const trash = sanitizeJsonPayload(msg.trash, 20000);
      if (trash) {
        player.trash = trash;
      }
    }

    if (allowInventorySync) {
      const quests = sanitizeJsonPayload(msg.quests, 80000);
      if (quests) {
        player.quests = quests;
      }
    }

    if (allowInventorySync) {
      const achievements = sanitizeJsonPayload(msg.achievements, 60000);
      if (achievements) {
        player.achievements = achievements;
      }
    }

    const metiers = sanitizeJsonPayload(msg.metiers, 60000);
    if (metiers) {
      player.metiers = metiers;
    }

    const spellParchments = sanitizeJsonPayload(msg.spellParchments, 20000);
    if (spellParchments) {
      player.spellParchments = spellParchments;
    }

    if (shouldRecompute && typeof computeFinalStats === "function" && player.baseStats) {
      const nextStats = computeFinalStats(player.baseStats, player.equipment);
      if (nextStats) {
        player.stats = nextStats;
        player.hpMax = Number.isFinite(nextStats.hpMax) ? nextStats.hpMax : player.hpMax;
        if (Number.isFinite(player.hp)) {
          player.hp = Math.min(player.hp, player.hpMax);
        } else if (Number.isFinite(nextStats.hp)) {
          player.hp = Math.min(nextStats.hp, player.hpMax);
        }
      }
    }

    if (typeof persistPlayerState === "function") {
      persistPlayerState(player);
    }

    if (allowInventorySync) {
      const afterInventory = player.inventory || null;
      const afterGold = Number.isFinite(player.gold) ? player.gold : 0;
      const goldDelta = afterGold - beforeGold;
      const itemDeltas = diffInventory(beforeInventory, afterInventory);
      if (goldDelta !== 0 || itemDeltas.length > 0) {
        logAntiDup({
          ts: Date.now(),
          reason: "CmdPlayerSync",
          accountId: player.accountId || null,
          characterId: player.characterId || null,
          playerId: player.id || null,
          mapId: player.mapId || null,
          goldDelta,
          itemDeltas: itemDeltas.slice(0, 20),
        });
      }
    }
  }

  return {
    findClientByPlayerId,
    sendPlayerSync,
    handleCmdPlayerSync,
  };
}

module.exports = {
  createPlayerSyncHandlers,
};
