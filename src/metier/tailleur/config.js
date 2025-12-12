// Définition statique du métier tailleur (coiffes + capes).
export const tailleurDefinition = {
  id: "tailleur",
  name: "Tailleur",
  type: "craft",
  description: "Fabrication de coiffes et capes.",
  craftCategories: [
    { id: "coiffe", label: "Coiffes" },
    { id: "cape", label: "Capes" },
  ],
};
