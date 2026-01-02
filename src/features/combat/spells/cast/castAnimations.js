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

export function getSpellAnimationDuration(scene, spellId, fromX, fromY, toX, toY) {
  if (!scene || !spellId) return 0;
  if (spellId === "punch_furtif") {
    const animKey = "spell_punch_furtif_anim";
    const anim = scene.anims?.get?.(animKey);
    if (anim && anim.frameRate && anim.frames?.length) {
      return Math.round((anim.frames.length / anim.frameRate) * 1000);
    }
    return 400;
  }
  if (spellId === "recharge_flux") {
    const dist = Phaser.Math.Distance.Between(fromX, fromY, toX, toY);
    if (dist < 6) return 260;
    return Math.max(180, Math.min(650, Math.round(dist * 1.2)));
  }
  return 0;
}

export function playEryonPrecastAnimation(scene, caster, fromX, fromY, toY) {
  if (!scene || !caster || caster.classId !== "eryon") return 0;

  const dir = (() => {
    const last = caster.lastDirection || "south-east";
    if (last === "north-east" || last === "north-west") return last;
    if (last === "south-east" || last === "south-west") return last;
    if (last === "north") return "north-east";
    if (last === "south") return "south-east";
    if (last === "west") return "south-west";
    return "south-east";
  })();

  const animKey = `eryon_fireball_${dir}`;
  const frameKey = `eryon_fireball_${dir}_0`;
  if (!scene.textures?.exists?.(frameKey) || !scene.anims?.exists?.(animKey)) return 0;

  const fxX = caster?.x ?? fromX;
  const fxY = caster?.y ?? fromY;
  const wasVisible = caster.visible !== false;
  caster.visible = false;

  const fx = scene.add.sprite(fxX, fxY, frameKey);
  fx.setOrigin(0.5, 0.9);
  fx.setDepth(
    typeof caster.depth === "number" ? caster.depth : Math.max(fxY, toY) + 6
  );
  fx.play(animKey);
  fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
    if (wasVisible) caster.visible = true;
    fx.destroy();
  });
  const fps = 12;
  const frameCount = 6;
  return Math.round((frameCount / fps) * 1000);
}
