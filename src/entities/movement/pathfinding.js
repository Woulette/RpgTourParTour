// Fonctions de pathfinding pour le joueur (combat + hors combat).

// Chemin simple "en ligne" (ancienne logique), utilis� hors combat
// ou comme fallback. Ne g�re pas les obstacles.
export function calculatePath(
  startX,
  startY,
  endX,
  endY,
  allowDiagonal = true
) {
  const path = [];

  // S�curit� : si les coordonn�es ne sont pas valides, on renvoie un chemin vide.
  if (
    !Number.isFinite(startX) ||
    !Number.isFinite(startY) ||
    !Number.isFinite(endX) ||
    !Number.isFinite(endY)
  ) {
    return path;
  }

  let currentX = startX;
  let currentY = startY;

  while (currentX !== endX || currentY !== endY) {
    const dx = endX - currentX;
    const dy = endY - currentY;

    let nextX = currentX;
    let nextY = currentY;

    if (allowDiagonal && dx !== 0 && dy !== 0) {
      // Diagonale
      nextX += dx > 0 ? 1 : -1;
      nextY += dy > 0 ? 1 : -1;
    } else if (dx !== 0) {
      // Horizontal
      nextX += dx > 0 ? 1 : -1;
    } else if (dy !== 0) {
      // Vertical
      nextY += dy > 0 ? 1 : -1;
    }

    path.push({ x: nextX, y: nextY });
    currentX = nextX;
    currentY = nextY;
  }

  return path;
}

// Pathfinding pour le joueur : en combat, on �vite les cases occup�es
// par des monstres (on ne traverse pas un ennemi). Hors combat, on
// conserve le chemin simple existant.
export function findPathForPlayer(
  scene,
  map,
  startX,
  startY,
  endX,
  endY,
  allowDiagonal = true
) {
  const state = scene.combatState;

  // Hors combat : on garde l'ancien comportement (ligne "droite").
  if (!state || !state.enCours) {
    return calculatePath(startX, startY, endX, endY, allowDiagonal);
  }

  if (!map) return [];

  const width = map.width;
  const height = map.height;

  const dirs4 = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  const dirs8 = [
    ...dirs4,
    { dx: 1, dy: 1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 1 },
    { dx: -1, dy: -1 },
  ];

  const dirs = allowDiagonal ? dirs8 : dirs4;

  // Rayon maximum � explorer autour de la position de d�part,
  // bas� sur les PM du joueur (avec une petite marge).
  const maxStepsFromStart =
    (state.pmRestants ?? state.pmBaseJoueur ?? 3) + 2;

  const startKey = `${startX},${startY}`;
  const visited = new Set([startKey]);

  const queue = [
    {
      x: startX,
      y: startY,
      path: [],
    },
  ];

  const isBlocked = (x, y) => {
    // En combat : un monstre sur la case = obstacle.
    const monstersList =
      (scene.combatMonsters && Array.isArray(scene.combatMonsters)
        ? scene.combatMonsters
        : scene.monsters || []);

    return monstersList.some(
      (m) =>
        m &&
        typeof m.tileX === "number" &&
        typeof m.tileY === "number" &&
        m.tileX === x &&
        m.tileY === y
    );
  };

  while (queue.length > 0) {
    const current = queue.shift();
    const { x, y, path } = current;

    if (x === endX && y === endY) {
      return path;
    }

    for (const { dx, dy } of dirs) {
      const nx = x + dx;
      const ny = y + dy;

      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

      // On ne regarde que dans un rayon raisonnable autour du d�part.
      const distFromStart = Math.abs(nx - startX) + Math.abs(ny - startY);
      if (distFromStart > maxStepsFromStart) continue;

      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;

      // On ne traverse pas de monstre : case bloqu�e.
      if (isBlocked(nx, ny)) continue;

      visited.add(key);

      queue.push({
        x: nx,
        y: ny,
        path: [...path, { x: nx, y: ny }],
      });
    }
  }

  // Aucun chemin trouv�
  return [];
}

