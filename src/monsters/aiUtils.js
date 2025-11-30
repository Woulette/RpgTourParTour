import { PLAYER_SPEED } from "../config/constants.js";

// Déplacement fluide case par case en chaînant les tweens.
export function moveMonsterAlongPath(
  scene,
  monster,
  map,
  groundLayer,
  path,
  onDone
) {
  if (!path || path.length === 0) {
    if (typeof onDone === "function") onDone();
    return;
  }

  const next = path.shift();
  const worldPos = map.tileToWorldXY(
    next.x,
    next.y,
    undefined,
    undefined,
    groundLayer
  );
  const targetX = worldPos.x + map.tileWidth / 2;
  const targetY = worldPos.y + map.tileHeight / 2;

  const dist = Phaser.Math.Distance.Between(
    monster.x,
    monster.y,
    targetX,
    targetY
  );
  const duration = (dist / PLAYER_SPEED) * 1000;

  scene.tweens.add({
    targets: monster,
    x: targetX,
    y: targetY,
    duration,
    ease: "Linear",
    onComplete: () => {
      monster.x = targetX;
      monster.y = targetY;
      monster.tileX = next.x;
      monster.tileY = next.y;

      if (path.length > 0) {
        moveMonsterAlongPath(scene, monster, map, groundLayer, path, onDone);
      } else if (typeof onDone === "function") {
        onDone();
      }
    },
  });
}

