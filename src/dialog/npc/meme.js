// Dialogues pour le PNJ Mémé, liés aux quêtes où elle intervient.
import { QUEST_STATES } from "../../quests/catalog.js";

export const memeDialog = {
  questDialogs: {
    papi_meme_1: {
      talk_to_meme: {
        [QUEST_STATES.IN_PROGRESS]: {
          text: "Oh non, les machines à coudre sont prises pour l'année entière...",
          choice: "Je viens de la part de Papi.",
        },
      },
      bring_wood: {
        [QUEST_STATES.IN_PROGRESS]: {
          text:
            "Si la zone est vraiment dégagée, on va pouvoir travailler.\n" +
            "Va me chercher dix bûches de bois de chêne.\n" +
            "Avec ça, je t'apprendrai les bases de la couture.",
          choice: "Se mettre en route.",
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
  },
  generic: {
    text: "Bonjour, mon petit.",
    choice: "À plus tard.",
  },
};

