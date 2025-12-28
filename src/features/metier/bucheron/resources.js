// Mapping des ressources bucheron (resourceId -> item + XP)
// Utilise resourceId configuré dans Tiled sur les arbres.

export const bucheronResources = {
  chene: {
    resourceId: "chene",
    itemId: "bois_chene",
    // XP fixe par récolte (indépendant de la quantité obtenue)
    xpHarvest: 10,
  },
  "chene-solide": {
    resourceId: "chene-solide",
    itemId: "bois_chene_solide",
    xpHarvest: 25,
  },
};
