export default {
  id: "goush",
  label: "Goush",
  textureKey: "goush",
  spritePath: "assets/monsters/goush/south-west.png",
  render: {
    originX: 0.5,
    originY: 1,
    offsetY: 0,
  },
  statsOverrides: {
    hpMax: 40,
    hp: 40,
    pa: 7,
    pm: 3,
    force: 24,
    initiative: 7,
  },
  spells: ["morsure", "bave_puante"],
  loot: [],
  xpReward: 110,
  goldRewardMin: 18,
  goldRewardMax: 40,
};

