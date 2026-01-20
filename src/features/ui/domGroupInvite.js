let inviteEl = null;
let inviteTextEl = null;
let acceptBtn = null;
let declineBtn = null;
let closeBtn = null;
let currentInvite = null;
let onAcceptCb = null;
let onDeclineCb = null;

function ensureInvite() {
  if (inviteEl) return;
  inviteEl = document.createElement("div");
  inviteEl.className = "group-invite";
  inviteEl.innerHTML = `
    <div class="group-invite-card" role="dialog" aria-modal="true">
      <button type="button" class="group-invite-close" aria-label="Fermer">x</button>
      <div class="group-invite-title">Invitation de groupe</div>
      <div class="group-invite-text"></div>
      <div class="group-invite-actions">
        <button type="button" class="group-invite-btn">Refuser</button>
        <button type="button" class="group-invite-btn primary">Accepter</button>
      </div>
    </div>
  `;

  inviteTextEl = inviteEl.querySelector(".group-invite-text");
  acceptBtn = inviteEl.querySelector(".group-invite-btn.primary");
  declineBtn = inviteEl.querySelector(".group-invite-btn");
  closeBtn = inviteEl.querySelector(".group-invite-close");

  document.body.appendChild(inviteEl);

  acceptBtn.addEventListener("click", () => {
    if (currentInvite && typeof onAcceptCb === "function") {
      onAcceptCb(currentInvite);
    }
    closeGroupInvite();
  });

  declineBtn.addEventListener("click", () => {
    if (currentInvite && typeof onDeclineCb === "function") {
      onDeclineCb(currentInvite);
    }
    closeGroupInvite();
  });

  closeBtn.addEventListener("click", () => {
    if (currentInvite && typeof onDeclineCb === "function") {
      onDeclineCb(currentInvite);
    }
    closeGroupInvite();
  });
}

export function openGroupInvite(invite, { onAccept, onDecline } = {}) {
  if (!invite) return;
  ensureInvite();
  currentInvite = invite;
  onAcceptCb = onAccept || null;
  onDeclineCb = onDecline || null;
  const inviter = invite.inviterName || "Un joueur";
  inviteTextEl.textContent = `${inviter} t'invite a rejoindre son groupe.`;
  inviteEl.classList.add("is-open");
}

export function closeGroupInvite() {
  currentInvite = null;
  onAcceptCb = null;
  onDeclineCb = null;
  if (inviteEl) inviteEl.classList.remove("is-open");
}

export function initDomGroupInvite() {
  ensureInvite();
}
