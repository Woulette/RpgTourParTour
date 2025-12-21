export const andemia_intro_2 = {
  id: "andemia_intro_2",
  title: "Premiers pas",
  giverNpcId: "meme_village",
  requires: ["andemia_intro_1"],
  description:
    "Mémé veut vérifier que tu tiens debout. Ramène-lui des ressources de corbeaux, puis va voir l'alchimiste.",
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
    {
      id: "talk_to_alchimiste",
      npcId: "alchimiste_provisoire",
      description: "Aller voir l'alchimiste.",
      objective: {
        type: "talk_to_npc",
        npcId: "alchimiste_provisoire",
        requiredCount: 1,
        label: "Parler à l'alchimiste",
      },
    },
  ],
  rewards: {
    xpPlayer: 60,
    gold: 25,
  },
};
