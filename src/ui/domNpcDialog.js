let currentNpc = null;

function getElements() {
  const panel = document.getElementById("npc-dialog-panel");
  if (!panel) return null;

  const nameEl = document.getElementById("npc-dialog-name");
  const speakerNpcEl = document.getElementById("npc-dialog-speaker-npc");
  const textEl = document.getElementById("npc-dialog-text");
  const choiceBtn = document.getElementById("npc-dialog-choice-1");

  return { panel, nameEl, speakerNpcEl, textEl, choiceBtn };
}

function closeNpcDialog() {
  const els = getElements();
  if (!els) return;
  document.body.classList.remove("npc-dialog-open");
  currentNpc = null;
}

export function openNpcDialog(npc, player) {
  const els = getElements();
  if (!els) return;
  const { panel, nameEl, speakerNpcEl, textEl, choiceBtn } = els;

  currentNpc = npc || null;

  const npcName = npc?.def?.name || "PNJ";

  if (nameEl) {
    nameEl.textContent = npcName;
  }
  if (speakerNpcEl) {
    speakerNpcEl.textContent = npcName;
  }

  if (textEl) {
    textEl.textContent = "Bonjour.";
  }

  if (choiceBtn) {
    choiceBtn.textContent = "Bonjour.";
    choiceBtn.onclick = () => {
      // Pour l'instant, répondre "Bonjour." ferme juste le dialogue.
      closeNpcDialog();
    };
  }

  panel.setAttribute("aria-hidden", "false");
  document.body.classList.add("npc-dialog-open");
}
