import { defaultMapKey, maps } from "./maps/index.js";
import {
  BACKGROUND_COLOR,
  GAME_HEIGHT,
  GAME_WIDTH,
  SHOW_GRID,
} from "./config/constants.js";
import { preloadMap, buildMap } from "./maps/loader.js";
import { setupCamera } from "./maps/camera.js";
import { createPlayer } from "./entities/player.js";
import { enableClickToMove } from "./entities/playerMovement.js";
import { createMapExits } from "./maps/exits.js";
import { setupPlayerAnimations } from "./entities/animation.js";
import {
  loadMapLikeMain,
  initWorldExitsForScene,
  rebuildCollisionGridFromMap,
  applyCustomLayerDepths,
  spawnObjectLayerTrees,
} from "./maps/world.js";
import { createHud, setupHudCamera } from "./ui/hud.js";
import { initDomHud } from "./ui/domHud.js";
import { initDomCombat } from "./ui/domCombat.js";
import { initDomSpells } from "./ui/domSpells.js";
import { initDomCombatResult } from "./ui/domCombatResult.js";
import { initDomInventory } from "./ui/domInventory.js";
import { initDomMetiers } from "./ui/domMetiersBucheron.js";
import { initDomQuests } from "./ui/domQuests.js";
import { initQuestTracker } from "./ui/domQuestTracker.js";
import { preloadMonsters, spawnInitialMonsters } from "./monsters/index.js";
import { defaultClassId } from "./config/classes.js";
import { attachCombatPreview } from "./ui/combatPreview.js";
import { attachMonsterTooltip } from "./ui/monsterTooltip.js";
import { spawnTestTrees } from "./metier/bucheron/trees.js";
import { preloadNpcs, spawnNpcsForMap } from "./npc/spawn.js";
import { initStore } from "./state/store.js";
    

class MainScene extends Phaser.Scene {
  constructor() {
    super("MainScene");
  }

  preload() {
    // PrÃ©charge toutes les maps dÃ©finies dans src/maps/index.js
    Object.values(maps).forEach((mapDef) => {
      preloadMap(this, mapDef);
    });

    this.load.image("player", "assets/rotations/south-east.png");
    this.load.image("tree_chene", "assets/metier/bucheron/Chene.png");
    this.load.image(
      "tree_chene_stump",
      "assets/metier/bucheron/SoucheChene.png"
    );
    this.load.image("chene", "assets/tileset/chene.png");
    this.load.image("boulleau_single", "assets/tileset/Boulleau.png");

    const animDirs = [
      "south",
      "south-east",
      "east",
      "north-east",
      "north",
      "north-west",
      "west",
      "south-west",
    ];
    animDirs.forEach((dir) => {
      for (let i = 0; i < 6; i += 1) {
        const index = i.toString().padStart(3, "0");
        this.load.image(
          `player_run_${dir}_${i}`,
          `assets/animations/running-6-frames/${dir}/frame_${index}.png`
        );
      }
    });

    preloadMonsters(this);
    preloadNpcs(this);
  }

