import { QUEST_STATES } from "../../quests/catalog.js";

export const mentorMap5Dialog = {
  questDialogs: {
    meme_donjon_aluineeks_1: {
      talk_to_mentor: {
        [QUEST_STATES.IN_PROGRESS]: {
          sequence: [
            {
              text:
                "Alors c'est toi ?\n" +
                "Le gardien t'a renvoyé ici parce que tu manques d'expérience ?",
              choice: "Oui...",
            },
            {
              text:
                "Ha !\n" +
                "Mais tu as bien fait de venir me voir.\n\n" +
                "Si tu veux prouver ta valeur, je vais te donner des épreuves.",
              choice: "Je t'écoute.",
              closeOnChoice: false,
            },
          ],
        },
      },
      __default: {
        [QUEST_STATES.COMPLETED]: {
          text:
            "Bon. On va pouvoir commencer.\n" +
            "Parle-moi quand tu es prêt pour ta première épreuve.",
          choice: "D'accord.",
        },
      },
    },

    mentor_epreuve_corbeaux_1: {
      kill_corbeaux: {
        [QUEST_STATES.NOT_STARTED]: {
          sequence: [
            {
              text:
                "Alors c'est toi le héros dont on parle ?\n" +
                "Tu as l'air... fragile.",
              choice: "Je ne suis pas venu pour qu'on se moque de moi.",
            },
            {
              text:
                "Ha ! Au moins, tu as du répondant.\n" +
                "Tu as bien fait de venir me voir.\n\n" +
                "On va commencer doucement : tue 4 corbeaux, puis reviens.",
              choice: "Très bien.",
            },
          ],
        },
        [QUEST_STATES.IN_PROGRESS]: {
          text: "4 corbeaux. Pas 3. Pas 5. Reviens quand c'est fait.",
          choice: "J'y retourne.",
        },
      },
      return_to_mentor: {
        [QUEST_STATES.IN_PROGRESS]: {
          text:
            "Je vois des traces sur tes vêtements... bien.\n" +
            "Tu as fait ce qu'il fallait.",
          choice: "Voilà.",
        },
      },
      __default: {
        [QUEST_STATES.COMPLETED]: {
          text: "Bien. On passera bientôt à quelque chose de plus sérieux.",
          choice: "À plus tard.",
        },
      },
    },

    mentor_epreuve_goush_liburion_1: {
      kill_goush: {
        [QUEST_STATES.NOT_STARTED]: {
          text:
            "On va voir si tu tiens toujours debout.\n" +
            "D'abord : tue 3 Goush.\n" +
            "Ensuite : je te demanderai 2 Liburion.",
          choice: "C'est parti.",
        },
        [QUEST_STATES.IN_PROGRESS]: {
          text: "3 Goush. Reviens quand c'est fait.",
          choice: "J'y retourne.",
        },
      },
      kill_liburion: {
        [QUEST_STATES.IN_PROGRESS]: {
          text:
            "Bien.\n" +
            "Maintenant, 2 Liburion. Ils ne te laisseront pas respirer.",
          choice: "Je m'en occupe.",
        },
      },
      return_to_mentor: {
        [QUEST_STATES.IN_PROGRESS]: {
          text:
            "Tu as survécu... intéressant.\n" +
            "Continue comme ça.",
          choice: "C'est fait.",
        },
      },
      __default: {
        [QUEST_STATES.COMPLETED]: {
          text: "Bien. On pourra passer à quelque chose d'encore plus dangereux.",
          choice: "À plus tard.",
        },
      },
    },

    mentor_epreuve_aluineeks_1: {
      kill_aluineeks: {
        [QUEST_STATES.NOT_STARTED]: {
          text:
            "Tu veux vraiment entrer au donjon ? Alors on monte d'un cran.\n" +
            "Tue 4 Aluineeks, puis reviens me voir.",
          choice: "Je m'en occupe.",
        },
        [QUEST_STATES.IN_PROGRESS]: {
          text: "Je n'ai pas toute la journée. Reviens quand tu as vaincu 4 Aluineeks.",
          choice: "D'accord.",
        },
      },
      return_to_mentor: {
        [QUEST_STATES.IN_PROGRESS]: {
          text:
            "Pas mal.\n" +
            "Tu commences à ressembler à quelqu'un de fiable.",
          choice: "C'est fait.",
        },
      },
      __default: {
        [QUEST_STATES.COMPLETED]: {
          text: "Continue comme ça. On parlera du donjon quand tu seras prêt.",
          choice: "À plus tard.",
        },
      },
    },
  },
  generic: {
    text: "Tu veux progresser ? Prouve-le.",
    choice: "À plus tard.",
  },
};
