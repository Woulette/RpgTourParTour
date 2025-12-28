import { emit as emitStoreEvent } from "../../../state/store.js";

export const DEPRECATED_ITEMS = new Set([
  "coiffe_corbeau",
  "cape_corbeau",
  "amulette_corbeau",
  "ceinture_corbeau",
  "bottes_corbeau",
  "anneau_corbeau",
]);

export function purgeDeprecatedItemsFromPlayer(player) {
  if (!player) return;

  let inventoryChanged = false;
  const inv = player.inventory;
  if (inv && Array.isArray(inv.slots)) {
    for (let i = 0; i < inv.slots.length; i += 1) {
      const slot = inv.slots[i];
      if (!slot || !slot.itemId) continue;
      if (!DEPRECATED_ITEMS.has(slot.itemId)) continue;
      inv.slots[i] = null;
      inventoryChanged = true;
    }
  }

  let equipmentChanged = false;
  const eq = player.equipment;
  if (eq && typeof eq === "object") {
    Object.keys(eq).forEach((slotKey) => {
      const entry = eq[slotKey];
      if (!entry || !entry.itemId) return;
      if (!DEPRECATED_ITEMS.has(entry.itemId)) return;
      eq[slotKey] = null;
      equipmentChanged = true;
    });
  }

  if (equipmentChanged && typeof player.recomputeStatsWithEquipment === "function") {
    player.recomputeStatsWithEquipment();
  }

  if (equipmentChanged) {
    emitStoreEvent("equipment:updated", { slot: "all" });
  }
  if (inventoryChanged) {
    emitStoreEvent("inventory:updated", { container: inv });
  }
}
