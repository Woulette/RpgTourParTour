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

// Tileset utilisé par assets/maps/MAPDEDEPARTANDEMIA.json (nom Tiled : "MapJeu1 (1)").
const mapDepartTileset = {
  name: "MapJeu1 (1)",
  imageKey: "MapJeu1_1",
  imagePath: "assets/tileset/MapJeu1 (1).png",
  frameWidth: 64,
  frameHeight: 32,
};

// Tileset utilisé par assets/maps/MAPDEDEPARTANDEMIA2.json (nom Tiled : "MapJeu2 (1)").
const mapDepartTileset2 = {
  name: "MapJeu2 (1)",
  imageKey: "MapJeu2_1",
  imagePath: "assets/tileset/MapJeu2 (1).png",
  frameWidth: 64,
  frameHeight: 32,
};

// Tileset utilisé par assets/maps/MAPDEDEPARTANDEMIA2.json (nom Tiled : "TestMapPnGPourDOfus de moi meme").
// Note: l'image attendue n'était pas dans le repo, on charge donc `assets/TestMapPnGPourDOfus de moi meme.png`.
const testMapDofusTileset = {
  name: "TestMapPnGPourDOfus de moi meme",
  imageKey: "TestMapPnGPourDofus",
  imagePath: "assets/TestMapPnGPourDOfus de moi meme.png",
  frameWidth: 1088,
  frameHeight: 608,
};

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
};

const entreeDonjonTileset = {
  name: "EntreDonjons1Teste",
  imageKey: "EntreDonjons1Teste",
  imagePath: "assets/EntreDonjons1Teste.png",
  frameWidth: 164,
  frameHeight: 124,
};

const maisonVillage1Tileset = {
  name: "MaisonVillage1",
  imageKey: "MaisonVillage1",
  imagePath: "assets/MesDecor/MaisonVillage1.png",
  frameWidth: 200,
  frameHeight: 200,
  autoTileOffset: true,
};

const taverneTileset = {
  name: "Taverne",
  imageKey: "Taverne",
  imagePath: "assets/MesDecor/Taverne.png",
  frameWidth: 200,
  frameHeight: 200,
  autoTileOffset: true,
};

const donjonDecorOssementTileset = {
  name: "Ossement",
  imageKey: "Ossement",
  imagePath: "assets/Ossement.png",
};

const donjonDecorStatueBossTileset = {
  name: "StatueBossDonjonAluineeks",
  imageKey: "StatueBossDonjonAluineeks",
  imagePath: "assets/StatueBossDonjonAluineeks.png",
};

const donjonDecorTroneBossTileset = {
  name: "TroneBossAluineeks",
  imageKey: "TroneBossAluineeks",
  imagePath: "assets/TroneBossAluineeks.png",
};

// Tilesets pour assets/maps/MapPourtesteVite fait Andemia.json
const mapPourTestViteTilesets = [
  {
    name: "testeBase2+2",
    imageKey: "testeBase2+2",
    imagePath: "assets/NouveauAssetSolEncours/testeBase2+2.png",
    frameWidth: 64,
    frameHeight: 32,
  },
  {
    name: "testeBase",
    imageKey: "testeBase",
    imagePath: "assets/NouveauAssetSolEncours/testeBase.png",
    frameWidth: 64,
    frameHeight: 32,
  },
  {
    name: "Sprite-0006",
    imageKey: "Sprite-0006",
    imagePath: "assets/NouveauAssetSolEncours/Sprite-0006.png",
    frameWidth: 64,
    frameHeight: 32,
  },
  {
    name: "Sprite-0005",
    imageKey: "Sprite-0005",
    imagePath: "assets/NouveauAssetSolEncours/Sprite-0005.png",
    frameWidth: 64,
    frameHeight: 32,
  },
  {
    name: "testTerre3",
    imageKey: "testTerre3",
    imagePath: "assets/NouveauAssetSolEncours/testTerre3.png",
    frameWidth: 64,
    frameHeight: 32,
  },
];

