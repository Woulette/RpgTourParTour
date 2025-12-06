import { openNpcDialog } from "../ui/domNpcDialog.js";
import { initDomQuests } from "../ui/domQuests.js";
import {
  getPrimaryQuestForNpc,
  getQuestState,
  QUEST_STATES,
  acceptQuest,
} from "../quests/index.js";

let questsUiInitialized = false;

export function startNpcInteraction(scene, player, npc) {
  if (!scene || !player || !npc || !npc.sprite) return;

  if (!questsUiInitialized) {
    initDomQuests(player);
    questsUiInitialized = true;
  }

  // Pour l'instant : pas de condition de distance,
  // tu peux parler au PNJ de n'importe où sur la map.

  const quest = getPrimaryQuestForNpc(npc.id);
  if (quest) {
    const state = getQuestState(player, quest.id);
    if (state && state.state === QUEST_STATES.NOT_STARTED) {
      acceptQuest(player, quest.id);
    }
  }

  openNpcDialog(npc, player);
}
