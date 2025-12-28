export const marchandDialog = {
  questDialogs: {
    andemia_intro_1: {
      meet_marchand: {
        in_progress: {
          sequence: [
            {
              text: "Bonjour, aventurier !",
              choice: "Se presenter",
            },
            {
              text:
                "Moi, c'est le Marchand. Ici, rien n'est gratuit.\n" +
                "Tout se paye... mais pour un nouvel arrivant, je pourrais faire exception.",
              choice: "On verra.",
              closeOnChoice: true,
            },
          ],
        },
      },
    },
    alchimiste_marchand_1: {
      deliver_invoice: {
        in_progress: {
          sequence: [
            {
              text: "Une facture de l'Alchimiste ?",
              choice: "Oui.",
            },
            {
              text:
                "La somme demande est colossale pour ces services !\n" +
                "Je ne peux pas payer une telle somme !",
              choice: "Et alors ?",
            },
            {
              text:
                "Aide-moi, et je te promets une grosse recompense.",
              choice: "Je veux bien aider.",
            },
          ],
        },
      },
    },
    alchimiste_marchand_2: {
      bring_ortie_potions: {
        not_started: {
          sequence: [
            {
              text:
                "Il me faut absolument 5 potions d'ortie pour me soigner,\n" +
                "mais je ne sais pas les fabriquer.",
              choice: "Je peux aider ?",
            },
            {
              text: "Peux-tu m'en fabriquer et me les ramener ?",
              choice: "Oui, je m'en charge.",
            },
          ],
        },
        in_progress: {
          text: "Il me faut 5 potions d'ortie.",
          choice: "J'y travaille.",
        },
        ready_to_turn_in: {
          sequence: [
            {
              text: "Parfait, tu me sauves la mise.",
              choice: "Et la recompense ?",
            },
            {
              text:
                "Je ne t'ai jamais promis de recompense.",
              choice: "Super...",
            },
          ],
        },
      },
    },
    alchimiste_marchand_3: {
      talk_marchand: {
        in_progress: {
          sequence: [
            {
              text: "Le maire est la. Tu confirmes les faits ?",
              choice: "Oui.",
            },
            {
              text: "Je m'excuse. J'ai depasse les bornes.",
              choice: "Bien.",
            },
          ],
        },
      },
      return_to_marchand: {
        in_progress: {
          text:
            "Je suis desole. Je veux me rattraper.\n" +
            "Reviens me voir, j'ai une mission pour me faire pardonner.",
          choice: "D'accord.",
        },
      },
    },
    alchimiste_marchand_4: {
      bring_resources: {
        not_started: {
          sequence: [
            {
              text:
                "Je peux t'aider a evoluer un sort de ton choix,\n" +
                "mais il me faut certaines ressources.",
              choice: "Lesquelles ?",
            },
            {
              text:
                "Ramene-moi 3 peaux de goush, 5 bois de chene\n" +
                "et 1 fourrure de liburion.",
              choice: "Je m'en occupe.",
            },
          ],
        },
        in_progress: {
          text:
            "Il me faut 3 peaux de goush, 5 bois de chene\n" +
            "et 1 fourrure de liburion.",
          choice: "J'y travaille.",
        },
        ready_to_turn_in: {
          sequence: [
            {
              text: "Parfait. Je commence le protocole de fabrication.",
              choice: "D'accord.",
            },
            {
              text: "Il me manque un dernier ingredient.",
              choice: "Je trouve ca louche.",
            },
            {
              text:
                "Il me faut 5 papiers.\n" +
                "Ce n'est pas complique a fabriquer,\n" +
                "mais ca demande un peu de travail.\n" +
                "Va voir Papi, il t'expliquera.",
              choice: "J'y vais.",
            },
          ],
        },
      },
      bring_paper: {
        in_progress: {
          text: "Il me faut 5 papiers.",
          choice: "Je m'en occupe.",
        },
        ready_to_turn_in: {
          sequence: [
            {
              text: "Parfait. J'ai termine le protocole.",
              choice: "Et la recompense ?",
            },
            {
              text: "Tiens, un talisman inferieur de tier 1.",
              choice: "Merci.",
            },
            {
              text:
                "Il me reste une derniere chose.\n" +
                "Retourne a l'atelier d'alchimie et fusionne\n" +
                "cette pierre avec le papier pour creer un\n" +
                "parchemin inferieur de tier 1",            
              choice: "D'accord.",
              closeOnChoice: true,
            },
          ],
        },
      },
    },
    alchimiste_marchand_5: {
      craft_parchemin: {
        not_started: {
          text:
            "Fabrique un parchemin inferieur de tier 1\n" +
            "et ramene-le moi.",
          choice: "J'y vais.",
        },
        in_progress: {
          text: "Fabrique un parchemin inferieur de tier 1.",
          choice: "Je m'en occupe.",
        },
        ready_to_turn_in: {
          text: "Parfait ! Montre moi le parchemin.",
          choice: "D'accord.",
          closeOnChoice: false,
        },
      },
      return_to_marchand: {
        in_progress: {
          text:
            "Le plus dur est derriere nous.\n" +
            "Il reste a appliquer le parchemin sur un de tes sorts.\n" +
            "Fais-le, puis reviens me voir.",
          choice: "D'accord.",
        },
      },
      apply_parchemin: {
        in_progress: {
          text: "Tu as applique le parchemin sur un sort ?",
          choice: "Oui, c'est fait.",
        },
      },
    },
  },
  generic: {
    text: "Avec moi, tout se paye.",
    choice: "A plus tard.",
  },
};
