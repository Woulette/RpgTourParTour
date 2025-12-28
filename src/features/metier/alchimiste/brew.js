// Logique de base pour le métier d'alchimiste.
// Ici on ne fait que définir la forme générale de l'API.

/**
 * Vérifie si le joueur peut préparer une recette d'alchimie donnée.
 * (Vérification d'inventaire / niveau de métier à compléter plus tard.)
 *
 * @param {object} player
 * @param {object} recipe
 * @returns {boolean}
 */
export function canBrew(player, recipe) {
  if (!player || !recipe) return false;
  return true;
}

/**
 * Prépare une potion (ou autre objet d'alchimie).
 * À terme : consommer les ingrédients, ajouter l'objet, donner de l'XP.
 *
 * @param {object} player
 * @param {object} recipe
 * @returns {{ success: boolean }}
 */
export function brew(player, recipe) {
  if (!canBrew(player, recipe)) {
    return { success: false };
  }

  // TODO : logique d'alchimie (inventaire, XP, etc.)
  return { success: true };
}

