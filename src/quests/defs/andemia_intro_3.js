export const andemia_intro_3 = {
  id: "andemia_intro_3",
  title: "Les essences du corbeau",
  giverNpcId: "alchimiste_provisoire",
  requires: ["andemia_intro_2"],
  description:
    "L’alchimiste veut vérifier ta détermination. Récupère des essences de corbeau, puis vois Mémé pour passer à l’artisanat.",
  stages: [
    {
      id: "bring_essence_corbeau",
      npcId: "alchimiste_provisoire",
      description: "Rapporter 2 essences de corbeau à l’alchimiste.",
      objective: {
        type: "deliver_item",
        itemId: "essence_corbeau",
        qty: 2,
        consume: false,
        label: "Essences de corbeau récupérées",
      },
    },
    {
      id: "talk_to_meme",
      npcId: "meme_village",
      description: "Retourner voir Mémé.",
      objective: {
        type: "talk_to_npc",
        npcId: "meme_village",
        requiredCount: 1,
        label: "Parler à Mémé",
      },
    },
    {
      id: "craft_panoplie_corbeau",
      npcId: "meme_village",
      description:
        "Fabriquer une panoplie du Corbeau (coiffe, cape, amulette, ceinture, bottes, anneau), puis retourner voir Mémé.",
      objective: {
        type: "craft_set",
        setId: "corbeau",
        requiredSlots: ["head", "cape", "amulet", "belt", "boots", "ring1"],
        label: "Panoplie du Corbeau fabriquée",
      },
    },
  ],
  rewards: {
    xpPlayer: 140,
    gold: 60,
  },
};
