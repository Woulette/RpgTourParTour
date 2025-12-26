import { openShopPanel } from "../ui/domShop.js";
import { startNpcDialogFlow } from "./dialogFlow.js";

export function startNpcInteraction(scene, player, npc) {
  if (!scene || !player || !npc || !npc.sprite) return;

  if (npc.type === "merchant") {
    openShopPanel(scene, player, npc);
    return;
  }

  startNpcDialogFlow(scene, player, npc);
}
