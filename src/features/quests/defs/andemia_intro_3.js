import { addItem } from "../../inventory/runtime/inventoryAuthority.js";

export const andemia_intro_3 = {
  id: "andemia_intro_3",
  title: "L'extracteur d'essence",
  giverNpcId: "alchimiste_provisoire",
  requires: ["andemia_intro_2"],
  description: "L'Alchimiste veut tester ta valeur.",
  stages: [
    {
      id: "bring_orties",
      npcId: "alchimiste_provisoire",
      description: "Ramener 20 orties a l'Alchimiste.",
      objective: {
        type: "deliver_item",
        itemId: "plante_ortie",
        qty: 20,
        consume: true,
        label: "20 orties",
      },
      onComplete: ({ player }) => {
        if (!player?.inventory) return;
        addItem(player.inventory, "extracteur_essence", 1);
      },
    },
  ],
  rewards: {
    xpPlayer: 480,
    gold: 35,
  },
};
