// Logique de base du metier alchimiste : recolte, inventaire, XP.

import { addItem } from "../../inventory/runtime/inventoryAuthority.js";
import { alchimisteResources } from "./resources.js";
import { addAlchimisteXp, ensureAlchimisteState } from "./state.js";
import { emit as emitStoreEvent } from "../../../state/store.js";

const ALCHIMISTE_XP_PER_HARVEST = 8;

/**
 * Verifie rapidement si le joueur peut interagir avec une plante.
 */
export function canHarvestHerb(player, node) {
  if (!player || !node) return false;
  if (node.harvested) return false;
  return true;
}

/**
 * Effectue la recolte d'une plante :
 * - ajoute les ressources a l'inventaire (si possible)
 * - ajoute de l'XP metier alchimiste
 * - marque le node comme recolte.
 */
export function harvestHerb(scene, player, node) {
  if (!canHarvestHerb(player, node)) {
    return { success: false, node };
  }

  const resourceDef = alchimisteResources[node.resourceId];
  const amount = Phaser.Math.Between(1, 5);

  let gainedItems = 0;
  let gainedXp = 0;

  if (resourceDef && player.inventory) {
    const remaining = addItem(player.inventory, resourceDef.itemId, amount);
    gainedItems = amount - remaining;

    gainedXp =
      typeof resourceDef.xpHarvest === "number" && resourceDef.xpHarvest > 0
        ? resourceDef.xpHarvest
        : ALCHIMISTE_XP_PER_HARVEST;

    addAlchimisteXp(player, gainedXp);
    const state = ensureAlchimisteState(player);
    emitStoreEvent("metier:updated", { id: "alchimiste", state });
  }

  node.harvested = true;

  const result = { success: true, node, gainedItems, gainedXp };
  // eslint-disable-next-line no-console
  console.log("[Alchimiste] harvestHerb resultat :", result);
  return result;
}
