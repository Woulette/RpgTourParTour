function createPlayerHelpers({ getItemDefs, MAX_INV_SIZE, MAX_QTY_PER_OP }) {
  function sanitizeInventorySnapshot(raw) {
    if (!raw || typeof raw !== "object") return null;
    const size =
      Number.isInteger(raw.size) && raw.size > 0 && raw.size <= 200
        ? raw.size
        : null;
    if (!size) return null;
    const slots = Array.isArray(raw.slots) ? raw.slots.slice(0, size) : [];
    while (slots.length < size) slots.push(null);

    const cleanSlots = slots.map((slot) => {
      if (!slot || typeof slot !== "object") return null;
      const itemId = typeof slot.itemId === "string" ? slot.itemId : null;
      const qty =
        Number.isInteger(slot.qty) && slot.qty > 0 ? Math.min(slot.qty, 9999) : null;
      if (!itemId || qty === null) return null;
      return { itemId, qty };
    });

    const autoGrow =
      raw.autoGrow && typeof raw.autoGrow === "object"
        ? {
            enabled: raw.autoGrow.enabled === true,
            minEmptySlots:
              Number.isInteger(raw.autoGrow.minEmptySlots) && raw.autoGrow.minEmptySlots >= 0
                ? raw.autoGrow.minEmptySlots
                : 0,
            growBy:
              Number.isInteger(raw.autoGrow.growBy) && raw.autoGrow.growBy > 0
                ? raw.autoGrow.growBy
                : 0,
          }
        : null;

    return {
      size,
      slots: cleanSlots,
      autoGrow,
    };
  }

  function isInventoryEmpty(inv) {
    if (!inv || !Array.isArray(inv.slots)) return true;
    return inv.slots.every(
      (slot) =>
        !slot ||
        typeof slot.itemId !== "string" ||
        !Number.isInteger(slot.qty) ||
        slot.qty <= 0
    );
  }

  function snapshotInventory(inv) {
    if (!inv) return null;
    return {
      size: inv.size,
      slots: inv.slots.map((slot) =>
        slot && typeof slot.itemId === "string" && Number.isInteger(slot.qty)
          ? { itemId: slot.itemId, qty: slot.qty }
          : null
      ),
      autoGrow: inv.autoGrow ? { ...inv.autoGrow } : null,
    };
  }

  function restoreInventory(inv, snapshot) {
    if (!inv || !snapshot) return;
    inv.size = snapshot.size;
    inv.slots = Array.isArray(snapshot.slots)
      ? snapshot.slots.map((slot) =>
          slot && typeof slot.itemId === "string" && Number.isInteger(slot.qty)
            ? { itemId: slot.itemId, qty: slot.qty }
            : null
        )
      : [];
    while (inv.slots.length < inv.size) inv.slots.push(null);
    inv.autoGrow = snapshot.autoGrow ? { ...snapshot.autoGrow } : null;
  }

  function ensureMetierState(player, metierId) {
    if (!player || !metierId) return null;
    if (!player.metiers) player.metiers = {};
    if (!player.metiers[metierId]) {
      player.metiers[metierId] = { level: 1, xp: 0, xpNext: 100 };
    }
    const state = player.metiers[metierId];
    state.level = Number.isInteger(state.level) && state.level > 0 ? state.level : 1;
    state.xp = Number.isFinite(state.xp) ? state.xp : 0;
    state.xpNext =
      Number.isInteger(state.xpNext) && state.xpNext > 0
        ? state.xpNext
        : state.level * 100;
    return state;
  }

  function addMetierXp(player, metierId, amount) {
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const state = ensureMetierState(player, metierId);
    if (!state) return null;
    state.xp += amount;
    while (state.xp >= state.xpNext) {
      state.xp -= state.xpNext;
      state.level += 1;
      state.xpNext = state.level * 100;
    }
    return state;
  }

  function sanitizeLevel(raw) {
    if (!Number.isFinite(raw)) return null;
    const lvl = Math.round(raw);
    if (lvl < 1 || lvl > 200) return null;
    return lvl;
  }

  function sanitizeJsonPayload(raw, maxLen) {
    if (raw == null) return null;
    if (typeof raw !== "object") return null;
    try {
      const json = JSON.stringify(raw);
      if (Number.isInteger(maxLen) && json.length > maxLen) return null;
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  function sanitizeEquipment(raw) {
    if (!raw || typeof raw !== "object") return null;
    const slots = [
      "head",
      "cape",
      "amulet",
      "weapon",
      "ring1",
      "ring2",
      "belt",
      "boots",
    ];
    const cleaned = {};
    for (const slot of slots) {
      const entry = raw[slot];
      if (!entry || typeof entry !== "object") {
        cleaned[slot] = null;
        continue;
      }
      const itemId = typeof entry.itemId === "string" ? entry.itemId : null;
      cleaned[slot] = itemId ? { itemId } : null;
    }
    return cleaned;
  }

  function sanitizeBaseStats(raw) {
    if (!raw || typeof raw !== "object") return null;
    const allowed = new Set([
      "force",
      "intelligence",
      "agilite",
      "chance",
      "tacle",
      "fuite",
      "pods",
      "dommagesCrit",
      "soins",
      "resistanceFixeTerre",
      "resistanceFixeFeu",
      "resistanceFixeAir",
      "resistanceFixeEau",
      "prospection",
      "critChancePct",
      "puissance",
      "vitalite",
      "initiative",
      "sagesse",
      "hpMax",
      "hp",
      "pa",
      "pm",
      "pushDamage",
      "dommage",
      "dommageFeu",
      "dommageEau",
      "dommageAir",
      "dommageTerre",
      "baseTacle",
      "baseFuite",
      "basePods",
      "baseDommagesCrit",
      "baseSoins",
      "baseResistanceFixeTerre",
      "baseResistanceFixeFeu",
      "baseResistanceFixeAir",
      "baseResistanceFixeEau",
      "baseProspection",
      "baseCritChancePct",
      "basePuissance",
      "baseVitalite",
      "baseInitiative",
      "baseSagesse",
      "hpRegen",
      "hpRegenPercent",
      "bonusDamagePercent",
      "bonusDamageCritPercent",
      "bonusDamageDistancePercent",
      "bonusDamageMeleePercent",
      "bonusDamageMeleeCritPercent",
      "bonusDamageDistanceCritPercent",
      "resistancePercentTerre",
      "resistancePercentFeu",
      "resistancePercentAir",
      "resistancePercentEau",
      "resistancePercentNeutre",
      "resistanceFixeNeutre",
      "dommageNeutre",
      "baseDommageNeutre",
    ]);
    const cleaned = {};
    for (const [key, value] of Object.entries(raw)) {
      if (!allowed.has(key)) continue;
      if (!Number.isFinite(value)) continue;
      cleaned[key] = value;
    }
    return Object.keys(cleaned).length > 0 ? cleaned : null;
  }

  function summarizeInventory(inv) {
    if (!inv || !Array.isArray(inv.slots)) return new Map();
    const summary = new Map();
    inv.slots.forEach((slot) => {
      if (!slot || typeof slot.itemId !== "string") return;
      const qty = Number.isInteger(slot.qty) ? slot.qty : 0;
      if (qty <= 0) return;
      summary.set(slot.itemId, (summary.get(slot.itemId) || 0) + qty);
    });
    return summary;
  }

  function diffInventory(beforeInv, afterInv) {
    const before = summarizeInventory(beforeInv);
    const after = summarizeInventory(afterInv);
    const deltas = [];
    const itemIds = new Set([...before.keys(), ...after.keys()]);
    for (const itemId of itemIds) {
      const delta = (after.get(itemId) || 0) - (before.get(itemId) || 0);
      if (delta !== 0) {
        deltas.push({ itemId, delta });
      }
    }
    deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    return deltas;
  }

  function logAntiDup(entry) {
    if (!entry) return;
    try {
      const fs = require("fs");
      const path = require("path");
      const logPath = path.resolve(__dirname, "..", "..", "data", "anti_dup.log");
      const line = `${JSON.stringify(entry)}\n`;
      fs.appendFile(logPath, line, "utf8", () => {});
    } catch {
      // ignore logging errors
    }
  }

  function getItemDef(itemId) {
    const defs = typeof getItemDefs === "function" ? getItemDefs() : null;
    if (!defs || !itemId) return null;
    return defs[itemId] || null;
  }

  function ensurePlayerInventory(player) {
    if (player.inventory && Array.isArray(player.inventory.slots)) {
      return normalizeInventory(player.inventory);
    }
    const size = 50;
    player.inventory = {
      size,
      slots: new Array(size).fill(null),
      autoGrow: { enabled: true, minEmptySlots: 10, growBy: 5 },
    };
    return normalizeInventory(player.inventory);
  }

  function normalizeInventory(inv) {
    if (!inv || !Array.isArray(inv.slots)) return inv;
    let size = Number.isInteger(inv.size) ? inv.size : inv.slots.length;
    if (!Number.isInteger(size) || size <= 0) size = inv.slots.length || 50;
    if (Number.isInteger(MAX_INV_SIZE) && size > MAX_INV_SIZE) {
      size = MAX_INV_SIZE;
    }
    inv.size = size;
    if (inv.slots.length > size) {
      inv.slots = inv.slots.slice(0, size);
    }
    while (inv.slots.length < size) inv.slots.push(null);
    inv.slots = inv.slots.map((slot) => {
      if (!slot || typeof slot !== "object") return null;
      const itemId = typeof slot.itemId === "string" ? slot.itemId : null;
      const qty =
        Number.isInteger(slot.qty) && slot.qty > 0 ? Math.min(slot.qty, 9999) : null;
      if (!itemId || qty === null) return null;
      return { itemId, qty };
    });
    return inv;
  }

  function countEmptySlots(inv) {
    if (!inv || !Array.isArray(inv.slots)) return 0;
    let empty = 0;
    for (let i = 0; i < inv.size; i += 1) {
      if (!inv.slots[i]) empty += 1;
    }
    return empty;
  }

  function maybeAutoGrow(inv) {
    const cfg = inv?.autoGrow;
    if (!cfg || cfg.enabled !== true) return;
    const minEmptySlots =
      Number.isFinite(cfg.minEmptySlots) && cfg.minEmptySlots >= 0
        ? cfg.minEmptySlots
        : 0;
    const growBy = Number.isFinite(cfg.growBy) && cfg.growBy > 0 ? cfg.growBy : 0;
    if (growBy <= 0) return;
    let empty = countEmptySlots(inv);
    while (empty < minEmptySlots) {
      inv.size += growBy;
      for (let i = 0; i < growBy; i += 1) inv.slots.push(null);
      empty += growBy;
    }
  }

  function findStackSlot(inv, itemId, maxStack) {
    for (let i = 0; i < inv.size; i += 1) {
      const slot = inv.slots[i];
      if (slot && slot.itemId === itemId && slot.qty < maxStack) return i;
    }
    return -1;
  }

  function findEmptySlot(inv) {
    for (let i = 0; i < inv.size; i += 1) {
      if (!inv.slots[i]) return i;
    }
    return -1;
  }

  function countItemInInventory(inv, itemId) {
    if (!inv || !Array.isArray(inv.slots) || !itemId) return 0;
    let total = 0;
    for (let i = 0; i < inv.size; i += 1) {
      const slot = inv.slots[i];
      if (!slot || slot.itemId !== itemId) continue;
      if (Number.isInteger(slot.qty) && slot.qty > 0) {
        total += slot.qty;
        if (Number.isInteger(MAX_QTY_PER_OP) && total >= MAX_QTY_PER_OP) return total;
      }
    }
    return total;
  }

  function addItemToInventory(inv, itemId, qty) {
    if (!inv || !itemId || qty <= 0) return 0;
    const def = getItemDef(itemId);
    const stackable = def?.stackable !== false;
    const maxStack =
      stackable && Number.isFinite(def?.maxStack) ? Math.max(1, def.maxStack) : 1;

    let remaining = qty;
    maybeAutoGrow(inv);
    const maxIterations =
      Math.max(1, Number.isInteger(inv.size) ? inv.size : 1) + remaining + 50;
    let iterations = 0;

    while (remaining > 0) {
      iterations += 1;
      if (iterations > maxIterations) {
        break;
      }
      let slotIndex = stackable ? findStackSlot(inv, itemId, maxStack) : -1;
      if (slotIndex === -1) {
        slotIndex = findEmptySlot(inv);
        if (slotIndex === -1) {
          maybeAutoGrow(inv);
          slotIndex = findEmptySlot(inv);
          if (slotIndex === -1) break;
        }
        inv.slots[slotIndex] = { itemId, qty: 0 };
      }

      const slot = inv.slots[slotIndex];
      if (!Number.isFinite(slot.qty)) slot.qty = 0;
      const space = Math.max(0, maxStack - slot.qty);
      const addNow = stackable ? Math.min(space, remaining) : 1;
      if (!Number.isFinite(addNow) || addNow <= 0) {
        break;
      }
      slot.qty += addNow;
      remaining -= addNow;
      if (!stackable) {
        // non-stackable: move to next slot each time
        continue;
      }
    }

    return qty - remaining;
  }

  function removeItemFromInventory(inv, itemId, qty) {
    if (!inv || !itemId || qty <= 0) return 0;
    let remaining = qty;
    let removed = 0;
    for (let i = 0; i < inv.size && remaining > 0; i += 1) {
      const slot = inv.slots[i];
      if (!slot || slot.itemId !== itemId) continue;
      const take = Math.min(slot.qty, remaining);
      slot.qty -= take;
      remaining -= take;
      removed += take;
      if (slot.qty <= 0) {
        inv.slots[i] = null;
      }
    }
    return removed;
  }

  return {
    sanitizeInventorySnapshot,
    isInventoryEmpty,
    snapshotInventory,
    restoreInventory,
    ensureMetierState,
    addMetierXp,
    sanitizeLevel,
    sanitizeJsonPayload,
    sanitizeEquipment,
    sanitizeBaseStats,
    summarizeInventory,
    diffInventory,
    logAntiDup,
    getItemDef,
    ensurePlayerInventory,
    normalizeInventory,
    countEmptySlots,
    maybeAutoGrow,
    findStackSlot,
    findEmptySlot,
    countItemInInventory,
    addItemToInventory,
    removeItemFromInventory,
  };
}

module.exports = {
  createPlayerHelpers,
};
