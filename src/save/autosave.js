import { getPlayer, on as onStoreEvent } from "../state/store.js";
import { getSelectedCharacter } from "../app/session.js";
import { buildSnapshotFromPlayer, saveCharacterSnapshot } from "./index.js";

const DEFAULT_COOLDOWN_MS = 1200;

let autosaveInitialized = false;
let lastSaveAt = 0;
let pendingTimer = null;
let intervalId = null;
let storeUnsubs = [];

function handleBeforeUnload() {
  trySaveNow();
}

function handlePageHide() {
  trySaveNow();
}

function handleVisibilityChange() {
  if (document.hidden) trySaveNow();
}

function trySaveNow() {
  const player = getPlayer();
  if (!player) return;

  const characterId =
    player.characterId || getSelectedCharacter()?.id || null;
  if (!characterId) return;

  const snapshot = buildSnapshotFromPlayer(player);
  if (!snapshot) return;
  saveCharacterSnapshot(characterId, snapshot);
  lastSaveAt = Date.now();
}

function scheduleSave() {
  if (pendingTimer) return;
  const now = Date.now();
  const elapsed = now - lastSaveAt;
  const delay = Math.max(0, DEFAULT_COOLDOWN_MS - elapsed);

  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    trySaveNow();
  }, delay);
}

export function initAutosave() {
  if (autosaveInitialized) return;
  autosaveInitialized = true;

  const events = [
    "player:updated",
    "player:levelup",
    "inventory:updated",
    "equipment:updated",
    "quest:updated",
    "achievements:updated",
    "metier:updated",
    "map:changed",
  ];

  events.forEach((evt) => {
    const unsub = onStoreEvent(evt, () => scheduleSave());
    storeUnsubs.push(unsub);
  });

  // Déconnexion / fermeture onglet : on force une sauvegarde immédiate.
  // (Important pour ne pas perdre la progression si l'onglet se ferme.)
  window.addEventListener("beforeunload", handleBeforeUnload);
  window.addEventListener("pagehide", handlePageHide);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  // Filet de sécurité : autosave régulier (si le joueur oublie de déclencher des events)
  intervalId = setInterval(() => {
    if (!document.body.classList.contains("game-running")) return;
    scheduleSave();
  }, 30000);
}

export function resetAutosave() {
  if (!autosaveInitialized) return;

  storeUnsubs.forEach((unsub) => {
    try {
      unsub();
    } catch (err) {
      // ignore cleanup errors
    }
  });
  storeUnsubs = [];

  window.removeEventListener("beforeunload", handleBeforeUnload);
  window.removeEventListener("pagehide", handlePageHide);
  document.removeEventListener("visibilitychange", handleVisibilityChange);

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }

  lastSaveAt = 0;
  autosaveInitialized = false;
}
