# Checklist simple (pour un autre chat)

Objectif : éviter les clics qui passent “à travers” l’UI et rendre l’UI fiable sur toutes les résolutions.

Ce que j’attends :
- Quand un panneau est ouvert (inventaire, quêtes, stats, métiers, carte, succès, sorts, shop, dialogue PNJ),
  aucun clic ne doit atteindre le monde (PNJ, arbres, ateliers, sol).
- Les overlays (résultat de combat, level up, menu) doivent bloquer le monde aussi.
- L’UI doit être prioritaire : UI d’abord, monde ensuite.

Solutions conseillées :
- Mettre un bloqueur d’input global (overlay transparent) quand une UI est ouverte.
- Centraliser la détection “UI ouverte” dans une fonction unique.

Tests à faire :
- Ouvrir l’inventaire et cliquer sur un slot alors qu’un PNJ est derrière → le PNJ ne s’ouvre pas.
- Ouvrir la carte/quests/stats/succès → aucun clic ne bouge le perso.
- Ouvrir un shop → aucun clic ne clique le monde derrière.
- Résultat de combat + level up → le monde reste bloqué.
- Résolution 1920x1080 et 1366x768 : pas de clics qui passent à travers l’UI.

Si possible :
- Le chat (input texte) bloque aussi les touches de déplacement.
- Les popups/menus sont toujours au-dessus et captent les clics.
