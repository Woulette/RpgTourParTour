export const dungeonKeeperDialog = {
  questDialogs: {
    maire_donjon_keeper_1: {
      talk_to_keeper: {
        in_progress: {
          sequence: [
            {
              text: "Qu'est-ce que tu fais la ?",
              choice: "Le maire m'envoie.",
            },
            {
              text: "Je ne veux pas etre encombre d'un nabo.",
              choice: "Un nabo ?",
            },
          ],
        },
      },
    },
    keeper_senbone_1: {
      kill_senbone: {
        not_started: {
          sequence: [
            {
              text:
                "Je t'ai sous estime. Tu vas m'etre tres utile.",
              choice: "Pourquoi ?",
            },
            {
              text:
                "Le maire a eu le nez fin. Il y a un probleme avec\n" +
                "les failles dimensionnelles, et il faut absolument\n" +
                "fermer ce donjon pour eviter que le titan apparaisse.",
              choice: "Je ferai le necessaire.",
            },
            {
              text: "Va tuer Senbone, le boss du donjon.",
              choice: "J'y vais.",
            },
          ],
        },
        in_progress: {
          text: "Va tuer Senbone, le boss du donjon.",
          choice: "J'y vais.",
        },
        ready_to_turn_in: {
          text: "Tu as vaincu Senbone ?",
          choice: "Oui.",
        },
      },
      return_to_keeper: {
        in_progress: {
          text: "Impressionnant, tu as reussi a refermer le donjon.",
          choice: "Oui.",
        },
      },
    },
    keeper_north_explosion_1: {
      meet_north: {
        not_started: {
          text:
            "Je viens d'entendre une explosion en direction du nord,\n" +
            "ce n'est pas bon signe. Retrouve-moi la-bas.",
          choice: "Compris.",
        },
        in_progress: {
          text: "Ca craint.",
          choice: "Ok.",
          closeOnChoice: true,
        },
      },
    },
  },
  generic: {
    text: "Le donjon est dangereux. Prepare-toi avant d'entrer.",
    choice: "A plus tard.",
  },
};
