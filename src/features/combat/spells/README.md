# Spells Architecture

Quick navigation for the spells system.

## Core (pipeline)
- `core/cast.js`: orchestrates spell casting and effect execution.
- `core/canCast.js`: validation rules (range, LOS, costs, cooldowns).
- `core/activeSpell.js`: current spell state.
- `core/preview.js`: preview logic (area, damage).
- `core/registry.js`: spell registration/loading.

## Effects (reusable behaviors)
Each effect is a small, reusable behavior. Spells are composed by listing effects.
- `effects/index.js`: effect registry (maps type -> handler).
- `effects/damage.js`: direct damage.
- `effects/lifeSteal.js`: damage + heal (uses last damage).
- `effects/push.js` / `effects/pull.js`: movement effects.
- `effects/areaBuff.js`: buff/debuff in area.
- `effects/status.js`: apply status effects.
- `effects/summonMonster.js`: monster summon.
- `effects/capture.js`: capture target logic.
- `effects/summonCaptured.js`: summon captured entity.
- `effects/patternDamage.js`: damage on patterns (cross, cone, etc.).

## Cast (movement/animation helpers)
- `cast/castAnimations.js`: VFX and cast animations.
- `cast/castPosition.js`: selection/targeting position logic.
- `cast/castMovement.js`: caster movement helpers.
- `cast/castBuffs.js`: buff/eryon handling helpers.
- `cast/castEryon.js`: Eryon charge system.

## Patterns
- `patterns/`: reusable AoE shapes.

## Utils
- `utils/util.js`: shared spell utilities.
- `utils/damage.js`: shared damage helpers.

## Spell data
- Player spells: `src/config/spells.js`
- Monster spells: `src/content/spells/monsters/*.js`

