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
