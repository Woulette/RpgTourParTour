export const andemia_intro_1 = {
  id: "andemia_intro_1",
  title: "Saluer nos voisin",
  giverNpcId: "papi_bucheron",
  description: "Papi te demande de te presenter aux habitants du village.",
  stages: [
    {
      id: "meet_meme",
      npcId: "meme_village",
      description: "Aller voir Meme au village.",
      objective: {
        type: "talk_to_npc",
        npcId: "meme_village",
        requiredCount: 1,
        label: "Parler a Meme",
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
    {
      id: "meet_marchand",
      npcId: "marchand_boutique",
      description: "Aller voir le Marchand.",
      objective: {
        type: "talk_to_npc",
        npcId: "marchand_boutique",
        requiredCount: 1,
        label: "Parler au Marchand",
      },
    },
    {
      id: "meet_maire",
      npcId: "maire_albinos",
      description: "Aller voir le maire.",
      objective: {
        type: "talk_to_npc",
        npcId: "maire_albinos",
        requiredCount: 1,
        label: "Parler au maire",
      },
    },
    {
      id: "return_to_papi",
      npcId: "papi_bucheron",
      description: "Retourner voir Papi.",
      objective: {
        type: "talk_to_npc",
        npcId: "papi_bucheron",
        requiredCount: 1,
        label: "Parler a Papi",
      },
    },
    {
      id: "return_to_meme",
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
    xpPlayer: 240,
    gold: 25,
  },
};
