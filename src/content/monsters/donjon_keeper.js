export default {
  id: "donjon_keeper",
  label: "Gardien du donjon",
  textureKey: "npc_donjon_aluineeks_combat",
  spritePath: "assets/npc/PnjDonjonAluineeks/rotations/south-west.png",
  animation: {
    directions: ["north-east", "north-west", "south-east", "south-west"],
  },
  useDiagonalFacing: true,
  render: {
    originX: 0.4,
    originY: 1.15,
    offsetX: 0,
    offsetY: 0,
    scale: 1.3,
  },
  statsOverrides: {
    hpMax: 200,
    hp: 200,
    pa: 8,
    pm: 3,
    force: 25,
    initiative: 5,
  },
  spells: ["traction_gardien", "gardatagarde"],
  loot: [],
  xpReward: 2040,
};
