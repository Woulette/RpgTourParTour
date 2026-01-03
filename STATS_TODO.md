# Stats - Reste a faire

## Systeme de paliers (T1 -> T5)
- Appliquer les caps par palier:
  - Chance de crit: T1=5% | T2=10% | T3=15% | T4=20% | T5=25%
  - Dommages crit: T1=5 | T2=10 | T3=15 | T4=20 | T5=25
  - Resistance fixe: T1=20 | T2=40 | T3=60 | T4=80 | T5=100
- Definir ou stocker le palier actif dans `player.classeEvolution` (tier par defaut = 1).

## Coups critiques
- Calculer la chance finale (critChancePct + caps).
- Appliquer les dommages crit fixes lors d'un crit.

## Soins
- Appliquer le bonus de soins aux sorts/effets de soin.

## Pods
- Appliquer la limite/gestion d'inventaire si necessaire.

## UI (si besoin)
- Decider l'emplacement final des sous-stats dans le panneau (carac vs onglets).
