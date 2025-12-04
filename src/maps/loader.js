export function preloadMap(scene, mapDef) {
  scene.load.tilemapTiledJSON(mapDef.key, mapDef.jsonPath);
  mapDef.tilesets.forEach((ts) => {
    scene.load.image(ts.imageKey, ts.imagePath);
  });
}

export function buildMap(scene, mapDef) {
  const map = scene.make.tilemap({ key: mapDef.key });

  // On ne crée des tilesets Phaser que pour ceux
  // qui existent réellement dans la carte Tiled.
  const tilesets = map.tilesets.map((tsData) => {
    const def = mapDef.tilesets.find((ts) => ts.name === tsData.name);
    if (def) {
      return map.addTilesetImage(def.name, def.imageKey);
    }
    // Fallback : tente avec le même nom pour la texture.
    return map.addTilesetImage(tsData.name);
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
