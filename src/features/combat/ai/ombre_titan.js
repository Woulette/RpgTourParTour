import { monsterSpells } from "../../../content/spells/monsters/index.js";
import {
  castSpellAtTile,
  canCastSpell,
  canCastSpellOnTile,
} from "../spells/index.js";
import { showFloatingTextOverEntity } from "../runtime/floatingText.js";
import {
  delay,
  moveMonsterAlongPath,
  findPathToReachAdjacentToTarget,
} from "../../../features/monsters/ai/aiUtils.js";

const POST_MOVE_DELAY_MS = 250;
const POST_ATTACK_DELAY_MS = 150;

function moveAlong(scene, state, monster, map, groundLayer, path, cb) {
  if (!path || path.length === 0) {
    cb?.();
    return;
  }
  moveMonsterAlongPath(scene, monster, map, groundLayer, path, () => {
    state.pmRestants = Math.max(0, (state.pmRestants ?? 0) - path.length);
    if (path.length > 0) {
      showFloatingTextOverEntity(scene, monster, `${path.length}`, {
        color: "#22c55e",
      });
    }
    delay(scene, POST_MOVE_DELAY_MS, cb);
  });
}

export function runTurn(scene, state, monster, player, map, groundLayer, onComplete) {
  const finish = () => onComplete?.();
  const pmRestants = state.pmRestants ?? 0;

  if (typeof monster.tileX !== "number" || typeof monster.tileY !== "number") {
    const t = map.worldToTileXY(monster.x, monster.y, true, undefined, undefined, groundLayer);
    if (t) {
      monster.tileX = t.x;
      monster.tileY = t.y;
      monster.currentTileX = t.x;
      monster.currentTileY = t.y;
    }
  }

  const mx = monster.tileX ?? 0;
  const my = monster.tileY ?? 0;

  let px = player.currentTileX;
  let py = player.currentTileY;
  if (typeof px !== "number" || typeof py !== "number") {
    const t = map.worldToTileXY(player.x, player.y, true, undefined, undefined, groundLayer);
    if (t) {
      px = t.x;
      py = t.y;
    } else {
      finish();
      return;
    }
  }

  const spells = monsterSpells.ombre_titan || {};
  const melee = spells.ombre_frappe;
  const ranged = spells.ombre_rafale;

  const tryCast = (spell) => {
    if (!spell) return false;
    if (!canCastSpell(scene, monster, spell)) return false;
    if (!canCastSpellOnTile(scene, monster, spell, px, py, map)) return false;
    return castSpellAtTile(scene, monster, spell, px, py, map, groundLayer);
  };

  const dist = Math.abs(px - mx) + Math.abs(py - my);

  if (dist > 1 && ranged && canCastSpell(scene, monster, ranged)) {
    if (tryCast(ranged)) {
      delay(scene, POST_ATTACK_DELAY_MS, finish);
      return;
    }
  }

  const tryMeleeTwice = () => {
    if (!melee) {
      finish();
      return;
    }
    let casted = false;
    if (tryCast(melee)) casted = true;
    if (tryCast(melee)) casted = true;
    delay(scene, casted ? POST_ATTACK_DELAY_MS : 80, finish);
  };

  if (dist === 1) {
    tryMeleeTwice();
    return;
  }

  if (pmRestants > 0) {
    const path =
      findPathToReachAdjacentToTarget(scene, map, mx, my, px, py, 60, monster) || [];
    const pathTiles = path.length > 0 ? path.slice(0, pmRestants) : [];
    moveAlong(scene, state, monster, map, groundLayer, pathTiles, tryMeleeTwice);
    return;
  }

  tryMeleeTwice();
}
