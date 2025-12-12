const tilesetNew = [
  {
    name: "NewTilesetPerso",
    imageKey: "NewTilesetPerso",
    imagePath: "assets/tileset/NewTilesetPerso.png",
    frameWidth: 64,
    frameHeight: 32,
  },
  {
    name: "Boulleau",
    imageKey: "Boulleau",
    imagePath: "assets/tileset/Boulleau.png",
    frameWidth: 50,
    frameHeight: 80,
  },
];

const tilesetLegacy = [
  {
    name: "tilesetperso",
    imageKey: "tilesetperso",
    imagePath: "assets/tileset/tilesetperso.png",
    frameWidth: 64,
    frameHeight: 32,
  },
];

const craftTableTileset = {
  name: "TableDeCraftTailleur",
  imageKey: "TableDeCraftTailleur",
  imagePath: "assets/TableDeCraftTailleur.png",
  frameWidth: 54,
  frameHeight: 65,
};

const craftTableBijoutierTileset = {
  name: "TableDeCraftBijoutier",
  imageKey: "TableDeCraftBijoutier",
  imagePath: "assets/TableDeCraftBijoutier.png",
  frameWidth: 54,
  frameHeight: 65,
};

const craftTableCordonnierTileset = {
  name: "TableDeCraftCordonnier",
  imageKey: "TableDeCraftCordonnier",
  imagePath: "assets/TableDeCraftCordonnier.png",
  frameWidth: 54,
  frameHeight: 65,
};

export const maps = {
  Map1Andemia: {
    key: "Map1Andemia",
    worldPos: { x: 0, y: 0 },
    jsonPath: "assets/maps/MapAndemia1.json",
    tilesets: tilesetNew,
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: true,
    monsterSpawns: [
      { type: "corbeau", groupSize: 1, offsetFromCenter: { x: -4, y: -3 } },
      { type: "corbeau", groupSize: 2, offsetFromCenter: { x: -1, y: -3 } },
      { type: "corbeau", groupSize: 3, offsetFromCenter: { x: 2, y: -3 } },
      { type: "corbeau", groupSize: 4, offsetFromCenter: { x: 5, y: -3 } },
      { type: "aluineeks", groupSize: 1, offsetFromCenter: { x: 8, y: -3 } },
    ],
    treePositions: [
      { tileX: 8, tileY: 18 },
      { tileX: 23, tileY: 23 },
      { tileX: 19, tileY: 8 },
    ],
    // Optionnel : borne manuelle des bandes de sortie (coordonnées monde).
    // Laisse null pour l’auto, ou mets { minX, minY, maxX, maxY } si tu veux régler à la main.
    exitBounds: null,
  },
  Map2Andemia: {
    key: "Map2Andemia",
    worldPos: { x: 1, y: 0 },
    jsonPath: "assets/maps/MapAndemiaTest5.json",
    tilesets: tilesetLegacy,
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: true,
    monsterSpawns: [
      { type: "corbeau", groupSize: 2, offsetFromCenter: { x: -3, y: -2 } },
      { type: "corbeau", groupSize: 1, offsetFromCenter: { x: 4, y: 1 } },
      { type: "aluineeks", groupSize: 1, offsetFromCenter: { x: 6, y: -1 } },
    ],
    treePositions: [
      { tileX: 10, tileY: 10 },
      { tileX: 18, tileY: 20 },
      { tileX: 25, tileY: 12 },
    ],
    // Bornes de bandes de sortie (coordonnées monde)
    exitBounds: null,
  },
  MapAndemia2: {
    key: "MapAndemia2",
    worldPos: { x: -1, y: 0 },
    jsonPath: "assets/maps/MapAndemia2.json",
    tilesets: [...tilesetNew, craftTableTileset, craftTableBijoutierTileset, craftTableCordonnierTileset],
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: false,
    monsterSpawns: [],
    treePositions: [],
    workstations: [
      {
        id: "tailleur",
        tileX: 15,
        tileY: 16,
        offsetX: -4,
      },
      {
        id: "bijoutier",
        tileX: 15,
        tileY: 14,
        offsetY: -4,
        textureKey: "TableDeCraftBijoutier",
      },
      {
        id: "cordonnier",
        tileX: 15,
        tileY: 12,
        offsetX: -4,
        textureKey: "TableDeCraftCordonnier",
      },
    ],
    exitBounds: null,
  },
};

export const defaultMapKey = "Map1Andemia";
