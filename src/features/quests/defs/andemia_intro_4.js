export const andemia_intro_4 = {
  id: "andemia_intro_4",
  title: "Une panoplie ca se merite",
  offerChoiceLabel: "On en etait ou deja ?",
  offerChoiceOrder: 2,
  giverNpcId: "alchimiste_provisoire",
  requires: ["andemia_intro_3"],
  description: "L'Alchimiste te renvoie voir Meme.",
  stages: [
    {
      id: "meet_meme",
      npcId: "meme_village",
      description: "Retourner voir Meme.",
      objective: {
        type: "talk_to_npc",
        npcId: "meme_village",
        requiredCount: 1,
        label: "Parler a Meme",
      },
    },
    {
      id: "craft_corbeau_set",
      npcId: "meme_village",
      description: "Crafter une panoplie du corbeau complete.",
      objective: {
        type: "craft_set",
        setId: "corbeau",
        requiredSlots: ["head", "cape", "amulet", "belt", "boots", "ring1"],
        label: "Panoplie du corbeau complete",
      },
    },
  ],
  rewards: {
    xpPlayer: 100,
    gold: 50,
  },
};
