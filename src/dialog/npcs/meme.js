import { QUEST_STATES } from "../../quests/catalog.js";
import { DIALOG_STATES } from "./dialogStates.js";

export const memeDialog = {
  questDialogs: {
    andemia_intro_1: {
      find_meme: {
        [QUEST_STATES.IN_PROGRESS]: {
          sequence: [
            {
              text: "…Tu es pâle. Encore un nouveau, hein ?",
              choice: "Papi m’a envoyé…",
            },
            {
              text:
                "Respire.\n" +
                "Ici, le monde n’obéit plus aux mêmes règles.\n" +
                "On appelle ça la fracture.",
              choice: "La fracture…",
              closeOnChoice: false,
            },
          ],
        },
      },
      __default: {
        [QUEST_STATES.COMPLETED]: {
          text:
            "Bien. Tu tiens debout.\n" +
            "Reviens me voir si tu sens que la fracture te “tire” à l’intérieur.",
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
                "Avant de te raconter des histoires, je veux voir si tu sais te défendre.\n" +
                "Dehors, des corbeaux rôdent. Ils sont plus agressifs depuis la fracture.",
              choice: "Je peux gérer.",
            },
            {
              text: "Ramène-moi 2 becs et 3 plumes de corbeau.",
              choice: "J’y vais.",
            },
          ],
        },
        [QUEST_STATES.IN_PROGRESS]: {
          text: "Il me faut 2 becs et 3 plumes de corbeau.\nReviens quand tu les as.",
          choice: "Je m’en occupe.",
        },
        [DIALOG_STATES.READY_TO_TURN_IN]: {
          sequence: [
            {
              text:
                "Bien. Ton regard est plus clair.\n" +
                "Ici, tout le monde apprend vite… ou disparaît.\n" +
                "Très bien. Avec ça, on va pouvoir commencer à faire quelque chose.",
              choice: "D’accord…",
            },
            {
              text:
                "Mais avant… va voir l’alchimiste du village.\n" +
                "Il se trouve à l’ouest.",
              choice: "C’est fait.",
            },
          ],
        },
      },
      __default: {
        [QUEST_STATES.COMPLETED]: {
          text: "Tu progresses. On parlera du reste quand tu seras prêt.",
          choice: "À plus tard.",
        },
      },
    },

    andemia_intro_3: {
      talk_to_meme: {
        [QUEST_STATES.IN_PROGRESS]: {
          sequence: [
            {
              text:
                "Tu reviens de chez l’alchimiste ?\n" +
                "Bien. On va pouvoir passer à l’étape suivante.",
              choice: "Oui.",
            },
            {
              text:
                "Avec ce que tu as récupéré sur les corbeaux, je peux enfin te montrer l’essentiel.",
              choice: "Je t’écoute.",
            },
          ],
        },
      },
      craft_panoplie_corbeau: {
        [QUEST_STATES.IN_PROGRESS]: {
          sequence: [
            {
              text:
                "Fabrique une panoplie du Corbeau :\n" +
                "coiffe, cape, amulette, ceinture, bottes et anneau.\n" +
                "Peu importe l’élément, du moment que c’est une panoplie du Corbeau.",
              choice: "Je m’en occupe.",
            },
          ],
        },
        [DIALOG_STATES.READY_TO_TURN_IN]: {
          sequence: [
            {
              text: "Parfait. Tu as compris l’idée : transformer le butin en équipement.",
              choice: "Voilà.",
            },
            {
              text:
                "On peut maintenant avancer… et tu vas vite voir que la fracture ne pardonne pas.\n" +
                "Reviens me voir quand tu seras prêt(e) pour la suite.",
              choice: "D’accord.",
            },
          ],
        },
      },
      __default: {
        [QUEST_STATES.COMPLETED]: {
          text: "Tu progresses. On parlera du reste quand tu seras prêt.",
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
