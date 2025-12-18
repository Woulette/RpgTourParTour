export default {
  id: "aluineeks",
  label: "Aluineeks",
  textureKey: "aluineeks",
  spritePath: "assets/monsters/aluineeks.png",
  render: {
    originX: 0.5,
    originY: 1,
    offsetY: 0,
  },
  statsOverrides: {
    hpMax: 50,
    hp: 50,
    pa: 8,
    pm: 4,
    force: 20,
    initiative: 4,
  },
  spells: ["fissure"],
  loot: [],
  xpReward: 80,
};

