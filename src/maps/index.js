const anemiaTilesets = [
  {
    name: "tilesetperso",
    imageKey: "tilesetperso",
    imagePath: "assets/tileset/tilesetperso.png",
  },
  {
    name: "FalaiseFace",
    imageKey: "FalaiseFace",
    imagePath: "assets/tileset/FalaiseFace.png",
  },
  {
    name: "FalaiseFace2",
    imageKey: "FalaiseFace2",
    imagePath: "assets/tileset/FalaiseFace2.png",
  },
  {
    name: "FalaiseGauche",
    imageKey: "FalaiseGauche",
    imagePath: "assets/tileset/FalaiseGauche.png",
  },
  {
    name: "FalaiseGauche2",
    imageKey: "FalaiseGauche2",
    imagePath: "assets/tileset/FalaiseGauche2.png",
  },
  {
    name: "FalaiseTerminaison",
    imageKey: "FalaiseTerminaison",
    imagePath: "assets/tileset/FalaiseTerminaison.png",
  },
  {
    name: "herbe5",
    imageKey: "herbe5",
    imagePath: "assets/tileset/herbe5.png",
  },
];

export const maps = {
  // Map de départ au centre
  Map1Andemia: {
    key: "Map1Andemia",
    worldPos: { x: 0, y: 0 },
    jsonPath: "assets/maps/MapAndemiaTest.json",
    tilesets: anemiaTilesets,
    cameraOffsets: { x: 0, y: 43 },
  },

  // Map à droite
  Map2Andemia: {
    key: "Map2Andemia",
    worldPos: { x: 1, y: 0 },
    jsonPath: "assets/maps/Map2Andemia.json",
    tilesets: anemiaTilesets,
    cameraOffsets: { x: 0, y: 43 },
  },

  // Map du bas
  Map3Andemia: {
    key: "Map3Andemia",
    worldPos: { x: 0, y:-1 }, // au-dessous de Map1Andemia
    jsonPath: "assets/maps/Map3andemia.json",
    tilesets: anemiaTilesets,
    cameraOffsets: { x: 0, y: 43 },
  },
};

export const defaultMapKey = "Map1Andemia";
