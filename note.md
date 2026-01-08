ETAT COMBAT SERVEUR

FAIT
- Sorts autoritaires cote serveur : PA, cooldown, portee, LOS, cible valide.
- Resolution serveur des sorts existants : degats, patternDamage, lifeSteal, push, pull.
- Status effects appliques et synchronises (buff/debuff + areaBuff).
- Ticks poison/DoT au debut du tour (degats + duree).
- Shield/absorb applique cote serveur.
- Capture + invocation capturee cote serveur, visibles pour tous les joueurs.
- IA serveur : choix sort + cible + degats (pas de calcul client).
- Tour/IA des invocations cote serveur (jouent en LAN).
- CmdCombatDamageApplied client ignore (serveur autoritaire).
- Eryon : charges cote serveur (gain, consomme surcharge, self-cast -> puissance).
- Fin de combat cote serveur (victoire: tous monstres morts, defaite: tous joueurs morts).

PAS FAIT ENCORE
- Teleport/glyph (pas utilise pour l instant).
- Resync/reconnect + checksum fin de tour.
- Logs combat serveur + LAN_COMBAT_DEBUG.

NOTES
- "DoT" = damage over time (degats par tour).
