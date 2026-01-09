let selectedCharacter = null;
let uiApi = null;
let netClient = null;
let netPlayerId = null;
let netEventHandler = null;
const netEventQueue = [];
let netIsHost = false;

export function setSelectedCharacter(character) {
  selectedCharacter = character || null;
}

export function getSelectedCharacter() {
  return selectedCharacter;
}

export function clearSelectedCharacter() {
  selectedCharacter = null;
}

export function setUiApi(api) {
  uiApi = api || null;
}

export function getUiApi() {
  return uiApi;
}

export function setNetClient(client) {
  netClient = client || null;
}

export function getNetClient() {
  return netClient;
}

export function setNetPlayerId(id) {
  netPlayerId = Number.isFinite(id) ? id : null;
  if (typeof window !== "undefined") {
    window.__netPlayerId = netPlayerId;
  }
}

export function getNetPlayerId() {
  return netPlayerId;
}

export function setNetEventHandler(handler) {
  netEventHandler = typeof handler === "function" ? handler : null;
  if (typeof window !== "undefined") {
    window.__lanHandlerReady = !!netEventHandler;
    window.__lanQueueSize = netEventQueue.length;
  }
  if (netEventHandler && netEventQueue.length > 0) {
    const pending = netEventQueue.splice(0, netEventQueue.length);
    pending.forEach((msg) => {
      try {
        netEventHandler(msg);
      } catch {
        // ignore handler errors during flush
      }
    });
  }
}

export function getNetEventHandler() {
  return netEventHandler;
}

export function pushNetEvent(msg) {
  if (netEventHandler) {
    netEventHandler(msg);
    return;
  }
  netEventQueue.push(msg);
  if (typeof window !== "undefined") {
    window.__lanQueueSize = netEventQueue.length;
  }
}

export function setNetIsHost(isHost) {
  netIsHost = !!isHost;
}

export function getNetIsHost() {
  return netIsHost;
}
