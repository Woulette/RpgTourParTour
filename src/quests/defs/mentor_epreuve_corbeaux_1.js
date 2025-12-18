export const mentor_epreuve_corbeaux_1 = {
  id: "mentor_epreuve_corbeaux_1",
  title: "Épreuve : Corbeaux",
  giverNpcId: "mentor_map5",
  requires: ["meme_donjon_aluineeks_1"],
  description:
    "Le Maître veut que tu prouves ta valeur. Tue 4 corbeaux, puis reviens le voir.",
  stages: [
    {
      id: "kill_corbeaux",
      npcId: "mentor_map5",
      description: "Tuer 4 corbeaux.",
      objective: {
        type: "kill_monster",
        monsterId: "corbeau",
        requiredCount: 4,
        label: "Corbeaux éliminés",
      },
    },
    {
      id: "return_to_mentor",
      npcId: "mentor_map5",
      description: "Retourner voir le Maître.",
      objective: {
        type: "talk_to_npc",
        npcId: "mentor_map5",
        requiredCount: 1,
        label: "Parler au Maître",
      },
    },
  ],
  rewards: {
    xpPlayer: 120,
    gold: 40,
  },
};

