export function setupCharacterAnimations(scene, prefix) {
  const directions = [
    "south",
    "south-east",
    "east",
    "north-east",
    "north",
    "north-west",
    "west",
    "south-west",
  ];

  directions.forEach((dir) => {
    const frames = [];
    for (let i = 0; i < 6; i += 1) {
      frames.push({ key: `${prefix}_run_${dir}_${i}` });
    }

    scene.anims.create({
      key: `${prefix}_run_${dir}`,
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
