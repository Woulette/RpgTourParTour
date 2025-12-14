// Instancie les objets "trees"/"decor" (calques d'objets Tiled) en sprites Phaser tries par Y.
export function spawnObjectLayerTrees(
  scene,
  map,
  layerName = "trees",
  storeKey = "staticTrees"
) {
  if (!scene || !map) return;
  const objectLayer = map.getObjectLayer(layerName);
  if (!objectLayer || !Array.isArray(objectLayer.objects)) return;

  // Nettoie un eventuel precedent chargement
  const storeName = storeKey || "staticTrees";
  if (Array.isArray(scene[storeName])) {
    scene[storeName].forEach((s) => s?.destroy?.());
  }
  scene[storeName] = [];

  const FLIP_MASK = 0xe0000000;

  objectLayer.objects.forEach((obj) => {
    if (!obj || !obj.gid) return;

    const rawGid = obj.gid & ~FLIP_MASK;
    const isTrue = (v) => v === true || v === "true" || v === 1;
    const getProp = (name) => {
      const p = obj.properties;
      if (!p) return undefined;
      if (Array.isArray(p)) return p.find((prop) => prop.name === name)?.value;
      return p[name];
    };

    const propTexture = getProp("textureKey");
    const propFrame =
      typeof getProp("frame") === "number" ? getProp("frame") : null;
    const propOffsetX =
      typeof getProp("offsetX") === "number" ? getProp("offsetX") : 0;
    const propOffsetY =
      typeof getProp("offsetY") === "number" ? getProp("offsetY") : 0;
    const propOverPlayer = isTrue(getProp("overPlayer"));
    const propUnderPlayer =
      isTrue(getProp("underPlayer")) || isTrue(getProp("playerFront"));

    const ordered = [...(map.tilesets || [])]
      .filter((t) => typeof t.firstgid === "number")
      .sort((a, b) => (a.firstgid ?? 0) - (b.firstgid ?? 0));

    let ts = null;
    for (const candidate of ordered) {
      if (rawGid >= candidate.firstgid) {
        ts = candidate;
      } else {
        break;
      }
    }
    if (!ts) {
      ts =
        map.tilesets.find((t) => t.name === "NewTilesetPerso") ||
        map.tilesets[0];
    }
    if (!ts) return;

    const textureKey =
      propTexture || (ts.image && ts.image.key) || ts.name || "NewTilesetPerso";
    const firstGid = ts.firstgid ?? 1;
    let frame =
      propTexture && propFrame === null ? 0 : propFrame ?? rawGid - firstGid;

    const tilesPerSet =
      ts.total ??
      ts.tileCount ??
      ts.tilecount ??
      (ts.image && ts.tileWidth && ts.tileHeight
        ? Math.floor(ts.image.width / ts.tileWidth) *
          Math.floor(ts.image.height / ts.tileHeight)
        : ts.imageWidth && ts.imageHeight && ts.tileWidth && ts.tileHeight
        ? Math.floor(ts.imageWidth / ts.tileWidth) *
          Math.floor(ts.imageHeight / ts.tileHeight)
        : undefined);

    if (typeof tilesPerSet === "number" && tilesPerSet > 0) {
      if (frame < 0) return;
      if (frame >= tilesPerSet) {
        frame = frame % tilesPerSet;
      }
    } else if (frame < 0) {
      return;
    }

    // Position : soit coordonnees monde de l'objet, soit coordonnees tuile (tileX/tileY)
    const propTileX = Number.isFinite(getProp("tileX")) ? getProp("tileX") : null;
    const propTileY = Number.isFinite(getProp("tileY")) ? getProp("tileY") : null;
    let posX = obj.x + propOffsetX;
    let posY = obj.y + propOffsetY;

    if (
      propTileX !== null &&
      propTileY !== null &&
      typeof map.tileToWorldXY === "function"
    ) {
      const layerForWorld = scene.groundLayer || map.layers?.[0];
      const wp = map.tileToWorldXY(
        propTileX,
        propTileY,
        undefined,
        undefined,
        layerForWorld
      );
      if (wp) {
        posX = wp.x + map.tileWidth / 2 + propOffsetX;
        posY = wp.y + map.tileHeight / 2 + propOffsetY;
      }
    }

    const sprite = scene.add.sprite(posX, posY, textureKey, frame);
    sprite.setOrigin(0.5, 1);
    sprite.isOverPlayer = propOverPlayer;
    sprite.isUnderPlayer = propUnderPlayer;
    applyDepthRules(scene, sprite);

    if (scene.hudCamera) {
      scene.hudCamera.ignore(sprite);
    }

    scene[storeName].push(sprite);
  });
}

function applyDepthRules(scene, sprite) {
  if (!sprite) return;
  if (sprite.isOverPlayer) {
    sprite.setDepth(100000);
    return;
  }
  if (sprite.isUnderPlayer) {
    const playerDepth = scene?.player?.depth ?? sprite.y;
    // Force strictly below the player, even if spawned after the player
    sprite.setDepth(Math.min(playerDepth, sprite.y) - 1);
    return;
  }
  sprite.setDepth(sprite.y);
}

export function refreshObjectLayerDepths(scene, storeName = "staticTrees") {
  if (!scene || !Array.isArray(scene[storeName])) return;
  scene[storeName].forEach((sprite) => applyDepthRules(scene, sprite));
}

// Recalcule la depth du joueur et des decors/arbres qui en dÃ©pendent.
export function recalcDepths(scene) {
  if (!scene) return;
  if (scene.player?.setDepth) {
    scene.player.setDepth(scene.player.y);
  }
  refreshObjectLayerDepths(scene, "staticDecor");
  refreshObjectLayerDepths(scene, "staticTrees");
}
