import {
  addItem as addItemLocal,
  addItemToLastSlot as addItemToLastSlotLocal,
  removeItem as removeItemLocal,
  getItemDef,
} from "./inventoryCore.js";
import { getInventoryOpKey } from "../../../net/lanClient.js";

function sendInventoryOp(op, itemId, qty) {
  if (typeof window === "undefined") return;
  if (window.__lanInventoryAuthority !== true) return;
  const client = window.__lanClient;
  const playerId = window.__netPlayerId;
  if (!client || !Number.isInteger(playerId)) return;
  if (!itemId || qty <= 0) return;
  const invKey = getInventoryOpKey();
  if (!invKey) return;
  try {
    client.sendCmd("CmdInventoryOp", {
      playerId,
      op,
      itemId,
      qty,
      __invKey: invKey,
    });
  } catch {
    // ignore network errors
  }
}

export function addItem(container, itemId, qty) {
  const remaining = addItemLocal(container, itemId, qty);
  const added = Math.max(0, qty - remaining);
  if (added > 0) {
    sendInventoryOp("add", itemId, added);
  }
  return remaining;
}

export function removeItem(container, itemId, qty) {
  const removed = removeItemLocal(container, itemId, qty);
  if (removed > 0) {
    sendInventoryOp("remove", itemId, removed);
  }
  return removed;
}

export function addItemToLastSlot(container, itemId, qty) {
  const remaining = addItemToLastSlotLocal(container, itemId, qty);
  const added = Math.max(0, qty - remaining);
  if (added > 0) {
    sendInventoryOp("add", itemId, added);
  }
  return remaining;
}

export { getItemDef };
