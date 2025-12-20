export const andemia_intro_1 = {
  id: "andemia_intro_1",
  title: "Réveil dans Andémia",
  giverNpcId: "papi_bucheron",
  description:
    "Tu reprends tes esprits dans un monde qui ne semble pas tout à fait réel. Papi te conseille d'aller voir Mémé pour comprendre ce qui se passe.",
  stages: [
    {
      id: "find_meme",
      npcId: "meme_village",
      description: "Trouver Mémé et lui parler.",
      objective: {
        type: "talk_to_npc",
        npcId: "meme_village",
        requiredCount: 1,
        label: "Parler à Mémé",
      },
    },
  ],
  rewards: {
    xpPlayer: 25,
    gold: 10,
  },
};

