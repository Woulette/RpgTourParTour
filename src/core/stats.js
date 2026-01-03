// Modèle de statistiques de base d'un personnage
// Toutes les valeurs sont des nombres.

export const baseStats = {
  // Caractéristiques principales
  force: 0,
  intelligence: 0,
  agilite: 0,
  chance: 0,
  tacle: 0,
  fuite: 0,
  pods: 0,
  dommagesCrit: 0,
  soins: 0,
  resistanceFixeTerre: 0,
  resistanceFixeFeu: 0,
  resistanceFixeAir: 0,
  resistanceFixeEau: 0,
  prospection: 100,
  critChancePct: 0,
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

  // Dommages plats (1 = +1 degat)
  dommage: 0,
  dommageFeu: 0,
  dommageEau: 0,
  dommageAir: 0,
  dommageTerre: 0,
};

// Crée un objet stats en partant du modèle, avec éventuellement des overrides
export function createStats(overrides = {}, options = {}) {
  const stats = { ...baseStats, ...overrides };
  return applyDerivedAgilityStats(stats, options);
}

// Applique les stats derivees depuis l'agilite (tacle/fuite).
export function applyDerivedAgilityStats(stats, options = {}) {
  if (!stats) return stats;
  const applySecondaryStats = options.applySecondaryStats !== false;
  const agi = typeof stats.agilite === "number" ? stats.agilite : 0;
  const force = typeof stats.force === "number" ? stats.force : 0;
  const intelligence =
    typeof stats.intelligence === "number" ? stats.intelligence : 0;
  const chance = typeof stats.chance === "number" ? stats.chance : 0;
  const baseTacle =
    typeof stats.baseTacle === "number" ? stats.baseTacle : stats.tacle ?? 0;
  const baseFuite =
    typeof stats.baseFuite === "number" ? stats.baseFuite : stats.fuite ?? 0;
  const basePods = applySecondaryStats
    ? typeof stats.basePods === "number"
      ? stats.basePods
      : stats.pods ?? 0
    : 0;
  const baseDommagesCrit = applySecondaryStats
    ? typeof stats.baseDommagesCrit === "number"
      ? stats.baseDommagesCrit
      : stats.dommagesCrit ?? 0
    : 0;
  const baseSoins = applySecondaryStats
    ? typeof stats.baseSoins === "number"
      ? stats.baseSoins
      : stats.soins ?? 0
    : 0;
  const baseResistanceFixeTerre = applySecondaryStats
    ? typeof stats.baseResistanceFixeTerre === "number"
      ? stats.baseResistanceFixeTerre
      : stats.resistanceFixeTerre ?? 0
    : 0;
  const baseResistanceFixeFeu = applySecondaryStats
    ? typeof stats.baseResistanceFixeFeu === "number"
      ? stats.baseResistanceFixeFeu
      : stats.resistanceFixeFeu ?? 0
    : 0;
  const baseResistanceFixeAir = applySecondaryStats
    ? typeof stats.baseResistanceFixeAir === "number"
      ? stats.baseResistanceFixeAir
      : stats.resistanceFixeAir ?? 0
    : 0;
  const baseResistanceFixeEau = applySecondaryStats
    ? typeof stats.baseResistanceFixeEau === "number"
      ? stats.baseResistanceFixeEau
      : stats.resistanceFixeEau ?? 0
    : 0;
  const baseProspection = applySecondaryStats
    ? typeof stats.baseProspection === "number"
      ? stats.baseProspection
      : stats.prospection ?? 0
    : 0;
  const baseCritChancePct = applySecondaryStats
    ? typeof stats.baseCritChancePct === "number"
      ? stats.baseCritChancePct
      : stats.critChancePct ?? 0
    : 0;

  stats.baseTacle = baseTacle;
  stats.baseFuite = baseFuite;
  if (applySecondaryStats) {
    stats.basePods = basePods;
    stats.baseDommagesCrit = baseDommagesCrit;
    stats.baseSoins = baseSoins;
    stats.baseResistanceFixeTerre = baseResistanceFixeTerre;
    stats.baseResistanceFixeFeu = baseResistanceFixeFeu;
    stats.baseResistanceFixeAir = baseResistanceFixeAir;
    stats.baseResistanceFixeEau = baseResistanceFixeEau;
    stats.baseProspection = baseProspection;
    stats.baseCritChancePct = baseCritChancePct;
  }

  const safeAgi = Math.max(0, agi);
  const safeForce = Math.max(0, force);
  const safeInt = Math.max(0, intelligence);
  const safeChance = Math.max(0, chance);

  stats.tacle = baseTacle + Math.floor(safeAgi / 10);
  stats.fuite = baseFuite + Math.floor(safeAgi / 10);
  if (applySecondaryStats) {
    stats.pods = basePods + safeForce * 5;
    stats.dommagesCrit = baseDommagesCrit + Math.floor(safeForce / 20);
    stats.soins = baseSoins + Math.floor(safeInt / 10);
    const resiFixeFromInt = Math.floor(safeInt / 20);
    stats.resistanceFixeTerre = baseResistanceFixeTerre + resiFixeFromInt;
    stats.resistanceFixeFeu = baseResistanceFixeFeu + resiFixeFromInt;
    stats.resistanceFixeAir = baseResistanceFixeAir + resiFixeFromInt;
    stats.resistanceFixeEau = baseResistanceFixeEau + resiFixeFromInt;
    stats.prospection = baseProspection + Math.floor(safeChance / 10);
    stats.critChancePct = baseCritChancePct + Math.floor(safeChance / 20);
  }
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
