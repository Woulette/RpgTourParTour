import { QUEST_STATES } from "../../quests/catalog.js";
import { DIALOG_STATES } from "./dialogStates.js";

export const memeDialog = {
  questDialogs: {
    papi_meme_1: {
      talk_to_meme: {
        [QUEST_STATES.IN_PROGRESS]: {
          sequence: [
            {
              text: "Oh non... les machines à coudre sont prises pour l'année entière...",
              choice: "Je viens de la part de Papi.",
            },
            {
              text:
                "Si la zone est vraiment dégagée, on va pouvoir travailler.\n" +
                "Va me chercher dix bûches de bois de chêne.\n" +
                "Avec ça, je t'apprendrai les bases de la couture.",
              choice: "Se mettre en route.",
            },
          ],
        },
      },
      bring_wood: {
        [QUEST_STATES.IN_PROGRESS]: {
          text:
            "Tu as trouvé mes dix bûches de bois de chêne ?\n" +
            "Reviens me voir quand tu les auras.",
          choice: "D'accord.",
        },
        [DIALOG_STATES.READY_TO_TURN_IN]: {
          text:
            "Parfait ! Avec ça, on va pouvoir fabriquer de belles choses.\n" +
            "Merci pour le bois.",
          choice: "Voici le bois.",
        },
      },
      __default: {
        [QUEST_STATES.COMPLETED]: {
          text:
            "Merci pour le bois. Avec ça, on va pouvoir fabriquer de belles choses.\n" +
            "Reviens me voir quand tu seras prêt à passer à l'étape suivante.",
          choice: "À plus tard.",
        },
      },
    },

    meme_panoplie_corbeau_1: {
      craft_panoplie_corbeau: {
        [QUEST_STATES.NOT_STARTED]: {
          sequence: [
            {
              text:
                "Tu t'en sors bien, mon petit.\n" +
                "Maintenant, on va passer à l'étape suivante : l'artisanat.",
              choice: "Je t'écoute.",
            },
            {
              text:
                "Fabrique la panoplie du Corbeau pour t'entraîner :\n" +
                "Quand tu auras tout fait, reviens me voir.",
              choice: "J'accepte.",
            },
          ],
        },
        [QUEST_STATES.IN_PROGRESS]: {
          text:
            "Alors, cette panoplie du Corbeau ?\n" +
            "Reviens me voir quand tu auras tout fabriqué.",
          choice: "Je m'en occupe.",
        },
        [DIALOG_STATES.READY_TO_TURN_IN]: {
          text:
            "Parfait ! Tu as tout fabriqué.\n" +
            "Tu vois, avec de la méthode, on arrive à tout.",
          choice: "Voilà, c'est fait.",
        },
      },
      __default: {
        [QUEST_STATES.COMPLETED]: {
          text:
            "Très bien. Tu as fait de grands progrès.\n" +
            "Reviens me voir quand tu voudras apprendre autre chose.",
          choice: "À plus tard.",
        },
      },
    },
  },
  generic: {
    text: "Bonjour, mon petit.",
    choice: "À plus tard.",
  },
};
