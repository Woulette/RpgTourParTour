// Mapping des ressources alchimiste (resourceId -> item + XP)
export const alchimisteResources = {
  ortie: {
    resourceId: "ortie",
    itemId: "plante_ortie",
    // XP fixe par recolte (independant de la quantite obtenue)
    xpHarvest: 8,
  },
  sauge: {
    resourceId: "sauge",
    itemId: "plante_sauge",
    xpHarvest: 18,
  },
  menthe: {
    resourceId: "menthe",
    itemId: "plante_menthe",
    xpHarvest: 30,
  },
};
