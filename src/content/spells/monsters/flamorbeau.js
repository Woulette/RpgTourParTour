export default {
  bec_ardent: {
    id: "bec_ardent",
    label: "Bec ardent",
    paCost: 4,
    rangeMin: 1,
    rangeMax: 1,
    lineOfSight: true,
    zone: "cell",
    element: "feu",
    damageMin: 5,
    damageMax: 9,
    effects: [
      { type: "damage", element: "feu", min: 5, max: 9 },
    ],
    description: "Un coup de bec brûlant.",
  },
};

