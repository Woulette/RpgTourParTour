function getSortedFrameNames(scene, textureKey) {
  const tex = scene?.textures?.get(textureKey);
  const names = tex && typeof tex.getFrameNames === "function" ? tex.getFrameNames() : [];
  // Ex: "Sprite-0032 0." -> sort by the number
  return names
    .slice()
    .sort((a, b) => {
      const na = parseInt(String(a).match(/(\d+)\.?$/)?.[1] || "0", 10);
      const nb = parseInt(String(b).match(/(\d+)\.?$/)?.[1] || "0", 10);
      return na - nb;
    });
}

export function setupSpellAnimations(scene) {
  if (!scene?.anims) return;

  // Punch furtif (Tank) - atlas TexturePacker (LibreSprite)
  const atlasKey = "spell_punch_furtif_atlas";
  const animKey = "spell_punch_furtif_anim";

  if (!scene.anims.exists(animKey)) {
    const frameNames = getSortedFrameNames(scene, atlasKey);
    if (frameNames.length > 0) {
      scene.anims.create({
        key: animKey,
        frames: frameNames.map((f) => ({ key: atlasKey, frame: f })),
        frameRate: 14,
        repeat: 0,
      });
    }
  }

  // Recharge de Flux (Eryon) - atlas LibreSprite (test)
  const atlasKeyFlux = "spell_recharge_flux_atlas";
  const animKeyFlux = "spell_recharge_flux_anim";

  if (!scene.anims.exists(animKeyFlux)) {
    const frameNames = getSortedFrameNames(scene, atlasKeyFlux);
    if (frameNames.length > 0) {
      scene.anims.create({
        key: animKeyFlux,
        frames: frameNames.map((f) => ({ key: atlasKeyFlux, frame: f })),
        frameRate: 14,
        repeat: -1,
      });
    }
  }

  const fireballDirs = ["south-east", "south-west", "north-east", "north-west"];
  fireballDirs.forEach((dir) => {
    const key = `eryon_fireball_${dir}`;
    if (scene.anims.exists(key)) return;
    const frames = [];
    for (let i = 0; i < 6; i += 1) {
      frames.push({ key: `eryon_fireball_${dir}_${i}` });
    }
    scene.anims.create({
      key,
      frames,
      frameRate: 12,
      repeat: 0,
    });
  });
}
