import {
  createCalibratedWorldToTile,
  computeScreenDirectionVectors,
} from "./util.js";

// Calcule la zone "jouable" : colonnes/lignes qui ont vraiment des tuiles.
export function computePlayableBounds(map, groundLayer) {
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
// 1) Si un calque d'objets "exits" existe, on l'utilise (sorties dÈfinies ‡ la main).
// 2) Sinon, on retombe sur le calcul automatique basÈ sur playableBounds.
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

      // 1) Si tileX / tileY sont dÈfinis dans Tiled, on les utilise directement.
      const txProp = getProp(obj, "tileX");
      const tyProp = getProp(obj, "tileY");

      let tx;
      let ty;

      if (typeof txProp === "number" && typeof tyProp === "number") {
        tx = txProp;
        ty = tyProp;
      } else {
        // 2) Sinon on dÈduit la tuile ‡ partir de la position monde de l'objet.
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
      // On dÈcale la tuile de sortie d'une colonne vers la droite
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
  // Petit dÈcalage pour tenir compte du fait que
  // seule la zone centrale de la map iso est jouable.
  // Ajuste cette valeur si nÈcessaire (en nombre de tuiles).
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

// (RÈ)initialise les bornes jouables et les tuiles de sortie pour une scËne dÈj‡
// associÈe ‡ une map et un groundLayer.
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

// Trouve la derniËre tuile "jouable" en partant de la tuile du joueur
// et en avan‡ant dans une direction d'Ècran (up/right/left/down).
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
