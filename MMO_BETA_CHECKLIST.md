# Checklist MMO Beta

## Systèmes Core (Indispensable)
- Serveur autoritaire : déplacement, combat, loot, échange, craft, inventaire.
- Persistance comptes + personnages (DB serveur).
- Transitions de map : tuiles d'entrée déterministes + spawn sûr (collisions).
- Boucle de combat stable : ordre des tours, tacle, validation des sorts, cooldowns.
- Ressources : spawn/récolte/respawn synchronisés côté serveur.
- IA monstres + respawn : piloté serveur, pas de mouvement client-only.

## Économie & Social (MVP)
- Échanges sécurisés (pas de duplication / pas de perte, rollback safe).
- Chat : global + map + groupe + privé.
- Amis + invitations de groupe (accept/decline, sync des membres).

## Sécurité & Anti-Cheat (Beta)
- Rate limit : login, déplacements, échanges, actions combat.
- Validation serveur sur tous les changements d'items.
- Gestion déco : sauvegarde propre + reprise combat.
- Détecter positions invalides (hors map) + auto-correction.

## Monde & Contenu (Jouable)
- Zone de départ avec quêtes + PNJ.
- Au moins 1-2 donjons ou événements.
- Tables de loot équilibrées pour les bas niveaux.
- Boucle de progression : XP -> niveau -> sorts/équipement.

## Ops & Stabilité
- Logs serveur (erreurs + audit échanges/loot).
- Backups DB (quotidien ou à l'arrêt).
- Reprise après crash (sauvegarde sûre, pas de perte d'items).

## QA / Scénarios de Test
- Multi-comptes : bons persos par compte.
- Échanges : offres partielles, annulation, reconnexion.
- Combat : tacle, cooldowns, LOS, sorts invalides.
- Transitions de map : chaque bordure et portail.
- Persistance : relog restaure inventaire/position/quêtes.

## TerminÇ¸
- Marché¸ basique (listing + achat direct) ou PNJ achat/vente.
- Craft / inventaire / loot gÇ¸rÇ¸s cÇïtÇ¸ serveur.

