export default {
  id: "liburion",
  label: "Liburion",
  textureKey: "liburion",
  spritePath: "assets/monsters/Liburion/rotations/south-west.png",
  animation: {
    prefix: "liburion",
    basePath: "assets/monsters/Liburion/animations/walk-4-frames",
    frameCount: 4,
  },
  render: {
    originX: 0.5,
    originY: 0.90,
    offsetY: 0,
  },
  baseLevel: 13,
  levelMin: 11,
  levelMax: 15,
  statsOverrides: {
    hpMax: 110,
    hp: 110,
    pa: 7,
    pm: 3,
    intelligence: 22,
    initiative: 8,
  },
  spells: ["eclat", "rugissement"],
  loot: [
    { itemId: "fourrure_liburion", min: 1, max: 1, dropRate: 0.3 },
  ],
  xpReward: 440,
  goldRewardMin: 17,
  goldRewardMax: 38,
};
