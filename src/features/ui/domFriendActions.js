import { getNetClient, getNetPlayerId } from "../../app/session.js";
import { showToast } from "./domToasts.js";

let panelEl = null;
let titleEl = null;
let groupBtn = null;
let messageBtn = null;
let ignoreBtn = null;
let removeBtn = null;
let closeBtn = null;
let messageWrap = null;
let messageInput = null;
let messageSendBtn = null;
let confirmWrap = null;
let confirmNoBtn = null;
let confirmYesBtn = null;
let currentEntry = null;

function ensurePanel() {
  if (panelEl) return;
  panelEl = document.createElement("div");
  panelEl.className = "friend-actions";
  panelEl.innerHTML = `
    <div class="friend-actions-card" role="dialog" aria-modal="true">
      <button type="button" class="friend-actions-close" aria-label="Fermer">x</button>
      <div class="friend-actions-title"></div>
      <div class="friend-actions-buttons">
        <button type="button" class="friend-actions-btn primary" data-action="message">Message</button>
        <button type="button" class="friend-actions-btn" data-action="group">Groupe</button>
        <button type="button" class="friend-actions-btn" data-action="ignore">Ignorer</button>
        <button type="button" class="friend-actions-btn danger" data-action="remove">Retirer</button>
      </div>
      <div class="friend-actions-message">
        <input type="text" maxlength="200" placeholder="Ecrire un message" />
        <button type="button" class="friend-actions-btn primary" data-action="send">Envoyer</button>
      </div>
      <div class="friend-actions-confirm">
        <div class="friend-actions-confirm-card">
          <div class="friend-actions-confirm-text">Retirer cet ami ?</div>
          <div class="friend-actions-confirm-actions">
            <button type="button" class="friend-actions-btn" data-action="confirm-no">Non</button>
            <button type="button" class="friend-actions-btn danger" data-action="confirm-yes">Oui</button>
          </div>
        </div>
      </div>
    </div>
  `;

  titleEl = panelEl.querySelector(".friend-actions-title");
  groupBtn = panelEl.querySelector("[data-action='group']");
  messageBtn = panelEl.querySelector("[data-action='message']");
  ignoreBtn = panelEl.querySelector("[data-action='ignore']");
  removeBtn = panelEl.querySelector("[data-action='remove']");
  closeBtn = panelEl.querySelector(".friend-actions-close");
  messageWrap = panelEl.querySelector(".friend-actions-message");
  messageInput = panelEl.querySelector(".friend-actions-message input");
  messageSendBtn = panelEl.querySelector("[data-action='send']");
  confirmWrap = panelEl.querySelector(".friend-actions-confirm");
  confirmNoBtn = panelEl.querySelector("[data-action='confirm-no']");
  confirmYesBtn = panelEl.querySelector("[data-action='confirm-yes']");

  panelEl.addEventListener("click", (event) => {
    if (event.target === panelEl) closeFriendActions();
  });

  closeBtn.addEventListener("click", () => closeFriendActions());

  messageBtn.addEventListener("click", () => {
    if (!currentEntry) return;
    messageWrap.classList.toggle("is-open");
    if (messageWrap.classList.contains("is-open")) {
      messageInput.focus();
    }
  });

  messageSendBtn.addEventListener("click", () => {
    if (!currentEntry) return;
    const text = (messageInput.value || "").trim();
    if (!text) return;
    if (!currentEntry.online) {
      showToast({ title: "Message", text: "Joueur hors ligne." });
      return;
    }
    const client = getNetClient();
    const playerId = getNetPlayerId();
    if (!client || !playerId || !currentEntry.accountId) return;
    client.sendCmd("CmdWhisper", {
      playerId,
      targetAccountId: currentEntry.accountId,
      text,
    });
    showToast({ title: "Message", text: "Message envoye." });
    messageInput.value = "";
    messageWrap.classList.remove("is-open");
  });

  groupBtn.addEventListener("click", () => {
    if (!currentEntry) return;
    if (!currentEntry.online || !Number.isInteger(currentEntry.playerId)) {
      showToast({ title: "Groupe", text: "Joueur hors ligne." });
      return;
    }
    const client = getNetClient();
    const playerId = getNetPlayerId();
    if (!client || !playerId) return;
    client.sendCmd("CmdGroupInvite", {
      playerId,
      targetId: currentEntry.playerId,
    });
    showToast({ title: "Groupe", text: "Invitation envoyee." });
    closeFriendActions();
  });

  ignoreBtn.addEventListener("click", () => {
    if (!currentEntry || !currentEntry.accountId) return;
    const client = getNetClient();
    const playerId = getNetPlayerId();
    if (!client || !playerId) return;
    client.sendCmd("CmdIgnoreAccount", {
      playerId,
      targetAccountId: currentEntry.accountId,
    });
    showToast({ title: "Ignorer", text: "Joueur ignore." });
    closeFriendActions();
  });

  removeBtn.addEventListener("click", () => {
    if (!currentEntry) return;
    confirmWrap.classList.add("is-open");
  });

  confirmNoBtn.addEventListener("click", () => {
    confirmWrap.classList.remove("is-open");
  });

  confirmYesBtn.addEventListener("click", () => {
    if (!currentEntry || !currentEntry.accountId) return;
    const client = getNetClient();
    const playerId = getNetPlayerId();
    if (!client || !playerId) return;
    client.sendCmd("CmdFriendRemove", {
      playerId,
      targetAccountId: currentEntry.accountId,
    });
    showToast({ title: "Amis", text: "Ami retire." });
    confirmWrap.classList.remove("is-open");
    closeFriendActions();
  });

  document.body.appendChild(panelEl);
}

export function openFriendActions(entry) {
  if (!entry) return;
  ensurePanel();
  currentEntry = entry;
  const name = entry.displayName || "Joueur";
  titleEl.textContent = name;
  messageWrap.classList.remove("is-open");
  messageInput.value = "";
  confirmWrap.classList.remove("is-open");
  panelEl.classList.add("is-open");
}

export function closeFriendActions() {
  currentEntry = null;
  if (panelEl) panelEl.classList.remove("is-open");
}

export function initDomFriendActions() {
  ensurePanel();
}
