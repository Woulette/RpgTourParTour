import { canCastSpellAtTile, castSpellAtTile } from "../../../combat/spells/index.js";
import { showFloatingTextOverEntity } from "../../../combat/runtime/floatingText.js";
import { delay, moveMonsterAlongPath } from "../aiUtils.js";
import { getEntityTile, selectTarget } from "./targetSelector.js";
import { getSpellForMonster, selectSpell } from "./spellSelector.js";
import { planMovement } from "./movementPlanner.js";

const POST_MOVE_DELAY_MS = 200;
const POST_ATTACK_DELAY_MS = 250;

function getDelay(profile, key, fallback) {
  const value = profile?.delays?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

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

  const monsterTile = getEntityTile(monster);
  const targetTile = getEntityTile(target);
  const distance =
    monsterTile && targetTile
      ? Math.abs(targetTile.x - monsterTile.x) +
        Math.abs(targetTile.y - monsterTile.y)
      : null;

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

  const postMoveDelay = getDelay(profile, "postMove", POST_MOVE_DELAY_MS);
  const postAttackDelay = getDelay(profile, "postAttack", POST_ATTACK_DELAY_MS);

  const attackTypes = ["damage", "control", "debuff"];
  const wantsMelee = profile?.role === "melee";
  const path = planMovement(scene, state, monster, target, profile, map);

  const pickPokeSelection = () => {
    if (!monsterTile || !targetTile) return null;
    const rules =
      Array.isArray(profile?.spells) && profile.spells.length > 0
        ? profile.spells
            .filter((rule) => rule && rule.id && attackTypes.includes(rule.type))
            .slice()
            .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
        : [];

    if (rules.length === 0) return null;
    const steps = [{ x: monsterTile.x, y: monsterTile.y }, ...(path || [])];

    for (let i = 0; i < steps.length; i += 1) {
      const pos = steps[i];
      for (const rule of rules) {
        if (rule.requireMelee) continue;
        const spell = getSpellForMonster(monster, rule.id);
        if (!spell) continue;
        const maxRange = spell.rangeMax ?? 0;
        if (maxRange <= 1) continue;
        const virtualCaster = {
          ...monster,
          tileX: pos.x,
          tileY: pos.y,
          currentTileX: pos.x,
          currentTileY: pos.y,
        };
        if (!canCastSpellAtTile(scene, virtualCaster, spell, targetTile.x, targetTile.y, map)) {
          continue;
        }
        return { stepIndex: i, spell, targetTile };
      }
    }

    return null;
  };

  if (wantsMelee && typeof distance === "number" && distance > 1 && path && path.length > 0) {
    const poke = pickPokeSelection();
    if (poke) {
      const moveBefore = path.slice(0, poke.stepIndex);
      const moveAfter = path.slice(poke.stepIndex);

      const castThenMove = () => {
        const ok = castSpellAtTile(
          scene,
          monster,
          poke.spell,
          poke.targetTile.x,
          poke.targetTile.y,
          map,
          groundLayer
        );
        if (ok) {
          didCast = true;
        }

        if (!moveAfter.length) {
          delay(scene, postAttackDelay, () => onComplete?.());
          return;
        }

        delay(scene, postAttackDelay, () => {
          moveMonsterAlongPath(scene, monster, map, groundLayer, moveAfter, () => {
            state.pmRestants = Math.max(0, (state.pmRestants ?? 0) - moveAfter.length);
            if (moveAfter.length > 0) {
              showFloatingTextOverEntity(scene, monster, `${moveAfter.length}`, {
                color: "#22c55e",
              });
            }
            delay(scene, postMoveDelay, () => onComplete?.());
          });
        });
      };

      if (moveBefore.length > 0) {
        moveMonsterAlongPath(scene, monster, map, groundLayer, moveBefore, () => {
          state.pmRestants = Math.max(0, (state.pmRestants ?? 0) - moveBefore.length);
          if (moveBefore.length > 0) {
            showFloatingTextOverEntity(scene, monster, `${moveBefore.length}`, {
              color: "#22c55e",
            });
          }
          delay(scene, postMoveDelay, () => castThenMove());
        });
      } else {
        castThenMove();
      }
      return;
    }
  }

  const shouldMoveFirst = wantsMelee && typeof distance === "number" && distance > 1;

  if (!shouldMoveFirst) {
    const attackSelection = selectSpell(scene, monster, target, profile, map, {
      types: attackTypes,
    });
    if (attackSelection && tryCast(attackSelection)) {
      delay(scene, postAttackDelay, () => onComplete?.());
      return;
    }
  }

  if (!path || path.length === 0) {
    if (shouldMoveFirst) {
      const fallbackAttack = selectSpell(scene, monster, target, profile, map, {
        types: attackTypes,
      });
      if (fallbackAttack && tryCast(fallbackAttack)) {
        delay(scene, postAttackDelay, () => onComplete?.());
        return;
      }
    }
    if (didCast) {
      delay(scene, postAttackDelay, () => onComplete?.());
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
      types: attackTypes,
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
        delay(scene, postAttackDelay, () => onComplete?.());
        return;
      }
    }

    delay(scene, postMoveDelay, () => onComplete?.());
  });
}
