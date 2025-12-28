import { removeItem } from "../../inventory/runtime/inventoryCore.js";

export function getTurnInNpcId(stage) {
  return stage?.turnInNpcId || stage?.npcId || stage?.objective?.npcId || null;
}

export function countItemInInventory(player, itemId) {
  const inv = player?.inventory;
  if (!inv || !Array.isArray(inv.slots) || !itemId) return 0;
  let count = 0;
  inv.slots.forEach((slot) => {
    if (!slot || slot.itemId !== itemId) return;
    count += slot.qty || 0;
  });
  return count;
}

export function hasAppliedParchment(player, state) {
  return Boolean(state?.progress?.applied) || hasEquippedParchment(player);
}

export function hasEquippedParchment(player) {
  if (!player || !player.spellParchments) return false;
  return Object.keys(player.spellParchments).length > 0;
}

export function getCraftedCount(player, state, itemId) {
  if (!itemId) return 0;
  const crafted = state?.progress?.crafted?.[itemId] || 0;
  const inInventory = countItemInInventory(player, itemId);
  return Math.max(crafted, inInventory);
}

export function isTurnInReadyAtNpc(player, questDef, state, stage, npcId) {
  if (!questDef || !state || !stage || !npcId) return false;
  if (state.state !== "in_progress") return false;
  const turnInNpcId = getTurnInNpcId(stage);
  if (turnInNpcId !== npcId) return false;

  const objective = stage.objective;
  if (!objective || !objective.type) return false;

  if (objective.type === "talk_to_npc") {
    if (
      questDef?.id === "alchimiste_marchand_5" &&
      stage?.id === "apply_parchemin"
    ) {
      return hasAppliedParchment(player, state);
    }
    return true;
  }

  if (objective.type === "kill_monster") {
    const required = objective.requiredCount || 1;
    const current = state.progress?.currentCount || 0;
    return current >= required;
  }

  if (objective.type === "kill_monsters") {
    const list = Array.isArray(objective.monsters) ? objective.monsters : [];
    if (list.length === 0) return false;
    const kills = state.progress?.kills || {};
    return list.every((entry) => {
      if (!entry || !entry.monsterId) return false;
      const required = entry.requiredCount || 1;
      const current = kills[entry.monsterId] || 0;
      return current >= required;
    });
  }

  if (objective.type === "deliver_item") {
    const required = objective.qty || 1;
    const current = countItemInInventory(player, objective.itemId);
    return current >= required;
  }

  if (objective.type === "deliver_items") {
    const items = Array.isArray(objective.items) ? objective.items : [];
    if (items.length === 0) return false;
    return items.every((it) => {
      if (!it || !it.itemId) return false;
      const required = it.qty || 1;
      const current = countItemInInventory(player, it.itemId);
      return current >= required;
    });
  }

  if (objective.type === "craft_items") {
    const items = Array.isArray(objective.items) ? objective.items : [];
    if (items.length === 0) return false;
    return items.every((it) => {
      if (!it || !it.itemId) return false;
      const required = it.qty || 1;
      const current = getCraftedCount(player, state, it.itemId);
      return current >= required;
    });
  }

  if (objective.type === "craft_set") {
    const requiredSlots = Array.isArray(objective.requiredSlots)
      ? objective.requiredSlots.filter(Boolean)
      : [];
    const required =
      requiredSlots.length > 0 ? requiredSlots.length : objective.requiredCount || 1;
    const current = state.progress?.currentCount || 0;
    return current >= required;
  }

  return false;
}

export function tryTurnInStage(scene, player, questId, questDef, state, stage) {
  if (!player || !questId || !questDef || !state || !stage) {
    return { ok: false };
  }

  const objective = stage.objective;
  if (!objective || !objective.type) return { ok: false };

  if (objective.type === "talk_to_npc") {
    if (
      questDef?.id === "alchimiste_marchand_5" &&
      stage?.id === "apply_parchemin" &&
      !hasAppliedParchment(player, state)
    ) {
      return { ok: false, reason: "not_complete" };
    }
    const required = objective.requiredCount || 1;
    state.progress = state.progress || {};
    state.progress.currentCount = required;
    return { ok: true, consumed: [] };
  }

  if (objective.type === "deliver_item") {
    const required = objective.qty || 1;
    const current = countItemInInventory(player, objective.itemId);
    if (current < required) {
      return { ok: false, reason: "missing_items", missing: required - current };
    }

    const consume = objective.consume !== false;
    if (consume) {
      const removed = removeItem(player.inventory, objective.itemId, required);
      if (removed < required) {
        return { ok: false, reason: "missing_items", missing: required - removed };
      }
    }

    return {
      ok: true,
      consumed: consume ? [{ itemId: objective.itemId, qty: required }] : [],
    };
  }

  if (objective.type === "deliver_items") {
    const items = Array.isArray(objective.items) ? objective.items : [];
    if (items.length === 0) return { ok: false };

    const missing = items
      .filter((it) => it && it.itemId)
      .map((it) => {
        const required = it.qty || 1;
        const current = countItemInInventory(player, it.itemId);
        return { itemId: it.itemId, required, current };
      })
      .filter((it) => it.current < it.required);

    if (missing.length > 0) {
      return { ok: false, reason: "missing_items" };
    }

    const consume = objective.consume !== false;
    if (consume) {
      for (const it of items) {
        if (!it || !it.itemId) continue;
        const required = it.qty || 1;
        const removed = removeItem(player.inventory, it.itemId, required);
        if (removed < required) {
          return { ok: false, reason: "missing_items" };
        }
      }
    }

    return {
      ok: true,
      consumed: consume
        ? items
            .filter((it) => it && it.itemId)
            .map((it) => ({ itemId: it.itemId, qty: it.qty || 1 }))
        : [],
    };
  }

  if (objective.type === "kill_monster") {
    const required = objective.requiredCount || 1;
    const current = state.progress?.currentCount || 0;
    if (current < required) return { ok: false, reason: "not_complete" };
    return { ok: true, consumed: [] };
  }

  if (objective.type === "kill_monsters") {
    const list = Array.isArray(objective.monsters) ? objective.monsters : [];
    if (list.length === 0) return { ok: false, reason: "not_complete" };
    const kills = state.progress?.kills || {};
    const complete = list.every((entry) => {
      if (!entry || !entry.monsterId) return false;
      const required = entry.requiredCount || 1;
      const current = kills[entry.monsterId] || 0;
      return current >= required;
    });
    if (!complete) return { ok: false, reason: "not_complete" };
    return { ok: true, consumed: [] };
  }

  if (objective.type === "craft_items") {
    const items = Array.isArray(objective.items) ? objective.items : [];
    if (items.length === 0) return { ok: false };
    const complete = items.every((it) => {
      if (!it || !it.itemId) return false;
      const required = it.qty || 1;
      const current = getCraftedCount(player, state, it.itemId);
      return current >= required;
    });
    if (!complete) return { ok: false, reason: "not_complete" };
    return { ok: true, consumed: [] };
  }

  if (objective.type === "craft_set") {
    const requiredSlots = Array.isArray(objective.requiredSlots)
      ? objective.requiredSlots.filter(Boolean)
      : [];
    const required =
      requiredSlots.length > 0 ? requiredSlots.length : objective.requiredCount || 1;
    const current = state.progress?.currentCount || 0;
    if (current < required) return { ok: false, reason: "not_complete" };
    return { ok: true, consumed: [] };
  }

  return { ok: false };
}
