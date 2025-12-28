export const DEFAULT_MONSTER_ANIM_DIRECTIONS = [
  "north-east",
  "north-west",
  "south-east",
  "south-west",
];

export function resolveMonsterAnimDirection(dx, dy) {
  if (dx >= 0 && dy >= 0) return "south-east";
  if (dx < 0 && dy >= 0) return "south-west";
  if (dx >= 0 && dy < 0) return "north-east";
  return "north-west";
}

export function playMonsterMoveAnimation(scene, monster, dx, dy) {
  if (!monster || !scene || !scene.anims || !scene.anims.exists) return;
  if (!monster.scene || !monster.scene.sys || !monster.active) return;
  if (!monster.anims || !monster.animPrefix) return;

  const dir = resolveMonsterAnimDirection(dx, dy);
  monster.lastDirection = dir;
  const key = `${monster.animPrefix}_run_${dir}`;
  if (scene.anims.exists(key)) {
    if (monster.animScale && typeof monster.setScale === "function") {
      monster.setScale(monster.animScale);
    }
    monster.anims.play(key, true);
  }
}

export function stopMonsterMoveAnimation(monster) {
  if (!monster || !monster.scene || !monster.scene.sys || !monster.active) return;
  if (monster.anims && monster.anims.currentAnim) {
    monster.anims.stop();
  }
  if (typeof monster.setTexture === "function") {
    const prefix = monster.animPrefix || monster.texture?.key || null;
    const dir = monster.lastDirection || "south-west";
    const idleKey = prefix ? `${prefix}_idle_${dir}` : null;
    if (idleKey && monster.scene?.textures?.exists && monster.scene.textures.exists(idleKey)) {
      monster.setTexture(idleKey);
    } else if (monster.baseTextureKey) {
      monster.setTexture(monster.baseTextureKey);
    }
  }
  if (
    typeof monster.baseScale === "number" &&
    Number.isFinite(monster.baseScale) &&
    typeof monster.setScale === "function"
  ) {
    monster.setScale(monster.baseScale);
  }
}
