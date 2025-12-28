import { addItem } from "../../../inventory/inventoryCore.js";
import { clampNonNegativeFinite, getJobLevel, hasItem } from "./utils.js";

export function applyLootToPlayerInventory(player, loot) {
  const finalLoot = [];
  if (!player || !player.inventory || !Array.isArray(loot)) return finalLoot;

  for (const entry of loot) {
    if (!entry || !entry.itemId) continue;
    const qty = entry.qty ?? 0;
    if (qty <= 0) continue;

    const remaining = addItem(player.inventory, entry.itemId, qty);
    const gained = qty - remaining;
    if (gained <= 0) continue;

    let slot = finalLoot.find((l) => l.itemId === entry.itemId);
    if (!slot) {
      slot = { itemId: entry.itemId, qty: 0 };
      finalLoot.push(slot);
    }
    slot.qty += gained;
  }

  return finalLoot;
}

export function rollLootFromSources(lootSources, dropMultiplier = 1, player = null) {
  const sources = Array.isArray(lootSources) ? lootSources : [];
  const mult = clampNonNegativeFinite(dropMultiplier) || 1;

  const aggregated = [];

  sources.forEach((src) => {
    const table = Array.isArray(src?.lootTable) ? src.lootTable : [];
    table.forEach((entry) => {
      if (!entry || !entry.itemId) return;

      const requiredJob = entry.requiresJob;
      if (requiredJob) {
        const minLevel =
          typeof entry.minJobLevel === "number" ? entry.minJobLevel : 1;
        if (getJobLevel(player, requiredJob) < minLevel) return;
      }

      const requiredItem =
        entry.requiresItem ||
        (typeof entry.itemId === "string" && entry.itemId.startsWith("essence_")
          ? "extracteur_essence"
          : null);
      if (requiredItem && !hasItem(player, requiredItem)) return;

      const baseRate = typeof entry.dropRate === "number" ? entry.dropRate : 1.0;
      const finalRate = Math.min(1, Math.max(0, baseRate * mult));
      if (Math.random() > finalRate) return;

      const min = entry.min ?? 1;
      const max = entry.max ?? min;
      const qty = Math.max(0, Phaser.Math.Between(min, max));
      if (qty <= 0) return;

      let slot = aggregated.find((l) => l.itemId === entry.itemId);
      if (!slot) {
        slot = { itemId: entry.itemId, qty: 0 };
        aggregated.push(slot);
      }
      slot.qty += qty;
    });
  });

  return aggregated;
}
