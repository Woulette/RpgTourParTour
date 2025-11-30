import { defaultMapKey, maps } from "./maps/index.js";
import { BACKGROUND_COLOR, GAME_HEIGHT, GAME_WIDTH, SHOW_GRID } from "./config/constants.js";
import { preloadMap, buildMap } from "./maps/loader.js";
import { setupCamera } from "./maps/camera.js";
import { createPlayer } from "./entities/player.js";
import { enableClickToMove } from "./entities/playerMovement.js";
import { createMapExits } from "./maps/exits.js";
import { setupPlayerAnimations } from "./entities/animation.js";
import { loadMapLikeMain, initWorldExitsForScene } from "./maps/world.js";
import { createHud, setupHudCamera } from "./ui/hud.js";
import { initDomHud } from "./ui/domHud.js";
import { initDomCombat } from "./ui/domCombat.js";
import { initDomSpells } from "./ui/domSpells.js";
import { initDomCombatResult } from "./ui/domCombatResult.js";
import { initDomInventory } from "./ui/domInventory.js";
import { preloadMonsters, spawnInitialMonsters } from "./monsters/index.js";
import { defaultClassId } from "./config/classes.js";
import { attachCombatPreview } from "./ui/combatPreview.js";
import {
  getActiveSpell,
  getSpellDamageRange,
  canCastSpellAtTile,
} from "./core/spellSystem.js";

class MainScene extends Phaser.Scene {
  constructor() {
    super("MainScene");
  }

  preload() {
    // Pr�charge toutes les maps d�finies dans src/maps/index.js
    Object.values(maps).forEach((mapDef) => {
      preloadMap(this, mapDef);
    });
    this.load.image("player", "assets/rotations/south-east.png");

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
  }

