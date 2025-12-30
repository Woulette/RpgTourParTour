import { castSpellAtTile } from "../../../combat/spells/index.js";
import { showFloatingTextOverEntity } from "../../../combat/runtime/floatingText.js";
import { delay, moveMonsterAlongPath } from "../aiUtils.js";
import { selectTarget } from "./targetSelector.js";
import { selectSpell } from "./spellSelector.js";
import { planMovement } from "./movementPlanner.js";

const POST_MOVE_DELAY_MS = 200;
const POST_ATTACK_DELAY_MS = 250;

export function runGenericAi(scene, state, monster, player, map, groundLayer, profile, onComplete) {
  if (!scene || !state || !monster || !map || !groundLayer) {
    onComplete?.();
    return;
  }

  const target = selectTarget(scene, monster, player, profile);
  if (!target) {
    onComplete?.();
    return;
  }

  let didCast = false;

  const tryCast = (selection) => {
    if (!selection || !selection.spell || !selection.targetTile) return false;
    const ok = castSpellAtTile(
      scene,
      monster,
      selection.spell,
      selection.targetTile.x,
      selection.targetTile.y,
      map,
      groundLayer
    );
    if (ok) {
      didCast = true;
    }
    return ok;
  };

  const buffSelection = selectSpell(scene, monster, target, profile, map, {
    types: ["buff"],
  });
  if (buffSelection) {
    tryCast(buffSelection);
  }

  const attackSelection = selectSpell(scene, monster, target, profile, map, {
    types: ["damage", "control", "debuff"],
  });
  if (attackSelection && tryCast(attackSelection)) {
    delay(scene, POST_ATTACK_DELAY_MS, () => onComplete?.());
    return;
  }

  const path = planMovement(scene, state, monster, target, profile, map);
  if (!path || path.length === 0) {
    if (didCast) {
      delay(scene, POST_ATTACK_DELAY_MS, () => onComplete?.());
      return;
    }
    onComplete?.();
    return;
  }

  moveMonsterAlongPath(scene, monster, map, groundLayer, path, () => {
    state.pmRestants = Math.max(0, (state.pmRestants ?? 0) - path.length);
    if (path.length > 0) {
      showFloatingTextOverEntity(scene, monster, `${path.length}`, {
        color: "#22c55e",
      });
    }

    const retry = selectSpell(scene, monster, target, profile, map, {
      types: ["damage", "control", "debuff"],
    });
    if (retry && retry.spell && retry.targetTile) {
      const ok = castSpellAtTile(
        scene,
        monster,
        retry.spell,
        retry.targetTile.x,
        retry.targetTile.y,
        map,
        groundLayer
      );
      if (ok) {
        delay(scene, POST_ATTACK_DELAY_MS, () => onComplete?.());
        return;
      }
    }

    delay(scene, POST_MOVE_DELAY_MS, () => onComplete?.());
  });
}
