export const alchimiste_marchand_2 = {
  id: "alchimiste_marchand_2",
  title: "Soigner le marchand",
  giverNpcId: "marchand_boutique",
  requires: ["alchimiste_marchand_1"],
  description: "Le marchand a besoin de potions d'ortie.",
  stages: [
    {
      id: "bring_ortie_potions",
      npcId: "marchand_boutique",
      description: "Ramener 5 potions d'ortie au marchand.",
      objective: {
        type: "deliver_item",
        itemId: "potion_ortie",
        qty: 5,
        consume: true,
        label: "5 potions d'ortie",
      },
    },
    {
      id: "return_to_alchimiste",
      npcId: "alchimiste_provisoire",
      description: "Retourner voir l'Alchimiste.",
      objective: {
        type: "talk_to_npc",
        npcId: "alchimiste_provisoire",
        requiredCount: 1,
        label: "Parler a l'Alchimiste",
      },
    },
  ],
  rewards: {
    xpPlayer: 140,
    gold: 90,
  },
};
