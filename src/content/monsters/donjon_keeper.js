export default {
  id: "donjon_keeper",
  label: "Gardien du donjon",
  textureKey: "npc_donjon_aluineeks",
  spritePath: "assets/npc/DonjonALuineeksPNJsouth-west.png",
  render: {
    originX: 0.5,
    originY: 1,
    offsetY: 0,
    scale: 1.3,
  },
  statsOverrides: {
    hpMax: 200,
    hp: 200,
    pa: 8,
    pm: 3,
    force: 25,
    initiative: 5,
  },
  spells: ["traction_gardien", "gardatagarde"],
  loot: [],
  xpReward: 2040,
};
