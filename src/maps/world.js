import { maps } from "./index.js";
import { buildMap } from "./loader.js";
import { setupCamera } from "./camera.js";
import { spawnInitialMonsters } from "../monsters/index.js";
import { spawnNpcsForMap } from "../npc/spawn.js";
import { spawnTestTrees } from "../metier/bucheron/trees.js";
import { createMapExits } from "./exits.js";

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
  const topByCol = new Array(map.width).fill(null);
  const bottomByCol = new Array(map.width).fill(null);

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
      if (topByCol[x] === null || y < topByCol[x]) {
        topByCol[x] = y;
      }
      if (bottomByCol[x] === null || y > bottomByCol[x]) {
        bottomByCol[x] = y;
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
  return {
    minX,
    maxX,
    minY,
    maxY,
    leftByRow,
    rightByRow,
    topByCol,
    bottomByCol,
  };
}

// Construit les tuiles de sortie pour chaque direction.
// 1) Si un calque d'objets "exits" existe, on l'utilise (sorties définies à la main).
// 2) Sinon, on retombe sur le calcul automatique basé sur playableBounds.
export function buildWorldExits(map, playableBounds, groundLayer) {
  const exits = { up: [], down: [], left: [], right: [] };

  // --- 1) Mode "manuel" : calque d'objets "exits" dans Tiled ---
  const objectLayer = map.getObjectLayer("exits") || map.getObjectLayer("Exits");
  if (objectLayer && Array.isArray(objectLayer.objects) && groundLayer) {
    const worldToTile = createCalibratedWorldToTile(map, groundLayer);

    const getProp = (obj, name) => {
      if (!obj.properties) return undefined;
      const p = obj.properties.find((prop) => prop.name === name);
      return p ? p.value : undefined;
    };

    objectLayer.objects.forEach((obj) => {
      const rawDir =
        getProp(obj, "direction") ||
        getProp(obj, "dir") ||
        obj.type ||
        obj.name;

      if (!rawDir) return;
      const dir = String(rawDir).toLowerCase();
      if (!["up", "down", "left", "right"].includes(dir)) return;

      // 1) Si tileX / tileY sont définis dans Tiled, on les utilise directement.
      const txProp = getProp(obj, "tileX");
      const tyProp = getProp(obj, "tileY");

      let tx;
      let ty;

      if (typeof txProp === "number" && typeof tyProp === "number") {
        tx = txProp;
        ty = tyProp;
      } else {
        // 2) Sinon on déduit la tuile à partir de la position monde de l'objet.
        const tilePos = worldToTile(obj.x, obj.y - obj.height / 2);
        if (!tilePos) return;
        tx = tilePos.x;
        ty = tilePos.y;
      }

      exits[dir].push({ x: tx, y: ty });
    });

    return exits;
  }

  // --- 2) Fallback : ancien calcul automatique ---
  if (!playableBounds) return exits;

  const { rightByRow, maxX, topByCol, minY, bottomByCol, maxY } =
    playableBounds;

  // Sorties vers la droite
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

  // Sorties vers le haut
  const up = [];
  // Petit décalage pour tenir compte du fait que
  // seule la zone centrale de la map iso est jouable.
  // Ajuste cette valeur si nécessaire (en nombre de tuiles).
  const TOP_MARGIN = 2;
  for (let x = 0; x < map.width; x++) {
    let y = minY;
    if (topByCol && typeof topByCol[x] === "number") {
      y = topByCol[x];
    }
    y += TOP_MARGIN;
    if (y < minY) y = minY;
    if (y > maxY) y = maxY;

    if (typeof y === "number") {
      let exitY = y - 1;
      if (exitY < 0) {
        exitY = y;
      }
      up.push({ x, y: exitY });
    }
  }

  // Sorties vers le bas
  const down = [];
  for (let x = 0; x < map.width; x++) {
    let y = maxY;
    if (bottomByCol && typeof bottomByCol[x] === "number") {
      y = bottomByCol[x];
    }
    if (typeof y === "number") {
      let exitY = y + 1;
      if (exitY >= map.height) {
        exitY = y;
      }
      down.push({ x, y: exitY });
    }
  }

  exits.right = right;
  exits.up = up;
  exits.down = down;
  return exits;
}

// Conversion monde->tuiles "calibrée" pour l'isométrique.
// Dupliquée depuis playerMovement pour rester locale au module de monde.
function createCalibratedWorldToTile(map, groundLayer) {
  const testTileX = 0;
  const testTileY = 0;

  const worldPos = map.tileToWorldXY(
    testTileX,
    testTileY,
    undefined,
    undefined,
    groundLayer
  );
  const centerX = worldPos.x + map.tileWidth / 2;
  const centerY = worldPos.y + map.tileHeight / 2;

  const tF = groundLayer.worldToTileXY(centerX, centerY, false);

  let offsetX = 0;
  let offsetY = 0;
  if (tF) {
    offsetX = tF.x - testTileX - 0.5;
    offsetY = tF.y - testTileY - 0.5;
  }

  return function worldToTile(worldX, worldY) {
    const raw = groundLayer.worldToTileXY(worldX, worldY, false);
    if (!raw) return null;

    return {
      x: Math.floor(raw.x - offsetX),
      y: Math.floor(raw.y - offsetY),
    };
  };
}

