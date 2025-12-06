// Dialogues pour le PNJ Papi, indexés par questId, stageId et état.
import { QUEST_STATES } from "../../quests/catalog.js";

export const papiDialog = {
  questDialogs: {
    papi_corbeaux_1: {
      hunt_corbeaux: {
        [QUEST_STATES.NOT_STARTED]: {
          text: "Ces corbeaux deviennent trop agressifs. Peux-tu en chasser quelques-uns ?",
          choice: "Je m'en occupe !",
        },
        [QUEST_STATES.IN_PROGRESS]: {
          text: "Alors, combien de corbeaux as-tu déjà chassés ?",
          choice: "Je continue la chasse.",
        },
      },
      return_to_papi: {
        [QUEST_STATES.IN_PROGRESS]: {
          text: "Les corbeaux sont partis ?",
          choice: "Oui, la zone est dégagée.",
        },
        [QUEST_STATES.COMPLETED]: {
          text: "Merci pour le coup de main !",
          choice: "À plus tard.",
        },
      },
      __default: {
        [QUEST_STATES.COMPLETED]: {
          text: "Merci pour le coup de main !",
          choice: "À plus tard.",
        },
      },
    },
  },
  generic: {
    text: "Bonjour.",
    choice: "À plus tard.",
  },
};
