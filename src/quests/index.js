import { quests, QUEST_STATES } from "./catalog.js";
import {
  getQuestDef,
  getQuestState,
  acceptQuest,
  incrementKillProgress,
  incrementKillProgressForAll,
  incrementCraftProgress,
  getAllQuestStates,
  advanceQuestStage,
  getCurrentQuestStage,
} from "./state.js";
import {
  getNpcMarker,
  getQuestContextForNpc,
  getOfferableQuestsForNpc,
} from "./runtime/npcStatus.js";

export {
  quests,
  QUEST_STATES,
  getQuestDef,
  getQuestState,
  acceptQuest,
  incrementKillProgress,
  incrementKillProgressForAll,
  incrementCraftProgress,
  getAllQuestStates,
  advanceQuestStage,
  getCurrentQuestStage,
  getNpcMarker,
  getQuestContextForNpc,
  getOfferableQuestsForNpc,
};

export function getPrimaryQuestForNpc(npcId, player) {
  if (player) {
    const context = getQuestContextForNpc(player, npcId);
    return context ? context.quest : null;
  }
  const list = Object.values(quests);
  return list.find((q) => q.giverNpcId === npcId) || null;
}
