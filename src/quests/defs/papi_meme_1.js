export const papi_meme_1 = {
  id: "papi_meme_1",
  title: "Un service pour Mémé",
  giverNpcId: "papi_bucheron",
  requires: ["papi_corbeaux_1"],
  description:
    "Papi t'envoie voir Mémé, puis récolter du bois pour qu'elle t'apprenne à coudre.",
  stages: [
    {
      id: "talk_to_meme",
      npcId: "meme_village",
      description: "Aller parler à Mémé, la femme de Papi.",
      objective: {
        type: "talk_to_npc",
        npcId: "meme_village",
        requiredCount: 1,
        label: "Parler à Mémé",
      },
    },
    {
      id: "bring_wood",
      npcId: "meme_village",
      description: "Récolter 10 bois de chêne et les apporter à Mémé.",
      objective: {
        type: "deliver_item",
        itemId: "bois_chene",
        qty: 10,
        consume: true,
        label: "Bois de chêne livré",
      },
    },
  ],
  rewards: {
    xpPlayer: 80,
    gold: 40,
  },
};

