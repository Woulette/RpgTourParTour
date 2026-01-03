# Plan des stats (brouillon)

## Idee principale
Puissance = bonus global aux degats, sans donner les sous-stats liees a Force/Int/Agi/Chance.

## Sous-stats par caracteristique

### Force
- 1 Force = +5 Pods
- 20 Force = +1 Dommages crit
- Nouvelles stats : `pods`, `dommagesCrit`

### Intelligence
- 10 Intelligence = +1 Soins
- 20 Intelligence = +1 Resistance fixe (tous elements)
- Nouvelles stats : `soins`, `resistanceFixeTerre`, `resistanceFixeFeu`, `resistanceFixeAir`, `resistanceFixeEau`
- Cap resistance par palier : T1=20 | T2=40 | T3=60 | T4=80 | T5=100

### Chance
- 10 Chance = +1 Prospection
- 20 Chance = +1% Chance de crit
- Nouvelles stats : `prospection`, `critChancePct`
- Prospection de base : 100 pour tous les personnages
- Drop : taux final = taux de base * (prospection / 100)

### Agilite
- 10 Agilite = +1 Tacle
- 10 Agilite = +1 Fuite
- Stats existantes : `tacle`, `fuite`

## Puissance
- Bonus global aux degats (formule a definir)
- Ne donne pas pods / soins / resistance fixe elementaire / prospection / crit / tacle / fuite

## Caps par palier d'evolution
- 5 paliers : T1 = classe de base, puis T2 -> T3 -> T4 -> T5
- Cap chance de crit : T1=5% | T2=10% | T3=15% | T4=20% | T5=25%
- Cap dommages crit : T1=5 | T2=10 | T3=15 | T4=20 | T5=25 (valeurs fixes)

## A implementer plus tard
- Systemes de coups critiques (chance + dommages crit)
- Prospection
- Resistance fixe (tous elements)
