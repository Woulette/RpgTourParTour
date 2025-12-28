export default {
  id: "maire_combat",
  label: "Maire",
  textureKey: "npc_maire_albinos",
  spritePath: "assets/npc/MaireAlbinossouth-west.png",
  render: {
    originX: 0.5,
    originY: 1,
    offsetY: 0,
  },
  statsOverrides: {
    hpMax: 400,
    hp: 400,
    pa: 8,
    pm: 4,
    intelligence: 100,
    initiative: 503,
  },
  spells: ["decret_maire", "jugement_maire"],
  loot: [],
  xpReward: 0,
};
