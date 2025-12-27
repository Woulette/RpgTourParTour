export const alchimiste_marchand_3 = {
  id: "alchimiste_marchand_3",
  title: "Plainte au maire",
  giverNpcId: "alchimiste_provisoire",
  requires: ["alchimiste_marchand_2"],
  description: "L'Alchimiste veut que tu ailles voir le maire.",
  stages: [
    {
      id: "meet_maire",
      npcId: "maire_albinos",
      description: "Aller voir le maire pour expliquer l'arnaque.",
      objective: {
        type: "talk_to_npc",
        npcId: "maire_albinos",
        requiredCount: 1,
        label: "Parler au maire",
      },
    },
    {
      id: "meet_maire_marchand",
      npcId: "maire_albinos_marchand",
      description: "Rejoindre le maire chez le marchand.",
      objective: {
        type: "talk_to_npc",
        npcId: "maire_albinos_marchand",
        requiredCount: 1,
        label: "Parler au maire",
      },
    },
    {
      id: "talk_marchand",
      npcId: "marchand_boutique",
      description: "Parler au marchand pour confronter les faits.",
      objective: {
        type: "talk_to_npc",
        npcId: "marchand_boutique",
        requiredCount: 1,
        label: "Parler au marchand",
      },
    },
    {
      id: "return_to_maire",
      npcId: "maire_albinos_marchand",
      description: "Retourner voir le maire.",
      objective: {
        type: "talk_to_npc",
        npcId: "maire_albinos_marchand",
        requiredCount: 1,
        label: "Parler au maire",
      },
    },
    {
      id: "return_to_marchand",
      npcId: "marchand_boutique",
      description: "Retourner voir le marchand.",
      objective: {
        type: "talk_to_npc",
        npcId: "marchand_boutique",
        requiredCount: 1,
        label: "Parler au marchand",
      },
    },
  ],
  rewards: {
    xpPlayer: 180,
    gold: 110,
  },
};
