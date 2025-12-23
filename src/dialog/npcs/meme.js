import { QUEST_STATES } from "../../quests/catalog.js";
import { DIALOG_STATES } from "./dialogStates.js";

export const memeDialog = {
  questDialogs: {
    andemia_intro_1: {
      find_meme: {
        [QUEST_STATES.IN_PROGRESS]: {
          sequence: [
            {
              text: "Tu es pale. Encore un nouveau, hein ?",
              choice: "Papi m'a envoye",
            },
            {
              text:
                "Respire. Ici, le monde n'obéit plus aux memes regles.\n" +
                "On appelle ca la fracture.",
              choice: "La fracture ?",
              closeOnChoice: false,
            },
          ],
        },
      },
      __default: {
        [QUEST_STATES.COMPLETED]: {
          text:
            "Bien. Tu tiens debout.\n" +
            "Reviens me voir si tu sens que la fracture te tire a l'interieur.",
          choice: "Je continue.",
        },
      },
    },

    andemia_intro_2: {
      bring_corbeau_parts: {
        [QUEST_STATES.NOT_STARTED]: {
          sequence: [
            {
              text:
                "Avant de te raconter des histoires, je veux voir si tu sais te defendre.\n" +
                "Dehors, des corbeaux rodent. Ils sont plus agressifs depuis la fracture.",
              choice: "Je peux gerer.",
            },
            {
              text: "Ramene-moi 2 becs et 3 plumes de corbeau.",
              choice: "J'y vais.",
            },
          ],
        },
        [QUEST_STATES.IN_PROGRESS]: {
          text: "Il me faut 2 becs et 3 plumes de corbeau.\nReviens quand tu les as.",
          choice: "Je m'en occupe.",
        },
        [DIALOG_STATES.READY_TO_TURN_IN]: {
          sequence: [
            {
              text:
                "Bien. Ton regard est plus clair.\n" +
                "Ici, tout le monde apprend vite ou disparait.\n" +
                "Avec ca, on va pouvoir commencer a faire quelque chose.",
              choice: "D'accord.",
            },
            {
              text:
                "Mais avant, va voir l'alchimiste du village.\n" +
                "Il se trouve a l'ouest.",
              choice: "C'est fait.",
            },
          ],
        },
      },
      __default: {
        [QUEST_STATES.COMPLETED]: {
          text: "Tu progresses. On parlera du reste quand tu seras pret.",
          choice: "A plus tard.",
        },
      },
    },

    andemia_intro_3: {
      talk_to_meme: {
        [QUEST_STATES.IN_PROGRESS]: {
          sequence: [
            {
              text:
                "Tu reviens de chez l'alchimiste ?\n" +
                "Bien. On va pouvoir passer a l'etape suivante.",
              choice: "Oui.",
            },
            {
              text:
                "Avec ce que tu as recupere sur les corbeaux, je peux te montrer l'essentiel.",
              choice: "Je t'ecoute.",
            },
          ],
        },
      },
      __default: {
        [QUEST_STATES.COMPLETED]: {
          text: "Tu progresses. Reviens me voir quand tu seras pret.",
          choice: "A plus tard.",
        },
      },
    },

    andemia_intro_4: {
      craft_panoplie_corbeau: {
        [QUEST_STATES.IN_PROGRESS]: {
          sequence: [
            {
              text:
                "Fabrique une panoplie du Corbeau :\n" +
                "coiffe, cape, amulette, ceinture, bottes et anneau.\n" +
                "Peu importe l'element, du moment que c'est une panoplie du Corbeau.",
              choice: "Je m'en occupe.",
            },
          ],
        },
        [DIALOG_STATES.READY_TO_TURN_IN]: {
          sequence: [
            {
              text:
                "Parfait. Tu as compris l'idee : transformer le butin en equipement.",
              choice: "Voila.",
            },
            {
              text:
                "On peut maintenant avancer, et tu vas vite voir que la fracture ne pardonne pas.\n" +
                "Reviens me voir quand tu seras pret(e) pour la suite.",
              choice: "D'accord.",
            },
          ],
        },
      },
      __default: {
        [QUEST_STATES.COMPLETED]: {
          text: "Tu progresses. On parlera du reste quand tu seras pret.",
          choice: "A plus tard.",
        },
      },
    },
  },
  generic: {
    text: "Bonjour, mon petit.",
    choice: "A plus tard.",
  },
};
