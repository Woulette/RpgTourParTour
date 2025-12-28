// Recettes du metier bricoleur (clefs, fusion, etc.)
export const bricoleurRecipes = [
  {
    id: "clef_aluineeks",
    label: "Clef d'aluineeks",
    level: 1,
    category: "clef",
    inputs: [
      { itemId: "bois_chene", qty: 2 },
      { itemId: "peau_goush", qty: 3 },
      { itemId: "peau_cedre", qty: 4 },
    ],
    output: { itemId: "clef_aluineeks", qty: 1 },
    xpGain: 25,
  },
];
