import { QUEST_STATES } from "../../quests/catalog.js";
import { DIALOG_STATES } from "./dialogStates.js";

export const maireDialog = {
  questDialogs: {
    maire_corbeaux_1: {
      kill_corbeaux: {
        [QUEST_STATES.NOT_STARTED]: {
          sequence: [
            {
              text:
                "La ville doit rester sure. Va eliminer 4 corbeaux autour des chemins.",
              choice: "J'y vais.",
            },
          ],
        },
        [QUEST_STATES.IN_PROGRESS]: {
          text: "Il me faut 4 corbeaux elimines.",
          choice: "J'y retourne.",
        },
      },
      return_to_maire: {
        [DIALOG_STATES.READY_TO_TURN_IN]: {
          sequence: [
            {
              text: "Bien. La zone est plus sure.",
              choice: "Mission accomplie.",
            },
            {
              text:
                "On continue. Cette fois, va t'occuper des cazards.",
              choice: "Compris.",
            },
          ],
        },
      },
      __default: {
        [QUEST_STATES.COMPLETED]: {
          text: "La ville compte sur toi pour la suite.",
          choice: "A plus tard.",
        },
      },
    },
    maire_cazard_1: {
      kill_cazard_gumgobs: {
        [QUEST_STATES.NOT_STARTED]: {
          sequence: [
            {
              text:
                "Les cazards sont devenus dangereux. Elimine-en 3, et 2 gumgobs.",
              choice: "J'y vais.",
            },
          ],
        },
        [QUEST_STATES.IN_PROGRESS]: {
          text: "Il me faut 3 cazards et 2 gumgobs elimines.",
          choice: "J'y retourne.",
        },
      },
      return_to_maire: {
        [DIALOG_STATES.READY_TO_TURN_IN]: {
          sequence: [
            {
              text: "Parfait. La ville respire mieux.",
              choice: "De rien.",
            },
            {
              text: "On continue. Il faut maintenant eliminer des goushs et des cedres.",
              choice: "Compris.",
            },
          ],
        },
      },
      __default: {
        [QUEST_STATES.COMPLETED]: {
          text: "Bien travaille. Je te donnerai d'autres missions.",
          choice: "A plus tard.",
        },
      },
    },
    maire_goush_1: {
      kill_goush_cedres: {
        [QUEST_STATES.NOT_STARTED]: {
          sequence: [
            {
              text:
                "Les goushs et les cedres menacent les abords. Elimine-en 3 et 2.",
              choice: "J'y vais.",
            },
          ],
        },
        [QUEST_STATES.IN_PROGRESS]: {
          text: "Il me faut 3 goushs et 2 cedres elimines.",
          choice: "J'y retourne.",
        },
      },
      return_to_maire: {
        [DIALOG_STATES.READY_TO_TURN_IN]: {
          sequence: [
            {
              text: "Bien joue. La zone est plus sure.",
              choice: "Avec plaisir.",
            },
            {
              text: "La prochaine cible : les liburions et les libarenes.",
              choice: "Compris.",
            },
          ],
        },
      },
      __default: {
        [QUEST_STATES.COMPLETED]: {
          text: "Merci pour ton aide.",
          choice: "A plus tard.",
        },
      },
    },
    maire_liburion_1: {
      kill_liburion_libarene: {
        [QUEST_STATES.NOT_STARTED]: {
          sequence: [
            {
              text:
                "Les liburions et les libarenes se rapprochent. Elimine-en 3 de chaque.",
              choice: "J'y vais.",
            },
          ],
        },
        [QUEST_STATES.IN_PROGRESS]: {
          text: "Il me faut 3 liburions et 3 libarenes elimines.",
          choice: "J'y retourne.",
        },
      },
      return_to_maire: {
        [DIALOG_STATES.READY_TO_TURN_IN]: {
          sequence: [
            {
              text: "Parfait. Tu fais du bon travail.",
              choice: "Merci.",
            },
          ],
        },
      },
      __default: {
        [QUEST_STATES.COMPLETED]: {
          text: "Je compte sur toi pour la suite.",
          choice: "A plus tard.",
        },
      },
    },
  },
  generic: {
    text: "Bonjour, citoyen.",
    choice: "A plus tard.",
  },
};
