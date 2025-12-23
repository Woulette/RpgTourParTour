export const andemia_intro_3 = {
  id: "andemia_intro_3",
  title: "Les essences du corbeau",
  giverNpcId: "alchimiste_provisoire",
  requires: ["andemia_intro_2"],
  description:
    "L'alchimiste veut verifier ta determination. Recupere des essences de corbeau, puis vois Meme.",
  stages: [
    {
      id: "bring_essence_corbeau",
      npcId: "alchimiste_provisoire",
      description: "Rapporter 2 essences de corbeau a l'alchimiste.",
      objective: {
        type: "deliver_item",
        itemId: "essence_corbeau",
        qty: 2,
        consume: false,
        label: "Essences de corbeau recuperees",
      },
    },
    {
      id: "talk_to_meme",
      npcId: "meme_village",
      description: "Retourner voir Meme.",
      objective: {
        type: "talk_to_npc",
        npcId: "meme_village",
        requiredCount: 1,
        label: "Parler a Meme",
      },
    },
  ],
  rewards: {
    xpPlayer: 140,
    gold: 60,
  },
};
