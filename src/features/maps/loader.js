export function preloadMap(scene, mapDef) {
  scene.load.tilemapTiledJSON(mapDef.key, mapDef.jsonPath);
  mapDef.tilesets.forEach((ts) => {
    if (ts.frameWidth && ts.frameHeight) {
      scene.load.spritesheet(ts.imageKey, ts.imagePath, {
        frameWidth: ts.frameWidth,
        frameHeight: ts.frameHeight,
      });
    } else {
      scene.load.image(ts.imageKey, ts.imagePath);
    }
  });
}

const PIXEL_ART_KEYS = new Set([
  "MaisonVillage1",
  "MaisonVillage2",
  "MaisonVillage3",
  "MaisonVillage4",
  "MaisonAlchimiste",
  "TourMairie",
]);

export function buildMap(scene, mapDef) {
  const map = scene.make.tilemap({ key: mapDef.key });

  // Create Phaser tilesets only for those that exist in Tiled JSON.
  const tilesets = map.tilesets.map((tsData) => {
    const def = mapDef.tilesets.find((ts) => ts.name === tsData.name);
    const textureKey = def ? def.imageKey : tsData.name;

    // Force sharp filtering for large house sprites while keeping the rest smooth.
    if (
      scene &&
      scene.textures &&
      scene.textures.exists(textureKey) &&
      PIXEL_ART_KEYS.has(textureKey)
    ) {
      const texture = scene.textures.get(textureKey);
      if (texture && texture.setFilter && Phaser?.Textures?.FilterMode) {
        texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }

    // Safety: if a tileset texture isn't loaded (missing PNG), create a small
    // placeholder texture so the map can still load.
    if (scene && scene.textures && !scene.textures.exists(textureKey)) {
      const w = tsData.tileWidth || tsData.tilewidth || 16;
      const h = tsData.tileHeight || tsData.tileheight || 16;
      const canvasTex = scene.textures.createCanvas(textureKey, w, h);
      const ctx = canvasTex.getContext();
      ctx.fillStyle = "#ff00ff";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#000000";
      ctx.fillRect(
        0,
        0,
        Math.max(1, Math.floor(w / 4)),
        Math.max(1, Math.floor(h / 4))
      );
      canvasTex.refresh();
    }

    const phaserTileset = def
      ? map.addTilesetImage(def.name, textureKey)
      : map.addTilesetImage(tsData.name, textureKey);

    // Décors "gros sprites" (maisons, taverne, etc.) : on aligne le bas du sprite
    // sur la tuile isométrique via un tileOffset (comme dans Tiled).
    if (phaserTileset && def) {
      const ox =
        typeof def.tileOffsetX === "number" ? def.tileOffsetX : 0;
      const oy =
        typeof def.tileOffsetY === "number"
          ? def.tileOffsetY
          : def.autoTileOffset
          ? map.tileHeight - (tsData.tileHeight || 0)
          : 0;
      if (ox || oy) {
        if (phaserTileset.tileOffset) {
          phaserTileset.tileOffset.x = ox;
          phaserTileset.tileOffset.y = oy;
        } else {
          phaserTileset.tileOffsetX = ox;
          phaserTileset.tileOffsetY = oy;
        }
      }
    }

    return phaserTileset;
  });

  const createdLayers = map.layers.map((layerData, index) => {
    const layer = map.createLayer(layerData.name, tilesets);
    layer.setOrigin(0, 0);
    layer.setDepth(index);
    return layer;
  });

  const getLayerName = (layer) =>
    (layer && layer.layer && layer.layer.name) || layer?.name || "";

  let groundLayer = createdLayers[0];
  if (mapDef && typeof mapDef.groundLayerName === "string") {
    const desired = mapDef.groundLayerName.trim();
    if (desired) {
      groundLayer =
        createdLayers.find((l) => getLayerName(l) === desired) || groundLayer;
    }
  } else {
    // Fallback : évite les calques "décor" typiques si le 1er calque n'est pas le sol.
    groundLayer =
      createdLayers.find((l) => {
        const n = getLayerName(l).toLowerCase().trim();
        if (!n) return false;
        if (n.includes("nogrid")) return false;
        if (n.includes("tronc")) return false;
        if (n.includes("feuillage")) return false;
        if (n.includes("canopy")) return false;
        return true;
      }) || groundLayer;
  }
  return { map, groundLayer, layers: createdLayers };
}
