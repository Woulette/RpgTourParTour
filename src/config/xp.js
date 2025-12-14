// Configuration globale pour tous les calculs d'XP.
// En modifiant uniquement ce fichier, tu peux retuner facilement l'équilibrage.

export const XP_CONFIG = {
  // Bonus appliqué en fonction du niveau le plus haut présent dans le groupe
  // (clé = niveau, valeur = multiplicateur).
  baseLevelBonus: {
    1: 1.0,
    2: 1.05,
    3: 1.1,
    4: 1.15,
  },

  // Bonus en fonction de la taille du groupe (nombre de monstres).
  // Pour une taille supérieure à la plus grande clé, on réutilise la dernière valeur.
  groupBonusBySize: {
    1: 1.0,
    2: 1.6,
    3: 2.1,
    4: 2.8,
  },

  // Paliers de pénalité selon l'écart de niveau entre le joueur et le groupe.
  // maxDiff est inclusif.
  penaltyTiers: [
    { maxDiff: 5, factor: 1.0 },
    { maxDiff: 10, factor: 0.9 },
    { maxDiff: 20, factor: 0.7 },
    { maxDiff: 40, factor: 0.5 },
    { maxDiff: 60, factor: 0.25 },
    { maxDiff: Infinity, factor: 0.12 },
  ],

  // 1 point de sagesse = +1% d'XP.
  wisdomPerPoint: 0.01,
};

