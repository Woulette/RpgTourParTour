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
    spells: ["rayon_astral", "capture_essence", "invocation_capturee"],
  },
  eryon: {
    label: "Eryon",
    color: 0xff6666,
    statBonuses: [],
    spells: ["recharge_flux", "surcharge_instable", "stabilisation_flux"],
  },
  // Back-compat : d'anciennes sauvegardes pouvaient avoir "assassin".
  assassin: {
    label: "Eryon",
    color: 0xff6666,
    statBonuses: [],
    spells: ["recharge_flux", "surcharge_instable", "stabilisation_flux"],
  },
};

export const defaultClassId = "archer";
