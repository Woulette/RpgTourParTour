export default {
  id: "liburion",
  label: "Liburion",
  textureKey: "liburion",
  spritePath: "assets/monsters/Liburion/rotations/south-west.png",
  render: {
    originX: 0.6,
    originY: 0.85,
    offsetY: 0,
  },
  statsOverrides: {
    hpMax: 50,
    hp: 50,
    pa: 7,
    pm: 3,
    intelligence: 22,
    initiative: 8,
  },
  spells: ["eclat"],
  loot: [],
  xpReward: 140,
  goldRewardMin: 25,
  goldRewardMax: 55,
};

