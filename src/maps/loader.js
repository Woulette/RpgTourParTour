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

export function buildMap(scene, mapDef) {
  const map = scene.make.tilemap({ key: mapDef.key });

  // Create Phaser tilesets only for those that exist in Tiled JSON.
  const tilesets = map.tilesets.map((tsData) => {
    const def = mapDef.tilesets.find((ts) => ts.name === tsData.name);
    const textureKey = def ? def.imageKey : tsData.name;

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

    if (def) {
      return map.addTilesetImage(def.name, textureKey);
    }
    return map.addTilesetImage(tsData.name, textureKey);
  });

  const createdLayers = map.layers.map((layerData, index) => {
    const layer = map.createLayer(layerData.name, tilesets);
    layer.setOrigin(0, 0);
    layer.setDepth(index);
    return layer;
  });

  const groundLayer = createdLayers[0];
  return { map, groundLayer, layers: createdLayers };
}

