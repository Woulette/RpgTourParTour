const KEY = (x, y) => `${x},${y}`;

export function ensureCollisionState(scene) {
  if (!scene.collision) {
    scene.collision = {
      blockedTiles: new Set(),
    };
  }
  return scene.collision;
}

export function blockTile(scene, tileX, tileY) {
  const state = ensureCollisionState(scene);
  state.blockedTiles.add(KEY(tileX, tileY));
}

export function unblockTile(scene, tileX, tileY) {
  const state = ensureCollisionState(scene);
  state.blockedTiles.delete(KEY(tileX, tileY));
}

export function isTileBlocked(scene, tileX, tileY) {
  const state = ensureCollisionState(scene);
  return state.blockedTiles.has(KEY(tileX, tileY));
}

