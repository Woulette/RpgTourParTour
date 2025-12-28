export const andemia_intro_2 = {
  id: "andemia_intro_2",
  title: "Deplumer nos corbeau",
  giverNpcId: "meme_village",
  requires: ["andemia_intro_1"],
  description: "Meme veut verifier que tu sais te debrouiller dehors.",
  stages: [
    {
      id: "bring_corbeau_parts",
      npcId: "meme_village",
      description: "Ramener 2 becs et 3 plumes de corbeau.",
      objective: {
        type: "deliver_items",
        consume: true,
        items: [
          { itemId: "bec_corbeau", qty: 2 },
          { itemId: "plume_corbeau", qty: 3 },
        ],
        label: "Butin de corbeau",
      },
    },
    {
      id: "meet_alchimiste",
      npcId: "alchimiste_provisoire",
      description: "Aller voir l'Alchimiste.",
      objective: {
        type: "talk_to_npc",
        npcId: "alchimiste_provisoire",
        requiredCount: 1,
        label: "Parler a l'Alchimiste",
      },
    },
  ],
  rewards: {
    xpPlayer: 360,
    gold: 30,
  },
};
