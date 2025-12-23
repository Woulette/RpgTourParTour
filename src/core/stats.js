// Modèle de statistiques de base d'un personnage
// Toutes les valeurs sont des nombres.

export const baseStats = {
  // Caractéristiques principales
  force: 50,
  intelligence: 50,
  agilite: 50,
  chance: 50,
  // Puissance : bonus générique de dégâts (équivaut à +1 sur force/intel/agi/chance
  // uniquement pour le calcul des dégâts, sans donner les effets secondaires).
  puissance: 0,
  vitalite: 0,
  initiative: 0,
  sagesse: 0,

  // Points de vie (max et actuels)
  hpMax: 50,
  hp: 50,

  // Ressources d'action
  pa: 12, // Points d'action de base
  pm: 6, // Points de mouvement de base
};

// Crée un objet stats en partant du modèle, avec éventuellement des overrides
export function createStats(overrides = {}) {
  return { ...baseStats, ...overrides };
}

// Applique une liste de bonus (équipement, buffs, etc.) sur des stats de base
// Chaque bonus est un objet { force: +10, pa: +1, ... }
export function applyBonuses(stats, bonuses = []) {
  const result = { ...stats };
  for (const bonus of bonuses) {
    for (const [key, value] of Object.entries(bonus)) {
      if (typeof value !== "number") continue;
      result[key] = (result[key] ?? 0) + value;
    }
  }
  return result;
}
