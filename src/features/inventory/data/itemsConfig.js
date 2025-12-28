// Point d'entrée unique pour les objets du jeu.
// On regroupe les différents sous-ensembles (ressources, consommables, équipements).

import { resourceItems } from "./items/resources.js";
import { consumableItems } from "./items/consumables.js";
import { equipmentItems } from "./items/equipment.js";
import { questItems } from "./items/questItems.js";

export const items = {
  ...resourceItems,
  ...consumableItems,
  ...questItems,
  ...equipmentItems,
};
