// Recettes de base pour le métier cordonnier (placeholder).
export const cordonnierRecipes = [
  {
    id: "bottes_corbeau",
    label: "Bottes du corbeau",
    level: 1,
    category: "bottes",
    inputs: [
      { itemId: "plume_corbeau", qty: 3 },
      { itemId: "bois_chene", qty: 2 },
    ],
    output: { itemId: "bottes_corbeau", qty: 1 },
    xpGain: 25,
  },
  {
    id: "ceinture_corbeau",
    label: "Ceinture du corbeau",
    level: 1,
    category: "ceinture",
    inputs: [
      { itemId: "plume_corbeau", qty: 4 },
      { itemId: "bois_chene", qty: 3 },
    ],
    output: { itemId: "ceinture_corbeau", qty: 1 },
    xpGain: 30,
  },
];
