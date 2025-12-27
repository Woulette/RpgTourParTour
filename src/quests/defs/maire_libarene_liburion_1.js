export const maire_libarene_liburion_1 = {
  id: "maire_libarene_liburion_1",
  title: "Predateurs prudents",
  giverNpcId: "maire_albinos",
  requires: ["maire_goush_cedre_1"],
  description:
    "Le maire veut que tu elimines des libarene et des liburion.",
  stages: [
    {
      id: "kill_monsters",
      npcId: "maire_albinos",
      description: "Eliminer 3 libarene et 3 liburion.",
      objective: {
        type: "kill_monsters",
        monsters: [
          { monsterId: "libarene", requiredCount: 3 },
          { monsterId: "liburion", requiredCount: 3 },
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
    xpPlayer: 320,
    gold: 85,
  },
};
