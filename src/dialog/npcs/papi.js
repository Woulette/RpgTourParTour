export const papiDialog = {
  questDialogs: {
    andemia_intro_1: {
      meet_meme: {
        not_started: {
          sequence: [
            {
              text:
                "Tu viens d'apparaitre, hein ?\n" +
                "La faille t'a arrache a ton monde et t'a jete ici.",
              choice: "Ou suis-je ?",
            },
            {
              text:
                "Andemia. Un monde isole.\n" +
                "Aucun systeme voisin, aucune voie de retour.",
              choice: "On est seuls ?",
            },
            {
              text:
                "Ici, tout est marque par la fracture.\n" +
                "Avant d'agir, apprends a connaitre les tiens.",
              choice: "D'accord.",
            },
            {
              text:
                "Va voir Meme, l'Alchimiste, le Marchand et le Maire.\n" +
                "Reviens ensuite, je t'expliquerai la suite.",
              choice: "J'y vais.",
            },
          ],
        },
        in_progress: {
          text:
            "Va voir Meme, l'Alchimiste, le Marchand et le Maire.\n" +
            "Reviens ensuite.",
          choice: "J'y vais.",
        },
      },
      return_to_papi: {
        in_progress: {
          sequence: [
            {
              text: "Tu as fini de rencontrer les habitants du village ?",
              choice: "Oui.",
            },
            {
              text:
                "Tres bien. Je ne vais pas te laisser comme ca.\n" +
                "Va voir ma femme : elle t'apprendra la couture\n",              
              choice: "J'y vais.",
            },
          ],
        },
      },
    },
    alchimiste_marchand_4: {
      meet_papi: {
        in_progress: {
          sequence: [
            {
              text:
                "Le papier se fabrique avec des copeaux de bois.\n" +
                "Va couper du chene et utilise l'atelier pres du grand tronc.\n" +
                "Il te faudra aussi de l'eau.",
              choice: "D'accord.",
            },
            {
              text:
                "Avec ces deux ressources, utilise l'atelier d'alchimie\n" +
                "chez l'alchimiste.",
              choice: "Merci Papi.",
            },
          ],
        },
      },
    },
  },
  generic: {
    text: "Bonjour.",
    choice: "A plus tard.",
  },
};