export const maps = {
  MapDeDepartAndemia: {
    key: "MapDeDepartAndemia",
    // Coordonnées monde dédiées (évite les collisions avec MapAndemia*).
    worldPos: { x: 100, y: 100 },
    jsonPath: "assets/maps/MAPDEDEPARTANDEMIA.json",
    enabled: false,
    tilesets: [...tilesetNew, entreeDonjonTileset, mapDepartTileset],
    groundLayerName: "Calque de Tuiles 1",
    startTile: { x: 18, y: 9 },
    cameraOffsets: { x: 0, y: 43 },
    // Map de départ : pas de spawns de test par défaut.
    spawnDefaults: false,
    treePositions: [],
    exitBounds: null,
  },
  MapDeDepartAndemia2: {
    key: "MapDeDepartAndemia2",
    // À gauche de la map de départ (100,100).
    worldPos: { x: 99, y: 100 },
    jsonPath: "assets/maps/MAPDEDEPARTANDEMIA2.json",
    enabled: false,
    tilesets: [
      ...tilesetNew,
      entreeDonjonTileset,
      mapDepartTileset2,
      testMapDofusTileset,
    ],
    groundLayerName: "Calque de Tuiles 1",
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: false,
    treePositions: [],
    exitBounds: null,
  },
  MapPourTestViteAndemia: {
    key: "MapPourTestViteAndemia",
    jsonPath: "assets/maps/MapPourtesteVite fait Andemia.json",
    enabled: false,
    tilesets: [...tilesetNew, ...mapPourTestViteTilesets],
    groundLayerName: "Calque de Tuiles 1",
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: false,
    treePositions: [],
    exitBounds: null,
  },
  Map1Andemia: {
    key: "Map1Andemia",
    worldPos: { x: 0, y: 0 },
    jsonPath: "assets/maps/MapAndemiaNouvelleVersion1.json",
    tilesets: [...tilesetNew, entreeDonjonTileset, maisonVillage1Tileset],
    // La grille debug ne doit pas passer au-dessus des calques décor (ex: "Calque de Tuiles 5").
    debugGridLayerNames: ["Calque de Tuiles 1", "Calque de Tuiles 2"],
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: true,
    monsterSpawns: [
      {
        groupPool: ["corbeau", "gravorbeau", "flamorbeau", "ondoreau"],
        groupSizeMin: 1,
        groupSizeMax: 4,
        forceMixedGroup: true,
        offsetFromCenter: { x: -4, y: 6 },
      },
      {
        groupPool: ["corbeau", "gravorbeau", "flamorbeau", "ondoreau"],
        groupSizeMin: 1,
        groupSizeMax: 4,
        forceMixedGroup: true,
        offsetFromCenter: { x: -7, y: -3 },
      },
      {
        groupPool: ["corbeau", "gravorbeau", "flamorbeau", "ondoreau"],
        groupSizeMin: 1,
        groupSizeMax: 4,
        forceMixedGroup: true,
        offsetFromCenter: { x: 4, y: 2 },
      },
      {
        groupPool: ["corbeau", "gravorbeau", "flamorbeau", "ondoreau"],
        groupSizeMin: 1,
        groupSizeMax: 4,
        forceMixedGroup: true,
        offsetFromCenter: { x: 5, y: -3 },
      },
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
  MapAndemiaNouvelleVersion2: {
    key: "MapAndemiaNouvelleVersion2",
    // À gauche de Map1Andemia (0,0).
    worldPos: { x: -1, y: 0 },
    jsonPath: "assets/maps/MapAndemiaNouvelleVersion2.json",
    tilesets: [...tilesetNew, entreeDonjonTileset],
    groundLayerName: "Calque de Tuiles 1",
    // Même logique de grille que la map principale (ne pas passer au-dessus des calques décor).
    debugGridLayerNames: ["Calque de Tuiles 1", "Calque de Tuiles 2"],
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: true,
    monsterSpawns: [
      {
        groupPool: ["corbeau", "gravorbeau", "flamorbeau", "ondoreau"],
        groupSizeMin: 1,
        groupSizeMax: 4,
        forceMixedGroup: true,
        offsetFromCenter: { x: -6, y: 3 },
      },
      {
        groupPool: ["corbeau", "gravorbeau", "flamorbeau", "ondoreau"],
        groupSizeMin: 1,
        groupSizeMax: 4,
        forceMixedGroup: true,
        offsetFromCenter: { x: 6, y: -2 },
      },
      {
        groupPool: ["corbeau", "gravorbeau", "flamorbeau", "ondoreau"],
        groupSizeMin: 1,
        groupSizeMax: 4,
        forceMixedGroup: true,
        offsetFromCenter: { x: -3, y: -6 },
      },
      {
        groupPool: ["corbeau", "gravorbeau", "flamorbeau", "ondoreau"],
        groupSizeMin: 1,
        groupSizeMax: 4,
        forceMixedGroup: true,
        offsetFromCenter: { x: 4, y: 6 },
      },
    ],
    treePositions: [
      { tileX: 11, tileY: 22 },
      { tileX: 20, tileY: 20 },
      { tileX: 19, tileY: 8 },
    ],
    exitBounds: null,
  },
  MapAndemiaNouvelleVersion3: {
    key: "MapAndemiaNouvelleVersion3",
    // Au-dessus de MapAndemiaNouvelleVersion2 (-1,0).
    worldPos: { x: -1, y: -1 },
    jsonPath: "assets/maps/MapAndemiaNouvelleVersion3.json",
    tilesets: [...tilesetNew, entreeDonjonTileset, taverneTileset],
    groundLayerName: "Calque de Tuiles 1",
    debugGridLayerNames: ["Calque de Tuiles 1", "Calque de Tuiles 2"],
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: false,
    monsterSpawns: [],
    treePositions: [
      { tileX: 8, tileY: 18 },
      { tileX: 23, tileY: 23 },
      { tileX: 19, tileY: 8 },
    ],
    exitBounds: null,
  },
  MapAndemia5: {
    key: "MapAndemia5",
    worldPos: { x: 0, y: -1 }, // au-dessus de Map1Andemia (0,0)
    jsonPath: "assets/maps/MapAndemia5.json",
    tilesets: [...tilesetNew, entreeDonjonTileset],
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: true,
    monsterSpawns: [
      {
        groupPool: ["goush", "liburion"],
        groupSizeMin: 1,
        groupSizeMax: 4,
        offsetFromCenter: { x: -6, y: 3 },
      },
      {
        groupPool: ["goush", "liburion"],
        groupSizeMin: 1,
        groupSizeMax: 4,
        offsetFromCenter: { x: 6, y: -2 },
      },
      {
        groupPool: ["goush", "liburion"],
        groupSizeMin: 1,
        groupSizeMax: 4,
        offsetFromCenter: { x: -3, y: -6 },
      },
      {
        groupPool: ["goush", "liburion"],
        groupSizeMin: 1,
        groupSizeMax: 4,
        offsetFromCenter: { x: 4, y: 6 },
      },
    ],
    treePositions: [],
    exitBounds: null,
  },
  MapAndemia6: {
    key: "MapAndemia6",
    worldPos: { x: 1, y: -1 }, // à droite de MapAndemia5 (0,-1)
    jsonPath: "assets/maps/MapAndemia6.json",
    tilesets: [...tilesetNew],
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: true,
    monsterSpawns: [],
    treePositions: [],
    exitBounds: null,
  },
  MapAndemia7: {
    key: "MapAndemia7",
    worldPos: { x: -1, y: -2 }, // au-dessus de MapAndemia3 (-1,-1)
    jsonPath: "assets/maps/MapAndemia7.json",
    tilesets: [...tilesetNew, entreeDonjonTileset],
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: true,
    monsterSpawns: [],
    treePositions: [],
    exitBounds: null,
  },
  MapAndemia8: {
    key: "MapAndemia8",
    worldPos: { x: 0, y: -2 }, // au-dessus de MapAndemia5 (0,-1)
    jsonPath: "assets/maps/MapAndemia8.json",
    tilesets: [...tilesetNew, entreeDonjonTileset],
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: true,
    monsterSpawns: [],
    treePositions: [],
    exitBounds: null,
  },
  MapAndemia9: {
    key: "MapAndemia9",
    worldPos: { x: 1, y: -2 }, // au-dessus de MapAndemia6 (1,-1)
    jsonPath: "assets/maps/MapAndemia9.json",
    tilesets: [...tilesetNew, entreeDonjonTileset],
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: true,
    monsterSpawns: [],
    treePositions: [],
    exitBounds: null,
  },
  MapAndemia10: {
    key: "MapAndemia10",
    worldPos: { x: -2, y: 0 }, // à gauche de MapAndemia2 (-1,0)
    jsonPath: "assets/maps/MapAndemia10.json",
    tilesets: [...tilesetNew, entreeDonjonTileset],
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: true,
    monsterSpawns: [],
    treePositions: [],
    exitBounds: null,
  },
  MapAndemia11: {
    key: "MapAndemia11",
    worldPos: { x: -2, y: -1 }, // à gauche de MapAndemia3 (-1,-1)
    jsonPath: "assets/maps/MapAndemia11.json",
    tilesets: [...tilesetNew, entreeDonjonTileset],
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: true,
    monsterSpawns: [],
    treePositions: [],
    exitBounds: null,
  },
  MapAndemia12: {
    key: "MapAndemia12",
    worldPos: { x: -2, y: -2 }, // au-dessus de MapAndemia11 (-2,-1)
    jsonPath: "assets/maps/MapAndemia12.json",
    tilesets: [...tilesetNew, entreeDonjonTileset],
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: true,
    monsterSpawns: [],
    treePositions: [],
    exitBounds: null,
  },
  MapAndemia3: {
    key: "MapAndemia3",
    worldPos: { x: -1, y: -1 }, // au-dessus de MapAndemia2 (-1,0)
    jsonPath: "assets/maps/MapAndemia3.json",
    tilesets: [...tilesetNew, craftTableTileset, entreeDonjonTileset],
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: false,
    monsterSpawns: [],
    treePositions: [],
    // Placement manuel du PNJ d'entrée du donjon (src/dungeons/entranceNpc.js)
    // Ajuste ces tuiles comme tu veux.
    entranceNpcTile: { x: 15, y: 6 },
    // Offset en pixels (affinage visuel) pour le PNJ d'entrée.
    entranceNpcOffset: { x: 0, y: -20 },
    // Où replacer le joueur en sortant du donjon (si tu veux forcer un point précis).
    // Sinon, le jeu se base sur entranceNpcTile et cherche une case libre autour.
    dungeonReturnTile: { x: 17, y: 17 },
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

  // --- Donjon Aluineeks (4 salles) ---
  // Note : pas de worldPos => inaccessible via les bandes de sortie (uniquement via PNJ).
  Map1DonjonAluineeks: {
    key: "Map1DonjonAluineeks",
    jsonPath: "assets/maps/Map1DonjonAluineeks.json",
    tilesets: [...tilesetNew, entreeDonjonTileset, donjonDecorOssementTileset],
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: true,
    isDungeon: true,
    dungeonId: "aluineeks",
    dungeonRoomIndex: 1,
    monsterSpawns: [
      // Un seul pack de 4 (les membres supplémentaires apparaissent en combat)
      { type: "chibone", groupSize: 4, offsetFromCenter: { x: 0, y: 0 } },
    ],
    treePositions: [],
    exitBounds: null,
  },
  Map2DonjonAluineeks: {
    key: "Map2DonjonAluineeks",
    jsonPath: "assets/maps/Map2DonjonAluineeks.json",
    tilesets: [...tilesetNew, entreeDonjonTileset, donjonDecorOssementTileset],
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: true,
    isDungeon: true,
    dungeonId: "aluineeks",
    dungeonRoomIndex: 2,
    monsterSpawns: [
      // Un seul pack de 4
      { type: "chibone", groupSize: 4, offsetFromCenter: { x: 0, y: 0 } },
    ],
    treePositions: [],
    exitBounds: null,
  },
  Map3DonjonAluineeks: {
    key: "Map3DonjonAluineeks",
    jsonPath: "assets/maps/Map3DonjonAluineeks.json",
    tilesets: [...tilesetNew, entreeDonjonTileset, donjonDecorOssementTileset],
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: true,
    isDungeon: true,
    dungeonId: "aluineeks",
    dungeonRoomIndex: 3,
    monsterSpawns: [
      // Un seul pack de 4
      { type: "skelbone", groupSize: 4, offsetFromCenter: { x: 0, y: 0 } },
    ],
    treePositions: [],
    exitBounds: null,
  },
  Map4DonjonAluineeks: {
    key: "Map4DonjonAluineeks",
    jsonPath: "assets/maps/Map4DonjonAluineeks.json",
    tilesets: [
      ...tilesetNew,
      entreeDonjonTileset,
      donjonDecorOssementTileset,
      donjonDecorStatueBossTileset,
      donjonDecorTroneBossTileset,
    ],
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: true,
    isDungeon: true,
    dungeonId: "aluineeks",
    dungeonRoomIndex: 4,
    monsterSpawns: [
      { type: "senbone", groupSize: 1, offsetFromCenter: { x: 0, y: 0 } },
    ],
    treePositions: [],
    exitBounds: null,
  },
};

export const defaultMapKey = "Map1Andemia";
