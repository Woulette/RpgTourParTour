import { papiDialog } from "./papi.js";
import { memeDialog } from "./meme.js";
import { memeQuestAddons } from "./memeQuestAddons.js";
import { dungeonKeeperDialog } from "./dungeonKeeper.js";
import { mentorMap5Dialog } from "./mentorMap5.js";
import { alchimisteProvisoireDialog } from "./alchimisteProvisoire.js";

const NPC_DIALOGS = {
  papi_bucheron: papiDialog,
  meme_village: {
    ...memeDialog,
    questDialogs: { ...(memeDialog.questDialogs || {}), ...memeQuestAddons },
  },
  donjon_aluineeks_keeper: dungeonKeeperDialog,
  mentor_map5: mentorMap5Dialog,
  alchimiste_provisoire: alchimisteProvisoireDialog,
};

export function getNpcDialog(npcId, questId, questState, stageId) {
  const def = NPC_DIALOGS[npcId];
  if (!def) return null;

  if (questId && def.questDialogs && def.questDialogs[questId]) {
    const questDialog = def.questDialogs[questId];
    if (stageId && questDialog[stageId]) {
      const byState = questDialog[stageId];
      if (questState && byState[questState]) {
        return byState[questState];
      }
    }
    if (questState && questDialog.__default && questDialog.__default[questState]) {
      return questDialog.__default[questState];
    }
  }

  return def.generic || null;
}
