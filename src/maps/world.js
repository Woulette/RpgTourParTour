import { maps } from "./index.js";
import { buildMap } from "./loader.js";
import { setupCamera } from "./camera.js";

// Index des maps par coordonnees logiques (x, y).
// Cle: "x,y" -> valeur = definition de map.
const mapsByCoord = new Map();

Object.values(maps).forEach((mapDef) => {
  const pos = mapDef.worldPos;
  if (!pos || typeof pos.x !== "number" || typeof pos.y !== "number") return;
  const key = `${pos.x},${pos.y}`;
  if (!mapsByCoord.has(key)) {
    mapsByCoord.set(key, mapDef);
  }
});

export function getMapAt(x, y) {
  return mapsByCoord.get(`${x},${y}`) || null;
}

export function getNeighbor(mapDef, direction) {
  if (!mapDef || !mapDef.worldPos) return null;

  const { x, y } = mapDef.worldPos;
  let nx = x;
  let ny = y;

  switch (direction) {
    case "right":
      nx = x + 1;
      break;
    case "left":
      nx = x - 1;
      break;
    case "up":
      ny = y - 1;
      break;
    case "down":
      ny = y + 1;
      break;
    default:
      return null;
  }

  return getMapAt(nx, ny);
}

// Calcule la zone "jouable" : colonnes/lignes qui ont vraiment des tuiles.
function computePlayableBounds(map, groundLayer) {
  let minX = map.width - 1;
  let maxX = 0;
  let minY = map.height - 1;
  let maxY = 0;
  let found = false;

  const leftByRow = new Array(map.height).fill(null);
  const rightByRow = new Array(map.height).fill(null);

  map.forEachTile(
    (tile) => {
      // Pas de tuile => index = -1 dans Phaser.
      if (tile.index === -1) return;
      found = true;
      const x = tile.x;
      const y = tile.y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      if (leftByRow[y] === null || x < leftByRow[y]) {
        leftByRow[y] = x;
      }
      if (rightByRow[y] === null || x > rightByRow[y]) {
        rightByRow[y] = x;
      }
    },
    undefined,
    0,
    0,
    map.width,
    map.height,
    groundLayer
  );

  if (!found) return null;
  return { minX, maxX, minY, maxY, leftByRow, rightByRow };
}

// Construit les tuiles de sortie pour chaque direction (pour l'instant: droite uniquement).
export function buildWorldExits(map, playableBounds) {
  const exits = {};
  if (!playableBounds) return exits;

  const { rightByRow, maxX } = playableBounds;
  const right = [];

  for (let y = 0; y < map.height; y++) {
    let x = maxX;
    if (rightByRow && typeof rightByRow[y] === "number") {
      x = rightByRow[y];
    }
    if (typeof x === "number") {
      // On décale la tuile de sortie d'une colonne vers la droite
      // (si on reste dans la map) pour que le changement de map
      // se fasse une case "plus loin" visuellement.
      let exitX = x + 1;
      if (exitX >= map.width) {
        exitX = x;
      }
      right.push({ x: exitX, y });
    }
  }

  exits.right = right;
  return exits;
}

// (Ré)initialise les bornes jouables et les tuiles de sortie pour une scène déjà
// associée à une map et un groundLayer.
export function initWorldExitsForScene(scene) {
  if (!scene || !scene.map || !scene.groundLayer) return;

  const playableBounds = computePlayableBounds(scene.map, scene.groundLayer);
  scene.playableBounds = playableBounds;
  scene.worldExits = buildWorldExits(scene.map, playableBounds);

  scene.exitDirection = null;
  scene.exitTargetTile = null;
}

// Recharge une map en reproduisant la logique de centrage de main.js.
export function loadMapLikeMain(scene, mapDef) {
  if (!scene || !mapDef) return;

  // On ne detruit pas l'ancienne map ici pour ne pas casser
  // la logique de deplacement existante : on la masque seulement.
  if (Array.isArray(scene.mapLayers) && scene.mapLayers.length > 0) {
    scene.mapLayers.forEach((layer) => {
      if (layer && layer.setVisible) {
        layer.setVisible(false);
      }
    });
  } else if (scene.groundLayer && scene.groundLayer.setVisible) {
    scene.groundLayer.setVisible(false);
  }

  const { map, groundLayer, layers } = buildMap(scene, mapDef);
  const mapLayers = layers && layers.length > 0 ? layers : [groundLayer];
  mapLayers.forEach((layer) => layer.setOrigin(0, 0));
  if (scene.hudCamera && scene.hudCamera.ignore) {
    mapLayers.forEach((layer) => scene.hudCamera.ignore(layer));
  }

  scene.map = map;
  scene.groundLayer = groundLayer || mapLayers[0];
  scene.mapLayers = mapLayers;
  scene.currentMapKey = mapDef.key;
  scene.currentMapDef = mapDef;

  // Bornes jouables (zone où il y a vraiment des tuiles) et tuiles de sortie.
  initWorldExitsForScene(scene);

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

  if (scene.player) {
    scene.player.x = startX;
    scene.player.y = startY;
    scene.player.currentTileX = centerTileX;
    scene.player.currentTileY = centerTileY;
  }

  setupCamera(scene, map, startX, startY, mapDef.cameraOffsets);
}

// Vérifie si le joueur est sur une tuile de sortie ciblée et lance la transition.
export function maybeHandleMapExit(scene) {
  if (!scene || !scene.player || !scene.currentMapDef) return;

  const player = scene.player;
  const dir = scene.exitDirection;
  const target = scene.exitTargetTile;

  if (!dir || !target) return;

  if (
    typeof player.currentTileX !== "number" ||
    typeof player.currentTileY !== "number" ||
    player.currentTileX !== target.x ||
    player.currentTileY !== target.y
  ) {
    return;
  }

  const neighbor = getNeighbor(scene.currentMapDef, dir);
  if (!neighbor) {
    scene.exitDirection = null;
    scene.exitTargetTile = null;
    return;
  }

  // On annule tout de suite l'intention pour éviter plusieurs déclenchements.
  scene.exitDirection = null;
  scene.exitTargetTile = null;

  const DELAY_MS = 150;
  const cam = scene.cameras && scene.cameras.main;

  const doChange = () => {
    loadMapLikeMain(scene, neighbor);
  };

  if (scene.time && scene.time.delayedCall) {
    scene.time.delayedCall(DELAY_MS, () => {
      if (cam && cam.fadeOut && cam.fadeIn) {
        cam.once("camerafadeoutcomplete", () => {
          doChange();
          cam.fadeIn(150, 0, 0, 0);
        });
        cam.fadeOut(150, 0, 0, 0);
      } else {
        doChange();
      }
    });
  } else {
    doChange();
  }
}
