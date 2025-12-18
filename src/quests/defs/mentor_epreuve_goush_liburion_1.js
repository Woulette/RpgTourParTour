export const mentor_epreuve_goush_liburion_1 = {
  id: "mentor_epreuve_goush_liburion_1",
  title: "Épreuve : Goush & Liburion",
  giverNpcId: "mentor_map5",
  requires: ["mentor_epreuve_corbeaux_1"],
  description:
    "Le Maître veut te voir gérer des créatures plus vicieuses. Tue 3 Goush puis 2 Liburion, et reviens le voir.",
  stages: [
    {
      id: "kill_goush",
      npcId: "mentor_map5",
      description: "Tuer 3 Goush.",
      objective: {
        type: "kill_monster",
        monsterId: "goush",
        requiredCount: 3,
        label: "Goush éliminés",
      },
    },
    {
      id: "kill_liburion",
      npcId: "mentor_map5",
      description: "Tuer 2 Liburion.",
      objective: {
        type: "kill_monster",
        monsterId: "liburion",
        requiredCount: 2,
        label: "Liburion éliminés",
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
    xpPlayer: 180,
    gold: 70,
  },
};

