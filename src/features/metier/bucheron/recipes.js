// Recettes de scierie (bucheron).
export const bucheronRecipes = [
  {
    id: "copeau_frene",
    label: "Copeau de chene",
    level: 1,
    category: "resource",
    recipeIcon: "assets/ressources/Bois/Copeau De Chene.png",
    inputs: [
      { itemId: "bois_chene", qty: 5 },
    ],
    output: { itemId: "copeau_frene", qty: 1 },
    xpGain: 10,
  },
];
