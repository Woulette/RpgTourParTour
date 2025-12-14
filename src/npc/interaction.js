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

    // Intro multi-etapes avec Papi pour la quete papi_corbeaux_1
    if (quest.id === "papi_corbeaux_1" && state.state === QUEST_STATES.NOT_STARTED) {
      const finalStep = {
        text:
          "Effectivement, tout est lie.\n" +
          "Bienvenue a Andemia. Une fois pris dans cette fracture, on ne repart pas aussi facilement...\n\n" +
          "Mais si tu dois rester, autant apprendre a survivre.\n" +
          "Ta formation commence ici, aventurier.\n" +
          "Tu veux bien me donner un coup de main ?",
        choice: "Oui, je vais t'aider.",
        questOffer: true,
        onChoice: () => {
          acceptQuest(player, quest.id);
          // On vient de prendre la quete -> plus de point d'exclamation au-dessus de Papi
          if (npc.questMarker && npc.questMarker.destroy) {
            npc.questMarker.destroy();
            npc.questMarker = null;
          }
        },
      };

      const secondStep = {
        text:
          "Hum. Ca se confirme... Tu dois etre victime d'un de ces retards temporels.\n" +
          "Depuis la fracture, des gens apparaissent comme toi : d'un coup, sans explication, au milieu d'Andemia.",
        choice: "J'ai juste un souvenir flou...",
        closeOnChoice: false,
        onChoice: () => {
          openNpcDialog(npc, player, finalStep);
        },
      };

      const firstStep = {
        text: "Mais d'ou sors-tu, toi ? Je ne t'ai pas vu arriver.",
        choice: "Je... je ne sais meme pas ce que je fais ici. Tout est flou.",
        closeOnChoice: false,
        onChoice: () => {
          openNpcDialog(npc, player, secondStep);
        },
      };

      openNpcDialog(npc, player, firstStep);
      return;
    }

    const dialogDef = getNpcDialog(npc.id, quest.id, state.state, stage?.id);

    const isOffer = state.state === QUEST_STATES.NOT_STARTED;
    const isNpcStage = stage && stage.npcId === npc.id;
    const isTalkStage = stage?.objective?.type === "talk_to_npc";
    const requiredCount = stage?.objective?.requiredCount || 1;
    const currentCount = state.progress?.currentCount || 0;
    let objectiveReady = isTalkStage || currentCount >= requiredCount;

    // Etape ou Meme demande du bois : on verifie l'inventaire (10 bois_chene).
    if (
      quest.id === "papi_meme_1" &&
      stage?.id === "bring_wood" &&
      npc.id === "meme_village"
    ) {
      const inv = player.inventory;
      const needed = 10;
      let count = 0;
      if (inv && Array.isArray(inv.slots)) {
        inv.slots.forEach((slot) => {
          if (!slot || slot.itemId !== "bois_chene") return;
          count += slot.qty || 0;
        });
      }
      objectiveReady = count >= needed;
    }

    if (isOffer) {
      const base = dialogDef || {
        text: "Salut, tu veux aider ?",
        choice: "J'accepte",
      };
      dialogData = {
        ...base,
        questOffer: true,
        onChoice: () => {
          acceptQuest(player, quest.id);
          if (npc.questMarker && npc.questMarker.destroy) {
            npc.questMarker.destroy();
            npc.questMarker = null;
          }
        },
      };
    } else if (
      isNpcStage &&
      state.state === QUEST_STATES.IN_PROGRESS &&
      objectiveReady
    ) {
      // Premiere rencontre avec Meme pour papi_meme_1 :
      // on montre d'abord la phrase des machines a coudre,
      // puis le vrai briefing "bois de chene" qui valide l'etape.
      if (
        quest.id === "papi_meme_1" &&
        stage.id === "talk_to_meme" &&
        npc.id === "meme_village"
      ) {
        const secondScreen = {
          text:
            "Si la zone est vraiment degagee, on va pouvoir travailler.\n" +
            "Va me chercher dix buches de bois de chene.\n" +
            "Avec ca, je t'apprendrai les bases de la couture.",
          choice: "Se mettre en route.",
          questTurnIn: true,
          onChoice: () => {
            setTalkObjectiveComplete(state, stage);
            advanceQuestStage(player, quest.id, { scene });
          },
        };

        dialogData = {
          text: "Oh non, les machines a coudre sont prises pour l'annee entiere...",
          choice: "Je viens de la part de Papi.",
          closeOnChoice: false,
          onChoice: () => {
            openNpcDialog(npc, player, secondScreen);
          },
        };
      } else {
        const base = dialogDef || {
          text: "Merci pour le coup de main !",
          choice: "A plus tard.",
        };
        dialogData = {
          ...base,
          questTurnIn: true,
          onChoice: () => {
            setTalkObjectiveComplete(state, stage);
            advanceQuestStage(player, quest.id, { scene });
          },
        };
      }
    } else {
      dialogData = dialogDef || { text: "Bonjour.", choice: "A plus tard." };
    }
  } else {
    dialogData = getNpcDialog(npc.id) || { text: "Bonjour.", choice: "A plus tard." };
  }

  openNpcDialog(npc, player, dialogData);
}

