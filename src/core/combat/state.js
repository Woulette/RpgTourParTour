// Gestion de l'état et de l'ordre de tour du combat.

// Crée l'état de combat à partir d'un joueur et d'un monstre.
// L'initiative détermine qui commence : joueur ou monstre.
export function createCombatState(player, monster) {
  const paJoueur = player.stats?.pa ?? 6;
  const pmJoueur = player.stats?.pm ?? 3;

  const paMonstre = monster.stats?.pa ?? 6;
  const pmMonstre = monster.stats?.pm ?? 3;

  const initJoueur = player.stats?.initiative ?? 0;
  const initMonstre = monster.stats?.initiative ?? 0;

  let premierTour = "joueur";
  if (initMonstre > initJoueur) {
    premierTour = "monstre";
  } else if (initMonstre === initJoueur) {
    // Égalité d'initiative : tirage aléatoire fixe pour tout le combat.
    premierTour = Math.random() < 0.5 ? "joueur" : "monstre";
  }

  const paInit = premierTour === "joueur" ? paJoueur : paMonstre;
  const pmInit = premierTour === "joueur" ? pmJoueur : pmMonstre;

  return {
    enCours: true,

    // Informations générales sur le combat
    startTime: Date.now(),
    xpGagne: 0,
    goldGagne: 0,
    issue: null, // "victoire" | "defaite"

    tour: premierTour, // "joueur" ou "monstre"
    round: 1,
    joueur: player,
    monstre: monster,
    paRestants: paInit,
    pmRestants: pmInit,
    paBaseJoueur: paJoueur,
    pmBaseJoueur: pmJoueur,
    paBaseMonstre: paMonstre,
    pmBaseMonstre: pmMonstre,

    // Ordre de tour multi-acteurs (joueur + monstres)
    actors: null,
    actorIndex: 0,

    // suivi des sorts lances par tour (joueur)
    castsThisTurn: {},
  };
}

// Construit l'ordre de tour (joueur + monstres du pack) en alternant
// les camps autant que possible, basé sur l'initiative.
export function buildTurnOrder(scene) {
  const state = scene.combatState;
  if (!state || !state.enCours) return;

  const player = state.joueur;
  const monsters =
    (scene.combatMonsters && Array.isArray(scene.combatMonsters)
      ? scene.combatMonsters
      : state.monstre
      ? [state.monstre]
      : []
    ).filter((m) => !!m);

  const actors = [];
  const playerActors = [];
  const monsterActors = [];

  if (player) {
    playerActors.push({ kind: "joueur", entity: player });
  }
  monsters.forEach((m) => {
    monsterActors.push({ kind: "monstre", entity: m });
  });

  const getInit = (actor) => actor.entity.stats?.initiative ?? 0;

  playerActors.sort((a, b) => getInit(b) - getInit(a));
  monsterActors.sort((a, b) => getInit(b) - getInit(a));

  if (!playerActors.length && !monsterActors.length) {
    state.actors = null;
    state.actorIndex = 0;
    return;
  }

  // Détermine qui joue en premier : meilleur joueur ou meilleur monstre.
  let firstSide = "joueur";
  if (playerActors.length && monsterActors.length) {
    const pInit = getInit(playerActors[0]);
    const mInit = getInit(monsterActors[0]);
    if (mInit > pInit) firstSide = "monstre";
    else if (mInit === pInit) {
      firstSide = Math.random() < 0.5 ? "joueur" : "monstre";
    }
  } else if (!playerActors.length) {
    firstSide = "monstre";
  }

  let lastSide = null;

  while (playerActors.length || monsterActors.length) {
    let side;
    if (!lastSide) {
      side = firstSide;
    } else {
      const opposite = lastSide === "joueur" ? "monstre" : "joueur";
      const hasOpposite =
        opposite === "joueur"
          ? playerActors.length > 0
          : monsterActors.length > 0;
      side = hasOpposite ? opposite : lastSide;
    }

    if (side === "joueur") {
      if (!playerActors.length) {
        if (!monsterActors.length) break;
        side = "monstre";
        actors.push(monsterActors.shift());
      } else {
        actors.push(playerActors.shift());
      }
    } else {
      if (!monsterActors.length) {
        if (!playerActors.length) break;
        side = "joueur";
        actors.push(playerActors.shift());
      } else {
        actors.push(monsterActors.shift());
      }
    }

    lastSide = side;
  }

  if (!actors.length) {
    state.actors = null;
    state.actorIndex = 0;
    return;
  }

  state.actors = actors;
  state.actorIndex = 0;

  const current = actors[0];
  if (current.kind === "joueur") {
    state.tour = "joueur";
    state.paRestants = state.paBaseJoueur;
    state.pmRestants = state.pmBaseJoueur;
    state.monstre = null;
  } else {
    state.tour = "monstre";
    state.paRestants = state.paBaseMonstre;
    state.pmRestants = state.pmBaseMonstre;
    state.monstre = current.entity;
  }
}

