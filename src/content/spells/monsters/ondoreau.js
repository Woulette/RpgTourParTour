export default {
  bec_ondoyant: {
    id: "bec_ondoyant",
    label: "Bec ondoyant",
    paCost: 4,
    rangeMin: 1,
    rangeMax: 1,
    lineOfSight: true,
    zone: "cell",
    element: "eau",
    damageMin: 5,
    damageMax: 9,
    critChanceBasePct: 5,
    damageCritMin: 6,
    damageCritMax: 11,
    effects: [
      { type: "damage", element: "eau", min: 5, max: 9 },
    ],
    description: "Un coup de bec fluide comme l'eau.",
  },
};

