export const meme_donjon_aluineeks_1 = {
  id: "meme_donjon_aluineeks_1",
  title: "Le maître du donjon",
  giverNpcId: "meme_village",
  requires: ["meme_panoplie_corbeau_1"],
  description:
    "Mémé pense que tu es prêt à rencontrer le gardien du Donjon des Aluineeks. Va lui parler, puis suis ses instructions.",
  stages: [
    {
      id: "talk_to_keeper",
      npcId: "donjon_aluineeks_keeper",
      description: "Aller voir le gardien devant l'entrée du donjon.",
      objective: {
        type: "talk_to_npc",
        npcId: "donjon_aluineeks_keeper",
        requiredCount: 1,
        label: "Parler au gardien",
      },
    },
    {
      id: "talk_to_mentor",
      npcId: "mentor_map5",
      description: "Aller voir le Maître au nord (nouvelle zone).",
      objective: {
        type: "talk_to_npc",
        npcId: "mentor_map5",
        requiredCount: 1,
        label: "Parler au Maître",
      },
    },
  ],
  rewards: {
    xpPlayer: 150,
    gold: 80,
  },
};

