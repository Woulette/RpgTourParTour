# Architecture cible (progressive)

Objectif: rendre le projet lisible, evolutif et facile a naviguer.
On passe en "feature-first": un dossier par feature, avec des sous-couches stables.

## Vision

- Feature-first: `src/features/<feature>/...`
- Couches internes standard:
  - `runtime/`: logique d'execution
  - `state/`: etat + store/slices
  - `ui/`: DOM, panels, widgets
  - `systems/`: coordination interne a la feature
  - `ai/`: IA de la feature
  - `data/` ou `defs/`: tables, configs, catalogues
  - `index.js`: API publique de la feature
- Infra partagée:
  - `src/engine/`: input, scenes, preload, runtime
  - `src/shared/`: utils, constants, helpers
  - `src/app/`: bootstrap + entrypoints

## Arborescence cible (extrait)

```
src/
  app/
    main.js
    bootstrap.js
  engine/
    input/
    scene/
    preload/
    runtime/
  shared/
    utils/
    constants/
  features/
    combat/
      runtime/
      state/
      systems/
      ui/
      ai/
      data/
      index.js
    inventory/
      runtime/
      state/
      ui/
      data/
      index.js
    quests/
      runtime/
      defs/
      state/
      ui/
      index.js
    spells/
      runtime/
      data/
      ui/
      index.js
    monsters/
      runtime/
      ai/
      data/
      index.js
    maps/
      runtime/
      data/
      index.js
    metier/
      alchimiste/
      bucheron/
      bijoutier/
      bricoleur/
      cordonnier/
      tailleur/
  content/
    monsters/
    spells/
```

## Conventions

- Une feature = un domaine fonctionnel clair (combat, inventory, quests).
- Tout ce qui touche a l'UI d'une feature vit dans `features/<feature>/ui/`.
- Tout ce qui est "engine" ou transversal reste dans `engine/` ou `shared/`.
- Chaque feature expose une surface publique via `features/<feature>/index.js`.
- Les nouveaux fichiers suivent ce schema (pas de nouveaux dossiers "core" ou "systems" globaux).

## Migration progressive (sans casse)

1) Ajouter ce doc + conventions.
2) Migrer une feature "petite" (Inventory) pour valider le pattern.
3) Migrer Combat en plusieurs sous-etapes.
4) Migrer le reste a rythme constant.

## Mapping initial: Inventory (etape 1)

Sources actuelles:
- `src/ui/domInventory/*`
- `src/inventory/*`

Destination:
- `src/features/inventory/ui/*` (ex: `domInventory` -> `ui/`)
- `src/features/inventory/runtime/*` (logique execution)
- `src/features/inventory/data/*` (items configs, catalogues)
- `src/features/inventory/index.js` (API publique)

Regle: on deplace petit a petit, on met a jour les imports, on garde le comportement identique.

## Mapping: Combat (etape 2)

Sources actuelles:
- `src/core/combat/*`
- `src/systems/combat/*`
- `src/ui/domCombat*.js`

Destination:
- `src/features/combat/runtime/*` (coeur combat + boucle)
- `src/features/combat/spells/*`
- `src/features/combat/summons/*`
- `src/features/combat/ai/*`
- `src/features/combat/ui/*`
- `src/features/combat/systems/*` (waves, etc.)

## Mapping: Spells (etape 3)

Sources actuelles:
- `src/spells/*`
- `src/ui/domSpells/*`

Destination:
- `src/features/spells/runtime/*` (animations, runtime)
- `src/features/spells/ui/*` (spellbook, spellbar)

## Mapping: Monsters (etape 4)

Sources actuelles:
- `src/monsters/*`
- `src/content/monsters/*`

Destination:
- `src/features/monsters/runtime/*` (spawn, animations, respawn)
- `src/features/monsters/ai/*` (IA utilitaires, tours)
- `src/content/monsters/*` (defs, conserve)

## Mapping: Quests (etape 5)

Anciennes sources (migrées):
- `src/quests/*`
- `src/ui/domQuestTracker.js`
- `src/ui/domQuests.js`

Destination:
- `src/features/quests/runtime/*`
- `src/features/quests/defs/*`
- `src/features/quests/ui/*`

## Mapping: Metier (etape 6)

Anciennes sources (migrées):
- `src/metier/*`
- `src/ui/domMetiers.js`
- `src/ui/craft/*`

Destination:
- `src/features/metier/*` (core metier + sous-metiers)
- `src/features/metier/ui/*`

## Mapping: Achievements (etape 7)

Anciennes sources (migrées):
- `src/achievements/*`
- `src/ui/domAchievements.js`
- `src/ui/domAchievementClaimPanel.js`
- `src/ui/domAchievementClaimHint.js`

Destination:
- `src/features/achievements/defs/*`
- `src/features/achievements/runtime/*`
- `src/features/achievements/ui/*`

## Mapping: Challenges (etape 8)

Anciennes sources (migrées):
- `src/challenges/*`

Destination:
- `src/features/challenges/data/*`
- `src/features/challenges/runtime/*`

## Mapping: NPC + Dialog (etape 9)

Anciennes sources (migrées):
- `src/npc/*`
- `src/dialog/npcs/*`

Destination:
- `src/features/npc/runtime/*`
- `src/features/npc/dialog/*`
- `src/features/npc/catalog/*`

## Mapping: Dungeons (etape 10)

Anciennes sources (migrǸes):
- `src/dungeons/*`

Destination:
- `src/features/dungeons/*`

## Mapping: Maps (etape 11)

Anciennes sources (migrǸes):
- `src/maps/*`

Destination:
- `src/features/maps/*`

## Mapping: UI general (etape 12)

Anciennes sources (migrǸes):
- `src/ui/*`

Destination:
- `src/features/ui/*`