// Calcule, pour la map isométrique actuelle, les vecteurs de déplacement
// "écran" (haut/bas/gauche/droite) exprimés en delta de tuiles.
function computeScreenDirectionVectors(map, groundLayer) {
  const worldToTile = createCalibratedWorldToTile(map, groundLayer);

  const centerTileX = Math.floor(map.width / 2);
  const centerTileY = Math.floor(map.height / 2);
  const centerWorld = map.tileToWorldXY(
    centerTileX,
    centerTileY,
    undefined,
    undefined,
    groundLayer
  );

  const baseX = centerWorld.x + map.tileWidth / 2;
  const baseY = centerWorld.y + map.tileHeight / 2;

  const stepX = map.tileWidth;
  const stepY = map.tileHeight;

  const tileCenter = worldToTile(baseX, baseY);
  const upTile = worldToTile(baseX, baseY - stepY);
  const downTile = worldToTile(baseX, baseY + stepY);
  const leftTile = worldToTile(baseX - stepX, baseY);
  const rightTile = worldToTile(baseX + stepX, baseY);

  function diff(a, b) {
    if (!a || !b) return { dx: 0, dy: 0 };
    return { dx: a.x - b.x, dy: a.y - b.y };
  }

  return {
    up: diff(upTile, tileCenter),
    down: diff(downTile, tileCenter),
    left: diff(leftTile, tileCenter),
    right: diff(rightTile, tileCenter),
  };
}

// Trouve la dernière tuile "jouable" en partant de la tuile du joueur
// et en avançant dans une direction d'écran (up/right/left/down).
export function findExitTileForDirection(scene, direction) {
  if (
    !scene ||
    !scene.map ||
    !scene.groundLayer ||
    !scene.playableBounds ||
    !scene.player
  ) {
    return null;
  }

  const dirs = scene.screenDirVectors;
  if (!dirs) return null;

  const vec = dirs[direction];
  if (!vec || (!vec.dx && !vec.dy)) return null;

  const { dx, dy } = vec;
  const { minX, maxX, minY, maxY } = scene.playableBounds;

  let tx = scene.player.currentTileX;
  let ty = scene.player.currentTileY;
  if (typeof tx !== "number" || typeof ty !== "number") return null;

  let lastX = tx;
  let lastY = ty;
  let safety = scene.map.width + scene.map.height + 10;

  while (safety-- > 0) {
    const nextX = tx + dx;
    const nextY = ty + dy;

    if (nextX < minX || nextX > maxX || nextY < minY || nextY > maxY) {
      break;
    }

    tx = nextX;
    ty = nextY;
    lastX = tx;
    lastY = ty;
  }

  if (lastX === scene.player.currentTileX && lastY === scene.player.currentTileY)
    return null;

  return { x: lastX, y: lastY };
}

// (Ré)initialise les bornes jouables et les tuiles de sortie pour une scène déjà
// associée à une map et un groundLayer.
export function initWorldExitsForScene(scene) {
  if (!scene || !scene.map || !scene.groundLayer) return;

  const playableBounds = computePlayableBounds(scene.map, scene.groundLayer);
  scene.playableBounds = playableBounds;
  scene.worldExits = buildWorldExits(
    scene.map,
    playableBounds,
    scene.groundLayer
  );
  scene.screenDirVectors = computeScreenDirectionVectors(
    scene.map,
    scene.groundLayer
  );

  scene.exitDirection = null;
  scene.exitTargetTile = null;
}

// Recharge une map en reproduisant la logique de centrage de main.js.
export function loadMapLikeMain(scene, mapDef) {
  if (!scene || !mapDef) return;

  // On ne detruit pas l'ancienne map ici pour ne pas casser
  // la logique de deplacement existante : on la masque seulement.
  // Cleanup des entites propres �� la map pour Ǹviter de les voir sur la suivante.
  if (Array.isArray(scene.monsters)) {
    scene.monsters.forEach((m) => {
      if (m?.hoverHighlight?.destroy) {
        m.hoverHighlight.destroy();
      }
      m.hoverHighlight = null;
      if (m && m.destroy) m.destroy();
    });
    scene.monsters = [];
  }
  if (Array.isArray(scene.npcs)) {
    scene.npcs.forEach((npc) => {
      if (npc?.hoverHighlight?.destroy) {
        npc.hoverHighlight.destroy();
      }
      npc.hoverHighlight = null;
      if (npc && npc.sprite && npc.sprite.destroy) {
        npc.sprite.destroy();
      }
    });
    scene.npcs = [];
  }
  if (Array.isArray(scene.bucheronNodes)) {
    scene.bucheronNodes.forEach((node) => {
      if (node?.hoverHighlight?.destroy) node.hoverHighlight.destroy();
      node.hoverHighlight = null;
      if (node?.sprite?.destroy) node.sprite.destroy();
    });
    scene.bucheronNodes = [];
  }

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

  // Respawn des entites propres �� la nouvelle map
  if (mapDef.spawnDefaults) {
    spawnInitialMonsters(
      scene,
      map,
      scene.groundLayer,
      centerTileX,
      centerTileY,
      mapDef
    );
    spawnTestTrees(scene, map, scene.player, mapDef);
    spawnNpcsForMap(scene, map, scene.groundLayer, mapDef.key);
  }
  createMapExits(scene);
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
