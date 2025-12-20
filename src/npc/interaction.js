import { openNpcDialog } from "../ui/domNpcDialog.js";
import {
  getQuestContextForNpc,
  QUEST_STATES,
  acceptQuest,
  advanceQuestStage,
} from "../quests/index.js";
import { getNpcDialog } from "../dialog/npcs/index.js";
import { DIALOG_STATES } from "../dialog/npcs/dialogStates.js";
import { countItemInInventory, tryTurnInStage } from "../quests/runtime/objectives.js";
import { enterDungeon } from "../dungeons/runtime.js";

const DUNGEON_KEY_ITEM_ID = "cle_donjon_aluineeks";
// (mentor) on enchaîne automatiquement sur la prochaine épreuve disponible

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
  const isDungeonKeeper = npc.id === "donjon_aluineeks_keeper";

  // Donjon Aluineeks : si aucune quete n'est en cours sur ce PNJ,
  // on affiche l'option "cle" si le joueur en possede une.
  if (isDungeonKeeper && !questContext) {
    const hasKey = countItemInInventory(player, DUNGEON_KEY_ITEM_ID) > 0;
    openNpcDialog(npc, player, {
      text: hasKey
        ? "Tu as une cle.\nUtiliser la cle pour entrer ?"
        : "Le donjon est dangereux.\nEntre seulement si tu es pret.",
      choice: hasKey ? "Utiliser la cle pour entrer" : "Entrer dans le donjon",
      closeOnChoice: true,
      onChoice: () => {
        // Pour le moment, on laisse l'entree possible meme sans cle.
        enterDungeon(scene, "aluineeks");
      },
    });
    return;
  }

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
      const shouldChainOffer = npc.id === "meme_village" && quest.id === "andemia_intro_1";
      dialogData = { ...base, questTurnIn: true, closeOnChoice: !shouldChainOffer };
      onDone = () => {
        const result = tryTurnInStage(scene, player, quest.id, quest, state, stage);
        if (!result.ok) return;
        advanceQuestStage(player, quest.id, { scene });

        // Chaînage sans re-cliquer ni fermer : on valide la quête actuelle,
        // puis on propose directement la prochaine quête disponible sur ce même PNJ.
        if (shouldChainOffer) {
          const offerContext = getQuestContextForNpc(player, npc.id);
          if (offerContext && offerContext.offerable && offerContext.quest) {
            const offerQuest = offerContext.quest;
            const offerState = offerContext.state;
            const offerStage = offerContext.stage;
            const offerDialogDef = getNpcDialog(
              npc.id,
              offerQuest.id,
              offerState?.state,
              offerStage?.id
            );

            const baseOffer =
              offerDialogDef || { text: "Je te confie une mission.", choice: "J'accepte" };

            openDialog(npc, player, { ...baseOffer, questOffer: true }, () => {
              acceptQuest(player, offerQuest.id);
              if (npc.questMarker && npc.questMarker.destroy) {
                npc.questMarker.destroy();
                npc.questMarker = null;
              }
            });
          }
          return;
        }

        // Enchaînement spécial : après avoir parlé au Maître (fin de la quête "donjon"),
        // on enchaîne directement sur le dialogue de la première épreuve, sans fermer.
        if (npc.id === "mentor_map5") {
          const offerContext = getQuestContextForNpc(player, npc.id);
          if (offerContext && offerContext.offerable && offerContext.quest) {
            const offerQuest = offerContext.quest;
            const offerState = offerContext.state;
            const offerStage = offerContext.stage;
            const offerDialogDef = getNpcDialog(
              npc.id,
              offerQuest.id,
              offerState?.state,
              offerStage?.id
            );

            const baseOffer =
              offerDialogDef || { text: "Je te confie une épreuve.", choice: "J'accepte" };

            openDialog(npc, player, { ...baseOffer, questOffer: true }, () => {
              acceptQuest(player, offerQuest.id);
              if (npc.questMarker && npc.questMarker.destroy) {
                npc.questMarker.destroy();
                npc.questMarker = null;
              }
            });
          }
        }
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
