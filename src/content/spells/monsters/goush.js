export default {
  morsure: {
    id: "morsure",
    label: "Morsure",
    paCost: 3,
    rangeMin: 1,
    rangeMax: 1,
    lineOfSight: true,
    zone: "cell",
    element: "terre",
    damageMin: 8,
    damageMax: 12,
    effects: [
      { type: "damage", element: "terre", min: 8, max: 12 },
    ],
    maxCastsPerTurn: 1,
    description: "Une morsure brutale au corps a corps.",
  },
  bave_puante: {
    id: "bave_puante",
    label: "Bave puante",
    paCost: 4,
    rangeMin: 1,
    rangeMax: 4,
    lineOfSight: true,
    zone: "cell",
    element: "terre",
    damageOnHit: false,
    damageMin: 0,
    damageMax: 0,
    cooldownTurns: 3,
    effects: [
      { type: "status", useSpellStatus: true },
    ],
    statusEffect: {
      id: "bave_puante",
      type: "poison",
      label: "Bave puante",
      turns: 2,
      damageMin: 5,
      damageMax: 9,
    },
    description:
      "Crache une bave terre (1-4 PO) et empoisonne la cible pendant 2 tours.",
  },
};

