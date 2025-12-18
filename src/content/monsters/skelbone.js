export default {
  id: "skelbone",
  label: "Skelbone",
  textureKey: "skelbone",
  spritePath: "assets/monsters/Skelbone/rotations/south-west.png",
  render: {
    originX: 0.5,
    originY: 1,
    offsetY: 0,
  },
  statsOverrides: {
    hpMax: 55,
    hp: 55,
    pa: 7,
    pm: 3,
    force: 16,
    initiative: 6,
  },
  spells: ["coup_de_bec"],
  loot: [],
  xpReward: 90,
  goldRewardMin: 15,
  goldRewardMax: 35,
};

