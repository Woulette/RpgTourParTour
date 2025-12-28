import { GAME_HEIGHT, GAME_WIDTH, HUD_HEIGHT } from "../../config/constants.js";

const EXIT_BAND_DEPTH = 10000;
const DEFAULT_BAND_THICKNESS = 25;
// Offsets en nombre de tuiles pour ajuster visuellement les bandes d'exit.
// Modifie ces valeurs si tu veux avancer/reculer les bandes par direction.
const BAND_OFFSETS_TILES = {
  right: { x: -0.8, y: 0 },
  left: { x: 0.8, y: 0 },
  up: { x: 0, y: 1 },
  down: { x: 0, y: -0.9 }, // bas laissé par défaut
};
// Trim facultatif (en tuiles) pour rogner la largeur/hauteur des bandes.
// Exemple : left: 0.5 rogne d'une demi-tuile à gauche.
const BAND_TRIM_TILES = {
  up: { left: 0, right: 0, top: -0.2, bottom: 0 },
  down: { left: 0, right: 0, top: 0, bottom: -0.2 }, // rogne un peu la largeur du bas
  left: { left: -0.1, right: 0, top: 0, bottom: 0 },
  right: { left: 0, right: -0.1, top: 0, bottom: 0 },
};

// Bandes alignees sur les tuiles d'exit (calque Tiled "exits").
// Pour chaque direction, on se base sur les tuiles de cette direction.
// Ordre : exitBounds (override) -> exits Tiled -> bbox iso auto.
export function createMapExits(scene) {
  // Nettoyage
  [
    "_mapExitBandRight",
    "_mapExitLineRight",
    "_mapExitBandLeft",
    "_mapExitLineLeft",
    "_mapExitBandTop",
    "_mapExitLineTop",
    "_mapExitBandBottom",
    "_mapExitLineBottom",
  ].forEach((key) => {
    if (scene[key]) {
      scene[key].destroy();
      scene[key] = null;
    }
  });
  if (scene._mapExitHoverHandler) {
    scene.input.off("pointermove", scene._mapExitHoverHandler);
    scene._mapExitHoverHandler = null;
  }

  const map = scene.map;
  const layer = scene.groundLayer || (map && map.layers && map.layers[0]);
  const mapDef = scene.currentMapDef || map?.data?.properties;
  const bandThickness = DEFAULT_BAND_THICKNESS;

  // Fallback bbox iso pour chaque direction si rien d'autre
  const isoBBox = (() => {
    if (!map) {
      return {
        minX: 0,
        maxX: GAME_WIDTH,
        minY: 0,
        maxY: GAME_HEIGHT - HUD_HEIGHT,
      };
    }
    const lw = map.width;
    const lh = map.height;
    const tw = map.tileWidth;
    const th = map.tileHeight;
    const layerOffsetX = (layer && layer.x) || 0;
    const layerOffsetY = (layer && layer.y) || 0;
    return {
      minX: layerOffsetX - (lh - 1) * (tw / 2),
      maxX: layerOffsetX + (lw - 1) * (tw / 2) + tw,
      minY: layerOffsetY,
      maxY: layerOffsetY + (lw + lh - 2) * (th / 2) + th,
    };
  })();

  // Si exitBounds fourni : on l'applique a tous les cotes
  let boundsOverride = null;
  if (mapDef && mapDef.exitBounds) {
    const { minX, minY, maxX, maxY } = mapDef.exitBounds;
    if (
      typeof minX === "number" &&
      typeof minY === "number" &&
      typeof maxX === "number" &&
      typeof maxY === "number"
    ) {
      boundsOverride = { minX, minY, maxX, maxY };
    }
  }

  // Recuperation des exits par direction
  const exits = scene.worldExits || {};

  function computeBoundsForDir(dir) {
    if (boundsOverride) return boundsOverride;
    const arr = Array.isArray(exits[dir]) ? exits[dir] : [];
    if (!map || !layer || arr.length === 0) return isoBBox;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    arr.forEach((t) => {
      if (typeof t.x !== "number" || typeof t.y !== "number") return;
      const wp = map.tileToWorldXY(t.x, t.y, undefined, undefined, layer);
      if (!wp) return;
      const tileMaxX = wp.x + map.tileWidth;
      const tileMaxY = wp.y + map.tileHeight;
      if (wp.x < minX) minX = wp.x;
      if (wp.y < minY) minY = wp.y;
      if (tileMaxX > maxX) maxX = tileMaxX;
      if (tileMaxY > maxY) maxY = tileMaxY;
    });

    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
      return isoBBox;
    }
    return { minX, minY, maxX, maxY };
  }

  // Bounds par direction
  const bRight = computeBoundsForDir("right");
  const bLeft = computeBoundsForDir("left");
  const bTop = computeBoundsForDir("up");
  const bBottom = computeBoundsForDir("down");

  // Recentre les bandes d'une tuile vers l'interieur
  const tileW = map?.tileWidth || 0;
  const tileH = map?.tileHeight || 0;

  const off = BAND_OFFSETS_TILES;

  const bRightAdj = {
    minX: bRight.minX + (off.right?.x || 0) * tileW,
    maxX: bRight.maxX + (off.right?.x || 0) * tileW,
    minY: bRight.minY + (off.right?.y || 0) * tileH,
    maxY: bRight.maxY + (off.right?.y || 0) * tileH,
  };

  const bLeftAdj = {
    minX: bLeft.minX + (off.left?.x || 0) * tileW,
    maxX: bLeft.maxX + (off.left?.x || 0) * tileW,
    minY: bLeft.minY + (off.left?.y || 0) * tileH,
    maxY: bLeft.maxY + (off.left?.y || 0) * tileH,
  };

  const bTopAdj = {
    minX: bTop.minX + (off.up?.x || 0) * tileW,
    maxX: bTop.maxX + (off.up?.x || 0) * tileW,
    minY: bTop.minY + (off.up?.y || 0) * tileH,
    maxY: bTop.maxY + (off.up?.y || 0) * tileH,
  };

  const bBottomAdj = {
    minX: bBottom.minX + (off.down?.x || 0) * tileW,
    maxX: bBottom.maxX + (off.down?.x || 0) * tileW,
    minY: bBottom.minY + (off.down?.y || 0) * tileH,
    maxY: bBottom.maxY + (off.down?.y || 0) * tileH,
  };

  // Applique un éventuel trim
  const trim = BAND_TRIM_TILES;
  const applyTrim = (b, t) => {
    if (!t) return b;
    return {
      minX: b.minX + (t.left || 0) * tileW,
      maxX: b.maxX - (t.right || 0) * tileW,
      minY: b.minY + (t.top || 0) * tileH,
      maxY: b.maxY - (t.bottom || 0) * tileH,
    };
  };

  const bTopDraw = applyTrim(bTopAdj, trim.up);
  const bBottomDraw = applyTrim(bBottomAdj, trim.down);
  const bLeftDraw = applyTrim(bLeftAdj, trim.left);
  const bRightDraw = applyTrim(bRightAdj, trim.right);

  // Droite : centree sur les exits right
  const bandRight = scene.add.rectangle(
    bRightDraw.maxX + bandThickness / 2,
    (bRightDraw.minY + bRightDraw.maxY) / 2,
    bandThickness,
    bRightDraw.maxY - bRightDraw.minY,
    0x000000,
    0.28
  );
  bandRight.setDepth(EXIT_BAND_DEPTH);
  bandRight.setScrollFactor(1);
  bandRight.setVisible(false);

  const lineRight = scene.add.rectangle(
    bRightDraw.maxX + bandThickness,
    (bRightDraw.minY + bRightDraw.maxY) / 2,
    4,
    bRightDraw.maxY - bRightDraw.minY,
    0xffffff,
    0.5
  );
  lineRight.setDepth(EXIT_BAND_DEPTH);
  lineRight.setScrollFactor(1);
  lineRight.setVisible(false);

  // Gauche
  const bandLeft = scene.add.rectangle(
    bLeftDraw.minX - bandThickness / 2,
    (bLeftDraw.minY + bLeftDraw.maxY) / 2,
    bandThickness,
    bLeftDraw.maxY - bLeftDraw.minY,
    0x000000,
    0.28
  );
  bandLeft.setDepth(EXIT_BAND_DEPTH);
  bandLeft.setScrollFactor(1);
  bandLeft.setVisible(false);

  const lineLeft = scene.add.rectangle(
    bLeftDraw.minX - bandThickness,
    (bLeftDraw.minY + bLeftDraw.maxY) / 2,
    4,
    bLeftDraw.maxY - bLeftDraw.minY,
    0xffffff,
    0.5
  );
  lineLeft.setDepth(EXIT_BAND_DEPTH);
  lineLeft.setScrollFactor(1);
  lineLeft.setVisible(false);

  // Haut
  const bandTop = scene.add.rectangle(
    (bTopDraw.minX + bTopDraw.maxX) / 2,
    bTopDraw.minY - bandThickness / 2,
    bTopDraw.maxX - bTopDraw.minX,
    bandThickness,
    0x000000,
    0.28
  );
  bandTop.setDepth(EXIT_BAND_DEPTH);
  bandTop.setScrollFactor(1);
  bandTop.setVisible(false);

  const lineTop = scene.add.rectangle(
    (bTopDraw.minX + bTopDraw.maxX) / 2,
    bTopDraw.minY - bandThickness,
    bTopDraw.maxX - bTopDraw.minX,
    4,
    0xffffff,
    0.5
  );
  lineTop.setDepth(EXIT_BAND_DEPTH);
  lineTop.setScrollFactor(1);
  lineTop.setVisible(false);

  // Bas (vers l'interieur)
  const bandBottom = scene.add.rectangle(
    (bBottomDraw.minX + bBottomDraw.maxX) / 2,
    bBottomDraw.maxY + bandThickness / 2, // on place la bande sous le bord visible
    bBottomDraw.maxX - bBottomDraw.minX,
    bandThickness,
    0x000000,
    0.28
  );
  bandBottom.setDepth(EXIT_BAND_DEPTH);
  bandBottom.setScrollFactor(1);
  bandBottom.setVisible(false);

  const lineBottom = scene.add.rectangle(
    (bBottomDraw.minX + bBottomDraw.maxX) / 2,
    bBottomDraw.maxY + bandThickness,
    bBottomDraw.maxX - bBottomDraw.minX,
    4,
    0xffffff,
    0.5
  );
  lineBottom.setDepth(EXIT_BAND_DEPTH);
  lineBottom.setScrollFactor(1);
  lineBottom.setVisible(false);

  // Hover
  const hoverHandler = (pointer) => {
    const cam = scene.cameras.main;
    if (!cam) return;

    const hudScreenY = cam.height - HUD_HEIGHT;
    if (pointer.y >= hudScreenY) {
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

    const worldPoint = cam.getWorldPoint(pointer.x, pointer.y);
    const wx = worldPoint.x;
    const wy = worldPoint.y;

    const overRight = wx >= bRightDraw.maxX && wx <= bRightDraw.maxX + bandThickness && wy >= bRightDraw.minY && wy <= bRightDraw.maxY;
    const overLeft = wx <= bLeftDraw.minX && wx >= bLeftDraw.minX - bandThickness && wy >= bLeftDraw.minY && wy <= bLeftDraw.maxY;
    const overTop = wy <= bTopDraw.minY && wy >= bTopDraw.minY - bandThickness && wx >= bTopDraw.minX && wx <= bTopDraw.maxX;
    const overBottom = wy >= bBottomDraw.maxY && wy <= bBottomDraw.maxY + bandThickness && wx >= bBottomDraw.minX && wx <= bBottomDraw.maxX;

    bandRight.setVisible(overRight);
    lineRight.setVisible(overRight);
    bandLeft.setVisible(overLeft);
    lineLeft.setVisible(overLeft);
    bandTop.setVisible(overTop);
    lineTop.setVisible(overTop);
    bandBottom.setVisible(overBottom);
    lineBottom.setVisible(overBottom);
  };

  scene.input.on("pointermove", hoverHandler);
  scene._mapExitHoverHandler = hoverHandler;

  scene._mapExitBandRight = bandRight;
  scene._mapExitLineRight = lineRight;
  scene._mapExitBandLeft = bandLeft;
  scene._mapExitLineLeft = lineLeft;
  scene._mapExitBandTop = bandTop;
  scene._mapExitLineTop = lineTop;
  scene._mapExitBandBottom = bandBottom;
  scene._mapExitLineBottom = lineBottom;
}
