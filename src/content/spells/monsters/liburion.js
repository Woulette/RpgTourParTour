export default {
  eclat: {
    id: "eclat",
    label: "Eclat liburien",
    paCost: 4,
    rangeMin: 2,
    rangeMax: 4,
    lineOfSight: true,
    zone: "cell",
    element: "feu",
    damageMin: 10,
    damageMax: 14,
    castPattern: "line4",
    maxCastsPerTurn: 2,
    effects: [
      { type: "damage", element: "feu", min: 10, max: 14 },
    ],
    description: "Un eclat en ligne, a moyenne portee.",
  },
  rugissement: {
    id: "rugissement",
    label: "Rugissement",
    paCost: 4,
    rangeMin: 0,
    rangeMax: 0,
    lineOfSight: false,
    zone: "cell",
    cooldownTurns: 3,
    maxCastsPerTurn: 1,
    effects: [
      { type: "areaBuff", useSpellAreaBuff: true },
    ],
    areaBuff: {
      radius: 2,
      effects: [
        {
          id: "rugissement_puissance",
          type: "puissance",
          amount: 20,
          turns: 2,
          label: "+20 Puissance",
        },
        {
          id: "rugissement_bouclier",
          type: "shield",
          percent: 0.2,
          turns: 2,
          label: "Bouclier",
        },
      ],
    },
    description: "Boost alliés (+20 puissance) et bouclier sur soi.",
  },
};
