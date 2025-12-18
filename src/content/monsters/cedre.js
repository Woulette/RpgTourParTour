export default {
  id: "cedre",
  label: "Cèdre",
  textureKey: "cedre",
  spritePath: "assets/monsters/Cedre/south-west.png",
  render: {
    originX: 0.5,
    originY: 1,
    offsetY: 0,
  },
  statsOverrides: {
    hpMax: 80,
    hp: 80,
    pa: 8,
    pm: 3,
    force: 20,
    initiative: 6,
  },
  spells: ["ronce", "seve_toxique"],
  loot: [],
  xpReward: 190,
  goldRewardMin: 28,
  goldRewardMax: 70,
};

