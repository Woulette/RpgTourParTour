export default {
  id: "cedre",
  label: "Cèdre",
  textureKey: "cedre",
  spritePath: "assets/monsters/Cedre/rotations/south-west.png",
  animation: {
    prefix: "cedre",
    basePath: "assets/monsters/Cedre/animations/walk-4-frames",
    frameCount: 4,
  },
  render: {
    originX: 0.55,
    originY: 0.95,
    offsetY: 0,
  },
  baseLevel: 10,
  levelMin: 7,
  levelMax: 11,
  statsOverrides: {
    hpMax: 80,
    hp: 80,
    pa: 8,
    pm: 3,
    force: 20,
    initiative: 6,
  },
  spells: ["aura_cedre", "souffle_cedre"],
  loot: [
    { itemId: "peau_cedre", min: 1, max: 1, dropRate: 0.3 },
  ],
  xpReward: 290,
  goldRewardMin: 28,
  goldRewardMax: 70,
};
