import { openShopPanel } from "../../ui/domShop.js";
import { openMarketPanel } from "../../ui/domMarket.js";
import { startNpcDialogFlow } from "./dialogFlow.js";
import { getNpcMarker } from "../../quests/index.js";

export function startNpcInteraction(scene, player, npc) {
  if (!scene || !player || !npc || !npc.sprite) return;

  if (npc.type === "merchant") {
    const marker = typeof npc.id === "string" ? getNpcMarker(player, npc.id) : null;
    if (marker) {
      startNpcDialogFlow(scene, player, npc);
      return;
    }
    if (npc.def?.marketId) {
      openMarketPanel(scene, player, npc);
      return;
    }
    openShopPanel(scene, player, npc);
    return;
  }

  startNpcDialogFlow(scene, player, npc);
}
