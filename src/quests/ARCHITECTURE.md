# Quêtes (architecture)

Objectif : éviter la logique “spéciale” PNJ par PNJ et garder un système scalable (50/100+ PNJ).

## Séparation

- `src/quests/catalog.js` : définitions immuables des quêtes (`QuestDef`).
- `src/quests/defs/` : fichiers de définitions par quête (data pure).
- `src/quests/state.js` : état par joueur (`QuestState`) + progression (accept/advance/complete).
- `src/quests/runtime/` : logique générique pour PNJ (`!/?`) et objectifs.

## Marqueurs `!` / `?`

Calcul centralisé dans `src/quests/runtime/npcStatus.js` :

- `?` si au moins une quête est **prête à être validée** sur ce PNJ.
  - `talk_to_npc` : toujours prêt dès que l’étape est active et que tu parles au bon PNJ.
  - `deliver_item` : prêt seulement si l’inventaire contient assez d’objets.
- `!` sinon, si au moins une quête est **disponible à prendre** sur ce PNJ (pré-requis validés).

Priorité : `?` avant `!`.

## Objectifs

Gérés dans `src/quests/runtime/objectives.js` :

- `kill_monster` : progression via `incrementKillProgress`.
- `talk_to_npc` : validation à l’interaction PNJ.
- `deliver_item` : validation si inventaire OK, avec `consume: true/false` pour consommer ou non.
