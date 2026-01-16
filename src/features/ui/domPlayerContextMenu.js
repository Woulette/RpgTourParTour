import { getNetClient, getNetPlayerId } from "../../app/session.js";
import { showToast } from "./domToasts.js";

let menuEl = null;
let nameEl = null;
let groupBtn = null;
let tradeBtn = null;
let messageBtn = null;
let friendBtn = null;
let ignoreBtn = null;
let currentTarget = null;
let currentTargetId = null;
let currentScene = null;
let updateTimer = null;
let openedAt = 0;
let lastPointerScreen = null;

function ensureMenu() {
  if (menuEl) return;
  menuEl = document.createElement("div");
  menuEl.className = "player-context-menu";
  menuEl.innerHTML = `
    <div class="player-context-card">
      <div class="player-context-name"></div>
      <div class="player-context-actions">
        <button type="button" class="player-context-btn" data-action="group">Groupe</button>
        <button type="button" class="player-context-btn" data-action="trade">Echange</button>
        <button type="button" class="player-context-btn" data-action="message">Message</button>
        <button type="button" class="player-context-btn" data-action="friend">Ajouter ami</button>
        <button type="button" class="player-context-btn" data-action="ignore">Ignorer</button>
      </div>
    </div>
  `;
  nameEl = menuEl.querySelector(".player-context-name");
  groupBtn = menuEl.querySelector("[data-action='group']");
  tradeBtn = menuEl.querySelector("[data-action='trade']");
  messageBtn = menuEl.querySelector("[data-action='message']");
  friendBtn = menuEl.querySelector("[data-action='friend']");
  ignoreBtn = menuEl.querySelector("[data-action='ignore']");

  menuEl.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  document.body.appendChild(menuEl);

  document.addEventListener("click", () => {
    if (Date.now() - openedAt < 150) return;
    closePlayerContextMenu();
  });

  groupBtn.addEventListener("click", () => {
    if (!currentTargetId) return;
    const client = getNetClient();
    const playerId = getNetPlayerId();
    if (!client || !playerId) return;
    client.sendCmd("CmdGroupInvite", {
      playerId,
      targetId: currentTargetId,
    });
    closePlayerContextMenu();
  });

  tradeBtn.addEventListener("click", () => {
    if (!currentTargetId) return;
    const client = getNetClient();
    const playerId = getNetPlayerId();
    if (!client || !playerId) return;
    client.sendCmd("CmdTradeInvite", {
      playerId,
      targetId: currentTargetId,
    });
    showToast({ title: "Echange", text: "Invitation envoyee." });
    closePlayerContextMenu();
  });

  messageBtn.addEventListener("click", () => {
    showToast({ title: "Message", text: "Bientot disponible." });
    closePlayerContextMenu();
  });

  friendBtn.addEventListener("click", () => {
    if (!currentTargetId) return;
    const client = getNetClient();
    const playerId = getNetPlayerId();
    if (!client || !playerId) return;
    client.sendCmd("CmdFriendAdd", {
      playerId,
      targetId: currentTargetId,
    });
    showToast({ title: "Ami", text: "Demande envoyee." });
    closePlayerContextMenu();
  });

  ignoreBtn.addEventListener("click", () => {
    if (!currentTargetId) return;
    const client = getNetClient();
    const playerId = getNetPlayerId();
    if (!client || !playerId) return;
    client.sendCmd("CmdIgnoreAdd", {
      playerId,
      targetId: currentTargetId,
    });
    showToast({ title: "Ignorer", text: "Joueur ignore." });
    closePlayerContextMenu();
  });
}

function updatePosition() {
  if (!menuEl || !currentTarget || !currentScene) return;
  const cam = currentScene.cameras?.main;
  const canvas = currentScene.game?.canvas;
  if (!cam || !canvas) return;

  const rect = canvas.getBoundingClientRect();
  const worldLeft = Number.isFinite(cam.worldView?.x) ? cam.worldView.x : cam.scrollX;
  const worldTop = Number.isFinite(cam.worldView?.y) ? cam.worldView.y : cam.scrollY;
  const bounds = currentTarget.getBounds ? currentTarget.getBounds() : null;
  const worldX = bounds ? bounds.right : currentTarget.x;
  const worldY = bounds ? bounds.centerY : currentTarget.y;
  const scaleX = canvas.width ? rect.width / canvas.width : 1;
  const scaleY = canvas.height ? rect.height / canvas.height : 1;
  const offsetX = 105;
  const offsetY = 28;
  const screenX = (worldX - worldLeft) * cam.zoom * scaleX + offsetX;
  const screenY = (worldY - worldTop) * cam.zoom * scaleY + offsetY;

  if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) {
    if (lastPointerScreen) {
      menuEl.style.left = `${lastPointerScreen.x}px`;
      menuEl.style.top = `${lastPointerScreen.y}px`;
    }
    return;
  }

  menuEl.style.left = `${rect.left + screenX}px`;
  menuEl.style.top = `${rect.top + screenY}px`;
}

export function openPlayerContextMenu({
  scene,
  target,
  targetId,
  displayName,
  pointer,
}) {
  if (!scene || !target || !Number.isInteger(targetId)) return;
  if (menuEl && currentTargetId === targetId && menuEl.classList.contains("is-open")) {
    closePlayerContextMenu();
    return;
  }
  ensureMenu();
  currentScene = scene;
  currentTarget = target;
  currentTargetId = targetId;
  lastPointerScreen = null;
  if (pointer) {
    const canvas = scene.game?.canvas;
    const rect = canvas ? canvas.getBoundingClientRect() : null;
    if (rect && Number.isFinite(pointer.x) && Number.isFinite(pointer.y)) {
      lastPointerScreen = {
        x: rect.left + pointer.x,
        y: rect.top + pointer.y,
      };
    } else if (pointer.event && Number.isFinite(pointer.event.clientX)) {
      lastPointerScreen = {
        x: pointer.event.clientX,
        y: pointer.event.clientY,
      };
    }
  }
  nameEl.textContent = displayName || "Joueur";
  openedAt = Date.now();
  menuEl.classList.add("is-open");
  updatePosition();

  if (updateTimer) window.clearInterval(updateTimer);
  updateTimer = window.setInterval(updatePosition, 120);
}

export function closePlayerContextMenu() {
  if (updateTimer) {
    window.clearInterval(updateTimer);
    updateTimer = null;
  }
  currentTarget = null;
  currentTargetId = null;
  if (menuEl) {
    menuEl.classList.remove("is-open");
  }
}

export function closePlayerContextMenuIfTarget(targetId) {
  if (!targetId) return;
  if (currentTargetId === targetId) {
    closePlayerContextMenu();
  }
}

export function initDomPlayerContextMenu(scene) {
  ensureMenu();
  currentScene = scene || currentScene;
}
