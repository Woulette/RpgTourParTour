# Marche joueur (equipements / ressources) - Regles indispensables

Ce document liste ce qu'il faut absolument faire et eviter pour un marche
securise (achat / vente entre joueurs) sans duplication ni triche.

## Objectif minimal
- Vendre/acheter equipements, ressources et consommables.
- Aucun objet de quete.
- Pas de duplication, pas d'or negatif, pas d'objets fantomes.

## Regles serveur obligatoires
- Autorite serveur totale: le client ne fait que demander.
- Verif au "finalize": existence item + quantite + or de l'acheteur.
- Transaction atomique: retirer item du vendeur + retirer or acheteur + donner item
  acheteur + donner or vendeur dans une seule operation.
- Cap d'or par operation (ex. 1_000_000_000) pour eviter overflow.
- Verifs de categorie: autoriser equipement/ressource/consommable.
- Rejet si quantite <= 0 ou prix <= 0.
- Historique d'audit (vendeur, acheteur, item, qty, prix, date).

## Verrouillage (anti-dup)
- "Reserve" serveur des items mis en vente:
  - un item liste n'est plus utilisable (equip/vente/echange/drop).
  - reserve liberee si: vente annulee, expiree, ou achetee.
- "Reserve" serveur de l'or si tu fais des offres auto (optionnel).

## Cas d'annulation
- Joueur se deco => annuler ses listings.
- Item supprime/equipe ailleurs => listing invalide (a refuser).
- Expiration listing (ex. 24h) => retrait auto.

## Matching achat
- Achat uniquement si listing toujours valide au moment de l'achat.
- Verif: joueur acheteur a assez d'or au moment du clic.
- Verif: vendeur a encore l'item reserve (toujours bloque).
- Si une verif echoue => achat refuse (message clair).

## UI / UX minimum
- Liste: item, quantite, prix unitaire, vendeur, temps restant.
- Filtre: equipement / ressource + recherche texte.
- Confirmation achat (resume: item, qty, total).
- Message d'erreur clair si achat refuse.

## A eviter (erreurs classiques)
- Retirer item du vendeur uniquement cote client.
- Valider un achat sans re-verifier l'inventaire serveur.
- Autoriser quete par erreur.
- Laisser un listing actif si le joueur equipe l'item.
- Traitement non-atomique (risque de dupe en cas de crash).

## Tests rapides a faire
- Achat simultane par 2 joueurs -> un seul passe.
- Listing annule -> item revient dans inventaire.
- Joueur deco -> listing supprime.
- Tentative de vente objet de quete -> refuse.
- Tentative d'achat sans or -> refuse.

## Optionnel (plus tard)
- Taxe de mise en vente / taxe sur vente.
- Limite de listings par joueur.
- Logs anti-cheat (spam, prix absurdes).
