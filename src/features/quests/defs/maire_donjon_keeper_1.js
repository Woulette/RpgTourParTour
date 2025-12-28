export const maire_donjon_keeper_1 = {
  id: "maire_donjon_keeper_1",
  title: "Le gardiens insolent",
  giverNpcId: "maire_albinos",
  requires: ["maire_libarene_liburion_1"],
  description:
    "Le maire t'envoie voir le gardien du donjon.",
  stages: [
    {
      id: "talk_to_keeper",
      npcId: "donjonaluineekspnj",
      description: "Aller parler au gardien du donjon.",
      objective: {
        type: "talk_to_npc",
        npcId: "donjonaluineekspnj",
        requiredCount: 1,
        label: "Parler au gardien",
      },
    },
  ],
  rewards: {
    xpPlayer: 180,
    gold: 40,
  },
};
