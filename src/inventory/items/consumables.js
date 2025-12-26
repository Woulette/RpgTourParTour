// Objets consommables (potions, etc.)

export const consumableItems = {
  potion_ortie: {
    id: "potion_ortie",
    label: "Potion d'ortie",
    category: "consommable",
    stackable: true,
    maxStack: 9999,
    icon: "assets/metier/Alchimiste/Craft/PotionAuOrtie.png",
    effect: {
      hpPlus: 20,
    },
  },
  parchemin_inferieur_tier_1: {
    id: "parchemin_inferieur_tier_1",
    label: "Parchemin inferieur tier 1",
    category: "consommable",
    description:
      "Un parchemin fragile qui concentre une energie limitee, utile pour les premiers paliers.",
    bonusInfo: "Ameliore un sort de niveau 1 a 10 au niveau 2.",
    stackable: true,
    maxStack: 9999,
    icon: "assets/ressources/Consommable/ParcheminInferieurTier1.png",
  },

    potion_vie: {
      id: "potion_vie",
      label: "Potion de vie",
      category: "consommable", // consommable | equipement | ressource | quete
      stackable: true,
      maxStack: 9999,
      effect: {
        hpPlus: 50,
      },
    },

    potion_regen: {
      id: "potion_regen",
      label: "Potion de regeneration",
      category: "consommable",
      stackable: true,
      maxStack: 9999,
      icon: "assets/monsters/corbeau/ressources/EssenceDeCorbeau.png",
      effect: {
        hpPlus: 80,
      },
    },

    potion_energie: {
      id: "potion_energie",
      label: "Potion d'energie",
      category: "consommable",
      stackable: true,
      maxStack: 9999,
      icon: "assets/monsters/corbeau/ressources/EssenceDeCorbeau.png",
      effect: {
        paPlusCombat: 1,
      },
    },
  
    potion_pa: {
      id: "potion_pa",
      label: "Potion de PA",
      category: "consommable",
      stackable: true,
      maxStack: 9999,
      effect: {
        paPlusCombat: 2,
      },
    },
  };
  
