// Définition statique du métier tailleur (coiffes + capes).
export const tailleurDefinition = {
  id: "tailleur",
  name: "Tailleur",
  description: "Fabrication de coiffes et capes.",
  // Placeholder d'aperçu pour l'onglet métiers (non récoltable, mais visible dans la liste).
  resources: [
    {
      id: "coiffe",
      name: "Coiffes / Capes",
      level: 1,
      quantityMin: 1,
      quantityMax: 1,
      xpGain: 25,
    },
  ],
};
