export const keeper_north_explosion_1 = {
  id: "keeper_north_explosion_1",
  title: "L'explosion au nord",
  giverNpcId: "donjonaluineekspnj",
  requires: ["keeper_senbone_1"],
  description: "Retrouver le gardien au nord apres l'explosion.",
  stages: [
    {
      id: "meet_north",
      npcId: "donjonaluineekspnj_north",
      description: "Retrouver le gardien au nord.",
      objective: {
        type: "talk_to_npc",
        npcId: "donjonaluineekspnj_north",
        requiredCount: 1,
        label: "Retrouver le gardien",
      },
    },
    {
      id: "meet_maire_north",
      npcId: "maire_albinos_north",
      description: "Parler au maire au nord.",
      objective: {
        type: "talk_to_npc",
        npcId: "maire_albinos_north",
        requiredCount: 1,
        label: "Parler au maire",
      },
    },
    {
      id: "close_rifts",
      description: "Fermer 2 failles temporelles.",
      objective: {
        type: "close_rifts",
        requiredCount: 2,
        label: "Fermer les failles temporelles",
      },
    },
    {
      id: "return_to_maire_north",
      npcId: "maire_albinos_north",
      description: "Retourner voir le maire.",
      objective: {
        type: "talk_to_npc",
        npcId: "maire_albinos_north",
        requiredCount: 1,
        label: "Parler au maire",
      },
    },
    {
      id: "kill_ombre_titan",
      description: "Vaincre l'ombre du titan.",
      objective: {
        type: "kill_monster",
        monsterId: "ombre_titan",
        requiredCount: 1,
        label: "Vaincre l'ombre du titan",
      },
    },
  ],
  rewards: {},
};
