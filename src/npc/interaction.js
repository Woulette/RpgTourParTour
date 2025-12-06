import { openNpcDialog } from "../ui/domNpcDialog.js";
import {
  getQuestContextForNpc,
  QUEST_STATES,
  acceptQuest,
  advanceQuestStage,
} from "../quests/index.js";
import { getNpcDialog } from "../dialog/npc/index.js";

function setTalkObjectiveComplete(state, stage) {
  if (!state || !stage || !stage.objective) return;
  if (stage.objective.type !== "talk_to_npc") return;
  const required = stage.objective.requiredCount || 1;
  state.progress.currentCount = required;
}

export function startNpcInteraction(scene, player, npc) {
  if (!scene || !player || !npc || !npc.sprite) return;

  const questContext = getQuestContextForNpc(player, npc.id);
  let dialogData = null;

  if (questContext) {
    const { quest, state, stage } = questContext;
    const dialogDef = getNpcDialog(npc.id, quest.id, state.state, stage?.id);

    const isOffer = state.state === QUEST_STATES.NOT_STARTED;
    const isNpcStage = stage && stage.npcId === npc.id;
    const isTalkStage = stage?.objective?.type === "talk_to_npc";
    const requiredCount = stage?.objective?.requiredCount || 1;
    const currentCount = state.progress?.currentCount || 0;
    const objectiveReady = isTalkStage || currentCount >= requiredCount;

    if (isOffer) {
      const base = dialogDef || {
        text: "Salut, tu veux aider ?",
        choice: "J'accepte",
      };
      dialogData = {
        ...base,
        questOffer: true,
        onChoice: () => acceptQuest(player, quest.id),
      };
    } else if (
      isNpcStage &&
      state.state === QUEST_STATES.IN_PROGRESS &&
      objectiveReady
    ) {
      const base = dialogDef || {
        text: "Merci pour le coup de main !",
        choice: "À plus tard.",
      };
      dialogData = {
        ...base,
        questTurnIn: true,
        onChoice: () => {
          setTalkObjectiveComplete(state, stage);
          advanceQuestStage(player, quest.id, { scene });
        },
      };
    } else {
      dialogData = dialogDef || { text: "Bonjour.", choice: "À plus tard." };
    }
  } else {
    dialogData = getNpcDialog(npc.id) || { text: "Bonjour.", choice: "À plus tard." };
  }

  openNpcDialog(npc, player, dialogData);
}
