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
  },
  generic: {
    text: "Bonjour, citoyen.",
    choice: "A plus tard.",
  },
};
