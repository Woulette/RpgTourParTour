import { items } from "./itemsConfig.js";
import { emit as emitStoreEvent } from "../state/store.js";

// Crée un inventaire simple avec un nombre fixe de slots.
export function createInventory(size = 20, options = {}) {
  return {
    size,
    slots: new Array(size).fill(null),
    autoGrow: options?.autoGrow || null,
  };
}

// Renvoie la définition d'objet ou null.
export function getItemDef(itemId) {
  return items[itemId] || null;
}

// Trouve un slot existant pour stacker (si possible).
function findStackSlot(container, itemId) {
  const def = getItemDef(itemId);
  if (!def || !def.stackable) return -1;

  const maxStack = def.maxStack ?? 9999;

  for (let i = 0; i < container.size; i += 1) {
    const slot = container.slots[i];
    if (slot && slot.itemId === itemId && slot.qty < maxStack) {
      return i;
    }
  }
  return -1;
}

// Trouve le premier slot vide.
function findEmptySlot(container) {
  for (let i = 0; i < container.size; i += 1) {
    if (!container.slots[i]) return i;
  }
  return -1;
}

function countEmptySlots(container) {
  let empty = 0;
  for (let i = 0; i < container.size; i += 1) {
    if (!container.slots[i]) empty += 1;
  }
  return empty;
}

function maybeAutoGrow(container) {
  const cfg = container?.autoGrow;
  if (!cfg || cfg.enabled !== true) return;

  const minEmptySlots =
    Number.isFinite(cfg.minEmptySlots) && cfg.minEmptySlots >= 0
      ? cfg.minEmptySlots
      : 0;
  const growBy = Number.isFinite(cfg.growBy) && cfg.growBy > 0 ? cfg.growBy : 0;

  if (growBy <= 0) return;

  let empty = countEmptySlots(container);
  while (empty < minEmptySlots) {
    container.size += growBy;
    for (let i = 0; i < growBy; i += 1) container.slots.push(null);
    empty += growBy;
  }
}

// Ajoute une quantité d'un objet à un inventaire.
// Retourne la quantité restante non ajoutée (0 si tout est entré).
export function addItem(container, itemId, qty) {
  let remaining = qty;
  const def = getItemDef(itemId);
  if (!def || qty <= 0) return remaining;

  // Si l'inventaire est configuré en auto-grow, on garde toujours un minimum de slots vides
  // pour éviter toute perte d'objets.
  maybeAutoGrow(container);

  const maxStack = def.maxStack ?? 9999;

  while (remaining > 0) {
    let slotIndex = findStackSlot(container, itemId);

    if (slotIndex === -1) {
      slotIndex = findEmptySlot(container);
      if (slotIndex === -1) {
        // Plus de place : auto-grow si activé, sinon on s'arrête.
        maybeAutoGrow(container);
        slotIndex = findEmptySlot(container);
        if (slotIndex === -1) break;
      }
      container.slots[slotIndex] = { itemId, qty: 0 };
    }

    const slot = container.slots[slotIndex];
    const space = maxStack - slot.qty;
    const addNow = Math.min(space, remaining);
    slot.qty += addNow;
    remaining -= addNow;
  }

  // Notification de mise à jour d'inventaire
  emitStoreEvent("inventory:updated", { container });
  return remaining;
}

// Retire une quantité d'un objet. Retourne la quantité effectivement retirée.
export function removeItem(container, itemId, qty) {
  let remaining = qty;
  let removed = 0;

  for (let i = 0; i < container.size && remaining > 0; i += 1) {
    const slot = container.slots[i];
    if (!slot || slot.itemId !== itemId) continue;

    const take = Math.min(slot.qty, remaining);
    slot.qty -= take;
    remaining -= take;
    removed += take;

    if (slot.qty <= 0) {
      container.slots[i] = null;
    }
  }

  if (removed > 0) {
    emitStoreEvent("inventory:updated", { container });
  }
  return removed;
}

// Déplace une quantité depuis un conteneur vers un autre.
// Retourne la quantité effectivement déplacée.
export function moveBetweenContainers(from, to, fromSlotIndex, qty) {
  const fromSlot = from.slots[fromSlotIndex];
  if (!fromSlot || qty <= 0) return 0;

  const itemId = fromSlot.itemId;
  const removable = Math.min(fromSlot.qty, qty);
  if (removable <= 0) return 0;

  const remainingAfterAdd = addItem(to, itemId, removable);
  const moved = removable - remainingAfterAdd;
  if (moved <= 0) return 0;

  fromSlot.qty -= moved;
  if (fromSlot.qty <= 0) {
    from.slots[fromSlotIndex] = null;
  }

  if (moved > 0) {
    emitStoreEvent("inventory:updated", { container: from });
    emitStoreEvent("inventory:updated", { container: to });
  }
  return moved;
}

// Renvoie les slots filtrés par une fonction (ex : par catégorie).
export function getSlotsByFilter(container, predicate) {
  const result = [];
  for (let i = 0; i < container.size; i += 1) {
    const slot = container.slots[i];
    if (!slot) continue;
    const def = getItemDef(slot.itemId);
    if (!def) continue;
    if (!predicate || predicate(def, slot, i)) {
      result.push({ index: i, slot, def });
    }
  }
  return result;
}

