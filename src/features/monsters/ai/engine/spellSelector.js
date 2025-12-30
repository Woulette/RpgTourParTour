import { monsterSpells } from "../../../../content/spells/monsters/index.js";
import { canCastSpell, canCastSpellOnTile } from "../../../combat/spells/index.js";
import { getEntityTile } from "./targetSelector.js";

function countAlliesInRadius(scene, center, radius) {
  const list =
    scene?.combatMonsters && Array.isArray(scene.combatMonsters)
      ? scene.combatMonsters
      : [];
  let count = 0;
  for (const m of list) {
    if (!m || !m.stats) continue;
    const hp = typeof m.stats.hp === "number" ? m.stats.hp : m.stats.hpMax ?? 0;
    if (hp <= 0) continue;
    const t = getEntityTile(m);
    if (!t) continue;
    const d = Math.abs(t.x - center.x) + Math.abs(t.y - center.y);
    if (d <= radius) count += 1;
  }
  return count;
}

function getSpellForMonster(monster, spellId) {
  if (!monster || !spellId) return null;
  const list = monsterSpells[monster.monsterId] || {};
  return list[spellId] || null;
}

export function selectSpell(scene, monster, target, profile, map, options = {}) {
  if (!scene || !monster || !profile || !Array.isArray(profile.spells)) return null;
  const types = Array.isArray(options.types) && options.types.length > 0 ? options.types : null;

  const sorted = profile.spells
    .filter((s) => s && s.id)
    .slice()
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  const monsterTile = getEntityTile(monster);
  if (!monsterTile) return null;

  for (const rule of sorted) {
    if (types && !types.includes(rule.type)) continue;
    const spell = getSpellForMonster(monster, rule.id);
    if (!spell) continue;
    if (!canCastSpell(scene, monster, spell)) continue;

    const targetTile = rule.selfCast ? monsterTile : getEntityTile(target);
    if (!targetTile) continue;

    if (rule.requireMelee) {
      const d =
        Math.abs(targetTile.x - monsterTile.x) + Math.abs(targetTile.y - monsterTile.y);
      if (d !== 1) continue;
    }

    if (typeof rule.minAllies === "number") {
      const radius = typeof rule.minAlliesRadius === "number" ? rule.minAlliesRadius : 2;
      const allies = countAlliesInRadius(scene, monsterTile, radius);
      if (allies < rule.minAllies) continue;
    }

    if (!canCastSpellOnTile(scene, monster, spell, targetTile.x, targetTile.y, map)) {
      continue;
    }

    return { spell, rule, targetTile };
  }

  return null;
}
