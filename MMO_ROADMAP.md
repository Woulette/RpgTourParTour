# MMO Roadmap (sans host)

## Phase 1 - Socle MMO (indispensable)
- Auth/login + session token (plus d'usurpation via characterId)
- Autorite serveur stricte (inventaire/or/quetes/XP)
- Persistence minimale (position, HP, stats, inventaire, monnaie)
- Inventaire/monnaie atomiques + logs anti-dup
- Validation serveur des operations (itemId, qty, stack max, poids)
- Snapshot serveur au login (client ne pousse que des commandes)
- Protection replay/duplicate (cmdId + fenetre temporelle)

## Phase 2 - MMO jouable
- Quetes + progression persistantes
- Commerce (P2P + marche simple) avec verrou/confirm
- Groupes + combats de groupe
- Drop/loot serveur (tables + RNG serveur)
- Reconnexion solide + resync map/combat
- Rate limits par type de commande (moves, inventaire, gold, etc.)
- Outils admin (kick/ban, give item, inspect)
- Audit events gameplay (trade, drop, quest turn-in)

## Phase 3 - MMO stable
- Sharding / multi-process (world/combat/db worker)
- Monitoring + logs structures + alertes
- Sauvegardes DB + restore testee
- Anti-cheat avance (rate limit + detection anomalies)
- Interest management par zone/viewport
- Reconciliation client/serveur (correction des ecarts)
- Job queue pour taches lourdes

## Phase 4 - MMO production
- Optim perf reseau (delta snapshots, compression)
- Migration/patching data live
- Equilibrage, economie, taxations, sinks
- Scalabilite horizontale (redis/pubsub)
- Securite (DDoS basic, auth durci)
- Observabilite temps reel (TPS, latence, drops)
- Backups chiffres + rotation
