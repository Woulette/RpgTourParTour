// Recettes de base pour le métier bijoutier (placeholder).
export const bijoutierRecipes = [
  {
    id: "anneau_corbeau",
    label: "Anneau du corbeau",
    level: 1,
    category: "anneau",
    inputs: [
      { itemId: "plume_corbeau", qty: 3 },
      { itemId: "bois_chene", qty: 2 },
    ],
    output: { itemId: "anneau_corbeau", qty: 1 },
    xpGain: 25,
  },
  {
    id: "amulette_corbeau",
    label: "Amulette du corbeau",
    level: 1,
    category: "amulette",
    inputs: [
      { itemId: "plume_corbeau", qty: 4 },
      { itemId: "bois_chene", qty: 2 },
    ],
    output: { itemId: "amulette_corbeau", qty: 1 },
    xpGain: 30,
  },
];
