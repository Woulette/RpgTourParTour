// Définition des ressources spécifiques au métier de bûcheron.
// On fait le lien entre un `resourceId` utilisé dans Tiled
// et l'item d'inventaire correspondant, ainsi que l'XP métier gagnée.
//
// Exemple de propriétés Tiled pour un arbre :
//   resourceId = "chene"
//   amount     = 3
//
// Ici, on décrit ce que "chene" signifie pour le jeu.

export const bucheronResources = {
  chene: {
    resourceId: "chene",
    // itemId : id de l'item dans le système d'inventaire (resourceItems).
    itemId: "bois_chene",
    // XP de métier par unité récoltée.
    xpPerUnit: 1,
  },

  // Tu pourras ajouter d'autres entrées du même genre :
  // hetre: { resourceId: "hetre", itemId: "bois_hetre", xpPerUnit: 2 },
};

