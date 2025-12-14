import { on as onStoreEvent } from "../../state/store.js";
import { incrementCraftProgress } from "../state.js";

let questRuntimeInitialized = false;

export function initQuestRuntime(player) {
  if (questRuntimeInitialized) return;
  if (!player) return;

  onStoreEvent("craft:completed", (payload) => {
    const itemId = payload?.itemId || payload?.recipeId;
    const qty = payload?.qty || 1;
    if (!itemId || qty <= 0) return;
    incrementCraftProgress(player, itemId, qty);
  });

  questRuntimeInitialized = true;
}

