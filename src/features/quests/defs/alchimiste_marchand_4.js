import { addItem } from "../../inventory/runtime/inventoryCore.js";

export const alchimiste_marchand_4 = {
  id: "alchimiste_marchand_4",
  title: "Evolution de sort",
  giverNpcId: "marchand_boutique",
  requires: ["alchimiste_marchand_3"],
  description: "Le marchand peut faire evoluer un sort si tu lui ramene des ressources.",
  stages: [
    {
      id: "bring_resources",
      npcId: "marchand_boutique",
      description: "Ramener les ressources au marchand.",
      objective: {
        type: "deliver_items",
        consume: true,
        items: [
          { itemId: "peau_goush", qty: 3 },
          { itemId: "bois_chene", qty: 5 },
          { itemId: "fourrure_liburion", qty: 1 },
        ],
        label: "Ressources pour l'evolution",
      },
    },
    {
      id: "meet_papi",
      npcId: "papi_bucheron",
      description: "Aller voir Papi pour apprendre a fabriquer du papier.",
      objective: {
        type: "talk_to_npc",
        npcId: "papi_bucheron",
        requiredCount: 1,
        label: "Parler a Papi",
      },
    },
    {
      id: "bring_paper",
      npcId: "marchand_boutique",
      description: "Ramener 5 papiers au marchand.",
      objective: {
        type: "deliver_item",
        itemId: "papier",
        qty: 5,
        consume: false,
        label: "5 papiers",
      },
      onComplete: ({ player }) => {
        if (!player?.inventory) return;
        addItem(player.inventory, "talisman_inferieur_tier_1", 1);
      },
    },
  ],
  rewards: {
    xpPlayer: 220,
    gold: 140,
  },
};
