export default {
  aura_cedre: {
    id: "aura_cedre",
    label: "Aura de cedre",
    paCost: 4,
    rangeMin: 0,
    rangeMax: 0,
    lineOfSight: false,
    zone: "cell",
    cooldownTurns: 3,
    maxCastsPerTurn: 2,
    effects: [
      { type: "areaBuff", useSpellAreaBuff: true },
    ],
    areaBuff: {
      radius: 2,
      effects: [
        {
          id: "cedre_aura_pm",
          type: "pm",
          amount: 1,
          turns: 2,
          label: "+1 PM",
        },
        {
          id: "cedre_aura_puissance",
          type: "puissance",
          amount: 25,
          turns: 2,
          label: "+25 Puissance",
        },
      ],
    },
    description:
      "Boost en zone (rayon 2) : +1 PM et +25 puissance pendant 2 tours.",
  },
  souffle_cedre: {
    id: "souffle_cedre",
    label: "Souffle de cedre",
    paCost: 3,
    rangeMin: 1,
    rangeMax: 1,
    lineOfSight: true,
    zone: "cell",
    element: "terre",
    damageMin: 9,
    damageMax: 11,
    pushbackDistance: 1,
    maxCastsPerTurn: 2,
    effects: [
      { type: "damage", element: "terre", min: 9, max: 11 },
      { type: "push", distance: 1 },
    ],
    description: "Repousse la cible d'une case au corps a corps.",
  },
};
