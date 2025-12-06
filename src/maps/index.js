const anemiaTilesets = [
  {
    name: "tilesetperso",
    imageKey: "tilesetperso",
    imagePath: "assets/tileset/tilesetperso.png",
  },
];

export const maps = {
  Map1Andemia: {
    key: "Map1Andemia",
    worldPos: { x: 0, y: 0 },
    jsonPath: "assets/maps/MapAndemiaTest4.json",
    tilesets: anemiaTilesets,
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: true,
  },
  Map2Andemia: {
    key: "Map2Andemia",
    worldPos: { x: 1, y: 0 },
    jsonPath: "assets/maps/MapAndemiaTest5.json",
    tilesets: anemiaTilesets,
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: false,
  },
};

export const defaultMapKey = "Map1Andemia";