  create() {
    const mapDef = maps[defaultMapKey];
    const { map, groundLayer, layers } = buildMap(this, mapDef);
    // Aligne le layer sur son origine sans d�calage manuel
    const mapLayers = layers && layers.length > 0 ? layers : [groundLayer];
    mapLayers.forEach((layer) => layer.setOrigin(0, 0));

    // Sauvegarde la carte sur la scène pour d'autres systèmes (respawn, etc.)
    this.map = map;
    this.groundLayer = groundLayer;
    this.mapLayers = mapLayers;
    this.currentMapKey = mapDef.key;
    this.currentMapDef = mapDef;

    // --- JOUEUR AU CENTRE (coordonn�es tuiles) ---
    const centerTileX = Math.floor(map.width /2);
    const centerTileY = Math.floor(map.height /2);
    const centerWorld = map.tileToWorldXY(
      centerTileX,
      centerTileY,
      undefined,
      undefined,
      groundLayer
    );

    const startX = centerWorld.x + map.tileWidth /2;
    const startY = centerWorld.y + map.tileHeight /2;

    this.player = createPlayer(this, startX, startY, defaultClassId);
    setupPlayerAnimations(this);
    this.player.setDepth(2);

    // Initialise les tuiles de sortie pour cette première map.
    initWorldExitsForScene(this);

    // --- MONSTRES DE TEST ---
    spawnInitialMonsters(this, map, groundLayer, centerTileX, centerTileY);

    // --- GRILLE ISO (DEBUG) ---
    let grid = null;
    if (SHOW_GRID) {
      grid = this.add.graphics();
      grid.lineStyle(1, 0xffffff, 1);
      grid.setDepth(1);

      const halfW = map.tileWidth / 2;
      const halfH = map.tileHeight / 2;

      map.forEachTile((tile) => {
        const worldPos = map.tileToWorldXY(tile.x, tile.y, undefined, undefined, groundLayer);
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

    // --- Cam�ras : s�parer monde et HUD pour �viter le zoom sur le HUD ---
    const worldElements = [...mapLayers, this.player];
    if (grid) worldElements.push(grid);
    setupCamera(this, map, startX, startY, mapDef.cameraOffsets);
    setupHudCamera(this, uiElements, worldElements);

    // Assure-toi que la cam�ra HUD ignore aussi les monstres d�j� cr��s
    if (this.hudCamera && this.monsters) {
      this.monsters.forEach((m) => this.hudCamera.ignore(m));
    }

    // Bande visuelle de sortie de map (bord droit).
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
    // Initialisation de l'inventaire (fen�tre INV)
    initDomInventory(this.player);

    // DEBUG : touche "N" -> charge maptest2 avec le m?me centrage
    this.input.keyboard.on("keydown-N", () => {
      const next = maps.maptest2;
      if (!next) return;
      loadMapLikeMain(this, next);
    });

    // --- PREVIEW_BLOCK_START
    this.damagePreviewText = null;
    this.damagePreviewBg = null;

    this.showDamagePreview = (monster) => {
      const state = this.combatState;
      if (!state || !state.enCours || state.tour !== "joueur") return;
      if (!monster || typeof monster.tileX !== "number" || typeof monster.tileY !== "number") {
        return;
      }

      const spell = getActiveSpell(this.player);
      if (!spell) {
        return;
      }

      const mapForCombat = this.combatMap || this.map;
      const layerForCombat = this.combatGroundLayer || this.groundLayer;
      if (!mapForCombat || !layerForCombat) return;

      const tileX = monster.tileX;
      const tileY = monster.tileY;

      // Si le sort ne peut pas �tre lanc� sur cette case, on ne montre rien
      if (
        !canCastSpellAtTile(
          this,
          this.player,
          spell,
          tileX,
          tileY,
          mapForCombat
        )
      ) {
        this.clearDamagePreview();
        return;
      }

      const { min, max } = getSpellDamageRange(this.player, spell);
      const text = `${min} - ${max}`;

      const worldPos = mapForCombat.tileToWorldXY(
        tileX,
        tileY,
        undefined,
        undefined,
        layerForCombat
      );
      const cx = worldPos.x + mapForCombat.tileWidth / 2;
      const cy = worldPos.y + mapForCombat.tileHeight / 2;

      if (this.damagePreviewText) {
        this.damagePreviewText.destroy();
      }
      if (this.damagePreviewBg) {
        this.damagePreviewBg.destroy();
      }

      // Texte centr� au-dessus du monstre
      // Position du centre de la bulle (un peu au-dessus du monstre)
      const bubbleCenterX = cx;
      const bubbleCenterY = cy - mapForCombat.tileHeight * 1.2;

      const dmgText = this.add.text(bubbleCenterX, bubbleCenterY, text, {
        fontFamily: "Arial",
        fontSize: 14,
        color: "#000000",
        stroke: "#ffffff",
        strokeThickness: 1,
        align: "center",
      });
      // On centre le texte sur ses coordonn?es
      dmgText.setOrigin(0.5, 0.5);

      // Petit fond arrondi derri?re le texte
      const paddingX = 6;
      const paddingY = 2;
      const bgWidth = dmgText.width + paddingX * 2;
      const bgHeight = dmgText.height + paddingY * 2;

      const bg = this.add.graphics();
      bg.fillStyle(0xffffff, 0.85);
      bg.lineStyle(1, 0x000000, 0.6);
      const radius = 6;
      const bgX = bubbleCenterX - bgWidth / 2;
      const bgY = bubbleCenterY - bgHeight / 2;

      bg.fillRoundedRect(bgX, bgY, bgWidth, bgHeight, radius);
      bg.strokeRoundedRect(bgX, bgY, bgWidth, bgHeight, radius);

      if (this.hudCamera) {
        this.hudCamera.ignore(bg);
        this.hudCamera.ignore(dmgText);
      }
      bg.setDepth(9);
      dmgText.setDepth(10);

      this.damagePreviewBg = bg;
      this.damagePreviewText = dmgText;
    };

    this.clearDamagePreview = () => {
      if (this.damagePreviewText) {
        this.damagePreviewText.destroy();
        this.damagePreviewText = null;
      }
      if (this.damagePreviewBg) {
        this.damagePreviewBg.destroy();
        this.damagePreviewBg = null;
      }
    };

    // Clic sur un monstre = on demande au joueur d'aller vers lui,
    // et le combat sera lanc� quand le joueur atteindra sa case.
    this.input.on("gameobjectdown", (pointer, gameObject) => {
      if (!gameObject.monsterId) return;

      // Combat d�j� en cours -> on ignore
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


