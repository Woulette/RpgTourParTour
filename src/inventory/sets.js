// Définition des bonus de panoplies d'équipement.
// Chaque set possède un id, un label et des paliers de bonus
// en fonction du nombre de pièces équipées.

export const equipmentSets = {
  corbeau: {
    id: "corbeau",
    label: "Panoplie du Corbeau",
    // clés = nombre de pièces équipées, valeurs = bonus de stats
    thresholds: {

      2: {
        // bonus un peu plus fort à 2 pièces
        agilite: 3,
      },
      3: {
        // petit bonus quand on a 4 pièces
        agilite: 6,
        vitalite: 10,
      },
      4: {
        // bonus un peu plus fort à 4 pièces
        agilite: 9,
        vitalite: 15,
      },
      5: {
        // bonus complet quand les 5 pièces sont équipées
        agilite: 12,
        vitalite: 30,
        initiative: 10,
      },
      6: {
        // bonus complet quand les 6 pièces sont équipées
        agilite: 20,
        vitalite: 30,
        initiative: 30,
      },
    },
  },
};

