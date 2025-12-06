import { quests, QUEST_STATES } from "./catalog.js";
import {
  getQuestDef,
  getQuestState,
  acceptQuest,
  incrementKillProgress,
  getAllQuestStates,
} from "./state.js";

export {
  quests,
  QUEST_STATES,
  getQuestDef,
  getQuestState,
  acceptQuest,
  incrementKillProgress,
  getAllQuestStates,
};

export function getPrimaryQuestForNpc(npcId) {
  const list = Object.values(quests);
  return list.find((q) => q.giverNpcId === npcId) || null;
}

