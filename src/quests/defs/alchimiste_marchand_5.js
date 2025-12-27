export const alchimiste_marchand_5 = {
  id: "alchimiste_marchand_5",
  title: "Parchemin inferieur",
  giverNpcId: "marchand_boutique",
  requires: ["alchimiste_marchand_4"],
  description: "Le marchand veut un parchemin inferieur de tier 1.",
  stages: [
    {
      id: "craft_parchemin",
      npcId: "marchand_boutique",
      description: "Fabriquer un parchemin inferieur de tier 1.",
      objective: {
        type: "craft_items",
        items: [{ itemId: "parchemin_inferieur_tier_1", qty: 1 }],
        label: "Parchemin inferieur tier 1",
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
    {
      id: "apply_parchemin",
      npcId: "marchand_boutique",
      description: "Appliquer le parchemin sur un sort.",
      objective: {
        type: "talk_to_npc",
        npcId: "marchand_boutique",
        requiredCount: 1,
        label: "Appliquer le parchemin",
      },
    },
  ],
  rewards: {
    xpPlayer: 260,
    gold: 160,
  },
};
