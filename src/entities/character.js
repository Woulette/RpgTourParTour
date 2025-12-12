export function createCharacter(scene, x, y, options = {}) {
  const {
    width = 32,
    height = 32,
    color = 0xffdd00,
    textureKey = null,
    stats = {},
    classId = "default",
  } = options;

  let sprite;
  if (textureKey) {
    sprite = scene.add.sprite(x, y, textureKey);
    sprite.setOrigin(0.5, 0.5);
  } else {
    sprite = scene.add.rectangle(x, y, width, height, color);
  }

  scene.physics.add.existing(sprite);
  sprite.body.setCollideWorldBounds(true);

  // Ajuste le body pour coller au sprite si nǸcessaire
  if (sprite.body && sprite.width && sprite.height) {
    sprite.body.setSize(sprite.width, sprite.height);
  }

  // Attach metadata to the sprite for later systems (combat, UI, etc.)
  sprite.classId = classId;
  sprite.stats = { ...stats };

  return sprite;
}
