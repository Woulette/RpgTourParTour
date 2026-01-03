let selectedCharacter = null;
let uiApi = null;
let netClient = null;
let netPlayerId = null;
let netEventHandler = null;

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
}

export function getNetPlayerId() {
  return netPlayerId;
}

export function setNetEventHandler(handler) {
  netEventHandler = typeof handler === "function" ? handler : null;
}

export function getNetEventHandler() {
  return netEventHandler;
}
