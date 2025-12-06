import { quests, QUEST_STATES } from "./catalog.js";
import {
  getQuestDef,
  getQuestState,
  acceptQuest,
  incrementKillProgress,
  getAllQuestStates,
  advanceQuestStage,
  getCurrentQuestStage,
} from "./state.js";

export {
  quests,
  QUEST_STATES,
  getQuestDef,
  getQuestState,
  acceptQuest,
  incrementKillProgress,
  getAllQuestStates,
  advanceQuestStage,
  getCurrentQuestStage,
};

export function getQuestContextForNpc(player, npcId) {
  if (!player || !npcId) return null;

  const entries = Object.values(quests);

  const offer = entries.find((questDef) => {
    if (questDef.giverNpcId !== npcId) return false;
    const state = getQuestState(player, questDef.id, { emit: false });
    return state.state === QUEST_STATES.NOT_STARTED;
  });
  if (offer) {
    const state = getQuestState(player, offer.id);
    return { quest: offer, state, stage: getCurrentQuestStage(offer, state) };
  }

  const stageMatch = entries.find((questDef) => {
    const state = getQuestState(player, questDef.id, { emit: false });
    if (state.state === QUEST_STATES.NOT_STARTED) return false;
    const stage = getCurrentQuestStage(questDef, state);
    return stage && stage.npcId === npcId;
  });

  if (stageMatch) {
    const state = getQuestState(player, stageMatch.id);
    const stage = getCurrentQuestStage(stageMatch, state);
    return { quest: stageMatch, state, stage };
  }

  return null;
}

export function getPrimaryQuestForNpc(npcId, player) {
  if (player) {
    const context = getQuestContextForNpc(player, npcId);
    return context ? context.quest : null;
  }
  const list = Object.values(quests);
  return list.find((q) => q.giverNpcId === npcId) || null;
}
