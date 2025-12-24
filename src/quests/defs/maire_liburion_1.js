export const maire_liburion_1 = {
  id: "maire_liburion_1",
  title: "Ordres du maire : Liburions",
  giverNpcId: "maire_albinos",
  requires: ["maire_goush_1"],
  description:
    "Le maire veut aller plus loin. Elimine des liburions et des libarenes.",
  stages: [
    {
      id: "kill_liburion_libarene",
      npcId: "maire_albinos",
      description: "Eliminer 3 liburions et 3 libarenes.",
      objective: {
        type: "kill_monsters",
        monsters: [
          {
            monsterId: "liburion",
            requiredCount: 3,
            label: "Liburions elimines",
          },
          {
            monsterId: "libarene",
            requiredCount: 3,
            label: "Libarenes eliminees",
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
    xpPlayer: 160,
    gold: 70,
  },
};
