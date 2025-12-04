import { GAME_HEIGHT, GAME_WIDTH, HUD_HEIGHT } from "../config/constants.js";

// Bandes de sortie de map : purement visuelles.
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
  if (scene._mapExitBandLeft) {
    scene._mapExitBandLeft.destroy();
    scene._mapExitBandLeft = null;
  }
  if (scene._mapExitLineLeft) {
    scene._mapExitLineLeft.destroy();
    scene._mapExitLineLeft = null;
  }
  if (scene._mapExitBandTop) {
    scene._mapExitBandTop.destroy();
    scene._mapExitBandTop = null;
  }
  if (scene._mapExitLineTop) {
    scene._mapExitLineTop.destroy();
    scene._mapExitLineTop = null;
  }
  if (scene._mapExitBandBottom) {
    scene._mapExitBandBottom.destroy();
    scene._mapExitBandBottom = null;
  }
  if (scene._mapExitLineBottom) {
    scene._mapExitLineBottom.destroy();
    scene._mapExitLineBottom = null;
  }
  if (scene._mapExitHoverHandler) {
    scene.input.off("pointermove", scene._mapExitHoverHandler);
    scene._mapExitHoverHandler = null;
  }

  const hudY = GAME_HEIGHT - HUD_HEIGHT; // hauteur de la zone de jeu
  const worldHeight = hudY;
  const worldWidth = GAME_WIDTH;

  const bandThickness = 30;

  // --- Bande droite ---
  const bandWidthRight = bandThickness;
  const bandRightX = GAME_WIDTH - bandWidthRight / 2;
  const bandRightY = worldHeight / 2;

  const bandRight = scene.add.rectangle(
    bandRightX,
    bandRightY,
    bandWidthRight,
    worldHeight,
    0x000000,
    0.28
  );
  bandRight.setScrollFactor(0);
  bandRight.setVisible(false);

  const lineRight = scene.add.rectangle(
    GAME_WIDTH - 1,
    bandRightY,
    4,
    worldHeight,
    0xffffff,
    0.5
  );
  lineRight.setScrollFactor(0);
  lineRight.setVisible(false);

  // --- Bande gauche ---
  const bandWidthLeft = bandThickness;
  const bandLeftX = bandWidthLeft / 2;
  const bandLeftY = worldHeight / 2;

  const bandLeft = scene.add.rectangle(
    bandLeftX,
    bandLeftY,
    bandWidthLeft,
    worldHeight,
    0x000000,
    0.28
  );
  bandLeft.setScrollFactor(0);
  bandLeft.setVisible(false);

  const lineLeft = scene.add.rectangle(1, bandLeftY, 4, worldHeight, 0xffffff, 0.5);
  lineLeft.setScrollFactor(0);
  lineLeft.setVisible(false);

  // --- Bande haute ---
  const bandHeightTop = bandThickness;
  const bandTopX = worldWidth / 2;
  const bandTopY = bandHeightTop / 2;

  const bandTop = scene.add.rectangle(
    bandTopX,
    bandTopY,
    worldWidth,
    bandHeightTop,
    0x000000,
    0.28
  );
  bandTop.setScrollFactor(0);
  bandTop.setVisible(false);

  const lineTop = scene.add.rectangle(
    bandTopX,
    1,
    worldWidth,
    4,
    0xffffff,
    0.5
  );
  lineTop.setScrollFactor(0);
  lineTop.setVisible(false);

  // --- Bande basse ---
  const bandHeightBottom = bandThickness;
  const bandBottomX = worldWidth / 2;
  const bandBottomY = hudY - bandHeightBottom / 2;

  const bandBottom = scene.add.rectangle(
    bandBottomX,
    bandBottomY,
    worldWidth,
    bandHeightBottom,
    0x000000,
    0.28
  );
  bandBottom.setScrollFactor(0);
  bandBottom.setVisible(false);

  const lineBottom = scene.add.rectangle(
    bandBottomX,
    hudY - 1,
    worldWidth,
    4,
    0xffffff,
    0.5
  );
  lineBottom.setScrollFactor(0);
  lineBottom.setVisible(false);

  // Gestion du survol : basé sur la position de la souris, sans zone interactive.
  const hoverHandler = (pointer) => {
    // On ignore le HUD : seulement la zone de jeu
    if (pointer.y >= hudY) {
      bandRight.setVisible(false);
      lineRight.setVisible(false);
      bandLeft.setVisible(false);
      lineLeft.setVisible(false);
      bandTop.setVisible(false);
      lineTop.setVisible(false);
      bandBottom.setVisible(false);
      lineBottom.setVisible(false);
      return;
    }

    const overRightBand = pointer.x >= GAME_WIDTH - bandWidthRight;
    const overLeftBand = pointer.x <= bandWidthLeft;
    const overTopBand = pointer.y <= bandHeightTop;
    const overBottomBand =
      pointer.y >= hudY - bandHeightBottom && pointer.y < hudY;

    bandRight.setVisible(overRightBand);
    lineRight.setVisible(overRightBand);

    bandLeft.setVisible(overLeftBand);
    lineLeft.setVisible(overLeftBand);

    bandTop.setVisible(overTopBand);
    lineTop.setVisible(overTopBand);

    bandBottom.setVisible(overBottomBand);
    lineBottom.setVisible(overBottomBand);
  };

  scene.input.on("pointermove", hoverHandler);

  scene._mapExitBandRight = bandRight;
  scene._mapExitLineRight = lineRight;
  scene._mapExitBandLeft = bandLeft;
  scene._mapExitLineLeft = lineLeft;
  scene._mapExitBandTop = bandTop;
  scene._mapExitLineTop = lineTop;
  scene._mapExitBandBottom = bandBottom;
  scene._mapExitLineBottom = lineBottom;
  scene._mapExitHoverHandler = hoverHandler;
}

