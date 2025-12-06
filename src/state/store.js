// Mini store central pour partager l'état joueur et diffuser des événements.
// Objectif : éviter que l'UI et le gameplay mutent l'état dans tous les sens.

let playerRef = null;
const listeners = new Map(); // event -> Set(callback)

export function initStore(player) {
  playerRef = player;
  return playerRef;
}

export function getPlayer() {
  return playerRef;
}

/**
 * Abonne un callback à un événement.
 * Retourne une fonction pour se désabonner.
 */
export function on(event, cb) {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  const set = listeners.get(event);
  set.add(cb);
  return () => set.delete(cb);
}

/**
 * Émet un événement avec un payload optionnel.
 */
export function emit(event, payload) {
  const set = listeners.get(event);
  if (!set) return;
  set.forEach((cb) => {
    try {
      cb(payload);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[store] listener error on", event, err);
    }
  });
}

/**
 * Met à jour le player via une fonction de patch,
 * puis émet un événement générique "player:updated".
 */
export function updatePlayer(patchFn) {
  if (typeof patchFn !== "function" || !playerRef) return;
  patchFn(playerRef);
  emit("player:updated", playerRef);
}
