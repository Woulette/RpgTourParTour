// Definitions statiques du metier alchimiste (nom + ressources affiches en UI)
export const alchimisteDefinition = {
  id: "alchimiste",
  name: "Alchimiste",
  type: "hybrid",
  craftCategories: [{ id: "potion", label: "Potions" }],
  resources: [
    {
      id: "ortie",
      name: "Ortie",
      level: 1,
      quantityMin: 1,
      quantityMax: 3,
      xpGain: 8,
    },
    {
      id: "sauge",
      name: "Sauge",
      level: 10,
      quantityMin: 1,
      quantityMax: 3,
      xpGain: 18,
    },
    {
      id: "menthe",
      name: "Menthe",
      level: 20,
      quantityMin: 1,
      quantityMax: 4,
      xpGain: 30,
    },
  ],
};
