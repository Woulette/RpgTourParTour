import { GAME_HEIGHT, HUD_HEIGHT } from "../config/constants.js";

export function createHud(scene) {
  const hudY = GAME_HEIGHT - HUD_HEIGHT;
  // HUD rendu en DOM/CSS : aucun élément Phaser ici.
  const uiElements = [];
  return { hudY, uiElements };
}

// Plus de caméra HUD Phaser : on laisse la caméra principale rendre le monde.
export function setupHudCamera(scene, uiElements, worldElements) {
  scene.cameras.main.ignore(uiElements);
  scene.hudCamera = null;
}
