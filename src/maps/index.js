const tilesetNew = [
  {
    name: "NewTilesetPerso",
    imageKey: "NewTilesetPerso",
    imagePath: "assets/tileset/NewTilesetPerso.png",
    frameWidth: 64,
    frameHeight: 32,
  },
];

const craftTableTileset = {
  name: "TableDeCraftTailleur",
  imageKey: "TableDeCraftTailleur",
  imagePath: "assets/Sprite/Metier/TableDeCraftTailleur.png",
  frameWidth: 54,
  frameHeight: 65,
};

const craftTableBijoutierTileset = {
  name: "TableDeCraftBijoutier",
  imageKey: "TableDeCraftBijoutier",
  imagePath: "assets/Sprite/Metier/TableDeCraftBijoutier.png",
  frameWidth: 54,
  frameHeight: 65,
};

const craftTableCordonnierTileset = {
  name: "TableDeCraftCordonnier",
  imageKey: "TableDeCraftCordonnier",
  imagePath: "assets/Sprite/Metier/TableDeCraftCordonnier.png",
  frameWidth: 60,
  frameHeight: 60,
};

const craftTableAlchimisteTileset = {
  name: "TableDeAlchimiste",
  imageKey: "TableDeAlchimiste",
  imagePath: "assets/metier/Alchimiste/TableDeAlchimiste.png",
  frameWidth: 60,
  frameHeight: 60,
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

const troncArbreDecoTileset = {
  name: "TroncArbreDeco",
  imageKey: "TroncArbreDeco",
  imagePath: "assets/MesDecor/TroncArbreDeco.png",
  frameWidth: 400,
  frameHeight: 400,
  autoTileOffset: true,
};

const tourMairieTileset = {
  name: "TourMairie",
  imageKey: "TourMairie",
  imagePath: "assets/MesDecor/TourMairie.png",
  frameWidth: 500,
  frameHeight: 500,
  autoTileOffset: true,
};

const maisonAlchimisteTileset = {
  name: "MaisonAlchimiste",
  imageKey: "MaisonAlchimiste",
  imagePath: "assets/MesDecor/MaisonAlchimiste.png",
  frameWidth: 400,
  frameHeight: 400,
  autoTileOffset: true,
};

const solTaverneTileset = {
  name: "SolTaverne",
  imageKey: "SolTaverne",
  imagePath: "assets/NouveauAssetSolEncours/SolTaverne.png",
  frameWidth: 64,
  frameHeight: 32,
};

const donjonDecorOssementTileset = {
  name: "Ossement",
  imageKey: "Ossement",
  imagePath: "assets/Sprite/DonjonAluineeks/Ossement.png",
};

const donjonDecorStatueBossTileset = {
  name: "StatueBossDonjonAluineeks",
  imageKey: "StatueBossDonjonAluineeks",
  imagePath: "assets/Sprite/DonjonAluineeks/StatueBossDonjonAluineeks.png",
};

const donjonDecorTroneBossTileset = {
  name: "TroneBossAluineeks",
  imageKey: "TroneBossAluineeks",
  imagePath: "assets/Sprite/DonjonAluineeks/TroneBossAluineeks.png",
};

const donjonAluineeksTileset = {
  name: "DonjonAluineeks",
  imageKey: "DonjonAluineeks",
  imagePath: "assets/Sprite/DonjonAluineeks/DonjonAluineeks.png",
  frameWidth: 1000,
  frameHeight: 1000,
  autoTileOffset: true,
};

export const maps = {

  Map1Andemia: {
    key: "Map1Andemia",
    worldPos: { x: 0, y: 0 },
    jsonPath: "assets/maps/MapAndemiaNouvelleVersion1.json",
    tilesets: [
      ...tilesetNew,
      maisonVillage1Tileset,
      craftTableAlchimisteTileset,
    ],
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
    workstations: [
      {
        id: "alchimiste",
        tileX: 10,
        tileY: 17,
        offsetX: -4,
        textureKey: "TableDeAlchimiste",
      },
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
    tilesets: [...tilesetNew],
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
    workstations: [
      {
        id: "bucheron",
        tileX: 14,
        tileY: 18,
        textureKey: "ScierieDuBucheron",
      },
      {
        id: "bricoleur",
        tileX: 17,
        tileY: 18,
        textureKey: "EtablieDuBricoleur",
      },
    ],
    exitBounds: null,
  },
  MapAndemiaNouvelleVersion3: {
    key: "MapAndemiaNouvelleVersion3",
    // Au-dessus de MapAndemiaNouvelleVersion2 (-1,0).
    worldPos: { x: -1, y: -1 },
    jsonPath: "assets/maps/MapAndemiaNouvelleVersion3.json",
    tilesets: [
      ...tilesetNew,
      taverneTileset,
      troncArbreDecoTileset,
    ],
    groundLayerName: "Calque de Tuiles 1",
    debugGridLayerNames: ["Calque de Tuiles 1", "Calque de Tuiles 2"],
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: true,
    monsterSpawns: [
      {
        groupPool: ["corbeau", "gravorbeau", "flamorbeau", "ondoreau"],
        groupSizeMin: 1,
        groupSizeMax: 4,
        forceMixedGroup: true,
        offsetFromCenter: { x: -4, y: 4 },
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
      { tileX: 13, tileY: 19 },
      { tileX: 27, tileY: 18 },
      { tileX: 19, tileY: 8 },
    ],
    wellPositions: [
      { tileX: 14, tileY: 10, offsetX: 0, offsetY: 4 },
    ],
    // Portail au sol : quand le joueur est sur cette tuile, on entre dans la taverne.
    // Ajuste `tileX/tileY` selon la case du portail sur la map 3.
    portals: [
      {
        id: "portalTaverne",
        tileX: 11,
        tileY: 18,
        targetMapKey: "MapTaverne",
        // Spawn dans la taverne (ajuste si besoin).
        targetStartTile: { x: 18, y: 18 },
      },
    ],
    exitBounds: null,
  },
  MapAndemiaNouvelleVersion6: {
    key: "MapAndemiaNouvelleVersion6",
    // Au-dessus de MapAndemiaNouvelleVersion3 (-1,-1).
    worldPos: { x: -1, y: -2 },
    jsonPath: "assets/maps/MapAndemiaNouvelleVersion6.json",
    tilesets: [...tilesetNew],
    groundLayerName: "Calque de Tuiles 1",
    debugGridLayerNames: ["Calque de Tuiles 1", "Calque de Tuiles 2"],
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: true,
    monsterSpawns: [
      {
        groupPool: ["cazard", "gumgob"],
        groupSizeMin: 1,
        groupSizeMax: 4,
        forceMixedGroup: true,
        offsetFromCenter: { x: -4, y: -6 },
      },
      {
        groupPool: ["cazard", "gumgob"],
        groupSizeMin: 1,
        groupSizeMax: 4,
        forceMixedGroup: true,
        offsetFromCenter: { x: 5, y: 5 },
      },
    ],
    treePositions: [],
    herbPositions: [
      { tileX: 8, tileY: 12 },
      { tileX: 15, tileY: 9 },
      { tileX: 21, tileY: 16 },
    ],
    exitBounds: null,
  },
  MapAndemiaNouvelleVersion4: {
    key: "MapAndemiaNouvelleVersion4",
    // À gauche de MapAndemiaNouvelleVersion3 (-1,-1).
    worldPos: { x: -2, y: -1 },
    jsonPath: "assets/maps/MapAndemiaNouvelleVersion4.json",
    tilesets: [...tilesetNew, tourMairieTileset],
    groundLayerName: "Calque de Tuiles 1",
    debugGridLayerNames: ["Calque de Tuiles 1", "Calque de Tuiles 2"],
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: true,
    monsterSpawns: [
      {
        groupPool: ["corbeau", "gravorbeau", "flamorbeau", "ondoreau"],
        groupSizeMin: 1,
        groupSizeMax: 4,
        forceMixedGroup: true,
        offsetFromCenter: { x: -5, y: 3 },
      },
      {
        groupPool: ["corbeau", "gravorbeau", "flamorbeau", "ondoreau"],
        groupSizeMin: 1,
        groupSizeMax: 4,
        forceMixedGroup: true,
        offsetFromCenter: { x: 4, y: -4 },
      },
    ],
    treePositions: [],
    dungeonReturnTile: { x: 14, y: 20 },
    entranceNpcTile: { x: 21, y: 15 },
    exitBounds: null,
  },
  MapAndemiaNouvelleVersion7: {
    key: "MapAndemiaNouvelleVersion7",
    // Au-dessus de MapAndemiaNouvelleVersion4 (-2,-1).
    worldPos: { x:-2, y: -2 },
    jsonPath: "assets/maps/MapAndemiaNouvelleVersion7.json",
    tilesets: [...tilesetNew],
    groundLayerName: "Calque de Tuiles 1",
    debugGridLayerNames: ["Calque de Tuiles 1", "Calque de Tuiles 2"],
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: true,
    monsterSpawns: [
      {
        groupPool: ["cazard", "gumgob"],
        groupSizeMin: 1,
        groupSizeMax: 4,
        forceMixedGroup: true,
        offsetFromCenter: { x: -4, y: -6 },
      },
      {
        groupPool: ["cazard", "gumgob"],
        groupSizeMin: 1,
        groupSizeMax: 4,
        forceMixedGroup: true,
        offsetFromCenter: { x: 5, y: 5 },
      },
    ],
    treePositions: [],
    herbPositions: [
      { tileX: 9, tileY: 14 },
      { tileX: 16, tileY: 10 },
      { tileX: 22, tileY: 18 },
    ],
    workstations: [
      {
        id: "boutique",
        tileX: 10,
        tileY: 18,
        textureKey: "Boutique",
      },
    ],
    exitBounds: null,
  },
    MapAndemiaNouvelleVersion10: {
      key: "MapAndemiaNouvelleVersion10",
      // Au-dessus de MapAndemiaNouvelleVersion7 (-2,-2).
      worldPos: { x: -2, y: -3 },
      jsonPath: "assets/maps/MapAndemiaNouvelleVersion10.json",
      tilesets: [...tilesetNew],
      groundLayerName: "Calque de Tuiles 1",
      debugGridLayerNames: ["Calque de Tuiles 1", "Calque de Tuiles 2"],
      cameraOffsets: { x: 0, y: 43 },
      spawnDefaults: true,
      monsterSpawns: [],
      treePositions: [],
        riftPositions: [
          {
            id: "north_rift_f_1",
            tileX: 12,
            tileY: 19,
            textureKey: "rift_dim_1",
            closedTextureKey: "rift_dim_1_closed",
          rank: "F",
          totalMonsters: 8,
          waveCount: 2,
          waveSizes: [4, 4],
          targetMapKey: "MapFaille1",
          targetStartTile: null,
        },
          {
            id: "north_rift_f_2",
            tileX: 19,
            tileY: 12,
            textureKey: "rift_dim_2",
            closedTextureKey: "rift_dim_2_closed",
          rank: "F",
          totalMonsters: 8,
          waveCount: 2,
          waveSizes: [4, 4],
          targetMapKey: "MapFaille2",
          targetStartTile: null,
        },
      ],
      storyPortals: [
        {
          id: "dimension_portal_north",
          tileX: 13,
          tileY: 13,
          closedTextureKey: "portal_dim_closed",
          openTextureKey: "portal_dim_open",
          questId: "keeper_north_explosion_1",
          openWhenQuestCompleted: true,
          targetMapKey: null,
          targetStartTile: null,
          blocksMovement: true,
        },
      ],
        exitBounds: null,
      },
    MapFaille1: {
      key: "MapFaille1",
      worldPos: { x: 100, y: 100 },
      jsonPath: "assets/maps/MapFaille1.json",
      tilesets: [...tilesetNew],
      groundLayerName: "Calque de Tuiles 1",
      debugGridLayerNames: ["Calque de Tuiles 1", "Calque de Tuiles 2"],
      cameraOffsets: { x: 0, y: 43 },
      spawnDefaults: true,
      monsterSpawns: [
        {
          groupCounts: { skelbone: 2, liburion: 1, cedre: 1 },
          tileX: 17,
          tileY: 17,
        },
      ],
      riftEncounter: {
        waveTurn: 3,
        wave2Monsters: ["liburion", "liburion", "cedre", "skelbone"],
      },
      treePositions: [],
      exitBounds: null,
    },
    MapFaille2: {
      key: "MapFaille2",
      worldPos: { x: 101, y: 100 },
      jsonPath: "assets/maps/MapFaille2.json",
      tilesets: [...tilesetNew],
      groundLayerName: "Calque de Tuiles 1",
      debugGridLayerNames: ["Calque de Tuiles 1", "Calque de Tuiles 2"],
      cameraOffsets: { x: 0, y: 43 },
      spawnDefaults: true,
      monsterSpawns: [
        {
          groupCounts: { liburion: 1, cedre: 2, chibone: 1 },
          tileX: 17,
          tileY: 17,
        },
      ],
      riftEncounter: {
        waveTurn: 3,
        wave2Monsters: ["skelbone", "skelbone", "cedre", "cedre"],
      },
      treePositions: [],
      exitBounds: null,
    },
  MapAndemiaNouvelleVersion5: {
    key: "MapAndemiaNouvelleVersion5",
    // À gauche de MapAndemiaNouvelleVersion4 (-2,-1).
    worldPos: { x: -3, y: -1 },
    jsonPath: "assets/maps/MapAndemiaNouvelleVersion5.json",
    tilesets: [...tilesetNew, maisonAlchimisteTileset],
    groundLayerName: "Calque de Tuiles 1",
    debugGridLayerNames: ["Calque de Tuiles 1", "Calque de Tuiles 2"],
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: true,
    monsterSpawns: [
      {
        groupPool: ["cazard", "gumgob"],
        groupSizeMin: 1,
        groupSizeMax: 4,
        forceMixedGroup: true,
        offsetFromCenter: { x: -2, y: 4 },
      },
      {
        groupPool: ["cazard", "gumgob"],
        groupSizeMin: 1,
        groupSizeMax: 4,
        forceMixedGroup: true,
        offsetFromCenter: { x: 2, y: -5 },
      },
    ],
    treePositions: [],
    herbPositions: [
      { tileX: 7, tileY: 13 },
      { tileX: 14, tileY: 8 },
      { tileX: 19, tileY: 17 },
    ],
    exitBounds: null,
  },
  MapTaverne: {
    key: "MapTaverne",
    jsonPath: "assets/maps/MapTaverne.json",
    tilesets: [
      ...tilesetNew,
      solTaverneTileset,
      craftTableTileset,
      craftTableBijoutierTileset,
      craftTableCordonnierTileset,
    ],
    groundLayerName: "Calque de Tuiles 1",
    debugGridLayerNames: ["Calque de Tuiles 1", "Calque de Tuiles 2"],
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: false,
    monsterSpawns: [],
    treePositions: [],
    // Tables de craft dans la taverne (sprites + interaction).
    // Ajuste ces tuiles si tu veux les déplacer dans Tiled.
    workstations: [
      { id: "tailleur", tileX: 12, tileY: 20, offsetX: -4 },
      {
        id: "bijoutier",
        tileX: 12,
        tileY: 18,
        offsetY: -4,
        textureKey: "TableDeCraftBijoutier",
      },
      {
        id: "cordonnier",
        tileX: 12,
        tileY: 16,
        offsetX: -4,
        textureKey: "TableDeCraftCordonnier",
      },
    ],
    exitBounds: null,
  },
  MapMairie: {
    key: "MapMairie",
    jsonPath: "assets/maps/MapMairie.json",
    tilesets: [...tilesetNew, solTaverneTileset],
    groundLayerName: "Calque de Tuiles 1",
    debugGridLayerNames: ["Calque de Tuiles 1", "Calque de Tuiles 2"],
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: false,
    monsterSpawns: [],
    treePositions: [],
    exitBounds: null,
  },
  MapMaisonAlchimiste: {
    key: "MapMaisonAlchimiste",
    jsonPath: "assets/maps/MapMaisonAlchimiste.json",
    tilesets: [...tilesetNew, maisonAlchimisteTileset],
    groundLayerName: "Calque de Tuiles 1",
    debugGridLayerNames: ["Calque de Tuiles 1", "Calque de Tuiles 2"],
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: false,
    monsterSpawns: [],
    treePositions: [],
    exitBounds: null,
  },
  MapAndemiaNouvelleVersion8: {
    key: "MapAndemiaNouvelleVersion8",
    worldPos: { x: 0, y: -1 }, // droite de MapAndemiaNouvelleVersion3 (-1,-1)
    jsonPath: "assets/maps/MapAndemiaNouvelleVersion8.json",
    tilesets: [...tilesetNew],
    groundLayerName: "Calque de Tuiles 1",
    debugGridLayerNames: ["Calque de Tuiles 1", "Calque de Tuiles 2"],
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: true,
    monsterSpawns: [],
    treePositions: [],
    exitBounds: null,
  },
  MapAndemiaNouvelleVersion9: {
    key: "MapAndemiaNouvelleVersion9",
    worldPos: { x: 1, y: -1 }, // droite de MapAndemiaNouvelleVersion8 (0,-1)
    jsonPath: "assets/maps/MapAndemiaNouvelleVersion9.json",
    tilesets: [...tilesetNew, donjonAluineeksTileset],
    groundLayerName: "Calque de Tuiles 1",
    debugGridLayerNames: ["Calque de Tuiles 1", "Calque de Tuiles 2"],
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: true,
    monsterSpawns: [
      {
        groupPool: ["goush", "cedre"],
        groupSizeMin: 1,
        groupSizeMax: 4,
        forceMixedGroup: true,
        offsetFromCenter: { x: -6, y: 3 },
      },
      {
        groupPool: ["goush", "cedre"],
        groupSizeMin: 1,
        groupSizeMax: 4,
        forceMixedGroup: true,
        offsetFromCenter: { x: 6, y: -2 },
      },
      {
        groupPool: ["goush", "cedre"],
        groupSizeMin: 1,
        groupSizeMax: 4,
        forceMixedGroup: true,
        offsetFromCenter: { x: -3, y: -6 },
      },
      {
        groupPool: ["goush", "cedre"],
        groupSizeMin: 1,
        groupSizeMax: 4,
        forceMixedGroup: true,
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
    tilesets: [...tilesetNew],
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
    tilesets: [...tilesetNew],
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
    tilesets: [...tilesetNew],
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
    tilesets: [...tilesetNew],
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: true,
    monsterSpawns: [
      {
        groupPool: ["liburion", "libarene"],
        groupSizeMin: 1,
        groupSizeMax: 4,
        forceMixedGroup: true,
        offsetFromCenter: { x: -4, y: 4 },
      },
      {
        groupPool: ["liburion", "libarene"],
        groupSizeMin: 1,
        groupSizeMax: 4,
        forceMixedGroup: true,
        offsetFromCenter: { x: 5, y: -3 },
      },
    ],
    treePositions: [],
    exitBounds: null,
  },
  MapAndemia11: {
    key: "MapAndemia11",
    worldPos: { x: -2, y: -1 }, // à gauche de MapAndemia3 (-1,-1)
    jsonPath: "assets/maps/MapAndemia11.json",
    tilesets: [...tilesetNew],
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
    tilesets: [...tilesetNew],
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
    tilesets: [...tilesetNew, craftTableTileset],
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
    tilesets: [...tilesetNew, donjonDecorOssementTileset],
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: true,
    isDungeon: true,
    dungeonId: "aluineeks",
    dungeonRoomIndex: 1,
    monsterSpawns: [
      // Un seul pack de 4 (les membres supplémentaires apparaissent en combat)
      { type: "chibone", groupSizeMin: 4, groupSizeMax: 4, offsetFromCenter: { x: 0, y: 0 } },
    ],
    treePositions: [],
    exitBounds: null,
  },
  Map2DonjonAluineeks: {
    key: "Map2DonjonAluineeks",
    jsonPath: "assets/maps/Map2DonjonAluineeks.json",
    tilesets: [...tilesetNew, donjonDecorOssementTileset],
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: true,
    isDungeon: true,
    dungeonId: "aluineeks",
    dungeonRoomIndex: 2,
    monsterSpawns: [
      // Un seul pack de 4
      { type: "chibone", groupSizeMin: 4, groupSizeMax: 4, offsetFromCenter: { x: 0, y: 0 } },
    ],
    treePositions: [],
    exitBounds: null,
  },
  Map3DonjonAluineeks: {
    key: "Map3DonjonAluineeks",
    jsonPath: "assets/maps/Map3DonjonAluineeks.json",
    tilesets: [...tilesetNew, donjonDecorOssementTileset],
    cameraOffsets: { x: 0, y: 43 },
    spawnDefaults: true,
    isDungeon: true,
    dungeonId: "aluineeks",
    dungeonRoomIndex: 3,
    monsterSpawns: [
      // Un seul pack de 4
      { type: "skelbone", groupSizeMin: 4, groupSizeMax: 4, offsetFromCenter: { x: 0, y: 0 } },
    ],
    treePositions: [],
    exitBounds: null,
  },
  Map4DonjonAluineeks: {
    key: "Map4DonjonAluineeks",
    jsonPath: "assets/maps/Map4DonjonAluineeks.json",
    tilesets: [
      ...tilesetNew,
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

