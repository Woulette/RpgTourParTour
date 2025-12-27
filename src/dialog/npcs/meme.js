export const memeDialog = {
  questDialogs: {
    andemia_intro_1: {
      meet_meme: {
        in_progress: {
          sequence: [
            {
              text: "Bonjour.",
              choice: "Se presenter",
            },
            {
              text:
                "Moi, c'est Meme. La reine de la couture.\n" +
                "Si tu veux crafter un equipement, viens me voir.",
              choice: "Merci.",
              closeOnChoice: true,
            },
          ],
        },
      },
      return_to_meme: {
        in_progress: {
          text:
            "Papi t'envoie ? Bien.\n" +
            "Si tu veux survivre ici, il faut apprendre a te proteger.",
          choice: "Je suis pret.",
        },
      },
    },
    andemia_intro_2: {
      bring_corbeau_parts: {
        not_started: {
          sequence: [
            {
              text:
                "Avant d'aller plus loin, je veux voir si tu sais te debrouiller.\n" +
                "Dehors, les corbeaux rodent.",
              choice: "D'accord.",
            },
            {
              text: "Ramene-moi 2 becs et 3 plumes de corbeau.",
              choice: "J'y vais.",
            },
          ],
        },
        in_progress: {
          text: "Il me faut 2 becs et 3 plumes de corbeau.",
          choice: "Je m'en occupe.",
        },
        ready_to_turn_in: {
          text:
            "Trés bien.\n" +
            "il me manque des essences Pour la panoplie. \n" +
            "Va voir l’Alchimiste, il pourra t’en procurer.",
          choice: "J'y vais.",
        },
      },
    },
    andemia_intro_4: {
      meet_meme: {
        in_progress: {
          sequence: [
            {
              text: "De retour ?",
              choice: "Oui.",
            },
            {
              text:
                "Tu vois les machines juste derriere ?\n" +
                "C'est ici que tu pourras crafter tes equipements.\n" +
                "Craft une panoplie du corbeau complete et reviens me voir.",
              choice: "Compris.",
            },
          ],
        },
      },
      craft_corbeau_set: {
        in_progress: {
          text: "Craft une panoplie du corbeau complete.",
          choice: "Je m'en occupe.",
        },
        ready_to_turn_in: {
          sequence: [
            {
              text: "Bien. Tu as termine la panoplie.",
              choice: "Oui.",
            },
            {
              text:
                "Tu t'es debrouille comme un chef.\n" +
                "Je n'ai plus rien a t'apprendre. La suite depend de toi.",
              choice: "Merci, Meme.",
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
