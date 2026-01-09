# MMO roadmap (sans host)

## Phase 1 ? Socle MMO (indispensable)
- Auth/login + session token (plus d?usurpation via characterId)
- Persistance minimale (position, HP, stats, inventaire, monnaie)
- Inventaire/monnaie atomiques + logs anti-dup

## Phase 2 ? MMO jouable
- Quetes + progression persistantes
- Commerce (P2P + marche simple) avec verrou/confirm
- Groupes + combats de groupe
- Drop/loot serveur (tables + RNG serveur)
- Reconnexion solide + resync map/combat
- Outils admin (kick/ban, give item, inspect)

## Phase 3 ? MMO stable
- Sharding / multi-process (world/combat/db worker)
- Monitoring + logs structures + alertes
- Sauvegardes DB + restore testee
- Anti-cheat avance (rate limit + detection anomalies)
- Interest management par zone/viewport

## Phase 4 ? MMO production
- Optim perf reseau (delta snapshots, compression)
- Migration/patching data live
- Equilibrage, economie, taxations, sinks
- Scalabilite horizontale (redis/pubsub)
- Securite (DDoS basic, auth durci)
