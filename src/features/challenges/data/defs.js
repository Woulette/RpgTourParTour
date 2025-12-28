export const combatChallenges = [
  {
    id: "hp_70",
    label: "Survivant",
    description: "Terminer le combat avec au moins 70% de vos PV.",
    kind: "hp_threshold_end",
    params: { minHpRatio: 0.7 },
    rewards: { xpBonusPct: 0.3, dropBonusPct: 0.3 },
  },
  {
    id: "finish_on_tile",
    label: "Positionnement",
    description: "Terminer le combat sur la case cible.",
    kind: "finish_on_tile",
    params: { radius: 4 },
    rewards: { xpBonusPct: 0.6, dropBonusPct: 0.6 },
  },
  {
    id: "no_cast_melee",
    label: "Sous pression",
    description:
      "Interdit de lancer un sort si au moins un ennemi est au corps à corps.",
    kind: "no_cast_when_enemy_melee",
    params: {},
    rewards: { xpBonusPct: 0.5, dropBonusPct: 0.5 },
  },
];

