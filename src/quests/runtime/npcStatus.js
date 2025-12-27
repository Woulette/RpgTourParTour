import { quests, QUEST_STATES } from "../catalog.js";
import { getQuestState, getCurrentQuestStage } from "../state.js";
import { isTurnInReadyAtNpc } from "./objectives.js";

function isOfferable(player, questDef, npcId) {
  if (!player || !questDef || !npcId) return false;
  if (questDef.giverNpcId !== npcId) return false;

  const state = getQuestState(player, questDef.id, { emit: false });
  if (state.state !== QUEST_STATES.NOT_STARTED) return false;

  if (Array.isArray(questDef.requires) && questDef.requires.length > 0) {
    const allDone = questDef.requires.every((reqId) => {
      const reqState = getQuestState(player, reqId, { emit: false });
      return reqState.state === QUEST_STATES.COMPLETED;
    });
    if (!allDone) return false;
  }

  return true;
}

export function getNpcMarker(player, npcId) {
  if (!player || !npcId) return null;
  const entries = Object.values(quests);

  const hasTurnIn = entries.some((questDef) => {
    const state = getQuestState(player, questDef.id, { emit: false });
    if (state.state !== QUEST_STATES.IN_PROGRESS) return false;
    const stage = getCurrentQuestStage(questDef, state);
    return isTurnInReadyAtNpc(player, questDef, state, stage, npcId);
  });

  if (hasTurnIn) return "?";

  const hasOffer = entries.some((questDef) => isOfferable(player, questDef, npcId));
  if (hasOffer) return "!";

  return null;
}

export function getQuestContextForNpc(player, npcId) {
  if (!player || !npcId) return null;
  const entries = Object.values(quests);

  const inProgressTurnIn = entries.find((questDef) => {
    const state = getQuestState(player, questDef.id, { emit: false });
    if (state.state !== QUEST_STATES.IN_PROGRESS) return false;
    const stage = getCurrentQuestStage(questDef, state);
    return isTurnInReadyAtNpc(player, questDef, state, stage, npcId);
  });

  if (inProgressTurnIn) {
    const state = getQuestState(player, inProgressTurnIn.id);
    const stage = getCurrentQuestStage(inProgressTurnIn, state);
    return { quest: inProgressTurnIn, state, stage, turnInReady: true, offerable: false };
  }

  const inProgressHere = entries.find((questDef) => {
    const state = getQuestState(player, questDef.id, { emit: false });
    if (state.state !== QUEST_STATES.IN_PROGRESS) return false;
    const stage = getCurrentQuestStage(questDef, state);
    return stage && stage.npcId === npcId;
  });

  if (inProgressHere) {
    const state = getQuestState(player, inProgressHere.id);
    const stage = getCurrentQuestStage(inProgressHere, state);
    return { quest: inProgressHere, state, stage, turnInReady: false, offerable: false };
  }

  const offer = entries.find((questDef) => isOfferable(player, questDef, npcId));
  if (offer) {
    const state = getQuestState(player, offer.id);
    return { quest: offer, state, stage: getCurrentQuestStage(offer, state), turnInReady: false, offerable: true };
  }

  const inProgressGiver = entries.find((questDef) => {
    if (questDef.giverNpcId !== npcId) return false;
    const state = getQuestState(player, questDef.id, { emit: false });
    return state.state === QUEST_STATES.IN_PROGRESS;
  });

  if (inProgressGiver) {
    const state = getQuestState(player, inProgressGiver.id);
    const stage = getCurrentQuestStage(inProgressGiver, state);
    return { quest: inProgressGiver, state, stage, turnInReady: false, offerable: false };
  }

  return null;
}

export function getOfferableQuestsForNpc(player, npcId) {
  if (!player || !npcId) return [];
  const entries = Object.values(quests);
  return entries.filter((questDef) => isOfferable(player, questDef, npcId));
}
