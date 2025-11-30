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
  maptest: {
    key: "maptest",
    worldPos: { x: 0, y: 0 },
    jsonPath: "assets/maps/Map1Andemia.json",
    tilesets: anemiaTilesets,
    cameraOffsets: { x: 0, y: 43 },
  },

  maptest2: {
    key: "maptest2",
    worldPos: { x: 1, y: 0 }, // à droite de maptest
    jsonPath: "assets/maps/Map2Andemia.json",
    tilesets: anemiaTilesets,
    cameraOffsets: { x: 0, y: 43 },
  },
};

export const defaultMapKey = "maptest";
