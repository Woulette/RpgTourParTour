import { QUEST_STATES, quests } from "./catalog.js";
import { monsters } from "../content/monsters/index.js";
import { emit as emitStoreEvent } from "../state/store.js";
import { addXpToPlayer } from "../entities/player.js";
import { addChatMessage } from "../chat/chat.js";
import { items as itemDefs } from "../inventory/itemsConfig.js";

function ensureQuestContainer(player) {
  if (!player.quests) {
    player.quests = {};
  }
  return player.quests;
}

function resetStageProgress(state) {
  state.progress = { currentCount: 0, crafted: {}, kills: {}, applied: false };
}

function runStageHook(hookName, stage, context) {
  if (!stage || typeof stage[hookName] !== "function") return;
  try {
    stage[hookName](context);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[quest] stage ${hookName} error`, context?.questId, err);
  }
}

function getMonsterFamilyId(monsterId) {
  if (!monsterId) return null;
  const def = monsters?.[monsterId];
  return def?.familyId || null;
}

function isMonsterObjectiveMatch(objective, monsterId) {
  if (!objective || !monsterId) return false;
  const targetId = objective.monsterId;
  const targetFamily = objective.monsterFamily;
  const familyId = getMonsterFamilyId(monsterId);
  if (targetId && targetId === monsterId) return true;
  if (targetId && familyId && targetId === familyId) return true;
  if (targetFamily && familyId && targetFamily === familyId) return true;
  return false;
}

function getQuestStageByIndex(questDef, stageIndex = 0) {
  if (!questDef || !Array.isArray(questDef.stages) || questDef.stages.length === 0) {
    return null;
  }
  const safeIndex = Math.max(0, Math.min(stageIndex, questDef.stages.length - 1));
  return questDef.stages[safeIndex];
}

export function getCurrentQuestStage(questDef, state) {
  if (!questDef || !state) return null;
  return getQuestStageByIndex(questDef, state.stageIndex || 0);
}

export function getQuestDef(questId) {
  return quests[questId] || null;
}

export function getQuestState(player, questId, { emit = true } = {}) {
  if (!player) return null;
  const container = ensureQuestContainer(player);
  if (!container[questId]) {
    container[questId] = {
      state: QUEST_STATES.NOT_STARTED,
      stageIndex: 0,
      progress: { currentCount: 0 },
    };
    if (emit) {
      emitStoreEvent("quest:updated", { questId, state: container[questId] });
    }
  }
  return container[questId];
}

export function acceptQuest(player, questId) {
  const questDef = getQuestDef(questId);
  if (!questDef || !player) return;
  const state = getQuestState(player, questId);
  if (state.state === QUEST_STATES.NOT_STARTED) {
    state.state = QUEST_STATES.IN_PROGRESS;
    state.stageIndex = 0;
    resetStageProgress(state);
    const stage = getCurrentQuestStage(questDef, state);
    runStageHook("onStart", stage, {
      player,
      questId,
      questDef,
      stage,
      state,
    });
    emitStoreEvent("quest:updated", { questId, state });
    addChatMessage(
      {
        kind: "quest",
        author: "Quêtes",
        channel: "quest",
        text: `Quête commencée : ${questDef.title}`,
      },
      { player }
    );
  }
}

export function advanceQuestStage(player, questId, { scene } = {}) {
  const questDef = getQuestDef(questId);
  if (!questDef || !player) return;
  const state = getQuestState(player, questId);
  if (state.state !== QUEST_STATES.IN_PROGRESS) return;

  const currentStage = getCurrentQuestStage(questDef, state);
  runStageHook("onComplete", currentStage, {
    player,
    scene,
    questId,
    questDef,
    stage: currentStage,
    state,
  });

  const hasStages =
    Array.isArray(questDef.stages) && questDef.stages.length > 0;
  const nextIndex = hasStages ? state.stageIndex + 1 : 0;

  if (!hasStages || nextIndex >= questDef.stages.length) {
    completeQuest(scene, player, questId);
    return;
  }

  state.stageIndex = nextIndex;
  resetStageProgress(state);
  const nextStage = getCurrentQuestStage(questDef, state);
  runStageHook("onStart", nextStage, {
    player,
    scene,
    questId,
    questDef,
    stage: nextStage,
    state,
  });
  emitStoreEvent("quest:updated", { questId, state });
}

export function isQuestCompleted(player, questId) {
  const state = getQuestState(player, questId);
  return state.state === QUEST_STATES.COMPLETED;
}

export function incrementKillProgress(scene, player, questId, monsterId) {
  const questDef = getQuestDef(questId);
  if (!questDef || !player) return;

  const state = getQuestState(player, questId);
  if (state.state !== QUEST_STATES.IN_PROGRESS) return;

  const stage = getCurrentQuestStage(questDef, state);
  if (!stage || !stage.objective) return;
  const objective = stage.objective;

  if (objective.type === "kill_monster") {
    if (!isMonsterObjectiveMatch(objective, monsterId)) return;

    const required = objective.requiredCount || 1;
    const current = state.progress.currentCount || 0;
    const next = Math.min(required, current + 1);

    state.progress.currentCount = next;
    emitStoreEvent("quest:updated", { questId, state });

    if (next >= required) {
      advanceQuestStage(player, questId, { scene });
    }
    return;
  }

  if (objective.type === "kill_monsters") {
    const list = Array.isArray(objective.monsters) ? objective.monsters : [];
    if (list.length === 0) return;
    const target = list.find((entry) => isMonsterObjectiveMatch(entry, monsterId));
    if (!target) return;

    state.progress = state.progress || {};
    state.progress.kills = state.progress.kills || {};
    const current = state.progress.kills[target.monsterId] || 0;
    const required = target.requiredCount || 1;
    const next = Math.min(required, current + 1);
    state.progress.kills[target.monsterId] = next;
    emitStoreEvent("quest:updated", { questId, state });

    const done = list.every((entry) => {
      if (!entry || !entry.monsterId) return false;
      const req = entry.requiredCount || 1;
      const cur = state.progress.kills[entry.monsterId] || 0;
      return cur >= req;
    });
    if (done) {
      advanceQuestStage(player, questId, { scene });
    }
  }
}

export function incrementKillProgressForAll(scene, player, monsterId) {
  if (!player || !monsterId) return;

  Object.values(quests).forEach((questDef) => {
    if (!questDef) return;

    const state = getQuestState(player, questDef.id, { emit: false });
    if (state.state !== QUEST_STATES.IN_PROGRESS) return;

    const stage = getCurrentQuestStage(questDef, state);
    if (!stage || !stage.objective) return;
    const objective = stage.objective;

    if (objective.type === "kill_monster") {
      if (!isMonsterObjectiveMatch(objective, monsterId)) return;

      const required = objective.requiredCount || 1;
      const current = state.progress?.currentCount || 0;
      const next = Math.min(required, current + 1);

      state.progress = state.progress || {};
      state.progress.currentCount = next;
      emitStoreEvent("quest:updated", { questId: questDef.id, state });

      if (next >= required) {
        advanceQuestStage(player, questDef.id, { scene });
      }
      return;
    }

    if (objective.type === "kill_monsters") {
      const list = Array.isArray(objective.monsters) ? objective.monsters : [];
      if (list.length === 0) return;
      const target = list.find((entry) => isMonsterObjectiveMatch(entry, monsterId));
      if (!target) return;

      state.progress = state.progress || {};
      state.progress.kills = state.progress.kills || {};
      const current = state.progress.kills[target.monsterId] || 0;
      const required = target.requiredCount || 1;
      const next = Math.min(required, current + 1);
      state.progress.kills[target.monsterId] = next;
      emitStoreEvent("quest:updated", { questId: questDef.id, state });

      const done = list.every((entry) => {
        if (!entry || !entry.monsterId) return false;
        const req = entry.requiredCount || 1;
        const cur = state.progress.kills[entry.monsterId] || 0;
        return cur >= req;
      });
      if (done) {
        advanceQuestStage(player, questDef.id, { scene });
      }
    }
  });
}

export function incrementCraftProgress(player, itemId, qty = 1) {
  const craftedQty = qty || 1;
  if (!player || !itemId || craftedQty <= 0) return;

  Object.values(quests).forEach((questDef) => {
    if (!questDef) return;
    const state = getQuestState(player, questDef.id, { emit: false });
    if (state.state !== QUEST_STATES.IN_PROGRESS) return;

    const stage = getCurrentQuestStage(questDef, state);
    const objective = stage?.objective;
    if (!objective || !objective.type) return;

    if (objective.type === "craft_items") {
      const items = Array.isArray(objective.items) ? objective.items : [];
      const target = items.find((it) => it && it.itemId === itemId);
      if (!target) return;

      const required = target.qty || 1;
      state.progress = state.progress || {};
      state.progress.crafted = state.progress.crafted || {};

      const current = state.progress.crafted[itemId] || 0;
      const next = Math.min(required, current + craftedQty);
      state.progress.crafted[itemId] = next;

      const totalRequired = items.reduce((acc, it) => acc + (it?.qty || 1), 0);
      const totalCurrent = items.reduce(
        (acc, it) =>
          acc + Math.min(it?.qty || 1, state.progress.crafted[it.itemId] || 0),
        0
      );
      state.progress.currentCount = Math.min(totalRequired, totalCurrent);

      emitStoreEvent("quest:updated", { questId: questDef.id, state });
      return;
    }

    if (objective.type === "craft_set") {
      const def = itemDefs?.[itemId];
      const setId = objective.setId;
      if (!def || !setId || def.setId !== setId) return;

      state.progress = state.progress || {};

      const requiredSlots = Array.isArray(objective.requiredSlots)
        ? objective.requiredSlots.filter(Boolean)
        : [];

      if (requiredSlots.length > 0) {
        const slot = def.slot || null;
        if (!slot || !requiredSlots.includes(slot)) return;
        state.progress.craftedSlots = state.progress.craftedSlots || {};
        state.progress.craftedSlots[slot] = true;
        const current = requiredSlots.reduce(
          (acc, s) => acc + (state.progress.craftedSlots[s] ? 1 : 0),
          0
        );
        state.progress.currentCount = Math.min(requiredSlots.length, current);
      } else {
        const required = objective.requiredCount || 1;
        const current = state.progress.currentCount || 0;
        state.progress.currentCount = Math.min(required, current + craftedQty);
      }

      emitStoreEvent("quest:updated", { questId: questDef.id, state });
    }
  });
}

export function completeQuest(scene, player, questId) {
  const questDef = getQuestDef(questId);
  if (!questDef || !player) return;
  const state = getQuestState(player, questId);
  if (state.state === QUEST_STATES.COMPLETED) return;

  const stageCount = Array.isArray(questDef.stages)
    ? questDef.stages.length
    : 0;
  if (stageCount > 0) {
    state.stageIndex = stageCount - 1;
  }

  state.state = QUEST_STATES.COMPLETED;
  emitStoreEvent("quest:updated", { questId, state });

  const rewards = questDef.rewards || {};
  const xp = rewards.xpPlayer || 0;
  const gold = rewards.gold || 0;

  if (xp > 0) {
    addXpToPlayer(player, xp);
  }

  if (!player.gold) {
    player.gold = 0;
  }
  if (gold > 0) {
    player.gold += gold;
  }

  const rewardParts = [];
  if (xp > 0) rewardParts.push(`+${xp} XP`);
  if (gold > 0) rewardParts.push(`+${gold} or`);
  const rewardText = rewardParts.length > 0 ? ` (${rewardParts.join(", ")})` : "";
  addChatMessage(
    {
      kind: "quest",
      author: "Quêtes",
      channel: "quest",
      text: `Quête terminée : ${questDef.title}${rewardText}`,
    },
    { player }
  );
}

export function getAllQuestStates(player) {
  const container = ensureQuestContainer(player);
  return Object.entries(quests).map(([id, def]) => {
    const state = getQuestState(player, id, { emit: false });
    const stage = getCurrentQuestStage(def, state);
    return { def, state, stage };
  });
}
