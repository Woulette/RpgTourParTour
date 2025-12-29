export function playSpellAnimation(scene, spellId, fromX, fromY, toX, toY) {
  if (!scene || !spellId) return;

  if (spellId === "punch_furtif") {
    const atlasKey = "spell_punch_furtif_atlas";
    const animKey = "spell_punch_furtif_anim";
    if (!scene.textures?.exists?.(atlasKey) || !scene.anims?.exists?.(animKey)) return;

    const fx = scene.add.sprite(toX, toY, atlasKey);
    fx.setOrigin(0.5, 0.75);
    fx.setDepth(toY + 5);
    fx.play(animKey);
    fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => fx.destroy());
  }

  if (spellId === "recharge_flux") {
    const atlasKey = "spell_recharge_flux_atlas";
    const animKey = "spell_recharge_flux_anim";
    if (!scene.textures?.exists?.(atlasKey) || !scene.anims?.exists?.(animKey)) return;

    const fx = scene.add.sprite(fromX, fromY, atlasKey);
    fx.setOrigin(0.5, 0.5);
    fx.setDepth(Math.max(fromY, toY) + 5);
    fx.play(animKey);

    const dist = Phaser.Math.Distance.Between(fromX, fromY, toX, toY);
    if (dist < 6) {
      scene.time.delayedCall(260, () => {
        if (fx?.destroy) fx.destroy();
      });
      return;
    }

    const duration = Math.max(180, Math.min(650, Math.round(dist * 1.2)));

    scene.tweens.add({
      targets: fx,
      x: toX,
      y: toY,
      duration,
      ease: "Linear",
      onComplete: () => {
        if (fx?.destroy) fx.destroy();
      },
    });

    scene.time.delayedCall(2000, () => {
      if (fx && fx.active && fx.destroy) fx.destroy();
    });
  }
}
