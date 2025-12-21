import { QUEST_STATES } from "../../quests/catalog.js";
import { DIALOG_STATES } from "./dialogStates.js";

export const alchimisteProvisoireDialog = {
  questDialogs: {
    andemia_intro_2: {
      talk_to_alchimiste: {
        [QUEST_STATES.IN_PROGRESS]: {
          sequence: [
            {
              text: "Ah, tu viens de la part de Mémé.",
              choice: "Oui.",
            },
            {
              text:
                "Parfait.\n" +
                "Je vois que tu sais déjà te débrouiller.\n\n" +
                "Je vais te confier la suite.",
              choice: "Je t’écoute.",
            },
          ],
        },
      },
      __default: {
        [QUEST_STATES.COMPLETED]: {
          text: "Bien. On va pouvoir passer aux essences.",
          choice: "D'accord.",
        },
      },
    },
    andemia_intro_3: {
      bring_essence_corbeau: {
        [QUEST_STATES.NOT_STARTED]: {
          sequence: [
            {
              text: "Très bien. Passons aux essences.",
              choice: "D’accord.",
            },
            {
              text:
                "Entendu.\n" +
                "Tu as besoin de te perfectionner, et elle veut s’assurer que tu tiens le coup.",
              choice: "C’est ça.",
            },
            {
              text:
                "Alors écoute bien.\n" +
                "Chasse des corbeaux dehors. Sur leurs carcasses, tu trouveras parfois une essence.\n\n" +
                "Ramène-moi 2 essences de corbeau.",
              choice: "Je m’en charge.",
            },
          ],
        },
        [QUEST_STATES.IN_PROGRESS]: {
          text: "Il me faut 2 essences de corbeau.\nReviens quand tu les as.",
          choice: "J’y retourne.",
        },
        [DIALOG_STATES.READY_TO_TURN_IN]: {
          sequence: [
            {
              text: "Parfait. C’est exactement ce que je voulais voir.",
              choice: "Voilà.",
            },
            {
              text:
                "Bien. Tu as récolté ce qu’il fallait.\n" +
                "Garde les essences, tu en auras besoin pour la suite.\n\n" +
                "Retourne voir Mémé : elle t’expliquera quoi faire ensuite.",
              choice: "J’y vais.",
            },
          ],
        },
      },
      __default: {
        [QUEST_STATES.COMPLETED]: {
          text:
            "Bien. Reviens me voir quand tu seras prêt, on ira plus loin dans l’alchimie.",
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
