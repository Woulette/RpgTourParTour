import { QUEST_STATES } from "../../quests/catalog.js";

export const papiDialog = {
  questDialogs: {
    papi_corbeaux_1: {
      hunt_corbeaux: {
        [QUEST_STATES.NOT_STARTED]: {
          sequence: [
            {
              text: "Mais d'où sors-tu, toi ? Je ne t'ai pas vu arriver.",
              choice: "Je... je ne sais même pas. Tout est flou.",
            },
            {
              text:
                "Hum. Ça se confirme...\n" +
                "Depuis la fracture, des gens apparaissent ici comme toi : d'un coup, sans explication.\n" +
                "Certains disent que le temps lui-même s'est déréglé.",
              choice: "J'ai juste un souvenir flou…",
            },
            {
              text:
                "Bienvenue à Andémia. Une fois pris dans cette fracture, on ne repart pas aussi facilement...\n\n" +
                "Mais si tu dois rester, autant apprendre à survivre. Ta formation commence ici, aventurier.\n" +
                "Tu veux bien me donner un coup de main ?",
              choice: "D'accord, je vais t'aider.",
            },
          ],
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
      },
      __default: {
        [QUEST_STATES.COMPLETED]: {
          text: "Merci pour le coup de main !",
          choice: "À plus tard.",
        },
      },
    },

    papi_meme_1: {
      talk_to_meme: {
        [QUEST_STATES.NOT_STARTED]: {
          text:
            "Bien joué, les corbeaux se calment enfin.\n" +
            "Ma femme sera ravie d'apprendre que le chemin est plus sûr.\n" +
            "Va lui parler, elle t'attend.",
          choice: "Se mettre en route.",
        },
        [QUEST_STATES.IN_PROGRESS]: {
          text:
            "Maintenant que la zone est plus tranquille, va voir ma femme.\n" +
            "Elle aura sûrement besoin d'un aventurier motivé comme toi.",
          choice: "Se mettre en route.",
        },
        [QUEST_STATES.COMPLETED]: {
          text: "Merci d'être allé la voir.",
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
