# Spells Refactor Plan

Goal: move spell execution to a data-driven, effect-based pipeline so adding many spells does not grow `cast.js`.

## Target Architecture

- `src/features/combat/spells/cast.js`: orchestration (costs, cooldowns, call effects)
- `src/features/combat/spells/registry.js`: effect type -> handler
- `src/features/combat/spells/effects/`: one file per effect
- `src/features/combat/spells/patterns/`: targeting/area patterns
- `src/features/combat/spells/utils/`: shared helpers (tiles, LOS, stats)
- `src/content/spells/`: data-only spell definitions (players/monsters/npc)

## Migration Strategy (Safe)

1) Add effect registry + executor while keeping legacy support.
2) Migrate a small set of simple spells to `effects` (validation in game).
3) Expand effect set and migrate remaining spells in batches.
4) Remove legacy paths once coverage is complete.

## Effect Examples (Data)

```
{
  id: "souffle_cedre",
  paCost: 3,
  rangeMin: 1,
  rangeMax: 1,
  effects: [
    { type: "damage", element: "terre", min: 9, max: 11 },
    { type: "push", distance: 1 }
  ]
}
```

## Notes

- Keep behavior identical during migration.
- Effects must be order-dependent (pipeline).
- Targeting/LOS stays separate from execution.

