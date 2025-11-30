// Sorts réservés aux monstres.
// Même modèle que les sorts des joueurs, mais organisés par monstre.

export const monsterSpells = {
  corbeau: {
    coup_de_bec: {
      id: "coup_de_bec",
      label: "Coup de bec",
      paCost: 4,
      rangeMin: 1,
      rangeMax: 1, // corps à corps
      lineOfSight: true,
      zone: "cell",
      element: "agilite",
      damageMin: 5,
      damageMax: 9,
      description: "Un coup de bec rapide au corps à corps.",
    },
  },

  aluineeks: {
    fissure: {
      id: "fissure",
      label: "Fissure",
      paCost: 4,
      rangeMin: 1,
      rangeMax: 2,        // 1 à 2 cases
      lineOfSight: true,
      zone: "cell",       // on gère la ligne dans l'IA
      element: "terre",   // utilise la stat force dans spellSystem
      damageMin: 12,
      damageMax: 15,
      description: "Fissure de terre en ligne (1–2 cases).",
    },
  },
};
