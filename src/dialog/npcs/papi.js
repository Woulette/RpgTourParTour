import { QUEST_STATES } from "../../quests/catalog.js";

export const papiDialog = {
  questDialogs: {
    andemia_intro_1: {
      find_meme: {
        [QUEST_STATES.NOT_STARTED]: {
          sequence: [
            {
              text: "…Ah. Encore un qui tombe du ciel.",
              choice: "Où… où je suis ?",
            },
            {
              text: "Andémia.\n\nOu ce qu’il en reste, depuis la fracture.",
              choice: "Une fracture ?",
            },
            {
              text:
                "Rien n’est normal ici.\n" +
                "Le sol, les bêtes, la magie… tout est tordu.\n\n" +
                "Des gens apparaissent comme toi. Arrachés à leur réalité.",
              choice: "Je ne me souviens de rien…",
            },
            {
              text:
                "Si tu restes seul, tu finiras mangé. Ou perdu.\n\n" +
                "Alors écoute bien.",
              choice: "D’accord… j’ai besoin d’aide.",
            },
            {
              text:
                "Va voir Mémé. Ma femme.\n" +
                "Elle comprend mieux la fracture que moi… et elle sait parler aux nouveaux.\n\n" +
                "Reviens me voir après. Si tu tiens encore debout.",
              choice: "Où est-elle ?",
            },
          ],
        },
        [QUEST_STATES.IN_PROGRESS]: {
          text:
            "Ne traîne pas.\n" +
            "Va voir Mémé. Elle t’aidera à comprendre ce qui se passe.",
          choice: "J’y vais.",
        },
      },
      __default: {
        [QUEST_STATES.COMPLETED]: {
          text: "Alors ? Mémé t’a remis les idées en place ?",
          choice: "Je continue.",
        },
      },
    },
  },
  generic: {
    text: "Bonjour.",
    choice: "À plus tard.",
  },
};
