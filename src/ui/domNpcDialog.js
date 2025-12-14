let currentNpc = null;
let currentDialog = null;

function getElements() {
  const panel = document.getElementById("npc-dialog-panel");
  if (!panel) return null;

  const nameEl = document.getElementById("npc-dialog-name");
  const speakerNpcEl = document.getElementById("npc-dialog-speaker-npc");
  const textEl = document.getElementById("npc-dialog-text");
  const choiceBtn = document.getElementById("npc-dialog-choice-1");
  const questBadge = document.getElementById("npc-dialog-quest-badge");
  const closeBtn = document.getElementById("npc-dialog-close");

  return {
    panel,
    nameEl,
    speakerNpcEl,
    textEl,
    choiceBtn,
    questBadge,
    closeBtn,
  };
}

function closeNpcDialog() {
  const els = getElements();
  if (!els) return;
  document.body.classList.remove("npc-dialog-open");
  currentNpc = null;
  currentDialog = null;
}

export function openNpcDialog(npc, player, dialogData) {
  const els = getElements();
  if (!els) return;
  const {
    panel,
    nameEl,
    speakerNpcEl,
    textEl,
    choiceBtn,
    questBadge,
    closeBtn,
  } = els;

  currentNpc = npc || null;
  currentDialog = dialogData || null;

  const npcName = npc?.def?.name || "PNJ";

  if (nameEl) {
    nameEl.textContent = npcName;
  }
  if (speakerNpcEl) {
    speakerNpcEl.textContent = npcName;
  }

  if (textEl) {
    textEl.textContent = dialogData?.text || "Bonjour.";
  }

  if (choiceBtn) {
    choiceBtn.textContent = dialogData?.choice || "À plus tard.";
    choiceBtn.onclick = () => {
      if (dialogData && typeof dialogData.onChoice === "function") {
        dialogData.onChoice();
      }
      if (dialogData?.closeOnChoice !== false) {
        closeNpcDialog();
      }
    };
  }

  if (closeBtn) {
    closeBtn.onclick = () => {
      closeNpcDialog();
    };
  }

  if (questBadge) {
    const symbol =
      dialogData && dialogData.questOffer
        ? "!"
        : dialogData && dialogData.questTurnIn
          ? "?"
          : "";
    const shouldShow = Boolean(symbol);
    questBadge.textContent = symbol;
    questBadge.classList.toggle("npc-dialog-quest-badge-visible", shouldShow);
    questBadge.setAttribute("aria-hidden", shouldShow ? "false" : "true");
  }

  panel.setAttribute("aria-hidden", "false");
  document.body.classList.add("npc-dialog-open");
}

