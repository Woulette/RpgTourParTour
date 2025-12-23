export const chapitre1Achievements = [
  {
    id: "chapitre1_etape_1_papi",
    category: "quetes",
    title: "Chapitre I — Eveil",
    description: "Terminer la premiere quete (Papi).",
    requirements: [{ type: "quest_completed", questId: "andemia_intro_1" }],
    rewards: { xpPlayer: 60, gold: 25, honorPoints: 5 },
  },
  {
    id: "chapitre1_etape_2_meme",
    category: "quetes",
    title: "Chapitre I — Premiers butins",
    description: "Terminer la quete des ressources de corbeaux (Meme).",
    requirements: [{ type: "quest_completed", questId: "andemia_intro_2" }],
    rewards: {
      xpPlayer: 80,
      gold: 35,
      honorPoints: 8,
      items: [
        { itemId: "bec_corbeau", qty: 5 },
        { itemId: "essence_corbeau", qty: 1 },
      ],
    },
  },
  {
    id: "chapitre1_etape_3_essences",
    category: "quetes",
    title: "Chapitre I — Essences",
    description: "Ramener les essences a l'alchimiste.",
    requirements: [{ type: "quest_completed", questId: "andemia_intro_3" }],
    rewards: {
      xpPlayer: 120,
      gold: 60,
      honorPoints: 12,
      items: [
        { itemId: "plume_corbeau", qty: 5 },
        { itemId: "patte_corbeau", qty: 5 },
      ],
    },
  },
  {
    id: "chapitre1_etape_4_panoplie",
    category: "quetes",
    title: "Chapitre I — Panoplie",
    description: "Fabriquer la panoplie du Corbeau et terminer la quete.",
    requirements: [{ type: "quest_completed", questId: "andemia_intro_4" }],
    rewards: { xpPlayer: 180, gold: 90, honorPoints: 18 },
  },
  {
    id: "chapitre1_global",
    category: "quetes",
    title: "Chapitre I — Validation du pack",
    description: "Valider tous les objectifs du pack.",
    requirements: [
      { type: "achievement_unlocked", achievementId: "chapitre1_etape_1_papi" },
      { type: "achievement_unlocked", achievementId: "chapitre1_etape_2_meme" },
      { type: "achievement_unlocked", achievementId: "chapitre1_etape_3_essences" },
      { type: "achievement_unlocked", achievementId: "chapitre1_etape_4_panoplie" },
    ],
    rewards: { xpPlayer: 500, gold: 250, honorPoints: 50 },
  },
];
