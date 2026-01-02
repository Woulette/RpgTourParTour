import { monsters } from "../../../content/monsters/index.js";

export const DEFAULT_MONSTER_ANIM_DIRECTIONS = [
  "north-east",
  "north-west",
  "south-east",
  "south-west",
];

function resolveExtraAnimDirection(monster, directions) {
  if (!monster || !Array.isArray(directions) || directions.length === 0) {
    return "south-east";
  }
  const preferred = monster.lastDirection;
  if (preferred && directions.includes(preferred)) return preferred;
  if (preferred === "north") {
    if (directions.includes("north-east")) return "north-east";
    if (directions.includes("north-west")) return "north-west";
  }
  if (preferred === "south") {
    if (directions.includes("south-east")) return "south-east";
    if (directions.includes("south-west")) return "south-west";
  }
  if (preferred === "east") {
    if (directions.includes("south-east")) return "south-east";
    if (directions.includes("north-east")) return "north-east";
  }
  if (preferred === "west") {
    if (directions.includes("south-west")) return "south-west";
    if (directions.includes("north-west")) return "north-west";
  }
  return directions[0];
}

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

function resolveMonsterExtraConfig(monster, extraKey) {
  if (!monster || !extraKey) return null;
  const def = monsters?.[monster.monsterId] || null;
  const extras = def?.extraAnimations || null;
  if (!extras || !extras[extraKey]) return null;
  return extras[extraKey];
}

export function getMonsterExtraAnimationDuration(scene, monster, extraKey, directions) {
  if (!scene?.anims || !monster || !extraKey) return 0;
  const prefix = monster.animPrefix || monster.texture?.key || null;
  if (!prefix) return 0;
  const dir = resolveExtraAnimDirection(monster, directions);
  const animKey = `${prefix}_${extraKey}_${dir}`;
  const anim = scene.anims.get(animKey);
  if (!anim || !anim.frameRate || !anim.frames?.length) return 0;
  return Math.round((anim.frames.length / anim.frameRate) * 1000);
}

export function playMonsterExtraAnimation(scene, monster, extraKey, directions) {
  if (!scene || !scene.anims || !monster || !extraKey) return 0;
  if (!monster.scene || !monster.scene.sys || !monster.active) return 0;
  if (!monster.anims) return 0;
  const prefix = monster.animPrefix || monster.texture?.key || null;
  if (!prefix) return 0;

  const extraDef = resolveMonsterExtraConfig(monster, extraKey);
  const offsetX =
    extraDef && typeof extraDef.offsetX === "number" ? extraDef.offsetX : 0;
  const offsetY =
    extraDef && typeof extraDef.offsetY === "number" ? extraDef.offsetY : 0;
  const originX =
    extraDef && typeof extraDef.originX === "number" ? extraDef.originX : null;
  const originY =
    extraDef && typeof extraDef.originY === "number" ? extraDef.originY : null;
  const hadOffsets = offsetX !== 0 || offsetY !== 0;
  const hadOrigin = originX !== null || originY !== null;
  const prev = {
    x: monster.x,
    y: monster.y,
    originX: monster.originX,
    originY: monster.originY,
  };

  const dir = resolveExtraAnimDirection(monster, directions);
  const animKey = `${prefix}_${extraKey}_${dir}`;
  if (!scene.anims.exists(animKey)) return 0;

  if (hadOffsets) {
    monster.x += offsetX;
    monster.y += offsetY;
  }
  if (hadOrigin && typeof monster.setOrigin === "function") {
    const ox = originX !== null ? originX : monster.originX;
    const oy = originY !== null ? originY : monster.originY;
    monster.setOrigin(ox, oy);
  }

  if (typeof monster.setScale === "function") {
    const baseScale =
      typeof monster.baseScale === "number" && Number.isFinite(monster.baseScale)
        ? monster.baseScale
        : 1;
    monster.setScale(baseScale);
  }

  monster.anims.play(animKey, true);
  monster.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
    if (!monster._deathAnimating) {
      if (hadOffsets) {
        monster.x = prev.x;
        monster.y = prev.y;
      }
      if (hadOrigin && typeof monster.setOrigin === "function") {
        monster.setOrigin(prev.originX, prev.originY);
      }
      if (typeof monster.setTexture === "function") {
        const idleKey = `${prefix}_idle_${dir}`;
        if (scene.textures?.exists?.(idleKey)) {
          monster.setTexture(idleKey);
        }
      }
    }
  });

  return getMonsterExtraAnimationDuration(scene, monster, extraKey, directions);
}

export function playMonsterSpellAnimation(scene, monster, spellId) {
  if (!monster || !spellId) return 0;
  const def = monsters?.[monster.monsterId] || null;
  const mapping = def?.spellAnimations || null;
  const extraKey = mapping?.[spellId] || null;
  if (!extraKey) return 0;
  const extra = resolveMonsterExtraConfig(monster, extraKey);
  const directions = extra?.directions || DEFAULT_MONSTER_ANIM_DIRECTIONS;
  return playMonsterExtraAnimation(scene, monster, extraKey, directions);
}

export function getMonsterSpellAnimationDuration(scene, monster, spellId) {
  if (!monster || !spellId) return 0;
  const def = monsters?.[monster.monsterId] || null;
  const mapping = def?.spellAnimations || null;
  const extraKey = mapping?.[spellId] || null;
  if (!extraKey) return 0;
  const extra = resolveMonsterExtraConfig(monster, extraKey);
  const directions = extra?.directions || DEFAULT_MONSTER_ANIM_DIRECTIONS;
  return getMonsterExtraAnimationDuration(scene, monster, extraKey, directions);
}

export function playMonsterDeathAnimation(scene, monster) {
  if (!monster) return 0;
  const def = monsters?.[monster.monsterId] || null;
  const extraKey = def?.deathAnimation || "death";
  const extra = resolveMonsterExtraConfig(monster, extraKey);
  if (!extra) return 0;
  monster._deathAnimating = true;
  const map = scene?.combatMap || scene?.map;
  const groundLayer = scene?.combatGroundLayer || scene?.groundLayer;
  if (map && groundLayer) {
    const tx =
      typeof monster.currentTileX === "number"
        ? monster.currentTileX
        : monster.tileX;
    const ty =
      typeof monster.currentTileY === "number"
        ? monster.currentTileY
        : monster.tileY;
    if (typeof tx === "number" && typeof ty === "number") {
      const wp = map.tileToWorldXY(tx, ty, undefined, undefined, groundLayer);
      if (wp) {
        const offX =
          typeof monster.renderOffsetX === "number" ? monster.renderOffsetX : 0;
        const offY =
          typeof monster.renderOffsetY === "number" ? monster.renderOffsetY : 0;
        monster.x = wp.x + map.tileWidth / 2 + offX;
        monster.y = wp.y + map.tileHeight + offY;
      }
    }
  }
  const directions = extra?.directions || DEFAULT_MONSTER_ANIM_DIRECTIONS;
  return playMonsterExtraAnimation(scene, monster, extraKey, directions);
}
