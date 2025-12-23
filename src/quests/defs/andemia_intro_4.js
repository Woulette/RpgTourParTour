export const andemia_intro_4 = {
  id: "andemia_intro_4",
  title: "Panoplie du Corbeau",
  giverNpcId: "meme_village",
  requires: ["andemia_intro_3"],
  description:
    "Meme veut te montrer comment transformer le butin en equipement.",
  stages: [
    {
      id: "craft_panoplie_corbeau",
      npcId: "meme_village",
      description:
        "Fabriquer une panoplie du Corbeau (coiffe, cape, amulette, ceinture, bottes, anneau), puis retourner voir Meme.",
      objective: {
        type: "craft_set",
        setId: "corbeau",
        requiredSlots: ["head", "cape", "amulet", "belt", "boots", "ring1"],
        label: "Panoplie du Corbeau fabriquee",
      },
    },
  ],
  rewards: {
    xpPlayer: 180,
    gold: 90,
  },
};
