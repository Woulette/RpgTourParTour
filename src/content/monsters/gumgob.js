export default {
  id: "gumgob",
  label: "Gumgob",
  textureKey: "gumgob",
  spritePath: "assets/monsters/Gumgob/rotations/south-west.png",
  render: {
    originX: 0.5,
    originY: 1,
    offsetY: 0,
  },
  statsOverrides: {
    hpMax: 95,
    hp: 95,
    pa: 7,
    pm: 3,
    force: 24,
    initiative: 5,
  },
  spells: ["coup_de_massue", "jet_de_caillou"],
  loot: [],
  xpReward: 220,
  goldRewardMin: 35,
  goldRewardMax: 90,
};
