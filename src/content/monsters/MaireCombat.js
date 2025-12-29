export default {
  id: "maire_combat",
  label: "Maire",
  textureKey: "npc_maire_albinos_combat",
  spritePath: "assets/npc/MaireAlbinos/rotations/south-west.png",
  animation: {
    directions: ["north-east", "north-west", "south-east", "south-west"],
  },
  useDiagonalFacing: true,
  render: {
    originX: 0.4,
    originY: 1.15,
    offsetX: 0,
    offsetY: 0,
  },
  statsOverrides: {
    hpMax: 400,
    hp: 400,
    pa: 8,
    pm: 4,
    intelligence: 100,
    initiative: 503,
  },
  spells: ["decret_maire", "jugement_maire"],
  loot: [],
  xpReward: 0,
};
