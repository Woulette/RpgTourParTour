export const maire_cazard_1 = {
  id: "maire_cazard_1",
  title: "Ordres du maire : Cazard",
  giverNpcId: "maire_albinos",
  requires: ["maire_corbeaux_1"],
  description:
    "Le maire veut continuer le nettoyage. Elimine des cazards.",
  stages: [
    {
      id: "kill_cazards",
      npcId: "maire_albinos",
      description: "Eliminer 4 cazards.",
      objective: {
        type: "kill_monster",
        monsterId: "cazard",
        requiredCount: 4,
        label: "Cazards elimines",
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
