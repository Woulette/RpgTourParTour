export const mentor_epreuve_aluineeks_1 = {
  id: "mentor_epreuve_aluineeks_1",
  title: "Épreuve : Aluineeks",
  giverNpcId: "mentor_map5",
  requires: ["mentor_epreuve_goush_liburion_1"],
  description:
    "Le Maître veut te voir affronter plus dangereux. Tue 4 Aluineeks, puis reviens le voir.",
  stages: [
    {
      id: "kill_aluineeks",
      npcId: "mentor_map5",
      description: "Tuer 4 Aluineeks.",
      objective: {
        type: "kill_monster",
        monsterId: "aluineeks",
        requiredCount: 4,
        label: "Aluineeks éliminés",
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
    xpPlayer: 200,
    gold: 80,
  },
};
