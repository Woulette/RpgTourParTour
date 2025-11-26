export function preloadMap(scene, mapDef) {
  scene.load.tilemapTiledJSON(mapDef.key, mapDef.jsonPath);
  mapDef.tilesets.forEach((ts) => {
    scene.load.image(ts.imageKey, ts.imagePath);
  });
}

export function buildMap(scene, mapDef) {
  const map = scene.make.tilemap({ key: mapDef.key });
  const ts = mapDef.tilesets[0];
  const tileset = map.addTilesetImage(ts.name, ts.imageKey);
  const groundLayer = map.createLayer(map.layers[0].name, tileset);
  return { map, groundLayer };
}
