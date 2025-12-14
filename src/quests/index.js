import { quests, QUEST_STATES } from "./catalog.js";
import {
  getQuestDef,
  getQuestState,
  acceptQuest,
  incrementKillProgress,
  getAllQuestStates,
  advanceQuestStage,
  getCurrentQuestStage,
  isQuestCompleted,
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

  // 1) Priorité aux quêtes EN COURS dont l'étape actuelle cible ce PNJ.
  const inProgress = entries.find((questDef) => {
    const state = getQuestState(player, questDef.id, { emit: false });
    if (state.state !== QUEST_STATES.IN_PROGRESS) return false;
    const stage = getCurrentQuestStage(questDef, state);
    return stage && stage.npcId === npcId;
  });

  if (inProgress) {
    const state = getQuestState(player, inProgress.id);
    const stage = getCurrentQuestStage(inProgress, state);
    return { quest: inProgress, state, stage };
  }

  // 2) Sinon, proposer une nouvelle quête disponible chez ce PNJ.
  const offer = entries.find((questDef) => {
    if (questDef.giverNpcId !== npcId) return false;
    const state = getQuestState(player, questDef.id, { emit: false });

    // Si la quête a des prérequis, on ne la propose que si tous sont complétés.
    if (Array.isArray(questDef.requires) && questDef.requires.length > 0) {
      const allDone = questDef.requires.every((reqId) =>
        isQuestCompleted(player, reqId)
      );
      if (!allDone) return false;
    }

    return state.state === QUEST_STATES.NOT_STARTED;
  });

  if (offer) {
    const state = getQuestState(player, offer.id);
    return { quest: offer, state, stage: getCurrentQuestStage(offer, state) };
  }

  // 3) Sinon, si aucune quête en cours / disponible ne concerne ce PNJ, rien de spécial.
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
