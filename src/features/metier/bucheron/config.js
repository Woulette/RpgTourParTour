// Définitions statiques du métier bûcheron (nom + ressources affichées en UI)
export const bucheronDefinition = {
  id: "bucheron",
  name: "Bucheron",
  resources: [
    {
      id: "Chene",
      name: "Bois De Chene",
      level: 1,
      quantityMin: 1,
      quantityMax: 3,
      xpGain: 10,
    },
    {
      id: "chene-solide",
      name: "Chene solide",
      level: 10,
      quantityMin: 1,
      quantityMax: 4,
      xpGain: 25,
    },
  ],
};
