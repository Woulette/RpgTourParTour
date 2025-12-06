import { getItemDef, addItem, removeItem } from "./inventoryCore.js";
import { applyBonuses } from "../core/stats.js";
import { equipmentSets } from "./sets.js";
import { emit as emitStoreEvent } from "../state/store.js";

// Slots d'équipement possibles pour un joueur
export const EQUIP_SLOTS = [
  "head",
  "cape",
  "amulet",
  "weapon",
  "ring1",
  "ring2",
  "belt",
  "boots",
];

// Crée un objet d'équipement vide pour un joueur
export function createEmptyEquipment() {
  const eq = {};
  for (const slot of EQUIP_SLOTS) {
    eq[slot] = null;
  }
  return eq;
}

// Recalcule les stats du joueur en partant de baseStats
// + bonus d'équipement simples + bonus de panoplie.
export function recomputePlayerStatsWithEquipment(player) {
  if (!player) return;

  // On considère toujours baseStats comme la source "nue" des stats joueur
  // (classe + points investis), sans équipement.
  const base = player.baseStats || player.stats || {};
  const bonuses = [];

  const equipment = player.equipment || {};
  const setCounts = {};

  // Bonus de chaque pièce + comptage des sets
  for (const slot of Object.keys(equipment)) {
    const entry = equipment[slot];
    if (!entry || !entry.itemId) continue;

    const def = getItemDef(entry.itemId);
    if (!def) continue;

    if (def.statsBonus) {
      bonuses.push(def.statsBonus);
    }

    if (def.setId) {
      setCounts[def.setId] = (setCounts[def.setId] || 0) + 1;
    }
  }

  // Bonus de panoplies (paliers)
  // On applique uniquement le palier le plus élevé atteint
  // (ex : 3 pièces => bonus du palier 3, mais pas celui de 2).
  for (const [setId, count] of Object.entries(setCounts)) {
    const setDef = equipmentSets[setId];
    if (!setDef || !setDef.thresholds) continue;

    let bestThreshold = -1;
    let bestBonus = null;

    for (const [thresholdStr, bonus] of Object.entries(setDef.thresholds)) {
      const threshold = parseInt(thresholdStr, 10);
      if (Number.isNaN(threshold)) continue;
      if (count >= threshold && bonus && threshold > bestThreshold) {
        bestThreshold = threshold;
        bestBonus = bonus;
      }
    }

    if (bestBonus) {
      bonuses.push(bestBonus);
    }
  }

  const newStats = applyBonuses(base, bonuses);

  // On essaye de ne pas "tuer" le joueur quand on réduit les HP max :
  const oldHp = player.stats?.hp ?? newStats.hp;

  // HP max = hpMax de base (niveau, etc.) + éventuels bonus directs hp/hpMax
  // + contribution de la Vitalité totale (base + équipement).
  const vit = newStats.vitalite ?? 0;
  const hpPerVit = 1; // 1 point de Vitalité = +1 PV max (ajustable)
  const baseHpMaxWithBonuses =
    newStats.hpMax ?? base.hpMax ?? oldHp ?? 0;
  const hpMax = baseHpMaxWithBonuses + vit * hpPerVit;

  newStats.hpMax = hpMax;
  newStats.hp = Math.min(oldHp, hpMax);

  player.stats = newStats;
}

// Équipe un objet à partir d'un slot d'inventaire.
// Retourne true si l'équipement a réussi.
export function equipFromInventory(player, inventory, inventorySlotIndex) {
  if (!player || !inventory) return false;

  const slot = inventory.slots[inventorySlotIndex];
  if (!slot || !slot.itemId) return false;

  const def = getItemDef(slot.itemId);
  if (!def || def.category !== "equipement") return false;

  const equipSlot = def.slot;
  if (!equipSlot) return false;

  if (!player.equipment) {
    player.equipment = createEmptyEquipment();
  }

  const currentEquip = player.equipment[equipSlot];

  // On retire 1 exemplaire de l'objet de l'inventaire
  const removed = removeItem(inventory, slot.itemId, 1);
  if (removed <= 0) return false;

  // Si quelque chose était déjà équipé ici, on essaie de le remettre dans l'inventaire
  if (currentEquip && currentEquip.itemId) {
    const rest = addItem(inventory, currentEquip.itemId, 1);
    if (rest > 0) {
      // pas de place, on annule l'équipement pour éviter de perdre l'objet
      addItem(inventory, slot.itemId, 1);
      return false;
    }
  }

  player.equipment[equipSlot] = { itemId: slot.itemId };
  recomputePlayerStatsWithEquipment(player);
  emitStoreEvent("equipment:updated", { slot: equipSlot });
  emitStoreEvent("inventory:updated", { container: inventory });
  return true;
}

// Déséquipe un slot et renvoie l'objet dans l'inventaire (si possible).
export function unequipToInventory(player, inventory, equipSlot) {
  if (!player || !inventory || !player.equipment) return false;

  const currentEquip = player.equipment[equipSlot];
  if (!currentEquip || !currentEquip.itemId) return false;

  const rest = addItem(inventory, currentEquip.itemId, 1);
  if (rest > 0) {
    // pas de place : on ne fait rien
    return false;
  }

  player.equipment[equipSlot] = null;
  recomputePlayerStatsWithEquipment(player);
  emitStoreEvent("equipment:updated", { slot: equipSlot });
  emitStoreEvent("inventory:updated", { container: inventory });
  return true;
}
