import { QUEST_STATES } from "../../quests/catalog.js";

export const dungeonKeeperDialog = {
  questDialogs: {
    meme_donjon_aluineeks_1: {
      talk_to_keeper: {
        [QUEST_STATES.IN_PROGRESS]: {
          text:
            "Tu veux entrer ? Pas comme ça.\n" +
            "Tu manques encore d'expérience.\n\n" +
            "Va voir le Maître au nord (sur la nouvelle zone).\n" +
            "Prouve ta valeur, et peut-être que ces lieux s'ouvriront à toi.",
          choice: "Se mettre en route",
        },
      },
      __default: {
        [QUEST_STATES.COMPLETED]: {
          text:
            "Reviens quand tu seras prêt.\n" +
            "Le donjon n'attend personne.",
          choice: "À plus tard.",
        },
      },
    },
  },
  generic: {
    text: "Le donjon est dangereux. Prépare-toi avant d'entrer.",
    choice: "À plus tard.",
  },
};
