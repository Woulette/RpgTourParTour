import { createInventory } from "./inventoryCore.js";

// Inventaire standard du joueur.
// Base : 50 emplacements (grille 5 x 10).
export function createPlayerInventory() {
  return createInventory(50);
}

// Banque simple : même logique, plus grand.
export function createBankInventory() {
  return createInventory(60);
}
