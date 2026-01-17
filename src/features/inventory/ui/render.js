import { getItemDef, removeItem } from "../runtime/inventoryAuthority.js";
import { equipFromInventory, unequipToInventory } from "../runtime/equipmentCore.js";
import { applyConsumableEffect } from "./consumables.js";

function isCombatLocked(player) {
  return !!player?.scene?.combatState?.enCours;
}

function sendEquipCmd(command, payload) {
  if (typeof window === "undefined") return false;
  if (window.__lanInventoryAuthority !== true) return false;
  const client = window.__lanClient;
  const playerId = window.__netPlayerId;
  if (!client || !Number.isInteger(playerId)) return false;
  try {
    client.sendCmd(command, { playerId, ...payload });
    return true;
  } catch {
    return false;
  }
}

function sendUseCmd(payload) {
  return sendEquipCmd("CmdUseItem", payload);
}

export function renderEquipmentSlots(player, equipSlots) {
  if (!equipSlots || equipSlots.length === 0) return;
  const equipment = player.equipment || {};

  equipSlots.forEach((slotEl) => {
    const equipSlot = slotEl.getAttribute("data-equip");
    slotEl.innerHTML = "";
    slotEl.classList.remove("filled");

    if (!equipSlot) return;

    const entry = equipment[equipSlot];
    if (!entry || !entry.itemId) return;

    const def = getItemDef(entry.itemId);
    if (!def) return;

    slotEl.classList.add("filled");

    if (def.icon) {
      const icon = document.createElement("div");
      icon.className = "inventory-slot-icon";
      icon.style.backgroundImage = `url("${def.icon}")`;
      slotEl.appendChild(icon);
    } else {
      const label = document.createElement("span");
      label.className = "inventory-slot-label";
      label.textContent = def.label || entry.itemId;
      slotEl.appendChild(label);
    }
  });
}

function buildInventorySlot(slotData, entryIndex, getPlayer, helpers, renderInventory) {
  const slot = document.createElement("button");
  slot.type = "button";
  slot.className = "inventory-slot";
  slot.dataset.index = String(entryIndex.virtualIndex);
  if (typeof entryIndex.realIndex === "number") {
    slot.dataset.realIndex = String(entryIndex.realIndex);
  }

  if (slotData) {
    const def = getItemDef(slotData.itemId);
    slot.classList.add("filled");

    if (def && def.icon) {
      const icon = document.createElement("div");
      icon.className = "inventory-slot-icon";
      icon.style.backgroundImage = `url("${def.icon}")`;
      slot.appendChild(icon);
    } else {
      const label = document.createElement("span");
      label.className = "inventory-slot-label";
      const baseName = def ? def.label : slotData.itemId;
      label.textContent = baseName;
      slot.appendChild(label);
    }

    if (slotData.qty > 1) {
      const qty = document.createElement("span");
      qty.className = "inventory-slot-qty";
      qty.textContent = String(slotData.qty);
      slot.appendChild(qty);
    }
  } else {
    slot.classList.add("empty");
  }

  slot.addEventListener("click", () => {
    const player = typeof getPlayer === "function" ? getPlayer() : null;
    if (!player) return;
    const idxAttr = slot.dataset.realIndex;
    const idx = idxAttr ? parseInt(idxAttr, 10) : NaN;
    const liveSlotData = Number.isNaN(idx) ? null : player.inventory?.slots?.[idx];
    if (!liveSlotData) {
      helpers.clearDetails();
      return;
    }
    helpers.showItemDetailsById(player, liveSlotData.itemId, helpers.dom);
  });

  slot.addEventListener("dblclick", () => {
    const player = typeof getPlayer === "function" ? getPlayer() : null;
    if (!player) return;
    if (isCombatLocked(player)) return;
    const idxAttr = slot.dataset.realIndex;
    const idx = idxAttr ? parseInt(idxAttr, 10) : NaN;
    const liveSlotData = Number.isNaN(idx) ? null : player.inventory?.slots?.[idx];
    if (!liveSlotData) return;
    const def = getItemDef(liveSlotData.itemId);
    if (!def) return;
    if (def.category === "consommable") {
      if (sendUseCmd({ inventorySlotIndex: idx })) {
        return;
      }
      const applied = applyConsumableEffect(player, def);
      if (applied) {
        removeItem(player.inventory, liveSlotData.itemId, 1);
        renderInventory();
      }
      return;
    }
    if (def.category !== "equipement") return;

    if (sendEquipCmd("CmdEquipItem", { inventorySlotIndex: idx })) {
      return;
    }
    const ok = equipFromInventory(player, player.inventory, idx);
    if (ok) {
      renderInventory();
    }
  });

  return slot;
}

export function renderInventoryGrid({
  player,
  getPlayer,
  grid,
  currentFilter,
  helpers,
  updateGoldDisplay,
  renderInventory,
}) {
  const inv = player.inventory;
  if (!inv) return;

  grid.innerHTML = "";
  helpers.clearDetails();
  if (typeof updateGoldDisplay === "function") {
    updateGoldDisplay(player);
  }

  const filtered = [];
  for (let i = 0; i < inv.size; i += 1) {
    const slotData = inv.slots[i];
    if (!slotData) continue;
    const def = getItemDef(slotData.itemId);
    const cat = def?.category ?? "inconnu";
    if (currentFilter === "all" || cat === currentFilter) {
      filtered.push({ realIndex: i, slotData });
    }
  }

  for (let v = 0; v < inv.size; v += 1) {
    const entry = filtered[v] || null;
    const entryIndex = {
      virtualIndex: v,
      realIndex: entry ? entry.realIndex : null,
    };
    const slotData = entry ? entry.slotData : null;

    const slot = buildInventorySlot(
      slotData,
      entryIndex,
      getPlayer,
      helpers,
      renderInventory
    );
    grid.appendChild(slot);
  }
}

export function bindEquipmentSlotEvents(
  getPlayer,
  equipSlots,
  helpers,
  renderInventory
) {
  if (!equipSlots || equipSlots.length === 0) return;

  equipSlots.forEach((slotEl) => {
    const equipSlot = slotEl.getAttribute("data-equip");

    slotEl.addEventListener("click", () => {
      const player = typeof getPlayer === "function" ? getPlayer() : null;
      if (!player) return;
      if (!equipSlot) {
        helpers.clearDetails();
        return;
      }
      const equipment = player.equipment || {};
      const entry = equipment[equipSlot];
      if (!entry || !entry.itemId) {
        helpers.clearDetails();
        return;
      }
      helpers.showItemDetailsById(player, entry.itemId, helpers.dom);
    });

  slotEl.addEventListener("dblclick", () => {
    const player = typeof getPlayer === "function" ? getPlayer() : null;
    if (!player) return;
    if (isCombatLocked(player)) return;
    if (!equipSlot) return;
    if (sendEquipCmd("CmdUnequipItem", { equipSlot })) {
      return;
    }
    const ok = unequipToInventory(player, player.inventory, equipSlot);
    if (ok) {
        renderInventory();
      }
    });
  });
}
