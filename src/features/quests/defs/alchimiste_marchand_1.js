import { addItem } from "../../inventory/runtime/inventoryCore.js";

export const alchimiste_marchand_1 = {
  id: "alchimiste_marchand_1",
  title: "Le marchand ambulant",
  offerChoiceLabel: "Tu as besoin d'aide ?",
  offerChoiceOrder: 1,
  giverNpcId: "alchimiste_provisoire",
  requires: ["andemia_intro_3"],
  description:
    "L'Alchimiste doit envoyer une facture au Marchand, mais il n'a pas le temps.",
  stages: [
    {
      id: "deliver_invoice",
      npcId: "marchand_boutique",
      description: "Aller voir le Marchand pour lui transmettre la facture.",
      objective: {
        type: "talk_to_npc",
        npcId: "marchand_boutique",
        requiredCount: 1,
        label: "Parler au Marchand",
      },
      onStart: ({ player }) => {
        if (!player?.inventory) return;
        addItem(player.inventory, "facture_alchimiste", 1);
      },
    },
  ],
  rewards: {
    xpPlayer: 100,
    gold: 50,
  },
};
