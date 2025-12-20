import { monsterSpells } from "../../../content/spells/monsters/index.js";
import { computeSpellDamage } from "../spells/damage.js";
import { showFloatingTextOverEntity } from "../../../core/combat/floatingText.js";
import { delay, moveMonsterAlongPath, findPathToReachAdjacentToTarget } from "../../../monsters/aiUtils.js";
import { getAliveCombatMonsters } from "../../../monsters/aiUtils.js";
import { getAliveSummon } from "./summon.js";
import { addChatMessage } from "../../../chat/chat.js";
import { endCombat } from "../../../core/combat.js";

function getHp(entity) {
  const stats = entity?.stats || {};
  return typeof stats.hp === "number" ? stats.hp : stats.hpMax ?? 0;
}

function pickSummonSpell(summon) {
  const spellBook = monsterSpells[summon.monsterId] || monsterSpells.corbeau || {};
  const primarySpellId =
    Array.isArray(summon.spellIds) && summon.spellIds.length > 0
      ? summon.spellIds[0]
      : null;
  return (
    (primarySpellId && spellBook[primarySpellId]) ||
    Object.values(spellBook)[0] ||
    null
  );
}

function findNearestEnemy(scene, fromX, fromY) {
  const alive = getAliveCombatMonsters(scene);
  let best = null;
  let bestDist = Infinity;
  for (const m of alive) {
    if (!m || !m.stats) continue;
    const hp = getHp(m);
    if (hp <= 0) continue;
    const dx = Math.abs((m.tileX ?? 0) - fromX);
    const dy = Math.abs((m.tileY ?? 0) - fromY);
    const d = dx + dy;
    if (d < bestDist) {
      bestDist = d;
      best = m;
    }
  }
  return best;
}

function applyDamageToEnemy(scene, summon, target, spell) {
  if (!scene?.combatState || !scene.combatState.enCours) return;
  if (!target?.stats) return;

  const damage = Math.max(0, computeSpellDamage(summon, spell));
  const currentHp = getHp(target);
  const newHp = Math.max(0, currentHp - damage);
  target.stats.hp = newHp;

  if (damage > 0) {
    showFloatingTextOverEntity(scene, target, `-${damage}`, { color: "#ff4444" });
  }

  if (scene?.combatState?.joueur) {
    const spellLabel = spell?.label || "Attaque";
    const targetName = target.displayName || target.label || target.monsterId || "Monstre";
    addChatMessage(
      {
        kind: "combat",
        channel: "global",
        author: "Invocation",
        text: `${spellLabel} : ${targetName} -${damage} PV`,
        element: spell?.element ?? null,
      },
      { player: scene.combatState.joueur }
    );
  }

  if (scene && typeof scene.updateCombatUi === "function") {
    scene.updateCombatUi();
  }

  if (newHp <= 0) {
    if (typeof target.onKilled === "function") {
      target.onKilled(scene, summon.owner || scene.combatState?.joueur);
    }
    if (typeof target.destroy === "function") {
      target.destroy();
    }
    if (scene.monsters) {
      scene.monsters = scene.monsters.filter((m) => m !== target);
    }
    if (scene.combatMonsters && Array.isArray(scene.combatMonsters)) {
      scene.combatMonsters = scene.combatMonsters.filter((m) => m && m !== target);
    }

    const remaining = getAliveCombatMonsters(scene).length;
    if (remaining <= 0) {
      if (scene.combatState) scene.combatState.issue = "victoire";
      endCombat(scene);
    }
  }
}

// Tour d'invocation : juste après le joueur, avant les monstres.
// V1 : IA simple (approche + attaque), ne peut jamais cibler le joueur.
export function runSummonTurn(scene, onComplete) {
  const state = scene?.combatState;
  if (!state || !state.enCours) {
    onComplete?.();
    return;
  }

  const player = state.joueur;
  const map = scene.combatMap;
  const groundLayer = scene.combatGroundLayer;
  if (!player || !map || !groundLayer) {
    onComplete?.();
    return;
  }

  const summon = getAliveSummon(scene, player);
  if (!summon) {
    onComplete?.();
    return;
  }

  // Sauvegarde le vrai monstre qui doit jouer après le joueur (déjà sélectionné par passerTour)
  const nextMonster = state.monstre;
  const nextPa = state.paRestants;
  const nextPm = state.pmRestants;
  const finish = () => {
    state.summonActing = false;
    state.monstre = nextMonster;
    state.paRestants = nextPa;
    state.pmRestants = nextPm;
    if (typeof scene.updateCombatUi === "function") {
      scene.updateCombatUi();
    }
    onComplete?.();
  };

  // Le summon "joue" pendant la phase monstre pour réutiliser les coûts/PM sans toucher au système de tour.
  state.summonActing = true;
  state.tour = "monstre";
  state.monstre = summon;
  state.paRestants = summon.stats?.pa ?? state.paBaseMonstre;
  state.pmRestants = summon.stats?.pm ?? state.pmBaseMonstre;

  if (typeof scene.updateCombatUi === "function") {
    scene.updateCombatUi();
  }

  let pmRestants = state.pmRestants ?? 0;
  if (pmRestants <= 0) {
    finish();
    return;
  }

  if (typeof summon.tileX !== "number" || typeof summon.tileY !== "number") {
    const t = map.worldToTileXY(summon.x, summon.y, true, undefined, undefined, groundLayer);
    if (t) {
      summon.tileX = t.x;
      summon.tileY = t.y;
    }
  }

  let sx = summon.tileX ?? 0;
  let sy = summon.tileY ?? 0;

  const enemy = findNearestEnemy(scene, sx, sy);
  if (!enemy) {
    finish();
    return;
  }

  const ex = enemy.tileX ?? 0;
  const ey = enemy.tileY ?? 0;

  const spell = pickSummonSpell(summon);
  const tryAttackIfMelee = () => {
    if (!spell) return false;
    const dist = Math.abs(ex - sx) + Math.abs(ey - sy);
    if (dist !== 1) return false;
    applyDamageToEnemy(scene, summon, enemy, spell);
    return true;
  };

  if (tryAttackIfMelee()) {
    finish();
    return;
  }

  let stepsUsed = 0;
  const pathTiles = [];
  const bfsPath =
    findPathToReachAdjacentToTarget(scene, map, sx, sy, ex, ey, 50, summon) || [];

  if (bfsPath.length > 0) {
    const slice = bfsPath.slice(0, pmRestants);
    slice.forEach((step) => {
      sx = step.x;
      sy = step.y;
      stepsUsed += 1;
      pathTiles.push({ x: sx, y: sy });
    });
  }

  if (stepsUsed === 0 || pathTiles.length === 0) {
    finish();
    return;
  }

  moveMonsterAlongPath(scene, summon, map, groundLayer, pathTiles, () => {
    state.pmRestants = Math.max(0, (state.pmRestants ?? 0) - stepsUsed);
    if (stepsUsed > 0) {
      showFloatingTextOverEntity(scene, summon, `${stepsUsed}`, {
        color: "#22c55e",
      });
    }

    delay(scene, 420, () => {
      // Re-sync tile after move
      const tx = summon.tileX ?? sx;
      const ty = summon.tileY ?? sy;
      const dist = Math.abs(ex - tx) + Math.abs(ey - ty);
      if (dist === 1) {
        tryAttackIfMelee();
      }
      delay(scene, 120, () => {
        finish();
      });
    });
  });
}
