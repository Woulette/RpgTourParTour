import { on as onStoreEvent } from "../../../state/store.js";
import { incrementCraftProgress } from "../state.js";

let questRuntimeInitialized = false;
let questRuntimeUnsubs = [];

export function initQuestRuntime(player) {
  if (questRuntimeInitialized) return;
  if (!player) return;

  const unsub = onStoreEvent("craft:completed", (payload) => {
    const itemId = payload?.itemId || payload?.recipeId;
    const qty = payload?.qty || 1;
    if (!itemId || qty <= 0) return;
    incrementCraftProgress(player, itemId, qty);
  });
  questRuntimeUnsubs.push(unsub);

  questRuntimeInitialized = true;
}

export function resetQuestRuntime() {
  if (!questRuntimeInitialized) return;
  questRuntimeUnsubs.forEach((unsub) => {
    try {
      unsub();
    } catch (err) {
      // ignore cleanup errors
    }
  });
  questRuntimeUnsubs = [];
  questRuntimeInitialized = false;
}
