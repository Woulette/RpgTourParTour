export default {
  maintendu: {
    id: "maintendu",
    label: "Maintendu",
    paCost: 4,
    rangeMin: 1,
    rangeMax: 3,
    lineOfSight: true,
    zone: "cell",
    element: "air",
    damageMin: 10,
    damageMax: 14,
    effects: [
      { type: "damage", element: "air", min: 10, max: 14 },
    ],
    maxCastsPerTurn: 1,
    description: "Attaque a moyenne portee.",
  },
};
