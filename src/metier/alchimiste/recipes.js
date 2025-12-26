// Recettes d'alchimie (potion/consommable).
export const alchimieRecipes = [
  {
    id: "potion_ortie",
    label: "Potion d'ortie",
    level: 1,
    category: "potion",
    recipeIcon: "assets/metier/Alchimiste/Craft/PotionAuOrtie.png",
    inputs: [
      { itemId: "plante_ortie", qty: 4 },
    ],
    output: { itemId: "potion_ortie", qty: 1 },
    xpGain: 12,
  },
  {
    id: "papier",
    label: "Papier",
    level: 1,
    category: "resource",
    recipeIcon: "assets/metier/Alchimiste/Craft/Papier.png",
    inputs: [
      { itemId: "copeau_frene", qty: 6 },
      { itemId: "eau", qty: 10 },
    ],
    output: { itemId: "papier", qty: 1 },
    xpGain: 12,
  },
  {
    id: "potion_vie",
    label: "Potion de vie",
    level: 10,
    category: "potion",
    inputs: [
      { itemId: "plante_sauge", qty: 3 },
      { itemId: "plante_ortie", qty: 2 },
      { itemId: "essence_corbeau", qty: 2 },
    ],
    output: { itemId: "potion_vie", qty: 1 },
    xpGain: 22,
  },
  {
    id: "potion_regen",
    label: "Potion de regeneration",
    level: 20,
    category: "potion",
    inputs: [
      { itemId: "plante_menthe", qty: 3 },
      { itemId: "plante_sauge", qty: 2 },
      { itemId: "essence_corbeau", qty: 2 },
    ],
    output: { itemId: "potion_regen", qty: 1 },
    xpGain: 36,
  },
  {
    id: "potion_energie",
    label: "Potion d'energie",
    level: 30,
    category: "potion",
    inputs: [
      { itemId: "plante_menthe", qty: 4 },
      { itemId: "essence_corbeau", qty: 3 },
      { itemId: "poussiere_temporelle", qty: 1 },
    ],
    output: { itemId: "potion_energie", qty: 1 },
    xpGain: 50,
  },
];

// Recettes de fusion (interface "Fusion")
export const alchimieFusionRecipes = [];
