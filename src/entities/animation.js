export function setupPlayerAnimations(scene) {
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
      frames.push({ key: `player_run_${dir}_${i}` });
    }

    scene.anims.create({
      key: `player_run_${dir}`,
      frames,
      frameRate: 10,
      repeat: -1,
    });
  });
}
