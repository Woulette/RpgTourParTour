export default {
  machoire: {
    id: "machoire",
    label: "Machoire",
    paCost: 3,
    rangeMin: 1,
    rangeMax: 1,
    lineOfSight: true,
    zone: "cell",
    element: "terre",
    damageMin: 10,
    damageMax: 12,
    critChanceBasePct: 5,
    damageCritMin: 12,
    damageCritMax: 14,
    effects: [
      { type: "damage", element: "terre", min: 10, max: 12 },
    ],
    maxCastsPerTurn: 2,
    description: "Morsure puissante au corps a corps.",
  },
};
