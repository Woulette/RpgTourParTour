// Définition des paternes de placement de combat.
// Chaque paterne est défini en coordonnées relatives (dx, dy)
// autour d'une tuile d'ancrage choisie sur la map.
//
// - playerOffsets : positions de départ possibles pour les joueurs
// - enemyOffsets  : positions de départ possibles pour les ennemis
//
// Convention :
//   x > 0  -> vers la droite
//   y > 0  -> vers le bas

export const COMBAT_PATTERNS = {
  // Paterne 1 : proche, presque au contact
  // Les joueurs sont groupés autour de l'ancre,
  // les ennemis juste quelques cases devant.
  close_melee: {
    playerOffsets: [
        { x: -1, y: -1 },
        { x: 0,  y: -1 },
        { x: 1,  y: -1 },
        { x: 2,  y: -1 },
      ],
    enemyOffsets: [
        { x: 0, y: 0 },
        { x: -1,  y: 0 },
        { x: 1,  y: 0},
        { x: 2,  y: 0 },
    ],
  },

  // Paterne 2 : distance "moyenne" entre les camps.
  // Les joueurs restent groupés autour de l'ancre,
  // les ennemis sont plus loin sur l'axe vertical.
  mid_range: {
    playerOffsets: [
      { x: 0, y: 0 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: -1 },
    ],
    enemyOffsets: [
      { x: 0, y: 4 },
      { x: -1, y: 4 },
      { x: 1, y: 4 },
      { x: 0, y: 5 },
    ],
  },

  // Paterne 3 : les deux camps sont chacun bien resserrés,
  // et séparés par une bonne distance pour laisser respirer le terrain.
  close_groups: {
    playerOffsets: [
      { x: -1, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: -1 },
    ],
    enemyOffsets: [
      { x: -1, y: 3 },
      { x: 0, y: 3 },
      { x: 1, y: 3 },
      { x: 0, y: 4 },
    ],
  },
};
