export const maire_cazard_1 = {
  id: "maire_cazard_1",
  title: "Ordres du maire : Cazard",
  giverNpcId: "maire_albinos",
  requires: ["maire_corbeaux_1"],
  description:
    "Le maire veut continuer le nettoyage. Elimine des cazards et des gumgobs.",
  stages: [
    {
      id: "kill_cazard_gumgobs",
      npcId: "maire_albinos",
      description: "Eliminer 3 cazards et 2 gumgobs.",
      objective: {
        type: "kill_monsters",
        monsters: [
          {
            monsterId: "cazard",
            requiredCount: 3,
            label: "Cazards elimines",
          },
          {
            monsterId: "gumgob",
            requiredCount: 2,
            label: "Gumgobs elimines",
          },
        ],
        label: "Monstres elimines",
      },
    },
    {
      id: "return_to_maire",
      npcId: "maire_albinos",
      description: "Retourner voir le maire.",
      objective: {
        type: "talk_to_npc",
        npcId: "maire_albinos",
        requiredCount: 1,
        label: "Parler au maire",
      },
    },
  ],
  rewards: {
    xpPlayer: 80,
    gold: 35,
  },
};
