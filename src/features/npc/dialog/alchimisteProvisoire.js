export const alchimisteProvisoireDialog = {
  questDialogs: {
    andemia_intro_1: {
      meet_alchimiste: {
        in_progress: {
          sequence: [
            {
              text: "Bienvenue.",
              choice: "Se presenter",
            },
            {
              text:
                "Je suis l'alchimiste, le medecin du village.\n" +
                "Un conseil, fais attention au marchand. Il sait tirer profit de tout.",
              choice: "Compris.",
              closeOnChoice: true,
            },
          ],
        },
      },
    },
    andemia_intro_2: {
      meet_alchimiste: {
        in_progress: {
          sequence: [
            {
              text: "Tu viens chercher des essences ?",
              choice: "Oui.",
            },
          ],
        },
      },
    },
    andemia_intro_3: {
      bring_orties: {
        not_started: {
          sequence: [
            {
              text: "Tu devras etre digne d'un vrai alchimiste !",
              choice: "Je t'ecoute.",
            },
            {
              text:
                "Je peux t'aider a te procurer un extracteur d'essence,\n" +
                "mais pour ca, tu vas devoir me rendre service.",
              choice: "Quel service ?",
            },
            {
              text: "Amene-moi 20 orties.",
              choice: "D'accord.",
            },
          ],
        },
        in_progress: {
          text: "Il me faut 20 orties.",
          choice: "Je m'en occupe.",
        },
        ready_to_turn_in: {
          sequence: [
            {
              text:
                "Parfait. Grace a ca, je vais pouvoir preparer les potions pour le marchand.",
              choice: "Tant mieux.",
            },
            {
              text: "Tiens, voici un extracteur d'essence. Il t'appartient.",
              choice: "Merci.",
            },
            {
              text:
                "Avec cet extracteur, tu pourras extraire l'essence des monstres que tu as vaincus.",
              choice: "D'accord.",
            },
            {
              text:
                "Mais si ton niveau d'alchimiste n'est pas suffisant, tu n'en tireras rien.",
              choice: "Compris.",
            },
          ],
        },
      },
    },
    andemia_intro_4: {
      meet_meme: {
        not_started: {
          sequence: [
            {
              text: "L'extracteur est a toi. Va voir Meme maintenant.",
              choice: "J'y vais.",
            },
          ],
        },
        in_progress: {
          text: "Va voir Meme.",
          choice: "D'accord.",
        },
      },
    },
    alchimiste_marchand_1: {
      deliver_invoice: {
        not_started: {
          sequence: [
            {
              text:
                "Je dois envoyer une facture au Marchand,\n" +
                "mais je n'ai pas le temps, mes potions m'attendent.",
              choice: "Je peux y aller.",
            },
            {
              text: "Parfait. Va le voir a ma place.",
              choice: "J'y vais.",
            },
          ],
        },
        in_progress: {
          text: "Va voir le Marchand et remets-lui la facture.",
          choice: "D'accord.",
        },
      },
    },
    alchimiste_marchand_2: {
      return_to_alchimiste: {
        in_progress: {
          sequence: [
            {
              text: "Tu as bien remis la facture ?",
              choice: "Oui.",
            },
            {
              text:
                "Le marchand t'a arnaque ?\n" +
                "Je t'avais prevenu de te mefier de cette fripouille.\n" +
                "C'est pour ca que j'ai augmente le prix de la facture.",
              choice: "Je vois.",
            },        

          ],
        },
      },
    },
    alchimiste_marchand_3: {
      meet_maire: {
        not_started: {
          text: "Va voir le maire pour te plaindre du marchand.",
          choice: "J'y vais.",
        },
        in_progress: {
          text: "Va voir le maire.",
          choice: "D'accord.",
        },
      },
    },
  },
  generic: {
    text: "Bonjour.",
    choice: "A plus tard.",
  },
};
