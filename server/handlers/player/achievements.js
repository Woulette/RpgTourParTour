function createAchievementHandlers({
  state,
  persistPlayerState,
  helpers,
  sync,
  getAchievementDefs,
  getAchievementDefsPromise,
  getAchievementDefsFailed,
  getLevelApi,
  computeFinalStats,
}) {
  const {
    ensurePlayerInventory,
    snapshotInventory,
    restoreInventory,
    addItemToInventory,
    diffInventory,
    logAntiDup,
  } = helpers;
  const { sendPlayerSync, findClientByPlayerId } = sync;

  function getAchievementDefsSafe() {
    return typeof getAchievementDefs === "function" ? getAchievementDefs() : null;
  }

  function getAchievementDef(defs, achievementId) {
    if (!defs || !achievementId) return null;
    return defs.find((d) => d && d.id === achievementId) || null;
  }

  function isQuestCompleted(player, questId) {
    return player?.quests?.[questId]?.state === "completed";
  }

  function getQuestStageIndex(player, questId) {
    const stageIndex = player?.quests?.[questId]?.stageIndex;
    return Number.isFinite(stageIndex) ? stageIndex : 0;
  }

  function isAchievementUnlocked(player, defs, achievementId, visiting = new Set()) {
    if (!player || !defs || !achievementId) return false;
    if (visiting.has(achievementId)) return false;
    const def = getAchievementDef(defs, achievementId);
    if (!def) return false;
    const reqs = Array.isArray(def.requirements) ? def.requirements : [];
    if (reqs.length === 0) return false;
    visiting.add(achievementId);
    const ok = reqs.every((req) => {
      if (!req || !req.type) return false;
      if (req.type === "quest_completed") {
        return isQuestCompleted(player, req.questId);
      }
      if (req.type === "quest_stage_index_at_least") {
        const min = Number.isFinite(req.min) ? req.min : 0;
        return getQuestStageIndex(player, req.questId) >= min;
      }
      if (req.type === "achievement_unlocked") {
        return isAchievementUnlocked(player, defs, req.achievementId, visiting);
      }
      return false;
    });
    visiting.delete(achievementId);
    return ok;
  }

  function applyAchievementRewards(player, def) {
    const rewards = def?.rewards || {};
    const xp = Number.isFinite(rewards.xpPlayer) ? rewards.xpPlayer : 0;
    const gold = Number.isFinite(rewards.gold) ? rewards.gold : 0;
    const honorPoints = Number.isFinite(rewards.honorPoints) ? rewards.honorPoints : 0;
    const items = Array.isArray(rewards.items) ? rewards.items : [];

    if (items.length > 0) {
      const inv = ensurePlayerInventory(player);
      const beforeInv = snapshotInventory(inv);
      let ok = true;
      items.forEach((entry) => {
        if (!entry || !entry.itemId) return;
        const qty = Number.isInteger(entry.qty) ? entry.qty : 1;
        if (qty <= 0) return;
        const added = addItemToInventory(inv, entry.itemId, qty);
        if (added < qty) ok = false;
      });
      if (!ok) {
        restoreInventory(inv, beforeInv);
        return false;
      }
      const deltas = diffInventory(beforeInv, inv);
      if (deltas.length > 0) {
        logAntiDup({
          ts: Date.now(),
          reason: "AchievementReward",
          accountId: player.accountId || null,
          characterId: player.characterId || null,
          playerId: player.id || null,
          mapId: player.mapId || null,
          itemDeltas: deltas.slice(0, 20),
        });
      }
    }

    if (xp > 0 && typeof getLevelApi === "function") {
      const api = getLevelApi();
      if (api && typeof api.ajouterXp === "function") {
        const levelState =
          player.levelState && typeof player.levelState === "object"
            ? player.levelState
            : typeof api.createLevelState === "function"
              ? api.createLevelState()
              : { niveau: 1, xp: 0, xpTotal: 0, xpProchain: 0, pointsCaracLibres: 0 };
        const result = api.ajouterXp(levelState, xp);
        if (result?.nouveauState) {
          player.levelState = result.nouveauState;
          player.level = result.nouveauState.niveau;
        }
      }
    }

    if (gold > 0) {
      const beforeGold = Number.isFinite(player.gold) ? player.gold : 0;
      player.gold = Math.max(0, beforeGold + Math.round(gold));
      if (player.gold !== beforeGold) {
        logAntiDup({
          ts: Date.now(),
          reason: "AchievementReward",
          accountId: player.accountId || null,
          characterId: player.characterId || null,
          playerId: player.id || null,
          mapId: player.mapId || null,
          goldDelta: player.gold - beforeGold,
        });
      }
    }

    if (honorPoints > 0) {
      const beforeHonor = Number.isFinite(player.honorPoints) ? player.honorPoints : 0;
      player.honorPoints = beforeHonor + honorPoints;
    }

    if (typeof computeFinalStats === "function" && player.baseStats) {
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

    return true;
  }

  function handleCmdAchievementClaim(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return false;
    const achievementId =
      typeof msg.achievementId === "string" ? msg.achievementId : null;
    if (!achievementId) return false;

    const defs = getAchievementDefsSafe();
    const defsFailed =
      typeof getAchievementDefsFailed === "function" ? getAchievementDefsFailed() : false;
    const defsPromise =
      typeof getAchievementDefsPromise === "function" ? getAchievementDefsPromise() : null;
    if (!defs && !defsFailed) {
      if (!msg.__achievementDefsWaited) {
        msg.__achievementDefsWaited = true;
        defsPromise?.then(() => handleCmdAchievementClaim(clientInfo, msg));
      }
      return false;
    }
    if (!defs || defsFailed) return false;
    const def = getAchievementDef(defs, achievementId);
    if (!def) return false;

    const player = state.players[clientInfo.id];
    if (!player) return false;
    if (!player.achievements) player.achievements = {};
    if (player.achievements[achievementId]?.claimed === true) return false;

    const unlocked = isAchievementUnlocked(player, defs, achievementId);
    if (!unlocked) return false;

    if (!applyAchievementRewards(player, def)) return false;

    player.achievements[achievementId] = {
      claimed: true,
      claimedAt: Date.now(),
    };

    if (typeof persistPlayerState === "function") {
      persistPlayerState(player);
    }
    const target = findClientByPlayerId(player.id);
    if (target?.ws) {
      sendPlayerSync(target.ws, player, "achievement");
    }
    return true;
  }

  return {
    handleCmdAchievementClaim,
  };
}

module.exports = {
  createAchievementHandlers,
};
