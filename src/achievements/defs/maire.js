export const maireAchievements = [
  {
    id: "maire_etape_1_corbeaux",
    category: "quetes",
    title: "Ordres du maire — Corbeaux",
    description: "Completer la mission de corbeaux pour le maire.",
    requirements: [{ type: "quest_completed", questId: "maire_corbeaux_1" }],
    rewards: { xpPlayer: 70, gold: 30, honorPoints: 6 },
  },
  {
    id: "maire_global",
    category: "quetes",
    title: "Ordres du maire — Validation du pack",
    description: "Valider tous les objectifs du pack du maire.",
    requirements: [
      { type: "achievement_unlocked", achievementId: "maire_etape_1_corbeaux" },
    ],
    rewards: { xpPlayer: 140, gold: 60, honorPoints: 12 },
  },
];
