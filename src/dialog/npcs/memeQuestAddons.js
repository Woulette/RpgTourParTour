import { QUEST_STATES } from "../../quests/catalog.js";

export const memeQuestAddons = {
  meme_donjon_aluineeks_1: {
    talk_to_keeper: {
      [QUEST_STATES.NOT_STARTED]: {
        sequence: [
          {
            text:
              "Tu as fabriqué tes premiers équipements.\n" +
              "Si tu veux progresser, il va falloir te frotter à plus fort.",
            choice: "Je suis prêt.",
          },
          {
            text:
              "Va voir le gardien devant le donjon.\n" +
              "Écoute ce qu'il a à te dire.",
            choice: "J'y vais.",
          },
        ],
      },
      [QUEST_STATES.IN_PROGRESS]: {
        text:
          "Le gardien t'attend devant l'entrée du donjon.\n" +
          "Va lui parler.",
        choice: "D'accord.",
      },
    },
    __default: {
      [QUEST_STATES.COMPLETED]: {
        text:
          "Bien. Tu as fait le premier pas.\n" +
          "Reviens me voir quand tu voudras aller plus loin.",
        choice: "À plus tard.",
      },
    },
  },
};

