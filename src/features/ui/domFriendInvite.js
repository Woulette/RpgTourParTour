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
  inviteEl.className = "friend-invite";
  inviteEl.innerHTML = `
    <div class="friend-invite-card" role="dialog" aria-modal="true">
      <button type="button" class="friend-invite-close" aria-label="Fermer">x</button>
      <div class="friend-invite-title">Invitation d'ami</div>
      <div class="friend-invite-text"></div>
      <div class="friend-invite-actions">
        <button type="button" class="friend-invite-btn">Refuser</button>
        <button type="button" class="friend-invite-btn primary">Accepter</button>
      </div>
    </div>
  `;

  inviteTextEl = inviteEl.querySelector(".friend-invite-text");
  acceptBtn = inviteEl.querySelector(".friend-invite-btn.primary");
  declineBtn = inviteEl.querySelector(".friend-invite-btn");
  closeBtn = inviteEl.querySelector(".friend-invite-close");

  document.body.appendChild(inviteEl);

  acceptBtn.addEventListener("click", () => {
    if (currentInvite && typeof onAcceptCb === "function") {
      onAcceptCb(currentInvite);
    }
    closeFriendInvite();
  });

  declineBtn.addEventListener("click", () => {
    if (currentInvite && typeof onDeclineCb === "function") {
      onDeclineCb(currentInvite);
    }
    closeFriendInvite();
  });

  closeBtn.addEventListener("click", () => {
    if (currentInvite && typeof onDeclineCb === "function") {
      onDeclineCb(currentInvite);
    }
    closeFriendInvite();
  });
}

export function openFriendInvite(invite, { onAccept, onDecline } = {}) {
  if (!invite) return;
  ensureInvite();
  currentInvite = invite;
  onAcceptCb = onAccept || null;
  onDeclineCb = onDecline || null;
  const inviter = invite.inviterName || "Un joueur";
  inviteTextEl.textContent = `${inviter} veut t'ajouter en ami.`;
  inviteEl.classList.add("is-open");
}

export function closeFriendInvite() {
  currentInvite = null;
  onAcceptCb = null;
  onDeclineCb = null;
  if (inviteEl) inviteEl.classList.remove("is-open");
}

export function initDomFriendInvite() {
  ensureInvite();
}
