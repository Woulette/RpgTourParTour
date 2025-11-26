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
};

