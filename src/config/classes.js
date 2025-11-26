export const classes = {
  archer: {
    label: "Archer",
    color: 0x66ccff,
    // bonus spécifiques éventuels par rapport aux stats de base (pour l'instant rien)
    statBonuses: [],
    spells: ["tir_simple"],
  },
  tank: {
    label: "Tank",
    color: 0xcc9955,
    statBonuses: [],
    spells: [],
  },
};

export const defaultClassId = "archer";
