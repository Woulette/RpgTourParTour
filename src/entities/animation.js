export function setupCharacterAnimations(scene, prefix, options = {}) {
  const directions =
    Array.isArray(options.directions) && options.directions.length > 0
      ? options.directions
      : [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west",
        ];
  const frameCount =
    typeof options.frameCount === "number" && options.frameCount > 0
      ? Math.round(options.frameCount)
      : 6;

  directions.forEach((dir) => {
    const animKey = `${prefix}_run_${dir}`;
    if (scene.anims && scene.anims.exists && scene.anims.exists(animKey)) {
      return;
    }
    const frames = [];
    for (let i = 0; i < frameCount; i += 1) {
      frames.push({ key: `${prefix}_run_${dir}_${i}` });
    }

    scene.anims.create({
      key: animKey,
      frames,
      frameRate: 10,
      repeat: -1,
    });
  });
}

// Back-compat: l'archer actuel utilise le préfixe "player".
export function setupPlayerAnimations(scene) {
  setupCharacterAnimations(scene, "player");
}
