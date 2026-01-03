# LAN / MULTI - REGLES CRITIQUES (A LIRE AVANT DE CODER)

Objectif: eviter les erreurs irreparables en multi. Ici, uniquement l'essentiel.

## ERREURS A EVITER (COMME LA PESTE)

1) Jamais faire confiance au client
- Regle d'or: client demande, serveur decide.
- Le client n'applique jamais: degats, PA/PM, loot, touches, crit.

2) Ne pas synchroniser l'etat complet en continu
- Pas de "j'envoie toute la map / tout l'inventaire / tous les PV".
- Envoie uniquement des evenements discrets (move, cast, endTurn, gainXP, addItem).

3) RNG cote client = desync assure
- RNG uniquement serveur.
- Le serveur renvoie les resultats (crit oui/non, degats exacts, loot exact).

4) Les floats vont te trahir
- Pas de float pour positions/degats/portees.
- Tout en entiers, grille, formules deterministes.

5) Ordre d'execution unique
- Le serveur impose l'ordre.
- EventId ou turnIndex monotone pour rejouer dans le meme ordre.

6) Pas de separation "solo / multi"
- Un seul moteur de regles.
- Solo = serveur local, LAN = serveur reseau.

7) Pas de resync = bombe a retardement
- Checksum fin de tour.
- Si mismatch, resync depuis le serveur.

8) Trop de messages = latence + bugs
- 1 action = 1 message (pas "chaque tick").

9) Versioning / compatibilite
- protocolVersion (int) + gameDataVersion (hash des datas).
- Refuser la connexion si mismatch (message clair).

10) Identifiants stables (UID) partout
- Ne jamais utiliser "index dans une liste".
- entityId stable pour joueurs/mobs/items/effets/projectiles/quetes.

11) Ownership / qui controle quoi
- Hors combat: chaque client peut demander le move de SON perso.
- En combat: seul le joueur actif peut envoyer Move/Cast/EndTurn.

12) Timeouts / deconnexions / reconnexion
- Timeout 10-20s.
- Pause ou IA de remplacement.
- Reconnect + resync minimal.

13) File d'evenements + ack
- EventId monotone.
- Client ack(lastEventIdReceived).
- Serveur renvoie les events manquants, ignore les doublons.

14) Serialization propre
- Ne jamais envoyer des objets de scene.
- Envoyer seulement IDs + nombres + petites structures.

15) Sauvegarde multi
- Seul le serveur (host) sauvegarde.
- Les clients ne font que du cache.

16) Determinisme strict
- Tri stable par ID.
- Pas d'iteration aleatoire.
- Regles d'arrondi identiques.
- Hash d'etat fin de tour.

17) Melanger logique et UI
- UI -> commande.
- Serveur -> valide/applique.
- Serveur -> event.
- Client -> affiche.

## KIT MINIMAL ANTI-ENFER (A FAIRE ABSOLUMENT)

- Serveur autoritaire.
- Commandes (intentions) uniquement.
- RNG serveur-only.
- IDs stables partout.
- Versioning (protocol + data hash).
- Checksum fin de tour + resync.

## CHOIX RESEAU (JS / LAN)

- Option A (recommandee): Node.js host + WebSocket.
- Option B: WebRTC DataChannel (plus complexe, signaling).
- Pour demarrer: Node + WebSocket.

## PIEGES SPECIFIQUES JS (A EVITER)

1) JSON partout = lent a long terme
- JSON OK pour demarrer, mais: protocolVersion + format stable.
- Exemple minimal: { v: 1, t: "CmdMove", id: 123 }

2) Tout est Number (float)
- Stats/degats/cellules en entiers.
- Arrondi unique (Math.floor/round, une seule regle).

3) Ordre des objets non garanti
- Toujours trier par ID avant application.

4) Doublons de commandes
- cmdId unique par client.
- Serveur garde dernier cmdId traite, ignore doublons.

5) Flood / spam
- Rate limit par type de commande.
- Validation stricte (tour actif, PA/PM, cooldown).

## JSON: CE QUI EST OK / PAS OK

- OK: maps/items/sorts/quetes en JSON (data, chargement, sauvegarde).
- PAS OK: envoyer des gros blobs JSON en continu.
- En reseau: envoyer mapId + positions, pas la map complete.

## ARCHI RECOMMANDEE (TOUR PAR TOUR)

- Client -> serveur: CmdMove, CmdCastSpell, CmdEndTurn, CmdUseItem, CmdInteract
- Serveur -> clients: EvMoved, EvSpellCast, EvDamageApplied, EvStatusApplied,
  EvTurnStarted, EvTurnEnded, EvInventoryChanged, EvQuestUpdated
- Le client n'infere rien, il affiche.

## 3 CHOSES QUI CASSENT PLUS TARD SI OUBLIEES

1) Handshake version
- protocolVersion + dataHash a la connexion.

2) RNG serveur-only
- Le serveur tire, le serveur envoie le resultat.

3) Checksum fin de tour + resync
- Hash et resync si mismatch.

## CONSEIL PRATIQUE

- Commencer le multi en combat (plus cadre), puis exploration.

## SOLO = SERVEUR LOCAL

- Un seul moteur de regles (server).
- Solo et multi passent par les memes commandes.
- Solo = serveur local (meme flux que la LAN).

## CHECKLIST DEMARRAGE (LAN MINIMAL)

- Serveur accepte 2 joueurs (room host/join).
- Sync deplacement via intentions.
- Entree en combat + ordre des tours.
- 1 sort simple (degat direct).
- Logs reseau (actions + resultats).
- Rejeu debug (enregistrer les commandes d'une partie).
