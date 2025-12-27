export const maire_goush_cedre_1 = {
  id: "maire_goush_cedre_1",
  title: "Traque des goush",
  giverNpcId: "maire_albinos",
  requires: ["maire_gobelins_cazards_1"],
  description:
    "Le maire veut que tu elimines des goush et des cedres.",
  stages: [
    {
      id: "kill_monsters",
      npcId: "maire_albinos",
      description: "Eliminer 3 goush et 2 cedres.",
      objective: {
        type: "kill_monsters",
        monsters: [
          { monsterId: "goush", requiredCount: 3 },
          { monsterId: "cedre", requiredCount: 2 },
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
    xpPlayer: 260,
    gold: 70,
  },
};
