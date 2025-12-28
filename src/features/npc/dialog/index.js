import { papiDialog } from "./papi.js";
import { memeDialog } from "./meme.js";
import { dungeonKeeperDialog } from "./dungeonKeeper.js";
import { mentorMap5Dialog } from "./mentorMap5.js";
import { alchimisteProvisoireDialog } from "./alchimisteProvisoire.js";
import { maireDialog } from "./maire.js";
import { marchandDialog } from "./marchand.js";

const NPC_DIALOGS = {
  papi_bucheron: papiDialog,
  meme_village: memeDialog,
  donjon_aluineeks_keeper: dungeonKeeperDialog,
  donjonaluineekspnj: dungeonKeeperDialog,
  donjonaluineekspnj_north: dungeonKeeperDialog,
  mentor_map5: mentorMap5Dialog,
  alchimiste_provisoire: alchimisteProvisoireDialog,
  maire_albinos: maireDialog,
  maire_albinos_north: maireDialog,
  maire_albinos_marchand: maireDialog,
  marchand_boutique: marchandDialog,
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
