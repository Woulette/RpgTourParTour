// Définition statique du métier bijoutier (anneaux + amulettes).
export const bijoutierDefinition = {
  id: "bijoutier",
  name: "Bijoutier",
  type: "craft",
  description: "Fabrication de bijoux (anneaux, amulettes).",
  craftCategories: [
    { id: "anneau", label: "Anneaux" },
    { id: "amulette", label: "Amulettes" },
  ],
};
