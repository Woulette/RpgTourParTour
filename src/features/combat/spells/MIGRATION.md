# Spells Refactor Summary

This project moved the spell system to a small, extensible pipeline.
Goal: avoid a giant `cast.js` with custom logic per spell.

## What changed
- Spells are now data + effects (composition).
- `core/cast.js` orchestrates and delegates to `effects`.
- New effect handlers were added for player spell needs:
  - `damage`, `lifeSteal`, `pullCasterToMelee`, `patternDamage`,
    `capture`, `summonCaptured`, plus existing `push/pull/status/areaBuff/summonMonster`.
- Player spells (`src/config/spells.js`) now define `effects: [...]`.
- Monster spells already use `effects` in `src/content/spells/monsters/*.js`.
- Preview now reads `effects` for pattern zones (still supports legacy `effectPattern`).

## Current architecture
See `src/features/combat/spells/README.md` for the folder map.

## Why this is extensible
- New spell = data + list of effects, not new logic in `cast.js`.
- New behavior = add one effect file and register it once.
- Effects are reusable across classes and monsters.

## What remains optional
- If desired, remove legacy fields from player spells
  (`lifeSteal`, `pullCasterToMeleeOnHit`, `effectPattern`, `capture`, `summon`).
- Also possible: migrate preview to only use `effects` (no legacy fallback).

## Quick verification checklist
- Life steal: `siphon_vital` / `flumigene`
- Pull caster: `traction_aerienne`
- Pattern damage: `surcharge_instable` / `racines_ancestrales`
- Capture + summon captured: `capture_essence` + `invocation_capturee`

