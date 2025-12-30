function getEntityTile(entity) {
  const x =
    typeof entity?.currentTileX === "number"
      ? entity.currentTileX
      : typeof entity?.tileX === "number"
      ? entity.tileX
      : null;
  const y =
    typeof entity?.currentTileY === "number"
      ? entity.currentTileY
      : typeof entity?.tileY === "number"
      ? entity.tileY
      : null;
  if (typeof x !== "number" || typeof y !== "number") return null;
  return { x, y };
}

function getAliveEntities(list) {
  const arr = Array.isArray(list) ? list : [];
  return arr.filter((e) => {
    if (!e || !e.stats) return false;
    const hp = typeof e.stats.hp === "number" ? e.stats.hp : e.stats.hpMax ?? 0;
    return hp > 0;
  });
}

function pickNearest(fromTile, entities) {
  if (!fromTile) return null;
  let best = null;
  let bestDist = Infinity;
  for (const e of entities) {
    const t = getEntityTile(e);
    if (!t) continue;
    const d = Math.abs(t.x - fromTile.x) + Math.abs(t.y - fromTile.y);
    if (d < bestDist) {
      bestDist = d;
      best = e;
    }
  }
  return best;
}

export function selectTarget(scene, monster, player, profile) {
  if (!scene || !monster) return null;
  const monsterTile = getEntityTile(monster);
  if (!monsterTile) return null;

  if (monster.isCombatAlly) {
    const enemies = getAliveEntities(scene?.combatMonsters);
    return pickNearest(monsterTile, enemies);
  }

  const targetPriority =
    Array.isArray(profile?.targetPriority) && profile.targetPriority.length > 0
      ? profile.targetPriority
      : ["player", "ally", "summon"];

  for (const kind of targetPriority) {
    if (kind === "player" && player) {
      return player;
    }
    if (kind === "ally") {
      const allies = getAliveEntities(scene?.combatAllies);
      const best = pickNearest(monsterTile, allies);
      if (best) return best;
    }
    if (kind === "summon") {
      const summons = getAliveEntities(scene?.combatSummons);
      const best = pickNearest(monsterTile, summons);
      if (best) return best;
    }
  }

  return player || null;
}

export { getEntityTile };
