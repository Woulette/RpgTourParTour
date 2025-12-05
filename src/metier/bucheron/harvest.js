// Logique de base pour le métier de bûcheron.
// On gère ici la récolte d'un arbre : vérification,
// ajout de ressources dans l'inventaire et gain d'XP.

import { addItem } from "../../inventory/inventoryCore.js";
import { bucheronResources } from "./resources.js";

const BUCHERON_XP_PER_HARVEST = 10;

/**
 * Vérifie rapidement si le joueur peut interagir avec un node de bûcheron.
 * (Portée, état déjà coupé, etc. à compléter plus tard.)
 *
 * @param {object} player
 * @param {object} node
 * @returns {boolean}
 */
export function canHarvestTree(player, node) {
  if (!player || !node) return false;
  if (node.harvested) return false;
  return true;
}

function addBucheronXp(player, amount) {
  if (!player || typeof amount !== "number" || amount <= 0) return;

  if (!player.metiers) {
    player.metiers = {};
  }
  if (!player.metiers.bucheron) {
    player.metiers.bucheron = { xp: 0 };
  }

  player.metiers.bucheron.xp += amount;
}

/**
 * Effectue la récolte d'un arbre :
 * - ajoute les ressources à l'inventaire (si possible)
 * - ajoute de l'XP de métier bûcheron
 * - marque le node comme coupé.
 *
 * @param {object} scene - scène Phaser (pour timers, effets visuels...)
 * @param {object} player
 * @param {object} node
 * @returns {{ success: boolean, node: object, gainedItems?: number, gainedXp?: number }}
 */
export function harvestTree(scene, player, node) {
  if (!canHarvestTree(player, node)) {
    return { success: false, node };
  }

  const resourceDef = bucheronResources[node.resourceId];
  // Quantité de bois aléatoire entre 1 et 3 à chaque récolte
  const amount = Phaser.Math.Between(1, 3);

  let gainedItems = 0;
  let gainedXp = 0;

  if (resourceDef && player.inventory) {
    const remaining = addItem(
      player.inventory,
      resourceDef.itemId,
      amount
    );
    gainedItems = amount - remaining;

    // XP fixe par récolte, quelle que soit la quantité
    gainedXp = BUCHERON_XP_PER_HARVEST;
    addBucheronXp(player, gainedXp);
  }

  node.harvested = true;

  const result = { success: true, node, gainedItems, gainedXp };
  // eslint-disable-next-line no-console
  console.log("[Bucheron] harvestTree résultat :", result);
  return result;
}
