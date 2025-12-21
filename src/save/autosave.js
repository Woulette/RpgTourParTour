import { getPlayer, on as onStoreEvent } from "../state/store.js";
import { buildSnapshotFromPlayer, saveCharacterSnapshot } from "./index.js";

const DEFAULT_COOLDOWN_MS = 1200;

let autosaveInitialized = false;
let lastSaveAt = 0;
let pendingTimer = null;

function trySaveNow() {
  const player = getPlayer();
  if (!player) return;

  const characterId =
    player.characterId || window.__andemiaSelectedCharacter?.id || null;
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
    onStoreEvent(evt, () => scheduleSave());
  });

  // Déconnexion / fermeture onglet : on force une sauvegarde immédiate.
  // (Important pour ne pas perdre la progression si l'onglet se ferme.)
  window.addEventListener("beforeunload", () => {
    trySaveNow();
  });
  window.addEventListener("pagehide", () => {
    trySaveNow();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) trySaveNow();
  });

  // Filet de sécurité : autosave régulier (si le joueur oublie de déclencher des events)
  setInterval(() => {
    if (!document.body.classList.contains("game-running")) return;
    scheduleSave();
  }, 30000);
}
