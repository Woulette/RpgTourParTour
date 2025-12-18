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
import { setupPlayerAnimations, setupCharacterAnimations } from "./entities/animation.js";
import {
  loadMapLikeMain,
  initWorldExitsForScene,
  rebuildCollisionGridFromMap,
  applyCustomLayerDepths,
  spawnObjectLayerTrees,
  recalcDepths,
} from "./maps/world.js";
import { createHud, setupHudCamera } from "./ui/hud.js";
import { initDomHud } from "./ui/domHud.js";
import { initDomCombat } from "./ui/domCombat.js";
import { initDomSpells } from "./ui/domSpells.js";
import { initDomCombatResult } from "./ui/domCombatResult.js";
import { initDomCombatInspector } from "./ui/domCombatInspector.js";
import { initDomInventory } from "./ui/domInventory.js";
import { initDomMetiers } from "./ui/domMetiers.js";
import { initDomQuests } from "./ui/domQuests.js";
import { initQuestTracker } from "./ui/domQuestTracker.js";
import { initDomChat } from "./ui/domChat.js";
import {
  preloadMonsters,
  processPendingRespawnsForCurrentMap,
  spawnInitialMonsters,
} from "./monsters/index.js";
import { defaultClassId } from "./config/classes.js";
import { attachCombatPreview } from "./ui/combatPreview.js";
import { attachMonsterTooltip } from "./ui/monsterTooltip.js";
import { initCharacterMenus } from "./ui/characterMenus.js";
import { onAfterMapLoaded } from "./dungeons/hooks.js";
import { spawnTestTrees } from "./metier/bucheron/trees.js";
import { preloadNpcs, spawnNpcsForMap } from "./npc/spawn.js";
import { initStore } from "./state/store.js";
import { initQuestRuntime } from "./quests/runtime/init.js";
import { initDevCheats } from "./dev/cheats.js";
import { attachCombatTileHover } from "./ui/combatTileHover.js";
    

class MainScene extends Phaser.Scene {
  constructor() {
    super("MainScene");
  }

  preload() {
    // PrÃ©charge toutes les maps dÃ©finies dans src/maps/index.js
    Object.values(maps).forEach((mapDef) => {
      preloadMap(this, mapDef);
    });

    const loadRunFrames = (prefix, basePath) => {
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
            `${prefix}_run_${dir}_${i}`,
            `${basePath}/${dir}/frame_${index}.png`
          );
        }
      });
    };

    // Archer (actuel)
    this.load.image("player", "assets/rotations/south-east.png");
    loadRunFrames("player", "assets/animations/running-6-frames");

    // Tank (nouveau perso) - assets dans "assets/animations/animation tank"
    this.load.image(
      "tank",
      "assets/animations/animation tank/rotations/south-east.png"
    );
    loadRunFrames(
      "tank",
      "assets/animations/animation tank/animations/running-6-frames"
    );
    this.load.image("tree_chene", "assets/metier/bucheron/Chene.png");
    this.load.image(
      "tree_chene_stump",
      "assets/metier/bucheron/SoucheChene.png"
    );
    this.load.image("chene", "assets/tileset/chene.png");
    this.load.image("boulleau_single", "assets/tileset/Boulleau.png");

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
  spawnObjectLayerTrees(this, map, "trees", "staticTrees");
  spawnObjectLayerTrees(this, map, "decor", "staticDecor");

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

    const selected = window.__andemiaSelectedCharacter || null;
    const classId = selected?.classId || defaultClassId;
    const displayName = selected?.name || "Joueur";

    this.player = createPlayer(this, startX, startY, classId);
    this.player.displayName = displayName;
    // Important : certains systèmes (PNJ donjon, quêtes, etc.) lisent la tuile courante.
    // Au premier spawn (sans transition de map), il faut l'initialiser.
    this.player.currentTileX = centerTileX;
    this.player.currentTileY = centerTileY;
    // Animations pour archer + tank (chargées en preload)
    setupPlayerAnimations(this);
    setupCharacterAnimations(this, "tank");
    this.player.setDepth(startY);

    // Recalcule les depth des decor/trees dependants du joueur
    recalcDepths(this);

    // Initialise le store central avec le joueur.
    initStore(this.player);
    initDomChat(this.player);
    initQuestRuntime(this.player);
    initDevCheats(this);

    // Initialise les tuiles de sortie pour cette premiÃ¨re map.
    initWorldExitsForScene(this);

    // Tick léger pour traiter les respawns dus sur la map courante.
    if (!this.respawnTick && this.time?.addEvent) {
      this.respawnTick = this.time.addEvent({
        delay: 1000,
        loop: true,
        callback: () => processPendingRespawnsForCurrentMap(this),
      });
    }

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
      // Si des respawns ont été planifiés sur cette map avant le chargement.
      processPendingRespawnsForCurrentMap(this);

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
    this.hudY = hudY;

    // --- CamÃ©ras : sÃ©parer monde et HUD pour Ã©viter le zoom sur le HUD ---
    const worldElements = [...mapLayers, this.player];
    if (grid) worldElements.push(grid);
    if (this.staticTrees) {
      this.staticTrees.forEach((tree) => worldElements.push(tree));
    }
    if (this.staticDecor) {
      this.staticDecor.forEach((obj) => worldElements.push(obj));
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

    // Donjons : hooks de map (PNJ d'entrée, exits, etc.)
    onAfterMapLoaded(this);

    // --- CLICK-TO-MOVE simple ---
    enableClickToMove(this, this.player, hudY, map, groundLayer);

    // Initialisation du HUD HTML (en dehors de Phaser)
    initDomHud(this.player);
    // Initialisation de l'UI de combat (bouton fin de tour)
    initDomCombat(this);
    initDomCombatInspector(this);
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
    attachCombatTileHover(this, hudY);

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

let gameInstance = null;

function destroyGame() {
  if (!gameInstance) return;
  try {
    gameInstance.destroy(true);
  } finally {
    gameInstance = null;
  }
}

function startGame(character) {
  window.__andemiaSelectedCharacter = character || null;
  destroyGame();
  gameInstance = new Phaser.Game(config);
  document.body.classList.add("game-running");
  document.body.classList.remove("menu-open");
}

function openMenu() {
  destroyGame();
  document.body.classList.remove("game-running");
  document.body.classList.add("menu-open");
}

// Bouton en jeu : retour menu
const returnMenuBtn = document.getElementById("ui-return-menu");
if (returnMenuBtn) {
  returnMenuBtn.addEventListener("click", () => {
    if (typeof window.__andemiaUi?.openMenu === "function") {
      window.__andemiaUi.openMenu();
      return;
    }
    openMenu();
  });
}

// Init menus (2 écrans) + démarrage jeu au choix perso
const menus = initCharacterMenus({
  onStartGame: (character) => startGame(character),
});
window.__andemiaUi = {
  openMenu: () => {
    openMenu();
    if (menus && typeof menus.openMenu === "function") menus.openMenu();
  },
};
