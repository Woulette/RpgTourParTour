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
    slot: "weapon",
    // À adapter si tu crées un asset dédié
    icon: "assets/equipment/arc_de_base.png",
    statsBonus: {
      agilite: 10,
    },
  },

  // --- Panoplie du Corbeau (6 pièces) ---
  coiffe_corbeau: {
    id: "coiffe_corbeau",
    label: "Coiffe du corbeau",
    category: "equipement",
    stackable: false,
    slot: "head",
    setId: "corbeau",
    icon: "assets/equipment/coiffecorbeau.png",
    statsBonus: {
      vitalite: 10,
      agilite: 5,
    },
  },

  cape_corbeau: {
    id: "cape_corbeau",
    label: "Cape du corbeau",
    category: "equipement",
    stackable: false,
    slot: "cape",
    setId: "corbeau",
    icon: "assets/equipment/capecorbeau.png",
    statsBonus: {
      vitalite: 8,
      agilite: 4,
    },
  },

  amulette_corbeau: {
    id: "amulette_corbeau",
    label: "Collier du corbeau",
    category: "equipement",
    stackable: false,
    slot: "amulet",
    setId: "corbeau",
    icon: "assets/equipment/colliercorbeau.png",
    statsBonus: {
      vitalite: 6,
      agilite: 3,
    },
  },

  ceinture_corbeau: {
    id: "ceinture_corbeau",
    label: "Ceinture du corbeau",
    category: "equipement",
    stackable: false,
    slot: "belt",
    setId: "corbeau",
    icon: "assets/equipment/ceinturecorbeau.png",
    statsBonus: {
      vitalite: 6,
      agilite: 2,
    },
  },

  bottes_corbeau: {
    id: "bottes_corbeau",
    label: "Bottes du corbeau",
    category: "equipement",
    stackable: false,
    slot: "boots",
    setId: "corbeau",
    icon: "assets/equipment/bottecorbeau.png",
    statsBonus: {
      vitalite: 6,
      agilite: 2,
    },
  },

  anneau_corbeau: {
    id: "anneau_corbeau",
    label: "Anneau du corbeau",
    category: "equipement",
    stackable: false,
    slot: "ring1",
    setId: "corbeau",
    icon: "assets/equipment/anneaucorbeau.png",
    statsBonus: {
      agilite: 4,
    },
  },
};

