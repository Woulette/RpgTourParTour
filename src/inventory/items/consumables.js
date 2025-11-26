// Objets consommables (potions, etc.)

export const consumableItems = {
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
  