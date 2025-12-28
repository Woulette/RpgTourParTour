import { CAMERA_PADDING, CAMERA_ZOOM } from "../../config/constants.js";

export function setupCamera(scene, map, focusX, focusY, offsets = {}) {
  const PADDING = CAMERA_PADDING;

  scene.physics.world.setBounds(
    -PADDING,
    -PADDING,
    map.widthInPixels + PADDING * 2,
    map.heightInPixels + PADDING * 2
  );

  scene.cameras.main.setBounds(
    -PADDING,
    -PADDING,
    map.widthInPixels + PADDING * 2,
    map.heightInPixels + PADDING * 2
  );

  scene.cameras.main.setRoundPixels(true);
  scene.cameras.main.setZoom(CAMERA_ZOOM);

  // Règle générale: caméra fixe sur la tuile (17,17) pour toutes les maps.
  // Ignore la position du joueur (style "Dofus" : cadrage constant).
  const targetTileX = Math.max(0, Math.min(17, (map?.width ?? 1) - 1));
  const targetTileY = Math.max(0, Math.min(17, (map?.height ?? 1) - 1));

  const layerForWorld = scene?.groundLayer || map?.layers?.[0] || null;
  const wp = map?.tileToWorldXY
    ? map.tileToWorldXY(
        targetTileX,
        targetTileY,
        undefined,
        undefined,
        layerForWorld
      )
    : null;

  const fixedFocusX = wp ? wp.x + map.tileWidth / 2 : map.widthInPixels / 2;
  const fixedFocusY = wp ? wp.y + map.tileHeight / 2 : map.heightInPixels / 2;

  const ox = offsets.x ?? 0;
  const oy = offsets.y ?? 0;
  scene.cameras.main.centerOn(fixedFocusX + ox, fixedFocusY + oy);
}
