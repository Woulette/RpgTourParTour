const MELEE_PROFILES = {
  goush: {
    role: "melee",
    targetPriority: ["player", "ally", "summon"],
    delays: {
      postMove: 280,
      postAttack: 420,
    },
    spells: [
      { id: "morsure", type: "damage", priority: 90, requireMelee: true },
      { id: "bave_puante", type: "debuff", priority: 60 },
    ],
  },
  gumgob: {
    role: "melee",
    targetPriority: ["player", "ally", "summon"],
    delays: {
      postMove: 240,
      postAttack: 360,
    },
    spells: [
      { id: "coup_de_massue", type: "damage", priority: 90, requireMelee: true },
      { id: "jet_de_caillou", type: "damage", priority: 40 },
    ],
  },
};

export default MELEE_PROFILES;
