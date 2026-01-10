# MMO Roadmap (sans host)

## Phase 1 - Socle MMO (indispensable)
- (Termine)

## Phase 2 - MMO jouable
- Commerce (P2P + marche simple) avec verrou/confirm
- Groupes + combats de groupe
- Reconnexion solide + resync map/combat
- Outils admin (kick/ban, give item, inspect)
- Audit events gameplay (trade, drop, quest turn-in)
- Tests anti-cheat rapides (rate-limits + invalid quest actions)

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
