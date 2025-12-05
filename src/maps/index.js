const anemiaTilesets = [
  {
    name: "tilesetperso",
    imageKey: "tilesetperso",
    imagePath: "assets/tileset/tilesetperso.png",
  },
];


export const maps = {
  // Unique map de départ
  Map1Andemia: {
    key: "Map1Andemia",
    worldPos: { x: 0, y: 0 },
    jsonPath: "assets/maps/MapAndemiaTest4.json",
    tilesets: anemiaTilesets,
    cameraOffsets: { x: 0, y: 43 },
  },
};

export const defaultMapKey = "Map1Andemia";
