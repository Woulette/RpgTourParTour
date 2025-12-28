export default {
  id: "ombre_titan",
  label: "Ombre du titan",
  textureKey: "ombre_titan",
  spritePath: "assets/monsters/OmbreTitan/rotations/south-west.png",
  render: {
    originX: 0.5,
    originY: 1,
    offsetY: 0,
    scale: 1.4,
  },
  statsOverrides: {
    hpMax: 900,
    hp: 900,
    pa: 8,
    pm: 3,
    force: 70,
    intelligence: 30,
    initiative: 35,
  },
  spells: ["ombre_frappe", "ombre_rafale"],
  loot: [],
  xpReward: 0,
};
