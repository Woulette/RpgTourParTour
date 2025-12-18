import { removeItem } from "../../inventory/inventoryCore.js";

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

export function isTurnInReadyAtNpc(player, questDef, state, stage, npcId) {
  if (!questDef || !state || !stage || !npcId) return false;
  if (state.state !== "in_progress") return false;
  const turnInNpcId = getTurnInNpcId(stage);
  if (turnInNpcId !== npcId) return false;

  const objective = stage.objective;
  if (!objective || !objective.type) return false;

  if (objective.type === "talk_to_npc") {
    return true;
  }

  if (objective.type === "kill_monster") {
    const required = objective.requiredCount || 1;
    const current = state.progress?.currentCount || 0;
    return current >= required;
  }

  if (objective.type === "deliver_item") {
    const required = objective.qty || 1;
    const current = countItemInInventory(player, objective.itemId);
    return current >= required;
  }

  if (objective.type === "craft_items") {
    const items = Array.isArray(objective.items) ? objective.items : [];
    const crafted = state.progress?.crafted || {};
    if (items.length === 0) return false;
    return items.every((it) => {
      if (!it || !it.itemId) return false;
      const required = it.qty || 1;
      const current = crafted[it.itemId] || 0;
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

  if (objective.type === "kill_monster") {
    const required = objective.requiredCount || 1;
    const current = state.progress?.currentCount || 0;
    if (current < required) return { ok: false, reason: "not_complete" };
    return { ok: true, consumed: [] };
  }

  if (objective.type === "craft_items") {
    const items = Array.isArray(objective.items) ? objective.items : [];
    const crafted = state.progress?.crafted || {};
    if (items.length === 0) return { ok: false };
    const complete = items.every((it) => {
      if (!it || !it.itemId) return false;
      const required = it.qty || 1;
      const current = crafted[it.itemId] || 0;
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
