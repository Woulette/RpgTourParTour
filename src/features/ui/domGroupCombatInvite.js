let inviteOverlayEl = null;
let inviteCardEl = null;
let inviteTitleEl = null;
let inviteTextEl = null;
let inviteTimerEl = null;
let inviteJoinBtn = null;
let inviteCloseBtn = null;
let currentInvite = null;
let closeTimer = null;
let countdownTimer = null;
let onJoinCb = null;
let onCloseCb = null;

function ensureInviteModal() {
  if (inviteOverlayEl) return;

  inviteOverlayEl = document.createElement("div");
  inviteOverlayEl.className = "group-combat-invite";

  inviteOverlayEl.innerHTML = `
    <div class="group-combat-card" role="dialog" aria-modal="true">
      <button type="button" class="group-combat-close" aria-label="Fermer">x</button>
      <div class="group-combat-title">Combat de groupe</div>
      <div class="group-combat-text"></div>
      <div class="group-combat-timer"></div>
      <div class="group-combat-actions">
        <button type="button" class="group-combat-join">Rejoindre</button>
      </div>
    </div>
  `;

  inviteCardEl = inviteOverlayEl.querySelector(".group-combat-card");
  inviteTitleEl = inviteOverlayEl.querySelector(".group-combat-title");
  inviteTextEl = inviteOverlayEl.querySelector(".group-combat-text");
  inviteTimerEl = inviteOverlayEl.querySelector(".group-combat-timer");
  inviteJoinBtn = inviteOverlayEl.querySelector(".group-combat-join");
  inviteCloseBtn = inviteOverlayEl.querySelector(".group-combat-close");

  document.body.appendChild(inviteOverlayEl);

  inviteJoinBtn.addEventListener("click", () => {
    if (currentInvite && typeof onJoinCb === "function") {
      onJoinCb(currentInvite);
    }
    closeGroupCombatInvite();
  });

  inviteCloseBtn.addEventListener("click", () => {
    if (currentInvite && typeof onCloseCb === "function") {
      onCloseCb(currentInvite);
    }
    closeGroupCombatInvite();
  });
}

function startCountdown(expiresAt) {
  if (!inviteTimerEl) return;
  const update = () => {
    const remainingMs = Math.max(0, expiresAt - Date.now());
    const seconds = Math.ceil(remainingMs / 1000);
    inviteTimerEl.textContent = `Expire dans ${seconds}s`;
    if (remainingMs <= 0) {
      closeGroupCombatInvite();
    }
  };
  update();
  countdownTimer = window.setInterval(update, 1000);
}

export function openGroupCombatInvite(invite, { onJoin, onClose } = {}) {
  if (!invite) return;
  ensureInviteModal();
  currentInvite = invite;
  onJoinCb = onJoin || null;
  onCloseCb = onClose || null;
  const inviterName = invite.inviterName || "Un membre du groupe";
  inviteTitleEl.textContent = "Combat de groupe";
  inviteTextEl.textContent = `Invitation de ${inviterName}.`;

  if (countdownTimer) {
    window.clearInterval(countdownTimer);
    countdownTimer = null;
  }
  if (closeTimer) {
    window.clearTimeout(closeTimer);
    closeTimer = null;
  }

  const expiresAt = Number.isFinite(invite.expiresAt)
    ? invite.expiresAt
    : Date.now() + 45000;
  startCountdown(expiresAt);
  closeTimer = window.setTimeout(() => {
    if (currentInvite && typeof onCloseCb === "function") {
      onCloseCb(currentInvite);
    }
    closeGroupCombatInvite();
  }, Math.max(0, expiresAt - Date.now()));

  inviteOverlayEl.classList.add("is-open");
  if (inviteCardEl) inviteCardEl.focus?.();
}

export function closeGroupCombatInvite() {
  if (closeTimer) {
    window.clearTimeout(closeTimer);
    closeTimer = null;
  }
  if (countdownTimer) {
    window.clearInterval(countdownTimer);
    countdownTimer = null;
  }
  currentInvite = null;
  onJoinCb = null;
  onCloseCb = null;
  if (inviteOverlayEl) inviteOverlayEl.classList.remove("is-open");
}

export function initDomGroupCombatInvite() {
  ensureInviteModal();
}
