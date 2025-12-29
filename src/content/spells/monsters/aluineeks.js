export default {
  fissure: {
    id: "fissure",
    label: "Fissure",
    paCost: 4,
    rangeMin: 1,
    rangeMax: 2,
    lineOfSight: true,
    zone: "cell",
    element: "terre",
    damageMin: 12,
    damageMax: 15,
    effects: [
      { type: "damage", element: "terre", min: 12, max: 15 },
    ],
    description: "Fissure de terre en ligne (1-2 cases).",
  },
};

