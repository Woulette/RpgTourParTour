let selectedCharacter = null;
let uiApi = null;

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
