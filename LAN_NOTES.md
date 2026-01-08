# LAN - NOTES COURTES

Raisons:
- Eviter de casser un systeme qui marche en modifiant plus tard.

Regles d'or (deplacement LAN):
- Dernier ordre gagne (cancel/replace via seq).
- 1 deplacement actif max par joueur.
- Serveur valide le move (seq recent uniquement).
- Sync reseau = intention (cell/path), jamais x/y en continu.
- Les clients annulent l'anim en cours si seq change.

Regles d'or (monde partage):
- Serveur autoritaire sur le monde (spawn/move/death/respawn/harvest).
- Sync reseau = intention (tuile/path/event), pas de x/y en continu.
- 1 action active max par entite (le dernier ordre remplace l'ancien).

Regles d'or (combat LAN):
- Serveur autoritaire sur l'etat combat (positions + HP + tour).
- Les clients ne simulent pas l'IA ni les degats en LAN.
- Chaque action critique => snapshot serveur (EvCombatState).
- Un cast en attente doit passer par le serveur (pas d'application locale).
- Un combat doit avoir un combatId + mapId coherents (ignore sinon).
- L'IA combat est pilotee par un seul driver (aiDriverId) et c'est lui qui emet
  les CmdCombatMonsterMoveStart (jamais conditionne par "host").

Init map (LAN):
- ensureMapInitialized(mapId) = point central d'init (hook unique).
- Stub temporaire : l'host doit etre sur la map pour fournir le snapshot.
- A remplacer plus tard par bundle serveur (plus de dependance host).
