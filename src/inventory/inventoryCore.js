import { items } from "./itemsConfig.js";

// Cr�e un inventaire simple avec un nombre fixe de slots.
export function createInventory(size = 20) {
  return {
    size,
    slots: new Array(size).fill(null),
  };
}

// Renvoie la d�finition d'objet ou null.
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

// Ajoute une quantit� d'un objet � un inventaire.
// Retourne la quantit� restante non ajout�e (0 si tout est entr�).
export function addItem(container, itemId, qty) {
  let remaining = qty;
  const def = getItemDef(itemId);
  if (!def || qty <= 0) return remaining;

  const maxStack = def.maxStack ?? 9999;

  while (remaining > 0) {
    let slotIndex = findStackSlot(container, itemId);

    if (slotIndex === -1) {
      slotIndex = findEmptySlot(container);
      if (slotIndex === -1) {
        // Plus de place
        break;
      }
      container.slots[slotIndex] = { itemId, qty: 0 };
    }

    const slot = container.slots[slotIndex];
    const space = maxStack - slot.qty;
    const addNow = Math.min(space, remaining);
    slot.qty += addNow;
    remaining -= addNow;
  }

  return remaining;
}

// Retire une quantit� d'un objet. Retourne la quantit� effectivement retir�e.
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

  return removed;
}

// D�place une quantit� depuis un conteneur vers un autre.
// Retourne la quantit� effectivement d�plac�e.
export function moveBetweenContainers(
  from,
  to,
  fromSlotIndex,
  qty,
) {
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

  return moved;
}

// Renvoie les slots filtr�s par une fonction (ex : par cat�gorie).
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

