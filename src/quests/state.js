import { QUEST_STATES, quests } from "./catalog.js";

function ensureQuestContainer(player) {
  if (!player.quests) {
    player.quests = {};
  }
  return player.quests;
}

export function getQuestDef(questId) {
  return quests[questId] || null;
}

export function getQuestState(player, questId) {
  if (!player) return null;
  const container = ensureQuestContainer(player);
  if (!container[questId]) {
    container[questId] = {
      state: QUEST_STATES.NOT_STARTED,
      progress: { currentCount: 0 },
    };
  }
  return container[questId];
}

export function acceptQuest(player, questId) {
  const qDef = getQuestDef(questId);
  if (!qDef || !player) return;
  const state = getQuestState(player, questId);
  if (state.state === QUEST_STATES.NOT_STARTED) {
    state.state = QUEST_STATES.IN_PROGRESS;
    state.progress.currentCount = 0;
  }
}

export function isQuestCompleted(player, questId) {
  const state = getQuestState(player, questId);
  return state.state === QUEST_STATES.COMPLETED;
}

export function incrementKillProgress(scene, player, questId, monsterId) {
  const qDef = getQuestDef(questId);
  if (!qDef || !player) return;
  if (!qDef.objective || qDef.objective.type !== "kill_monster") return;
  if (qDef.objective.monsterId !== monsterId) return;

  const state = getQuestState(player, questId);
  if (state.state !== QUEST_STATES.IN_PROGRESS) return;

  const required = qDef.objective.requiredCount || 1;
  const current = state.progress.currentCount || 0;
  const next = Math.min(required, current + 1);

  state.progress.currentCount = next;

  if (next >= required) {
    completeQuest(scene, player, questId);
  }
}

export function completeQuest(scene, player, questId) {
  const qDef = getQuestDef(questId);
  if (!qDef || !player) return;
  const state = getQuestState(player, questId);
  if (state.state === QUEST_STATES.COMPLETED) return;

  state.state = QUEST_STATES.COMPLETED;

  const rewards = qDef.rewards || {};
  const xp = rewards.xpPlayer || 0;
  const gold = rewards.gold || 0;

  if (!player.levelState) {
    player.levelState = { xp: 0 };
  }
  if (xp > 0) {
    player.levelState.xp = (player.levelState.xp || 0) + xp;
  }

  if (!player.gold) {
    player.gold = 0;
  }
  if (gold > 0) {
    player.gold += gold;
  }
}

export function getAllQuestStates(player) {
  const container = ensureQuestContainer(player);
  return Object.entries(quests).map(([id, def]) => {
    const state = getQuestState(player, id);
    return { def, state };
  });
}

