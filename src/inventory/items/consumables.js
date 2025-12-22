// Objets consommables (potions, etc.)

export const consumableItems = {
  potion_vie_mineure: {
    id: "potion_vie_mineure",
    label: "Potion de vie mineure",
    category: "consommable",
    stackable: true,
    maxStack: 9999,
    icon: "assets/monsters/corbeau/ressources/EssenceDeCorbeau.png",
    effect: {
      hpPlus: 20,
    },
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
  
