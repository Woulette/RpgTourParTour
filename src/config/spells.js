// Définition des sorts du jeu.
// Pour l'instant : un seul sort de test pour l'archer.

export const spells = {
  tir_simple: {
    id: 'tir_simple',
    label: 'Tir simple',
    // Coût en PA (pas de mana dans ton jeu)
    paCost: 3,
    // Niveau minimum pour débloquer le sort
    requiredLevel: 1,
    // Portée en cases (min / max)
    rangeMin: 1,
    rangeMax: 5,
    // Nécessite une ligne de vue directe ou non (utile plus tard)
    lineOfSight: true,
    // Type de zone : une seule case pour l'instant
    zone: 'cell',
    // Élément principal du sort (utilisé plus tard pour les dégâts)
    element: 'agilite',
    // Dégâts de base (fourchette min / max)
    damageMin: 9,
    damageMax: 15,
    description: 'Un tir de base à distance.',
  },
};

