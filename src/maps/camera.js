import { CAMERA_PADDING, CAMERA_ZOOM } from "../config/constants.js";

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

  const ox = offsets.x ?? 0;
  const oy = offsets.y ?? 0;
  scene.cameras.main.centerOn(focusX + ox, focusY + oy);
}
