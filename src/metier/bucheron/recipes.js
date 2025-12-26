// Recettes de scierie (bucheron).
export const bucheronRecipes = [
  {
    id: "copeau_frene",
    label: "Copeau de frene",
    level: 1,
    category: "resource",
    recipeIcon: "assets/metier/Bucheron/Craft/CopeauDeFrene.png",
    inputs: [
      { itemId: "bois_frene", qty: 5 },
    ],
    output: { itemId: "copeau_frene", qty: 1 },
    xpGain: 10,
  },
];
