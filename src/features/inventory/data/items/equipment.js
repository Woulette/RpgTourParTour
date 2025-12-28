// Objets d'équipement (armes, armures, etc.)
// Convention des slots possibles :
// head | cape | amulet | weapon | ring1 | ring2 | belt | boots

export const equipmentItems = {
  // Exemple générique, hors panoplie
  arc_de_base: {
    id: "arc_de_base",
    label: "Arc simple",
    category: "equipement",
    stackable: false,
    requiredLevel: 1,
    slot: "weapon",
    // À adapter si tu crées un asset dédié
    icon: "assets/equipment/arc_de_base.png",
    statsBonus: {
      agilite: 10,
    },
  },

  // --- Panoplie du Corbeau (variantes elementaires uniquement) ---
  coiffe_corbeau_air: {
    id: "coiffe_corbeau_air",
    label: "Coiffe du corbeau (Air)",
    category: "equipement",
    stackable: false,
    requiredLevel: 1,
    slot: "head",
    setId: "corbeau",
    icon: "assets/equipment/Coiffe/CoiffeCorbeauAir.png",
    statsBonus: {
      vitalite: 10,
      agilite: 5,
    },
  },

  coiffe_corbeau_eau: {
    id: "coiffe_corbeau_eau",
    label: "Coiffe du corbeau (Eau)",
    category: "equipement",
    stackable: false,
    requiredLevel: 1,
    slot: "head",
    setId: "corbeau",
    icon: "assets/equipment/Coiffe/CoiffeCorbeauEau.png",
    statsBonus: {
      vitalite: 10,
      chance: 5,
    },
  },

  coiffe_corbeau_feu: {
    id: "coiffe_corbeau_feu",
    label: "Coiffe du corbeau (Feu)",
    category: "equipement",
    stackable: false,
    requiredLevel: 1,
    slot: "head",
    setId: "corbeau",
    icon: "assets/equipment/Coiffe/CoiffeCorbeauFeu.png",
    statsBonus: {
      vitalite: 10,
      intelligence: 5,
    },
  },

  coiffe_corbeau_terre: {
    id: "coiffe_corbeau_terre",
    label: "Coiffe du corbeau (Terre)",
    category: "equipement",
    stackable: false,
    requiredLevel: 1,
    slot: "head",
    setId: "corbeau",
    icon: "assets/equipment/Coiffe/CoiffeCorbeauTerre.png",
    statsBonus: {
      vitalite: 10,
      force: 5,
    },
  },

  cape_corbeau_air: {
    id: "cape_corbeau_air",
    label: "Cape du corbeau (Air)",
    category: "equipement",
    stackable: false,
    requiredLevel: 1,
    slot: "cape",
    setId: "corbeau",
    icon: "assets/equipment/Cape/CapeCorbeauAir.png",
    statsBonus: {
      vitalite: 8,
      agilite: 4,
    },
  },

  cape_corbeau_eau: {
    id: "cape_corbeau_eau",
    label: "Cape du corbeau (Eau)",
    category: "equipement",
    stackable: false,
    requiredLevel: 1,
    slot: "cape",
    setId: "corbeau",
    icon: "assets/equipment/Cape/CapeCorbeauEau.png",
    statsBonus: {
      vitalite: 8,
      chance: 4,
    },
  },

  cape_corbeau_feu: {
    id: "cape_corbeau_feu",
    label: "Cape du corbeau (Feu)",
    category: "equipement",
    stackable: false,
    requiredLevel: 1,
    slot: "cape",
    setId: "corbeau",
    icon: "assets/equipment/Cape/CapeCorbeauFeu.png",
    statsBonus: {
      vitalite: 8,
      intelligence: 4,
    },
  },

  cape_corbeau_terre: {
    id: "cape_corbeau_terre",
    label: "Cape du corbeau (Terre)",
    category: "equipement",
    stackable: false,
    requiredLevel: 1,
    slot: "cape",
    setId: "corbeau",
    icon: "assets/equipment/Cape/CapeCorbeauTerre.png",
    statsBonus: {
      vitalite: 8,
      force: 4,
    },
  },

  amulette_corbeau_air: {
    id: "amulette_corbeau_air",
    label: "Collier du corbeau (Air)",
    category: "equipement",
    stackable: false,
    requiredLevel: 1,
    slot: "amulet",
    setId: "corbeau",
    icon: "assets/equipment/Amulette/CollierCorbeauAir.png",
    statsBonus: {
      vitalite: 6,
      agilite: 3,
    },
  },

  amulette_corbeau_eau: {
    id: "amulette_corbeau_eau",
    label: "Collier du corbeau (Eau)",
    category: "equipement",
    stackable: false,
    requiredLevel: 1,
    slot: "amulet",
    setId: "corbeau",
    icon: "assets/equipment/Amulette/CollierCorbeauEau.png",
    statsBonus: {
      vitalite: 6,
      chance: 3,
    },
  },

  amulette_corbeau_feu: {
    id: "amulette_corbeau_feu",
    label: "Collier du corbeau (Feu)",
    category: "equipement",
    stackable: false,
    requiredLevel: 1,
    slot: "amulet",
    setId: "corbeau",
    icon: "assets/equipment/Amulette/CollierCorbeauFeu.png",
    statsBonus: {
      vitalite: 6,
      intelligence: 3,
    },
  },

  amulette_corbeau_terre: {
    id: "amulette_corbeau_terre",
    label: "Collier du corbeau (Terre)",
    category: "equipement",
    stackable: false,
    requiredLevel: 1,
    slot: "amulet",
    setId: "corbeau",
    icon: "assets/equipment/Amulette/CollierCorbeauTerre.png",
    statsBonus: {
      vitalite: 6,
      force: 3,
    },
  },

  ceinture_corbeau_air: {
    id: "ceinture_corbeau_air",
    label: "Ceinture du corbeau (Air)",
    category: "equipement",
    stackable: false,
    requiredLevel: 1,
    slot: "belt",
    setId: "corbeau",
    icon: "assets/equipment/Ceinture/CeintureCorbeauAir.png",
    statsBonus: {
      vitalite: 6,
      agilite: 2,
    },
  },

  ceinture_corbeau_eau: {
    id: "ceinture_corbeau_eau",
    label: "Ceinture du corbeau (Eau)",
    category: "equipement",
    stackable: false,
    requiredLevel: 1,
    slot: "belt",
    setId: "corbeau",
    icon: "assets/equipment/Ceinture/CeintureCorbeauEau.png",
    statsBonus: {
      vitalite: 6,
      chance: 2,
    },
  },

  ceinture_corbeau_feu: {
    id: "ceinture_corbeau_feu",
    label: "Ceinture du corbeau (Feu)",
    category: "equipement",
    stackable: false,
    requiredLevel: 1,
    slot: "belt",
    setId: "corbeau",
    icon: "assets/equipment/Ceinture/CeintureCorbeauFeu.png",
    statsBonus: {
      vitalite: 6,
      intelligence: 2,
    },
  },

  ceinture_corbeau_terre: {
    id: "ceinture_corbeau_terre",
    label: "Ceinture du corbeau (Terre)",
    category: "equipement",
    stackable: false,
    requiredLevel: 1,
    slot: "belt",
    setId: "corbeau",
    icon: "assets/equipment/Ceinture/CeintureCorbeauTerre.png",
    statsBonus: {
      vitalite: 6,
      force: 2,
    },
  },

  bottes_corbeau_air: {
    id: "bottes_corbeau_air",
    label: "Bottes du corbeau (Air)",
    category: "equipement",
    stackable: false,
    requiredLevel: 1,
    slot: "boots",
    setId: "corbeau",
    icon: "assets/equipment/Botte/BotteCorbeauAir.png",
    statsBonus: {
      vitalite: 6,
      agilite: 2,
    },
  },

  bottes_corbeau_eau: {
    id: "bottes_corbeau_eau",
    label: "Bottes du corbeau (Eau)",
    category: "equipement",
    stackable: false,
    requiredLevel: 1,
    slot: "boots",
    setId: "corbeau",
    icon: "assets/equipment/Botte/BotteCorbeauEau.png",
    statsBonus: {
      vitalite: 6,
      chance: 2,
    },
  },

  bottes_corbeau_feu: {
    id: "bottes_corbeau_feu",
    label: "Bottes du corbeau (Feu)",
    category: "equipement",
    stackable: false,
    requiredLevel: 1,
    slot: "boots",
    setId: "corbeau",
    icon: "assets/equipment/Botte/BotteCorbeauFeu.png",
    statsBonus: {
      vitalite: 6,
      intelligence: 2,
    },
  },

  bottes_corbeau_terre: {
    id: "bottes_corbeau_terre",
    label: "Bottes du corbeau (Terre)",
    category: "equipement",
    stackable: false,
    requiredLevel: 1,
    slot: "boots",
    setId: "corbeau",
    icon: "assets/equipment/Botte/BotteCorbeauTerre.png",
    statsBonus: {
      vitalite: 6,
      force: 2,
    },
  },

  anneau_corbeau_air: {
    id: "anneau_corbeau_air",
    label: "Anneau du corbeau (Air)",
    category: "equipement",
    stackable: false,
    requiredLevel: 1,
    slot: "ring1",
    setId: "corbeau",
    icon: "assets/equipment/Anneau/AnneauCorbeauAir.png",
    statsBonus: {
      agilite: 4,
    },
  },

  anneau_corbeau_eau: {
    id: "anneau_corbeau_eau",
    label: "Anneau du corbeau (Eau)",
    category: "equipement",
    stackable: false,
    requiredLevel: 1,
    slot: "ring1",
    setId: "corbeau",
    icon: "assets/equipment/Anneau/AnneauCorbeauEau.png",
    statsBonus: {
      chance: 4,
    },
  },

  anneau_corbeau_feu: {
    id: "anneau_corbeau_feu",
    label: "Anneau du corbeau (Feu)",
    category: "equipement",
    stackable: false,
    requiredLevel: 1,
    slot: "ring1",
    setId: "corbeau",
    icon: "assets/equipment/Anneau/AnneauCorbeauFeu.png",
    statsBonus: {
      intelligence: 4,
    },
  },

  anneau_corbeau_terre: {
    id: "anneau_corbeau_terre",
    label: "Anneau du corbeau (Terre)",
    category: "equipement",
    stackable: false,
    requiredLevel: 1,
    slot: "ring1",
    setId: "corbeau",
    icon: "assets/equipment/Anneau/AnneauCorbeauTerre.png",
    statsBonus: {
      force: 4,
    },
  },
};

