export default {
  id: "cazard",
  label: "Cazard",
  textureKey: "cazard",
  spritePath: "assets/monsters/Cazard/rotations/south-west.png",
  render: {
    originX: 0.5,
    originY: 1,
    offsetY: 0,
  },
  statsOverrides: {
    hpMax: 65,
    hp: 65,
    pa: 7,
    pm: 3,
    agilite: 18,
    initiative: 7,
  },
  spells: ["griffure", "projectile_epineux"],
  loot: [],
  xpReward: 160,
  goldRewardMin: 22,
  goldRewardMax: 55,
};
