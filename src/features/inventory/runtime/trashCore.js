import { getItemDef } from "./inventoryCore.js";
import { emit as emitStoreEvent } from "../../../state/store.js";

const DEFAULT_TRASH_SIZE = 50;
const TRASH_TTL_MS = 24 * 60 * 60 * 1000;

export function createTrashContainer(size = DEFAULT_TRASH_SIZE) {
  const safeSize = Number.isFinite(size) && size > 0 ? size : DEFAULT_TRASH_SIZE;
  return {
    size: safeSize,
    slots: new Array(safeSize).fill(null),
  };
}

export function ensureTrashContainer(player, size = DEFAULT_TRASH_SIZE) {
  if (!player) return null;
  if (!player.trash || !Array.isArray(player.trash.slots)) {
    player.trash = createTrashContainer(size);
    return player.trash;
  }
  const desiredSize = Number.isFinite(size) && size > 0 ? size : player.trash.size;
  if (!Number.isFinite(player.trash.size) || player.trash.size <= 0) {
    player.trash.size = player.trash.slots.length || desiredSize || DEFAULT_TRASH_SIZE;
  }
  if (Number.isFinite(desiredSize) && desiredSize > player.trash.size) {
    player.trash.size = desiredSize;
  }
  if (player.trash.slots.length > player.trash.size) {
    player.trash.slots = player.trash.slots.slice(0, player.trash.size);
  }
  while (player.trash.slots.length < player.trash.size) {
    player.trash.slots.push(null);
  }
  return player.trash;
}

function findEmptyTrashSlot(container) {
  for (let i = 0; i < container.size; i += 1) {
    if (!container.slots[i]) return i;
  }
  return -1;
}

export function purgeExpiredTrash(container, now = Date.now()) {
  if (!container || !Array.isArray(container.slots)) return 0;
  let removed = 0;
  for (let i = 0; i < container.size; i += 1) {
    const slot = container.slots[i];
    if (!slot) continue;
    if (typeof slot.expiresAt === "number" && slot.expiresAt <= now) {
      container.slots[i] = null;
      removed += 1;
    }
  }
  if (removed > 0) {
    emitStoreEvent("trash:updated", { container });
  }
  return removed;
}

export function canAddItemToTrash(container, itemId, qty) {
  if (!container || !Array.isArray(container.slots) || !itemId || qty <= 0) {
    return false;
  }
  const def = getItemDef(itemId);
  if (!def) return false;
  const maxStack = def.maxStack ?? 9999;
  let remaining = qty;

  if (def.stackable) {
    for (let i = 0; i < container.size; i += 1) {
      const slot = container.slots[i];
      if (!slot || slot.itemId !== itemId) continue;
      if (slot.qty < maxStack) {
        remaining -= Math.min(maxStack - slot.qty, remaining);
        if (remaining <= 0) return true;
      }
    }
  }

  const emptySlots = container.slots.filter((slot) => !slot).length;
  if (def.stackable) {
    return emptySlots * maxStack >= remaining;
  }
  return emptySlots >= remaining;
}

export function addItemToTrash(container, itemId, qty, now = Date.now()) {
  if (!container || !Array.isArray(container.slots) || !itemId || qty <= 0) {
    return qty;
  }

  purgeExpiredTrash(container, now);

  const def = getItemDef(itemId);
  if (!def) return qty;
  const maxStack = def.maxStack ?? 9999;
  const expiresAt = now + TRASH_TTL_MS;

  let remaining = qty;

  if (def.stackable) {
    for (let i = 0; i < container.size; i += 1) {
      const slot = container.slots[i];
      if (!slot || slot.itemId !== itemId) continue;
      if (slot.qty >= maxStack) continue;
      const addNow = Math.min(maxStack - slot.qty, remaining);
      slot.qty += addNow;
      slot.expiresAt = Math.max(slot.expiresAt || 0, expiresAt);
      remaining -= addNow;
      if (remaining <= 0) break;
    }
  }

  while (remaining > 0) {
    const idx = findEmptyTrashSlot(container);
    if (idx === -1) break;
    const addNow = def.stackable ? Math.min(maxStack, remaining) : 1;
    container.slots[idx] = { itemId, qty: addNow, expiresAt };
    remaining -= addNow;
    if (!def.stackable) {
      if (remaining <= 0) break;
    }
  }

  if (remaining !== qty) {
    emitStoreEvent("trash:updated", { container });
  }
  return remaining;
}

export function removeTrashSlot(container, slotIndex) {
  if (!container || !Array.isArray(container.slots)) return null;
  if (!Number.isFinite(slotIndex)) return null;
  if (slotIndex < 0 || slotIndex >= container.size) return null;
  const slot = container.slots[slotIndex];
  if (!slot) return null;
  container.slots[slotIndex] = null;
  emitStoreEvent("trash:updated", { container });
  return slot;
}

export function getTrashTtlMs() {
  return TRASH_TTL_MS;
}
