export const meme_panoplie_corbeau_1 = {
  id: "meme_panoplie_corbeau_1",
  title: "La panoplie du Corbeau",
  giverNpcId: "meme_village",
  requires: ["papi_meme_1"],
  description:
    "Mémé veut que tu fabriques la panoplie du Corbeau pour t'apprendre les bases de l'artisanat.",
  stages: [
    {
      id: "craft_panoplie_corbeau",
      npcId: "meme_village",
      description:
        "Fabriquer toutes les pièces de la panoplie du Corbeau, puis retourner voir Mémé.",
      objective: {
        type: "craft_items",
        items: [
          { itemId: "anneau_corbeau", qty: 1 },
          { itemId: "amulette_corbeau", qty: 1 },
          { itemId: "coiffe_corbeau", qty: 1 },
          { itemId: "cape_corbeau", qty: 1 },
          { itemId: "ceinture_corbeau", qty: 1 },
          { itemId: "bottes_corbeau", qty: 1 },
        ],
        label: "Panoplie du Corbeau fabriquée",
      },
    },
  ],
  rewards: {
    xpPlayer: 120,
    gold: 60,
  },
};

