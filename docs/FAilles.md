Faille dimensionnelle (mecanique)

Resume
- Une faille est un point interactif sur une map (ex: MapAndemiaNouvelleVersion10).
- Survol = highlight, clic = ouvre une modale de details (rang, vagues, monstres).
- Teleportation possible si un mapKey de destination est configure.
- Une faille fermee se grise et ne peut plus etre relancee.

Fichiers principaux
- Spawner + logique faille: src/features/maps/world/rifts.js
- UI modale: src/features/ui/domRifts.js
- Styles modale: assets/css/rifts.css (injecte dans index.html)
- Positions: src/features/maps/index.js (propriete riftPositions)

Configuration (MapDef)
Exemple:
  riftPositions: [
    {
      id: "north_rift_f_1",
      tileX: 8,
      tileY: 8,
      textureKey: "rift_dim_1",
      rank: "F",
      totalMonsters: 8,
      waveCount: 2,
      targetMapKey: "MapFailleF1",
      targetStartTile: { x: 10, y: 12 },
    },
  ]

Apparition des failles
- Les failles spawnent uniquement si la quete "keeper_north_explosion_1" est en cours.

Teleportation
- Le bouton "Se teleporter" est actif uniquement si targetMapKey est defini.
- La transition utilise le meme fade que les portails/changes de map.

Fermeture d'une faille
- Quand la faille est terminee (combat/vagues finis), appeler:
  closeRiftForPlayer(scene, scene.player.activeRiftId)
- Cela grise le sprite + incremente la progression de quete.

Quete liee
- keeper_north_explosion_1 (stage "close_rifts")
- Objectif: "Failles fermees" (requiredCount: 2)

A faire plus tard
- MapKey des failles (MapFailleF1/MapFailleF2 ou autre).
- Spawn combats en 2 vagues: 4 monstres + 4 monstres au tour 2.
