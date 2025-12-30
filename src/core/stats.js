// Modèle de statistiques de base d'un personnage
// Toutes les valeurs sont des nombres.

export const baseStats = {
  // Caractéristiques principales
  force: 0,
  intelligence: 0,
  agilite: 2220,
  chance: 0,
  tacle: 0,
  fuite: 0,
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
  pa: 6, // Points d'action de base
  pm: 3, // Points de mouvement de base

  // Dommages de poussée
  pushDamage: 0,
};

// Crée un objet stats en partant du modèle, avec éventuellement des overrides
export function createStats(overrides = {}) {
  const stats = { ...baseStats, ...overrides };
  return applyDerivedAgilityStats(stats);
}

// Applique les stats derivees depuis l'agilite (tacle/fuite).
export function applyDerivedAgilityStats(stats) {
  if (!stats) return stats;
  const agi = typeof stats.agilite === "number" ? stats.agilite : 0;
  const baseTacle =
    typeof stats.baseTacle === "number" ? stats.baseTacle : stats.tacle ?? 0;
  const baseFuite =
    typeof stats.baseFuite === "number" ? stats.baseFuite : stats.fuite ?? 0;

  stats.baseTacle = baseTacle;
  stats.baseFuite = baseFuite;
  stats.tacle = baseTacle + Math.floor(agi / 10);
  stats.fuite = baseFuite + Math.floor(agi / 10);
  return stats;
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
