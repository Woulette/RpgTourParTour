export default {
  coup_de_massue: {
    id: "coup_de_massue",
    label: "Coup de massue",
    paCost: 4,
    rangeMin: 1,
    rangeMax: 1,
    lineOfSight: true,
    zone: "cell",
    element: "terre",
    damageMin: 11,
    damageMax: 15,
    effects: [
      { type: "damage", element: "terre", min: 11, max: 15 },
    ],
    maxCastsPerTurn: 1,
    description: "Une attaque lourde au corps a corps.",
  },
  jet_de_caillou: {
    id: "jet_de_caillou",
    label: "Jet de caillou",
    paCost: 3,
    rangeMin: 2,
    rangeMax: 5,
    lineOfSight: true,
    zone: "cell",
    element: "terre",
    damageMin: 7,
    damageMax: 10,
    effects: [
      { type: "damage", element: "terre", min: 7, max: 10 },
    ],
    maxCastsPerTurn: 2,
    description: "Lance un caillou à distance (2-5 PO).",
  },
};

