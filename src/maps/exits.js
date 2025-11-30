import { GAME_HEIGHT, GAME_WIDTH, HUD_HEIGHT } from "../config/constants.js";

// Bande de sortie droite : purement visuelle.
// - visibilité contrôlée par la position de la souris (pointermove global)
// - aucun objet interactif : les clics restent gérés par enableClickToMove.
export function createMapExits(scene) {
  // Nettoie d'éventuels anciens éléments
  if (scene._mapExitBandRight) {
    scene._mapExitBandRight.destroy();
    scene._mapExitBandRight = null;
  }
  if (scene._mapExitLineRight) {
    scene._mapExitLineRight.destroy();
    scene._mapExitLineRight = null;
  }
  if (scene._mapExitHoverHandler) {
    scene.input.off("pointermove", scene._mapExitHoverHandler);
    scene._mapExitHoverHandler = null;
  }

  const hudY = GAME_HEIGHT - HUD_HEIGHT; // hauteur de la zone de jeu
  const bandWidth = 30;
  const worldHeight = hudY;

  const bandX = GAME_WIDTH - bandWidth / 2;
  const bandY = worldHeight / 2;

  // Bande sombre (cachée par défaut)
  const bandRight = scene.add.rectangle(
    bandX,
    bandY,
    bandWidth,
    worldHeight,
    0x000000,
    0.28
  );
  bandRight.setScrollFactor(0);
  bandRight.setVisible(false);

  // Ligne claire sur le bord externe (cachée par défaut)
  const lineRight = scene.add.rectangle(
    GAME_WIDTH - 1,
    bandY,
    4,
    worldHeight,
    0xffffff,
    0.5
  );
  lineRight.setScrollFactor(0);
  lineRight.setVisible(false);

  // Gestion du survol : basé sur la position de la souris, sans zone interactive.
  const hoverHandler = (pointer) => {
    // On ignore le HUD : seulement la zone de jeu
    if (pointer.y >= hudY) {
      bandRight.setVisible(false);
      lineRight.setVisible(false);
      return;
    }

    const overBand = pointer.x >= GAME_WIDTH - bandWidth;
    bandRight.setVisible(overBand);
    lineRight.setVisible(overBand);
  };

  scene.input.on("pointermove", hoverHandler);

  scene._mapExitBandRight = bandRight;
  scene._mapExitLineRight = lineRight;
  scene._mapExitHoverHandler = hoverHandler;
}

