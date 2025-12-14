import { openNpcDialog } from "../ui/domNpcDialog.js";
import {
  getQuestContextForNpc,
  QUEST_STATES,
  acceptQuest,
  advanceQuestStage,
} from "../quests/index.js";
import { getNpcDialog } from "../dialog/npcs/index.js";
import { DIALOG_STATES } from "../dialog/npcs/dialogStates.js";
import { tryTurnInStage } from "../quests/runtime/objectives.js";

function openDialogSequence(npc, player, screens, onDone) {
  const list = Array.isArray(screens) ? screens : [];
  if (list.length === 0) return;

  const openAt = (index) => {
    const screen = list[index];
    if (!screen) return;
    const isLast = index >= list.length - 1;

    openNpcDialog(npc, player, {
      ...screen,
      closeOnChoice: !isLast ? false : screen.closeOnChoice,
      onChoice: () => {
        if (!isLast) return openAt(index + 1);
        if (typeof onDone === "function") onDone();
      },
    });
  };

  openAt(0);
}

function openDialog(npc, player, dialogData, onDone) {
  if (!dialogData) return;

  if (Array.isArray(dialogData.sequence)) {
    const lastIndex = dialogData.sequence.length - 1;
    const screens = dialogData.sequence.map((screen, index) => {
      if (index !== lastIndex) return screen;
      return {
        ...screen,
        questOffer: dialogData.questOffer,
        questTurnIn: dialogData.questTurnIn,
      };
    });
    openDialogSequence(npc, player, screens, onDone);
    return;
  }

  openNpcDialog(npc, player, {
    ...dialogData,
    onChoice: () => {
      if (typeof onDone === "function") onDone();
    },
  });
}

export function startNpcInteraction(scene, player, npc) {
  if (!scene || !player || !npc || !npc.sprite) return;

  const questContext = getQuestContextForNpc(player, npc.id);

  let dialogData = null;
  let onDone = null;

  if (questContext) {
    const { quest, state, stage, offerable, turnInReady } = questContext;

    const objectiveType = stage?.objective?.type;
    const dialogState =
      state.state === QUEST_STATES.IN_PROGRESS &&
      turnInReady &&
      objectiveType &&
      objectiveType !== "talk_to_npc"
        ? DIALOG_STATES.READY_TO_TURN_IN
        : state.state;

    const dialogDef = getNpcDialog(npc.id, quest.id, dialogState, stage?.id);

    if (offerable && state.state === QUEST_STATES.NOT_STARTED) {
      const base = dialogDef || { text: "Salut, tu veux aider ?", choice: "J'accepte" };
      dialogData = { ...base, questOffer: true };
      onDone = () => {
        acceptQuest(player, quest.id);
        if (npc.questMarker && npc.questMarker.destroy) {
          npc.questMarker.destroy();
          npc.questMarker = null;
        }
      };
    } else if (state.state === QUEST_STATES.IN_PROGRESS && turnInReady) {
      const base = dialogDef || {
        text: "Merci pour le coup de main !",
        choice: "A plus tard.",
      };
      dialogData = { ...base, questTurnIn: true };
      onDone = () => {
        const result = tryTurnInStage(scene, player, quest.id, quest, state, stage);
        if (!result.ok) return;
        advanceQuestStage(player, quest.id, { scene });
      };
    } else {
      dialogData = dialogDef || getNpcDialog(npc.id) || {
        text: "Bonjour.",
        choice: "A plus tard.",
      };
    }
  } else {
    dialogData = getNpcDialog(npc.id) || { text: "Bonjour.", choice: "A plus tard." };
  }

  openDialog(npc, player, dialogData, onDone);
}
