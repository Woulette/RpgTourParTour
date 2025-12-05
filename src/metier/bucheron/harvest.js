// Logique de base pour le métier de bûcheron.
// On gère ici la récolte d'un arbre : vérification,
// ajout de ressources dans l'inventaire et gain d'XP.

import { addItem } from "../../inventory/inventoryCore.js";
import { bucheronResources } from "./resources.js";

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
  const amount =
    typeof node.amount === "number" && !Number.isNaN(node.amount)
      ? node.amount
      : 1;

  let gainedItems = 0;
  let gainedXp = 0;

  if (resourceDef && player.inventory) {
    const remaining = addItem(
      player.inventory,
      resourceDef.itemId,
      amount
    );
    gainedItems = amount - remaining;

    const xpPerUnit =
      typeof resourceDef.xpPerUnit === "number"
        ? resourceDef.xpPerUnit
        : 0;
    gainedXp = xpPerUnit * gainedItems;
    if (gainedXp > 0) {
      addBucheronXp(player, gainedXp);
    }
  }

  node.harvested = true;

  const result = { success: true, node, gainedItems, gainedXp };
  // eslint-disable-next-line no-console
  console.log("[Bucheron] harvestTree résultat :", result);
  return result;
}
