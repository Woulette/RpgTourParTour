// Logique de base du metier bucheron : recolte, inventaire, XP.

import { addItem } from "../../inventory/inventoryCore.js";
import { bucheronResources } from "./resources.js";
import { addBucheronXp, ensureBucheronState } from "./state.js";
import { emit as emitStoreEvent } from "../../state/store.js";

const BUCHERON_XP_PER_HARVEST = 10;

/**
 * Verifie rapidement si le joueur peut interagir avec un arbre.
 */
export function canHarvestTree(player, node) {
  if (!player || !node) return false;
  if (node.harvested) return false;
  return true;
}

/**
 * Effectue la recolte d'un arbre :
 * - ajoute les ressources a l'inventaire (si possible)
 * - ajoute de l'XP metier bucheron
 * - marque le node comme coupe.
 */
export function harvestTree(scene, player, node) {
  if (!canHarvestTree(player, node)) {
    return { success: false, node };
  }

  const resourceDef = bucheronResources[node.resourceId];
  // Quantite de bois aleatoire entre 1 et 3 a chaque recolte
  const amount = Phaser.Math.Between(1, 3);

  let gainedItems = 0;
  let gainedXp = 0;

  if (resourceDef && player.inventory) {
    const remaining = addItem(player.inventory, resourceDef.itemId, amount);
    gainedItems = amount - remaining;

    // XP de metier : fixe par récolte (indépendant de la quantité obtenue)
    gainedXp =
      typeof resourceDef.xpHarvest === "number" && resourceDef.xpHarvest > 0
        ? resourceDef.xpHarvest
        : BUCHERON_XP_PER_HARVEST;

    addBucheronXp(player, gainedXp);
    const state = ensureBucheronState(player);
    // Informe le store qu'un métier a changé.
    emitStoreEvent("metier:updated", { id: "bucheron", state });
  }

  node.harvested = true;

  const result = { success: true, node, gainedItems, gainedXp };
  // eslint-disable-next-line no-console
  console.log("[Bucheron] harvestTree resultat :", result);
  return result;
}
