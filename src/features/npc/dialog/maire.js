export const maireDialog = {
  questDialogs: {
    andemia_intro_1: {
      meet_maire: {
        in_progress: {
          sequence: [
            {
              text: "Bonjour.",
              choice: "Se presenter",
            },
            {
              text:
                "Je suis le Maire du village.\n" +
                "Ne te fie pas aux apparences \n" +
                "C'est l'evolution qui a agrandi mes oreilles.",
              choice: "Enchante.",
              closeOnChoice: true,
            },
          ],
        },
      },
    },
    maire_corbeaux_1: {
      kill_corbeaux: {
        not_started: {
          sequence: [
            {
              text:
                "J'ai un mauvais pressentiment.\n" +
                "Depuis plusieurs jours, les monstres sont plus presents\n" +
                "dans les zones, et je crains une apparition du titan.",
              choice: "Je comprends.",
            },
            {
              text:
                "Va stopper ces creatures et chasse les corbeaux.\n" +
                "Elimine 4 corbeaux puis reviens me voir.",
              choice: "J'y vais.",
            },
          ],
        },
        in_progress: {
          text: "Elimine 4 corbeaux et reviens me voir.",
          choice: "J'y vais.",
        },
      },
      return_to_maire: {
        in_progress: {
          text:
            "Merci. Le village te doit une fiere chandelle.\n" +
            "J'ai d'autres taches a te confier.",
          choice: "Je t'ecoute.",
        },
      },
    },
    maire_gobelins_cazards_1: {
      kill_monsters: {
        not_started: {
          sequence: [
            {
              text:
                "Les gobelins et les cazards se multiplient.\n" +
                "Il faut endiguer ca vite.",
              choice: "Je suis pret.",
            },
            {
              text: "Elimine 2 gobelins et 3 cazards.",
              choice: "J'y vais.",
            },
          ],
        },
        in_progress: {
          text: "Elimine 2 gobelins et 3 cazards.",
          choice: "J'y vais.",
        },
      },
      return_to_maire: {
        in_progress: {
          text:
            "Bien. La menace recule pour le moment.\n" +
            "J'ai encore une mission pour toi.",
          choice: "Je t'ecoute.",
        },
      },
    },
    maire_goush_cedre_1: {
      kill_monsters: {
        not_started: {
          sequence: [
            {
              text:
                "Elimine 3 goush et 2 cedres.\n" +
                "Mais ne t'approche pas du donjon,\n" +
                "et n'y entre en aucun cas.",
              choice: "D'accord.",
            },
          ],
        },
        in_progress: {
          text:
            "Elimine 3 goush et 2 cedres.\n" +
            "N'approche pas du donjon.",
          choice: "J'y vais.",
        },
      },
      return_to_maire: {
        in_progress: {
          text:
            "Ouf, tu m'as bien ecoute.\n" +
            "Il reste un type de monstre a eradiquer.\n" +
            "Meffie-toi en comme la peste,\n" +
            "ils sont plus coriaces que les autres.",
          choice: "J'ai compris.",
        },
      },
    },
    maire_libarene_liburion_1: {
      kill_monsters: {
        not_started: {
          sequence: [
            {
              text: "Elimine 3 libarene et 3 liburion.",
              choice: "J'y vais.",
            },
          ],
        },
        in_progress: {
          text: "Elimine 3 libarene et 3 liburion.",
          choice: "J'y vais.",
        },
      },
      return_to_maire: {
        in_progress: {
          text: "Excellent boulot !",
          choice: "Merci.",
          closeOnChoice: false,
        },
      },
    },
    maire_donjon_keeper_1: {
      talk_to_keeper: {
        not_started: {
          text:
            "J'ai recu un appel a l'aide du gardien du donjon.\n" +
            "Je ne sais pas exactement ce qu'il veut. Va le voir.",
          choice: "J'y vais.",
        },
      },
    },
    keeper_north_explosion_1: {
      meet_maire_north: {
        in_progress: {
          sequence: [
            {
              text:
                "Mon mauvais pressentiment vient clairement de se realiser.",
              choice: "Et alors ?",
            },
            {
              text:
                "Si on ne referme pas les portails dans la minute,\n" +
                "on va tous se faire aneantir.",
              choice: "Je comprends.",
            },
            {
              text:
                "Je vais t'aider a refermer les failles.\n" +
                "Il faut en fermer deux.",
              choice: "On y va.",
              closeOnChoice: true,
            },
          ],
        },
      },
      return_to_maire_north: {
        in_progress: {
          sequence: [
            {
              text:
                "Bien joue. Les failles se referment.",
              choice: "Qu'est-ce que c'est ???",
            },
            {
              text:
                "Un titan !\n" +
                "Retroussez vos manches, ca va etre du lourd.",
              choice: "D'accord.",
            },
          ],
        },
      },
    },
    alchimiste_marchand_3: {
      meet_maire: {
        in_progress: {
          text:
            "Le marchand t'a arnaque ?\n" +
            "Tres bien. Retrouve-moi chez le marchand.",
          choice: "D'accord.",
        },
      },
      meet_maire_marchand: {
        in_progress: {
          text:
            "Peux-tu me confirmer les faits devant le marchand ?",
          choice: "Oui.",
        },
      },
      return_to_maire: {
        in_progress: {
          text: "Merci. Je vais regler ca avec lui.",
          choice: "Merci, monsieur le maire.",
        },
      },
    },
  },
  generic: {
    text: "Bonjour, citoyen.",
    choice: "A plus tard.",
  },
};
