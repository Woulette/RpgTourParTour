export const andemia_intro_2 = {
  id: "andemia_intro_2",
  title: "Premiers pas",
  giverNpcId: "meme_village",
  requires: ["andemia_intro_1"],
  description:
    "Mémé veut vérifier que tu tiens debout. Ramène-lui des ressources de corbeaux pour prouver que tu sais te débrouiller.",
  stages: [
    {
      id: "bring_corbeau_parts",
      npcId: "meme_village",
      description: "Ramener 2 becs et 3 plumes de corbeau.",
      objective: {
        type: "deliver_items",
        items: [
          { itemId: "bec_corbeau", qty: 2 },
          { itemId: "plume_corbeau", qty: 3 },
        ],
        consume: true,
        label: "Ressources de corbeau livrées",
      },
    },
  ],
  rewards: {
    xpPlayer: 60,
    gold: 25,
  },
};
