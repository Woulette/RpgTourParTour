export const chapitre1Achievements = [
  {
    id: "chapitre1_etape_1_papi",
    category: "quetes",
    title: "Chapitre I \u2014 \u00c9veil",
    description: "Terminer la premi\u00e8re qu\u00eate (Papi).",
    requirements: [{ type: "quest_completed", questId: "andemia_intro_1" }],
    rewards: { xpPlayer: 60, gold: 25, honorPoints: 5 },
  },
  {
    id: "chapitre1_etape_2_meme",
    category: "quetes",
    title: "Chapitre I \u2014 Premiers butins",
    description: "Terminer la qu\u00eate des ressources de corbeaux (M\u00e9m\u00e9).",
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
    title: "Chapitre I \u2014 Essences",
    description: "Ramener les essences \u00e0 l'alchimiste.",
    // Dans andemia_intro_3, l'\u00e9tape 0 = essences. Quand elle est valid\u00e9e, on passe en stageIndex 1.
    requirements: [
      { type: "quest_stage_index_at_least", questId: "andemia_intro_3", min: 1 },
    ],
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
    title: "Chapitre I \u2014 Panoplie",
    description: "Fabriquer la panoplie du Corbeau et terminer la qu\u00eate.",
    requirements: [{ type: "quest_completed", questId: "andemia_intro_3" }],
    rewards: { xpPlayer: 180, gold: 90, honorPoints: 18 },
  },
  {
    id: "chapitre1_global",
    category: "quetes",
    title: "Chapitre I \u2014 Validation du pack",
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
