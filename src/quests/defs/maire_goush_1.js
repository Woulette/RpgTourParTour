export const maire_goush_1 = {
  id: "maire_goush_1",
  title: "Ordres du maire : Goush",
  giverNpcId: "maire_albinos",
  requires: ["maire_cazard_1"],
  description:
    "Le maire te confie une nouvelle mission. Elimine des goushs et des cedres.",
  stages: [
    {
      id: "kill_goush_cedres",
      npcId: "maire_albinos",
      description: "Eliminer 3 goushs et 2 cedres.",
      objective: {
        type: "kill_monsters",
        monsters: [
          {
            monsterId: "goush",
            requiredCount: 3,
            label: "Goushs elimines",
          },
          {
            monsterId: "cedre",
            requiredCount: 2,
            label: "Cedres elimines",
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
    xpPlayer: 120,
    gold: 50,
  },
};
