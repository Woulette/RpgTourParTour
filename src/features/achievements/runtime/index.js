import { emit as emitStoreEvent } from "../../../state/store.js";
import { addItem, getItemDef } from "../../inventory/runtime/inventoryAuthority.js";
import { adjustGold } from "../../inventory/runtime/goldAuthority.js";
import { addXpToPlayer } from "../../../entities/player.js";
import { achievementDefs } from "../defs/index.js";
import { addChatMessage } from "../../../chat/chat.js";
import { getNetClient, getNetPlayerId } from "../../../app/session.js";

function useAchievementAuthority() {
  return typeof window !== "undefined" && window.__lanInventoryAuthority === true;
}

function sendAchievementClaim(achievementId) {
  if (!useAchievementAuthority()) return false;
  const client = getNetClient();
  const playerId = getNetPlayerId();
  if (!client || !Number.isInteger(playerId)) return false;
  if (!achievementId) return false;
  try {
    client.sendCmd("CmdAchievementClaim", { playerId, achievementId });
    return true;
  } catch {
    return false;
  }
}

function ensureAchievementContainer(player) {
  if (!player.achievements) player.achievements = {};
  return player.achievements;
}

function getQuestStateValue(player, questId) {
  const state = player?.quests?.[questId]?.state;
  return typeof state === "string" ? state : null;
}

function getQuestStageIndex(player, questId) {
  const stageIndex = player?.quests?.[questId]?.stageIndex;
  return Number.isFinite(stageIndex) ? stageIndex : 0;
}

function evaluateRequirement(player, req) {
  if (!req || !req.type) return { ok: false, current: 0, required: 1 };

  if (req.type === "quest_completed") {
    const ok = getQuestStateValue(player, req.questId) === "completed";
    return { ok, current: ok ? 1 : 0, required: 1 };
  }

  if (req.type === "quest_stage_index_at_least") {
    const min = Number.isFinite(req.min) ? req.min : 0;
    const currentIndex = getQuestStageIndex(player, req.questId);
    const ok = currentIndex >= min;
    return { ok, current: Math.min(min, currentIndex), required: min };
  }

  if (req.type === "achievement_unlocked") {
    const achievementId = req.achievementId;
    if (!achievementId) return { ok: false, current: 0, required: 1 };
    const progress = getAchievementProgress(player, achievementId);
    const ok = progress?.unlocked === true;
    return { ok, current: ok ? 1 : 0, required: 1 };
  }

  return { ok: false, current: 0, required: 1 };
}

export function getAchievementProgress(player, achievementId) {
  const def = achievementDefs.find((a) => a.id === achievementId);
  if (!def) return null;
  const reqs = Array.isArray(def.requirements) ? def.requirements : [];
  const details = reqs.map((r) => evaluateRequirement(player, r));
  const required = details.length;
  const current = details.reduce((acc, d) => acc + (d.ok ? 1 : 0), 0);
  const unlocked = required === 0 ? false : current >= required;

  const container = ensureAchievementContainer(player || {});
  const entry = container[achievementId] || {};
  const claimed = entry.claimed === true;

  return { def, unlocked, claimed, current, required, details };
}

export function listAchievements(player) {
  const safePlayer = player || {};
  return achievementDefs.map((def) => getAchievementProgress(safePlayer, def.id));
}

export function refreshAchievements(player) {
  if (!player) return;
  ensureAchievementContainer(player);
  const progress = listAchievements(player);
  // On n'écrit pas "unlocked" en dur : l'unlock est calculé. On émet pour l'UI.
  emitStoreEvent("achievements:updated", { progress });
  return progress;
}

function applyRewards(player, rewards) {
  if (!player || !rewards) return;

  const xp = rewards.xpPlayer || 0;
  const gold = rewards.gold || 0;
  const honorPoints = rewards.honorPoints || 0;
  const items = Array.isArray(rewards.items) ? rewards.items : [];

  if (xp > 0) {
    // Utilise la logique de level up / sagesse, si dispo.
    addXpToPlayer(player, xp);
  }

  if (gold > 0) adjustGold(player, gold, "achievement_reward");

  if (!Number.isFinite(player.honorPoints)) player.honorPoints = 0;
  if (honorPoints > 0) player.honorPoints += honorPoints;

  if (player.inventory && items.length > 0) {
    items.forEach((it) => {
      if (!it || !it.itemId) return;
      const qty = it.qty || 1;
      addItem(player.inventory, it.itemId, qty);
    });
  }

  const normalizedItems = [];
  if (items.length > 0) {
    const byId = new Map();
    items.forEach((it) => {
      if (!it || !it.itemId) return;
      const qty = it.qty || 1;
      byId.set(it.itemId, (byId.get(it.itemId) || 0) + qty);
    });
    byId.forEach((qty, itemId) => normalizedItems.push({ itemId, qty }));
  }

  const rewardParts = [];
  if (xp > 0) rewardParts.push(`+${xp} XP`);
  if (gold > 0) rewardParts.push(`+${gold} or`);
  if (honorPoints > 0) rewardParts.push(`+${honorPoints} honneur fracturel`);
  if (normalizedItems.length > 0) {
    const parts = normalizedItems.map(({ itemId, qty }) => {
      const def = getItemDef(itemId);
      const label = def?.label || itemId;
      return `${label} x${qty}`;
    });
    rewardParts.push(`+${parts.join(", ")}`);
  }
  const rewardText = rewardParts.length > 0 ? ` (${rewardParts.join(", ")})` : "";
  addChatMessage(
    {
      kind: "achievement",
      author: "Accomplissements",
      channel: "quest",
      text: `R\u00e9compense r\u00e9clam\u00e9e${rewardText}`,
    },
    { player }
  );

  // Event UI : permet d'afficher des pops d'icônes (récompenses visuelles)
  emitStoreEvent("rewards:granted", {
    source: "achievement",
    rewards: {
      xpPlayer: xp,
      gold,
      honorPoints,
      items: normalizedItems,
    },
  });

  emitStoreEvent("player:updated", { player });
}

export function claimAchievement(player, achievementId) {
  if (!player || !achievementId) return { ok: false };
  const progress = getAchievementProgress(player, achievementId);
  if (!progress) return { ok: false, reason: "unknown_achievement" };
  if (!progress.unlocked) return { ok: false, reason: "not_unlocked" };
  if (progress.claimed) return { ok: false, reason: "already_claimed" };

  if (useAchievementAuthority()) {
    sendAchievementClaim(achievementId);
    return { ok: true, pending: true };
  }

  const container = ensureAchievementContainer(player);
  container[achievementId] = { claimed: true, claimedAt: Date.now() };
  applyRewards(player, progress.def.rewards || {});

  refreshAchievements(player);
  return { ok: true };
}
