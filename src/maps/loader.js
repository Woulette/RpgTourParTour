export function preloadMap(scene, mapDef) {
  scene.load.tilemapTiledJSON(mapDef.key, mapDef.jsonPath);
  mapDef.tilesets.forEach((ts) => {
    scene.load.image(ts.imageKey, ts.imagePath);
  });
}

export function buildMap(scene, mapDef) {
  const map = scene.make.tilemap({ key: mapDef.key });
  const tilesets = mapDef.tilesets.map((ts) =>
    map.addTilesetImage(ts.name, ts.imageKey)
  );

  const createdLayers = map.layers.map((layerData, index) => {
    const layer = map.createLayer(layerData.name, tilesets);
    layer.setOrigin(0, 0);
    layer.setDepth(index);
    return layer;
  });

  const groundLayer = createdLayers[0];
  return { map, groundLayer, layers: createdLayers };
}