// Passe le tour au personnage suivant et recharge ses PA/PM.
export function passerTour(scene) {
  const state = scene.combatState;
  if (!state || !state.enCours) return;

  const actors = state.actors;
  const previousTour = state.tour;
  const previousIndex =
    typeof state.actorIndex === "number" ? state.actorIndex : 0;
  const currentRound = typeof state.round === "number" ? state.round : 1;
  if (!actors || !actors.length) {
    // Fallback ancien comportement 1v1
    if (state.tour === "joueur") {
      state.tour = "monstre";
      state.paRestants = state.paBaseMonstre;
      state.pmRestants = state.pmBaseMonstre;
    } else {
      state.tour = "joueur";
      state.paRestants = state.paBaseJoueur;
      state.pmRestants = state.pmBaseJoueur;
    }

    // On considère un "nouveau tour" quand on repasse au joueur.
    if (previousTour === "monstre" && state.tour === "joueur") {
      state.round = currentRound + 1;
    } else if (typeof state.round !== "number") {
      state.round = currentRound;
    }
  } else {
    const isAlive = (actor) => {
      const ent = actor.entity;
      if (!ent || !ent.stats) return false;
      const hp =
        typeof ent.stats.hp === "number"
          ? ent.stats.hp
          : ent.stats.hpMax ?? 0;
      return hp > 0;
    };

    let nextIndex = state.actorIndex;
    let loops = 0;
    do {
      nextIndex = (nextIndex + 1) % actors.length;
      const candidate = actors[nextIndex];
      if (isAlive(candidate)) break;
      loops += 1;
    } while (loops < actors.length);

    const wrapped = nextIndex <= previousIndex;
    if (wrapped) {
      state.round = currentRound + 1;
    } else if (typeof state.round !== "number") {
      state.round = currentRound;
    }

    state.actorIndex = nextIndex;
    const current = actors[nextIndex];

    if (current.kind === "joueur") {
      state.tour = "joueur";
      state.paRestants = state.paBaseJoueur;
      state.pmRestants = state.pmBaseJoueur;
      state.monstre = null;
    } else {
      state.tour = "monstre";
      state.paRestants = state.paBaseMonstre;
      state.pmRestants = state.pmBaseMonstre;
      state.monstre = current.entity;
    }
  }

  // reset des compteurs de sorts a chaque changement de tour
  state.castsThisTurn = {};

  // Si c'est au joueur de jouer, rafraîchit les PA/PM dans le HUD
  if (
    state.tour === "joueur" &&
    state.joueur &&
    typeof state.joueur.updateHudApMp === "function"
  ) {
    state.joueur.updateHudApMp(state.paRestants, state.pmRestants);
  }

  // Rafraîchit l'UI HTML de combat si elle est branchée.
  if (scene && typeof scene.updateCombatUi === "function") {
    scene.updateCombatUi();
  }

  return state.tour;
}
