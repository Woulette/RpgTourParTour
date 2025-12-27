export const maire_gobelins_cazards_1 = {
  id: "maire_gobelins_cazards_1",
  title: "Chasse aux monstres",
  giverNpcId: "maire_albinos",
  requires: ["maire_corbeaux_1"],
  description:
    "Le maire veut que tu elimines des gobelins et des cazards.",
  stages: [
    {
      id: "kill_monsters",
      npcId: "maire_albinos",
      description: "Eliminer 2 gobelins et 3 cazards.",
      objective: {
        type: "kill_monsters",
        monsters: [
          { monsterId: "gumgob", requiredCount: 2 },
          { monsterId: "cazard", requiredCount: 3 },
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
    xpPlayer: 220,
    gold: 55,
  },
};
