// Systeme de niveau / experience cumulative

// Points de caracteristiques gagnes par niveau
export const POINTS_PAR_NIVEAU = 5;

const MAX_LEVEL = 200;
const XP_SEED_TOTALS = {
  2: 80,
  3: 240,
  4: 590,
  5: 920,
  6: 1600,
  7: 2580,
  8: 4300,
};
const XP_TARGET_LEVEL = 30;
const XP_TARGET_TOTAL = 100000;

function solveGrowthFactor(baseTotal, baseDelta, targetLevel, targetTotal) {
  const steps = Math.max(0, targetLevel - 8);
  if (steps <= 0) return 1.0;
  if (baseDelta <= 0) return 1.0;
  if (targetTotal <= baseTotal + baseDelta * steps) return 1.0;

  let lo = 1.0;
  let hi = 2.0;
  const calcTotal = (f) => {
    if (Math.abs(f - 1) < 1e-9) return baseTotal + baseDelta * steps;
    return baseTotal + baseDelta * (f * (f ** steps - 1) / (f - 1));
  };

  while (calcTotal(hi) < targetTotal) {
    hi += 1.0;
    if (hi > 5) break;
  }

  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    const total = calcTotal(mid);
    if (total >= targetTotal) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

function buildXpTotals() {
  const totals = Array(MAX_LEVEL + 2).fill(0);
  totals[1] = 0;

  Object.entries(XP_SEED_TOTALS).forEach(([lvl, value]) => {
    const n = Number(lvl);
    if (Number.isFinite(n) && n >= 2 && n <= MAX_LEVEL) {
      totals[n] = Number(value) || 0;
    }
  });

  const baseTotal = totals[8] || 0;
  const baseDelta = (totals[8] || 0) - (totals[7] || 0);
  const growth = solveGrowthFactor(baseTotal, baseDelta, XP_TARGET_LEVEL, XP_TARGET_TOTAL);

  let delta = baseDelta > 0 ? baseDelta : 100;
  for (let lvl = 9; lvl <= MAX_LEVEL; lvl += 1) {
    delta *= growth;
    totals[lvl] = Math.round((totals[lvl - 1] || 0) + delta);
  }

  return totals;
}

const XP_TOTALS = buildXpTotals();

export function getXpTotalForLevel(level) {
  const lvl = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level || 1)));
  return XP_TOTALS[lvl] || 0;
}

// Cree un etat de niveau pour un nouveau personnage
export function createLevelState(overrides = {}) {
  return normalizeLevelState({
    niveau: 1,
    xp: 0,
    xpTotal: 0,
    xpProchain: getXpTotalForLevel(2),
    pointsCaracLibres: 0,
    ...overrides,
  });
}

export function normalizeLevelState(levelState = {}) {
  const niveau = Math.max(1, Math.floor(levelState.niveau || 1));
  const levelStartTotal = getXpTotalForLevel(niveau);
  const xpTotal =
    typeof levelState.xpTotal === "number"
      ? levelState.xpTotal
      : levelStartTotal + (levelState.xp || 0);
  const xp = Math.max(0, xpTotal - levelStartTotal);
  const xpProchain = getXpTotalForLevel(niveau + 1);
  const pointsCaracLibres = levelState.pointsCaracLibres || 0;

  return {
    niveau,
    xp,
    xpTotal,
    xpProchain,
    pointsCaracLibres,
  };
}

// XP total necessaire pour passer au niveau suivant
export function calculXpProchain(niveau) {
  return getXpTotalForLevel(niveau + 1);
}

// Ajoute de l'XP, gere les passages de niveau et les points de carac
// Retourne un nouvel etat et le nombre de niveaux gagnes
export function ajouterXp(levelState, montantXp) {
  const normalized = normalizeLevelState(levelState);
  let { niveau, xpTotal, pointsCaracLibres } = normalized;
  let niveauxGagnes = 0;
  let total = xpTotal + (montantXp || 0);

  let xpProchain = getXpTotalForLevel(niveau + 1);
  while (niveau < MAX_LEVEL && total >= xpProchain) {
    niveau += 1;
    niveauxGagnes += 1;
    pointsCaracLibres += POINTS_PAR_NIVEAU;
    xpProchain = getXpTotalForLevel(niveau + 1);
  }

  const levelStartTotal = getXpTotalForLevel(niveau);
  const xp = Math.max(0, total - levelStartTotal);

  return {
    nouveauState: {
      niveau,
      xp,
      xpTotal: total,
      xpProchain,
      pointsCaracLibres,
    },
    niveauxGagnes,
  };
}
