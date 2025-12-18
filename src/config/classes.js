export const classes = {
  archer: {
    label: "Archer",
    color: 0x66ccff,
    statBonuses: [],
    spells: ["tir_simple", "fleche_carbonisee", "flumigene"],
  },
  tank: {
    label: "Tank",
    color: 0xcc9955,
    statBonuses: [],
    spells: ["punch_furtif", "traction_aerienne", "punch_enflamme"],
  },
  mage: {
    // Remplace l'ancienne classe "Mage" par l'Animiste
    label: "Animiste",
    color: 0x66ccff,
    statBonuses: [],
    spells: [],
  },
  assassin: {
    label: "Assassin",
    color: 0xff6666,
    statBonuses: [],
    spells: [],
  },
};

export const defaultClassId = "archer";
