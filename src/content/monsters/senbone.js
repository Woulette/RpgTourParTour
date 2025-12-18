export default {
  id: "senbone",
  label: "Senbone",
  textureKey: "senbone",
  spritePath: "assets/monsters/Senbone/rotations/south-west.png",
  render: {
    originX: 0.5,
    originY: 1,
    offsetY: 0,
  },
  statsOverrides: {
    hpMax: 220,
    hp: 220,
    pa: 10,
    pm: 4,
    force: 30,
    initiative: 10,
  },
  spells: ["fissure"],
  loot: [],
  xpReward: 400,
  goldRewardMin: 60,
  goldRewardMax: 130,
};

