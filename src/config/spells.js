// D�finition des sorts du jeu.
// Pour l'instant : un seul sort de test pour l'archer.

export const spells = {
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