    create() {
    const mapDef = maps[defaultMapKey];
    const { map, groundLayer, layers } = buildMap(this, mapDef);

    // Aligne le layer sur son origine sans décalage manuel
    const mapLayers = layers && layers.length > 0 ? layers : [groundLayer];
    mapLayers.forEach((layer) => layer.setOrigin(0, 0));

    // Sauvegarde la carte sur la scène pour d'autres systèmes (respawn, etc.)
    this.map = map;
    this.groundLayer = groundLayer;
    this.mapLayers = mapLayers;
    this.currentMapKey = mapDef.key;
    this.currentMapDef = mapDef;
    applyCustomLayerDepths(this);

    // Collision : applique les rectangles du calque "collisions"
  rebuildCollisionGridFromMap(this, map, groundLayer);
  spawnObjectLayerTrees(this, map, "trees");

  // --- JOUEUR AU CENTRE (coordonnÃ©es tuiles) ---
  const centerTileX = Math.floor(map.width / 2);
    const centerTileY = Math.floor(map.height / 2);
    const centerWorld = map.tileToWorldXY(
      centerTileX,
      centerTileY,
      undefined,
      undefined,
      groundLayer
    );

    const startX = centerWorld.x + map.tileWidth / 2;
    const startY = centerWorld.y + map.tileHeight / 2;

    this.player = createPlayer(this, startX, startY, defaultClassId);
    setupPlayerAnimations(this);
    this.player.setDepth(startY);

    // Initialise le store central avec le joueur.
    initStore(this.player);

    // Initialise les tuiles de sortie pour cette premiÃ¨re map.
    initWorldExitsForScene(this);

    if (mapDef.spawnDefaults) {
      // --- MONSTRES DE TEST ---
      spawnInitialMonsters(
        this,
        map,
        groundLayer,
        centerTileX,
        centerTileY,
        mapDef
      );

      // --- ARBRES DE TEST (M?TIER B?CHERON) ---
      spawnTestTrees(this, map, this.player, mapDef);

      // --- PNJ ---
      spawnNpcsForMap(this, map, groundLayer, mapDef.key);
    }

    // --- GRILLE ISO (DEBUG) ---
    let grid = null;
    if (SHOW_GRID) {
      grid = this.add.graphics();
      grid.lineStyle(1, 0xffffff, 1);
      grid.setDepth(1);

      const halfW = map.tileWidth / 2;
      const halfH = map.tileHeight / 2;

      map.forEachTile((tile) => {
        const worldPos = map.tileToWorldXY(
          tile.x,
          tile.y,
          undefined,
          undefined,
          groundLayer
        );
        const cx = worldPos.x + halfW;
        const cy = worldPos.y + halfH;

        const points = [
          new Phaser.Math.Vector2(cx, cy - halfH), // haut
          new Phaser.Math.Vector2(cx + halfW, cy), // droite
          new Phaser.Math.Vector2(cx, cy + halfH), // bas
          new Phaser.Math.Vector2(cx - halfW, cy), // gauche
        ];

        grid.strokePoints(points, true);
      });
    }

    // --- HUD ---
    const { hudY, uiElements } = createHud(this);

    // --- CamÃ©ras : sÃ©parer monde et HUD pour Ã©viter le zoom sur le HUD ---
    const worldElements = [...mapLayers, this.player];
    if (grid) worldElements.push(grid);
    if (this.staticTrees) {
      this.staticTrees.forEach((tree) => worldElements.push(tree));
    }
    if (this.bucheronNodes) {
      this.bucheronNodes.forEach((node) => {
        if (node.sprite) worldElements.push(node.sprite);
      });
    }
    if (this.npcs) {
      this.npcs.forEach((npc) => {
        if (npc.sprite) worldElements.push(npc.sprite);
      });
    }

    setupCamera(this, map, startX, startY, mapDef.cameraOffsets);
    setupHudCamera(this, uiElements, worldElements);

    // Assure-toi que la camÃ©ra HUD ignore aussi les monstres dÃ©jÃ  crÃ©Ã©s
    if (this.hudCamera && this.monsters) {
      this.monsters.forEach((m) => this.hudCamera.ignore(m));
    }

    // Bandes visuelles de sortie de map (bord droit + haut).
    createMapExits(this);

    // --- CLICK-TO-MOVE simple ---
    enableClickToMove(this, this.player, hudY, map, groundLayer);

    // Initialisation du HUD HTML (en dehors de Phaser)
    initDomHud(this.player);
    // Initialisation de l'UI de combat (bouton fin de tour)
    initDomCombat(this);
    // Initialisation de la barre de sorts
    initDomSpells(this.player);
    // Initialisation de la popup de fin de combat
    initDomCombatResult(this, this.player);
    // Initialisation de l'inventaire (fenÃªtre INV)
    initDomInventory(this.player);
    // Initialisation de la fenÃªtre de mÃ©tiers
    initDomMetiers(this.player);
    initDomQuests(this.player);
    initQuestTracker(this.player);

    // DEBUG : touche "N" -> charge Map2Andemia avec le mÃªme centrage
    this.input.keyboard.on("keydown-N", () => {
      const next = maps.Map2Andemia;
      if (!next) return;
      loadMapLikeMain(this, next);
    });

    // --- PREVIEW_BLOCK_START : hooks d'UI ---
    attachCombatPreview(this);
    attachMonsterTooltip(this);

    // Clic sur un monstre = on demande au joueur d'aller vers lui,
    // et le combat sera lancÃ© quand le joueur atteindra sa case.
    this.input.on("gameobjectdown", (pointer, gameObject) => {
      if (!gameObject.monsterId) return;

      // Combat dÃ©jÃ  en cours -> on ignore
      if (this.combatState && this.combatState.enCours) return;

      // On enregistre la cible de combat pour plus tard
      this.pendingCombatTarget = gameObject;
    });
  }
}

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: BACKGROUND_COLOR,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: { gravity: { y: 0 }, debug: false },
  },
  scene: [MainScene],
};

new Phaser.Game(config);

