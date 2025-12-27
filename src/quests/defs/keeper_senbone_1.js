export const keeper_senbone_1 = {
  id: "keeper_senbone_1",
  title: "Le coeur du donjon",
  giverNpcId: "donjonaluineekspnj",
  requires: ["maire_donjon_keeper_1"],
  description: "Le gardien veut que tu elimines le boss Senbone.",
  stages: [
    {
      id: "kill_senbone",
      npcId: "donjonaluineekspnj",
      description: "Eliminer Senbone dans le donjon.",
      objective: {
        type: "kill_monster",
        monsterId: "senbone",
        requiredCount: 1,
        label: "Senbone elimine",
      },
    },
    {
      id: "return_to_keeper",
      npcId: "donjonaluineekspnj",
      description: "Retourner voir le gardien du donjon.",
      objective: {
        type: "talk_to_npc",
        npcId: "donjonaluineekspnj",
        requiredCount: 1,
        label: "Parler au gardien",
      },
    },
  ],
  rewards: {
    xpPlayer: 420,
    gold: 120,
  },
};
