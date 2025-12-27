export const maire_corbeaux_1 = {
  id: "maire_corbeaux_1",
  title: "Menace des corbeaux",
  giverNpcId: "maire_albinos",
  description: "Le maire veut que tu elimines 4 corbeaux pres du village.",
  stages: [
    {
      id: "kill_corbeaux",
      npcId: "maire_albinos",
      description: "Eliminer 4 corbeaux.",
      objective: {
        type: "kill_monster",
        monsterFamily: "corbeau",
        requiredCount: 4,
        label: "Corbeaux elimines",
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
    xpPlayer: 180,
    gold: 40,
  },
};
