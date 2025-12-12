// Recettes de base pour le métier tailleur.
// Placeholder minimal : on pourra enrichir avec de vraies ressources.
export const tailleurRecipes = [
  {
    id: "coiffe_corbeau",
    label: "Coiffe du corbeau",
    level: 1,
    category: "coiffe",
    inputs: [
      { itemId: "plume_corbeau", qty: 3 },
      { itemId: "bois_chene", qty: 2 },
    ],
    output: { itemId: "coiffe_corbeau", qty: 1 },
    xpGain: 25,
  },
  {
    id: "cape_corbeau",
    label: "Cape du corbeau",
    level: 1,
    category: "cape",
    inputs: [
      { itemId: "plume_corbeau", qty: 4 },
      { itemId: "bois_chene", qty: 3 },
    ],
    output: { itemId: "cape_corbeau", qty: 1 },
    xpGain: 30,
  },
];
