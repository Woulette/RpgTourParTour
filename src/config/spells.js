// D�finition des sorts du jeu.
// Pour l'instant : un seul sort de test pour l'archer.

export const spells = {
  punch_furtif: {
    id: "punch_furtif",
    label: "Punch furtif",
    // Coût en PA (pas de mana dans ton jeu)
    paCost: 3,
    requiredLevel: 1,
    rangeMin: 1,
    rangeMax: 3,
    lineOfSight: true,
    zone: "cell",
    element: "terre",
    damageMin: 11,
    damageMax: 14,
    description: "Un coup de poing terre, rapide et précis.",
  },
  traction_aerienne: {
    id: "traction_aerienne",
    label: "Traction aerienne",
    paCost: 3,
    requiredLevel: 1,
    rangeMin: 1,
    rangeMax: 4,
    lineOfSight: true,
    zone: "cell",
    element: "air",
    damageMin: 8,
    damageMax: 11,
    maxCastsPerTurn: 1,
    castPattern: "line4",
    pullCasterToMeleeOnHit: true,
    description:
      "Lance un tir d'air en ligne, puis rapproche au corps a corps si la cible est touchee.",
  },
  punch_enflamme: {
    id: "punch_enflamme",
    label: "Punch enflamme",
    paCost: 4,
    requiredLevel: 1,
    rangeMin: 1,
    rangeMax: 2,
    lineOfSight: true,
    zone: "cell",
    element: "feu",
    damageMin: 11,
    damageMax: 15,
    maxCastsPerTurn: 2,
    castPattern: "line4",
    effectPattern: "front_cross",
    description:
      "Un punch de feu en ligne qui frappe en croix devant le lanceur.",
  },
  tir_simple: {
    id: 'tir_simple',
    label: 'Tir simple',
    // Co�t en PA (pas de mana dans ton jeu)
    paCost: 3,
    // Niveau minimum pour d�bloquer le sort
    requiredLevel: 1,
    // Port�e en cases (min / max)
    rangeMin: 1,
    rangeMax: 5,
    // N�cessite une ligne de vue directe ou non (utile plus tard)
    lineOfSight: true,
    // Type de zone : une seule case pour l'instant
    zone: 'cell',
    // �l�ment principal du sort (utilis� plus tard pour les d�g�ts)
    element: 'agilite',
    // D�g�ts de base (fourchette min / max)
    damageMin: 9,
    damageMax: 15,
    description: 'Un tir de base � distance.',
  },

  fleche_carbonisee: {
    id: "fleche_carbonisee",
    label: "Fleche carbonisee",
    paCost: 4,
    requiredLevel: 1,
    rangeMin: 1,
    rangeMax: 8,
    lineOfSight: true,
    zone: "cell",
    element: "feu",
    damageMin: 11,
    damageMax: 17,
    description: "Une fleche de feu plus puissante mais plus couteuse.",
  },
  flumigene: {
    id: "flumigene",
    label: "Flumigene",
    paCost: 2,
    requiredLevel: 1,
    rangeMin: 1,
    rangeMax: 6,
    lineOfSight: true,
    zone: "cell",
    element: "eau",
    damageMin: 5,
    damageMax: 7,
    // meta for later logic
    lifeSteal: true,
    maxCastsPerTurn: 2,
    description: "Une fleche d eau a faible degats qui vole la vie.",
  },
};

