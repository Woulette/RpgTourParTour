import { GAME_HEIGHT, GAME_WIDTH, HUD_HEIGHT } from "../config/constants.js";

export function createHud(scene) {
  const hudY = GAME_HEIGHT - HUD_HEIGHT;
  // On ne dessine plus la barre HUD dans Phaser :
  // elle est gérée en HTML/CSS (voir hud.css / hudInterface.css).
  const uiElements = [];

  return { hudY, uiElements };
}

export function setupHudCamera(scene, uiElements, worldElements) {
  scene.cameras.main.ignore(uiElements);

  const uiCamera = scene.cameras.add(0, 0, GAME_WIDTH, GAME_HEIGHT);
  uiCamera.ignore(worldElements);
  uiCamera.setScroll(0, 0);
  uiCamera.setZoom(1);

  // Sauvegarde la caméra HUD pour pouvoir ignorer les objets du monde (monstres, marqueurs, etc.)
  scene.hudCamera = uiCamera;
}
