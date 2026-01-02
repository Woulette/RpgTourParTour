Provisional animation timing notes

- Damage popups for player spells are delayed to match the end of the spell FX.
- Monster removal is delayed until the spell FX finishes (no death animation yet).
- Combat victory is delayed by ~1000 ms after the last monster dies so the hit is visible.

Why this is provisional:
- There are no monster death animations yet.
- These delays should be replaced by a real "on death animation complete" signal.

Files touched:
- src/features/combat/spells/core/cast.js
- src/features/combat/spells/cast/castAnimations.js
- src/features/combat/spells/effects/execute.js
- src/features/combat/spells/effects/damage.js
