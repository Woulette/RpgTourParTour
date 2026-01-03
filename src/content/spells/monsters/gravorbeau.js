export default {
  bec_graveleux: {
    id: "bec_graveleux",
    label: "Bec graveleux",
    paCost: 4,
    rangeMin: 1,
    rangeMax: 1,
    lineOfSight: true,
    zone: "cell",
    element: "terre",
    damageMin: 5,
    damageMax: 9,
    critChanceBasePct: 5,
    damageCritMin: 6,
    damageCritMax: 11,
    effects: [
      { type: "damage", element: "terre", min: 5, max: 9 },
    ],
    description: "Un coup de bec lourd, chargé de terre.",
  },
};

