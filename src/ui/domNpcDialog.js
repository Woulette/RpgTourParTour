let currentNpc = null;
let currentDialog = null;

function getElements() {
  const panel = document.getElementById("npc-dialog-panel");
  if (!panel) return null;

  const nameEl = document.getElementById("npc-dialog-name");
  const speakerNpcEl = document.getElementById("npc-dialog-speaker-npc");
  const textEl = document.getElementById("npc-dialog-text");
  const choiceBtn = document.getElementById("npc-dialog-choice-1");
  const choiceBtn2 = document.getElementById("npc-dialog-choice-2");
  const questBadge = document.getElementById("npc-dialog-quest-badge");
  const closeBtn = document.getElementById("npc-dialog-close");

  return {
    panel,
    nameEl,
    speakerNpcEl,
    textEl,
    choiceBtn,
    choiceBtn2,
    questBadge,
    closeBtn,
  };
}

function closeNpcDialog() {
  const els = getElements();
  if (!els) return;
  els.panel.setAttribute("aria-hidden", "true");
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
    choiceBtn2,
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
    choiceBtn.disabled = false;
    choiceBtn.onclick = () => {
      if (choiceBtn.disabled) return;
      choiceBtn.disabled = true;
      if (choiceBtn2) choiceBtn2.disabled = true;
      if (dialogData && typeof dialogData.onChoice === "function") {
        dialogData.onChoice();
      }
      if (dialogData?.closeOnChoice !== false) {
        closeNpcDialog();
      }
    };
  }

  if (choiceBtn2) {
    const choice2Text = dialogData?.choice2;
    if (choice2Text) {
      choiceBtn2.style.display = "";
      choiceBtn2.textContent = choice2Text;
      choiceBtn2.disabled = false;
      choiceBtn2.onclick = () => {
        if (choiceBtn2.disabled) return;
        choiceBtn2.disabled = true;
        if (choiceBtn) choiceBtn.disabled = true;
        if (dialogData && typeof dialogData.onChoice2 === "function") {
          dialogData.onChoice2();
        }
        const closeOnChoice2 =
          dialogData?.closeOnChoice2 === undefined
            ? dialogData?.closeOnChoice
            : dialogData?.closeOnChoice2;
        if (closeOnChoice2 !== false) {
          closeNpcDialog();
        }
      };
    } else {
      choiceBtn2.style.display = "none";
      choiceBtn2.disabled = true;
      choiceBtn2.onclick = null;
    }
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

