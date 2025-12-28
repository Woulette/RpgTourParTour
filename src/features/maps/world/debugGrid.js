import { GRID_ALPHA, SHOW_GRID } from "../../../config/constants.js";

function getLayerName(layer) {
  return (
    (layer && layer.name) ||
    (layer && layer.layer && layer.layer.name) ||
    ""
  )
    .toLowerCase()
    .trim();
}

function isDecorLayerName(name) {
  if (!name) return false;
  return (
    name.includes("tronc") ||
    name.includes("feuillage") ||
    name.includes("canopy")
  );
}

// (Re)construit la grille debug sur les cases "sol" (union des tilelayers),
// en ignorant les calques de décor typiques (tronc/feuillage).
export function rebuildDebugGrid(scene, map, groundLayer, mapLayers) {
  if (!scene) return null;

  if (!SHOW_GRID) {
    if (scene.debugGrid?.destroy) scene.debugGrid.destroy();
    scene.debugGrid = null;
    return null;
  }

  const layers = Array.isArray(mapLayers) ? mapLayers : [];
  if (!map || !groundLayer || layers.length === 0) return null;

  if (!scene.debugGrid) {
    scene.debugGrid = scene.add.graphics();
  } else {
    scene.debugGrid.clear();
  }

  const grid = scene.debugGrid;
  const alpha = typeof GRID_ALPHA === "number" ? GRID_ALPHA : 1;
  grid.lineStyle(1, 0xffffff, alpha);

  const mapDef = scene.currentMapDef || null;
  const preferredNames = Array.isArray(mapDef?.debugGridLayerNames)
    ? mapDef.debugGridLayerNames
        .map((n) => String(n).toLowerCase().trim())
        .filter(Boolean)
    : null;

  const shouldIncludeLayer = (layer) => {
    const name = getLayerName(layer);
    if (!name) return false;
    if (isDecorLayerName(name)) return false;
    if (preferredNames && preferredNames.length > 0) {
      return preferredNames.includes(name);
    }
    return true;
  };

  // Place la grille juste au-dessus des tilelayers inclus (ex: calque 1/2),
  // mais sous les autres calques (ex: calque 5, tronc/feuillage).
  let maxIncludedDepth = 0;
  layers.forEach((layer) => {
    if (!shouldIncludeLayer(layer)) return;
    const d = layer?.depth;
    if (typeof d === "number" && d > maxIncludedDepth) maxIncludedDepth = d;
  });
  grid.setDepth(maxIncludedDepth + 0.01);

  if (scene.hudCamera?.ignore) {
    scene.hudCamera.ignore(grid);
  }

  const halfW = map.tileWidth / 2;
  const halfH = map.tileHeight / 2;

  // Collecte les cases à dessiner depuis les tilelayers autorisés.
  const cells = new Set();
  layers.forEach((layer) => {
    if (!layer?.forEachTile) return;
    if (!shouldIncludeLayer(layer)) return;

    layer.forEachTile((tile) => {
      if (!tile || typeof tile.index !== "number" || tile.index === -1) return;
      const ts = tile.tileset;
      if (
        ts &&
        typeof ts.tileWidth === "number" &&
        typeof ts.tileHeight === "number" &&
        (ts.tileWidth !== map.tileWidth || ts.tileHeight !== map.tileHeight)
      ) {
        // Ignore les gros tilesets (ex: maison 200x200) pour la grille.
        return;
      }
      cells.add(`${tile.x},${tile.y}`);
    });
  });

  cells.forEach((key) => {
    const [sx, sy] = key.split(",");
    const tx = Number(sx);
    const ty = Number(sy);
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;

    const worldPos = map.tileToWorldXY(tx, ty, undefined, undefined, groundLayer);
    const cx = worldPos.x + halfW;
    const cy = worldPos.y + halfH;

    const points = [
      new Phaser.Math.Vector2(cx, cy - halfH), // haut
      new Phaser.Math.Vector2(cx + halfW, cy), // droite
      new Phaser.Math.Vector2(cx, cy + halfH), // bas
      new Phaser.Math.Vector2(cx - halfW, cy), // gauche
    ];

    grid.strokePoints(points, true);
  });

  return grid;
}
