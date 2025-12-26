# IA Monstres - Notes de base

Objectif: eviter les bugs classiques (positions, PM/PA, LOS) et garder un
comportement clair pour tous les monstres.

## Checklist rapide
- Position:
  - S'assurer que `monster.tileX/tileY` sont renseignes au debut du tour.
  - Recuperer `player.currentTileX/Y` avec fallback `worldToTileXY`.
- PA/PM:
  - Toujours respecter `state.paRestants` et `state.pmRestants`.
  - Ne pas reutiliser un `pmRestants` en cache apres un move. Relire l'etat.
- Ciblage/LOS:
  - Sorts a distance -> verifier la ligne de vue.
  - Si push/deplacement de la cible: recalculer la position avant un 2e cast.
- Deplacement:
  - Utiliser le pathfinding "meilleure case adjacente" (pas la 1ere trouvee).
  - Si aucun chemin, finir le tour proprement.
- Buffs de zone:
  - Se repositionner pour toucher un maximum d'allies.
  - Si aucun allie, buff sur soi si c'est permis.
- Sequencement:
  - Attaque -> move -> attaque seulement si PM/PA restants.
  - Sinon finir le tour (pas de boucle).

## Conventions utiles
- Toujours appeler `onComplete()` pour terminer le tour.
- Apres un mouvement, mettre a jour `state.pmRestants` et afficher le cout PM.
- Si un sort echoue, ne pas forcer un autre cast sans re-verifier portee/LOS.

## Erreurs frequentes
- Reutiliser une vieille position du joueur.
- Se remettre en ligne inutilement (biais BFS).
- Double deplacement par tour (PM qui se "rechargent").
- Tir a travers obstacles (LOS non verifiee).

