// Système de niveau / expérience de base

// Points de caractéristiques gagnés par niveau
export const POINTS_PAR_NIVEAU = 5;

// Crée un état de niveau pour un nouveau personnage
export function createLevelState(overrides = {}) {
  return {
    niveau: 1,
    xp: 0,
    xpProchain: calculXpProchain(1),
    pointsCaracLibres: 0,
    ...overrides,
  };
}

// Formule simple : XP nécessaire pour passer au niveau suivant
export function calculXpProchain(niveau) {
  // Exemple : courbe légèrement croissante
  return 50 + (niveau - 1) * 25;
}

// Ajoute de l'XP, gère les passages de niveau et les points de carac
// Retourne un nouvel état et le nombre de niveaux gagnés
export function ajouterXp(levelState, montantXp) {
  let { niveau, xp, xpProchain, pointsCaracLibres } = levelState;
  let reste = montantXp;
  let niveauxGagnes = 0;

  while (reste > 0) {
    const manque = xpProchain - xp;
    if (reste < manque) {
      xp += reste;
      reste = 0;
    } else {
      // passage de niveau
      reste -= manque;
      niveau += 1;
      niveauxGagnes += 1;
      pointsCaracLibres += POINTS_PAR_NIVEAU;
      xp = 0;
      xpProchain = calculXpProchain(niveau);
    }
  }

  return {
    nouveauState: { niveau, xp, xpProchain, pointsCaracLibres },
    niveauxGagnes,
  };
}
