// Définition des bonus de panoplies d'équipement.
// Chaque set possède un id, un label et des paliers de bonus
// en fonction du nombre de pièces équipées.

export const equipmentSets = {
  corbeau: {
    id: "corbeau",
    label: "Panoplie du Corbeau",
    // clés = nombre de pièces équipées, valeurs = bonus de stats
    thresholds: {
      // 1 pièce : aucun bonus, donc pas de palier 1
      2: {
        // petit bonus quand on a 2 pièces
        agilite: 3,
      },
      3: {
        // bonus un peu plus fort à 3 pièces
        agilite: 5,
        vitalite: 10,
      },
      6: {
        // bonus complet quand les 6 pièces sont équipées
        agilite: 12,
        vitalite: 30,
        initiative: 10,
      },
    },
  },
};

