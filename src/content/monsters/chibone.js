export default {
  id: "chibone",
  label: "Chibone",
  textureKey: "chibone",
  spritePath: "assets/monsters/Chibone/rotations/south-west.png",
  render: {
    originX: 0.55,
    originY: 0.9,
    offsetY: 0,
  },
  statsOverrides: {
    hpMax: 40,
    hp: 40,
    pa: 6,
    pm: 3,
    force: 12,
    agilite: 8,
    initiative: 5,
  },
  spells: ["coup_de_bec"],
  loot: [],
  xpReward: 60,
  goldRewardMin: 10,
  goldRewardMax: 25,
};

