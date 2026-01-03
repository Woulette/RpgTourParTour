﻿// Gestion de l'état et de l'ordre de tour du combat.

// Crée l'état de combat à partir d'un joueur et d'un monstre.
// L'initiative détermine qui commence : joueur ou monstre.
import { endCombat } from "./runtime.js";
import { addChatMessage } from "../../../chat/chat.js";
import { showFloatingTextOverEntity } from "./floatingText.js";
import { tickCaptureAttemptAtStartOfPlayerTurn } from "../summons/capture.js";
import { unblockTile } from "../../../collision/collisionGrid.js";
import { applyFixedResistanceToDamage } from "../spells/utils/damage.js";
import {
  maybeSpawnRiftWave,
  maybeSpawnRiftWaveOnClear,
} from "../systems/waves.js";

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

// Construit l'ordre de tour (joueur + allies + monstres)\r\n// en alternant les camps avec tri d'initiative interne.
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
  const allies =
    scene.combatAllies && Array.isArray(scene.combatAllies)
      ? scene.combatAllies.filter((s) => s && s.isCombatAlly)
      : [];

  const actors = [];
  const playerActors = [];
  const monsterActors = [];

  if (player) {
    playerActors.push({ kind: "joueur", entity: player });
  }
  allies.forEach((ally) => {
    playerActors.push({ kind: "monstre", entity: ally });
  });
  monsters.forEach((m) => {
    monsterActors.push({ kind: "monstre", entity: m });
  });

  const getInit = (actor) => actor.entity?.stats?.initiative ?? 0;

  playerActors.sort((a, b) => getInit(b) - getInit(a));
  monsterActors.sort((a, b) => getInit(b) - getInit(a));

  if (!playerActors.length && !monsterActors.length) {
    state.actors = null;
    state.actorIndex = 0;
    return;
  }

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
    state.monstre = current.entity;
    state.paRestants = current.entity?.stats?.pa ?? state.paBaseMonstre;
    state.pmRestants = current.entity?.stats?.pm ?? state.pmBaseMonstre;
  }
}

function cleanupDeadSummons(scene) {
  if (!scene?.combatSummons || !Array.isArray(scene.combatSummons)) return;
  const kept = [];
  scene.combatSummons.forEach((s) => {
    if (!s || !s.stats) return;
    const hp = typeof s.stats.hp === "number" ? s.stats.hp : s.stats.hpMax ?? 0;
    if (hp > 0) {
      kept.push(s);
      return;
    }
    if (s.blocksMovement && s._blockedTile) {
      unblockTile(scene, s._blockedTile.x, s._blockedTile.y);
      s._blockedTile = null;
    }
    if (typeof s.destroy === "function") {
      s.destroy();
    }
  });
  scene.combatSummons = kept;
}

function cleanupDeadAllies(scene) {
  if (!scene?.combatAllies || !Array.isArray(scene.combatAllies)) return;
  const kept = [];
  scene.combatAllies.forEach((s) => {
    if (!s || !s.stats) return;
    const hp = typeof s.stats.hp === "number" ? s.stats.hp : s.stats.hpMax ?? 0;
    if (hp > 0) {
      kept.push(s);
      return;
    }
    if (s.blocksMovement && s._blockedTile) {
      unblockTile(scene, s._blockedTile.x, s._blockedTile.y);
      s._blockedTile = null;
    }
    if (typeof s.destroy === "function") {
      s.destroy();
    }
  });
  scene.combatAllies = kept;
}

// Recalcule l'ordre des tours sans perturber l'acteur en cours.
export function rebuildTurnOrderKeepCurrent(scene) {
  const state = scene?.combatState;
  if (!state || !state.enCours) return;

  const currentActor = state.tour === "joueur" ? state.joueur : state.monstre;
  const currentTour = state.tour;
  const currentPa = state.paRestants;
  const currentPm = state.pmRestants;

  buildTurnOrder(scene);

  if (!state.actors || !currentActor) return;
  const idx = state.actors.findIndex((a) => a && a.entity === currentActor);
  if (idx < 0) return;

  state.actorIndex = idx;
  if (currentTour === "joueur") {
    state.tour = "joueur";
    state.monstre = null;
  } else {
    state.tour = "monstre";
    state.monstre = currentActor;
  }

  if (typeof currentPa === "number") state.paRestants = currentPa;
  if (typeof currentPm === "number") state.pmRestants = currentPm;
}
// Passe le tour au personnage suivant et recharge ses PA/PM.
export function passerTour(scene) {
  const state = scene.combatState;
  if (!state || !state.enCours) return;

  cleanupDeadSummons(scene);
  cleanupDeadAllies(scene);

  const actors = state.actors;
  const previousTour = state.tour;
  const previousIndex =
    typeof state.actorIndex === "number" ? state.actorIndex : 0;
  const currentRound = typeof state.round === "number" ? state.round : 1;
  if (!actors || !actors.length) {
    // Fallback ancien comportement 1v1
    if (state.tour === "joueur") {
      state.tour = "monstre";
      state.paRestants = state.monstre?.stats?.pa ?? state.paBaseMonstre;
      state.pmRestants = state.monstre?.stats?.pm ?? state.pmBaseMonstre;
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
      state.monstre = current.entity;
      state.paRestants = current.entity?.stats?.pa ?? state.paBaseMonstre;
      state.pmRestants = current.entity?.stats?.pm ?? state.pmBaseMonstre;
    }
  }

  // Vague de faille : spawn au debut du tour 3 (ou config).
  maybeSpawnRiftWave(scene);

  // reset des compteurs de sorts a chaque changement de tour
  state.castsThisTurn = {};

  // Début de tour : tick cooldowns + effets (poison, etc.)
  const activeEntity =
    state.tour === "joueur" ? state.joueur : state.monstre || null;
  if (activeEntity) {
    tickSpellCooldowns(activeEntity);
    applyStartOfTurnStatusEffects(scene, activeEntity);
    if (activeEntity === state.joueur) {
      tickCaptureAttemptAtStartOfPlayerTurn(scene, activeEntity);
    }
    if (!state.enCours) return;
  }

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

function tickSpellCooldowns(entity) {
  if (!entity) return;
  const cooldowns = entity.spellCooldowns;
  if (!cooldowns || typeof cooldowns !== "object") return;
  Object.keys(cooldowns).forEach((key) => {
    const value = cooldowns[key];
    if (typeof value !== "number" || value <= 0) return;
    cooldowns[key] = Math.max(0, value - 1);
  });
}

function applyShieldToDamage(entity, damage) {
  if (!entity || !Array.isArray(entity.statusEffects)) {
    return { damage, absorbed: 0 };
  }
  let remaining = Math.max(0, damage);
  let absorbed = 0;
  let touched = false;

  entity.statusEffects.forEach((effect) => {
    if (!effect || effect.type !== "shield") return;
    if ((effect.turnsLeft ?? 0) <= 0) return;
    if (remaining <= 0) return;
    const amount = typeof effect.amount === "number" ? effect.amount : 0;
    if (amount <= 0) return;
    const used = Math.min(amount, remaining);
    effect.amount = amount - used;
    remaining -= used;
    absorbed += used;
    touched = true;
    if (effect.amount <= 0) {
      effect.turnsLeft = 0;
    }
  });

  if (touched) {
    entity.statusEffects = entity.statusEffects.filter(
      (effect) =>
        effect &&
        (effect.type !== "shield" ||
          ((effect.turnsLeft ?? 0) > 0 && (effect.amount ?? 0) > 0))
    );
  }

  return { damage: remaining, absorbed };
}

function showShieldAbsorbText(scene, target, absorbed) {
  if (!scene || !target) return;
  if (typeof absorbed !== "number" || absorbed <= 0) return;
  showFloatingTextOverEntity(scene, target, `-${absorbed}`, { color: "#4aa8ff" });
}

function applyStartOfTurnStatusEffects(scene, entity) {
  const state = scene?.combatState;
  if (!state || !state.enCours || !entity || !entity.stats) return;

  const effects = Array.isArray(entity.statusEffects) ? entity.statusEffects : [];
  if (effects.length === 0) return;

  const pmBonus = effects.reduce((sum, effect) => {
    if (!effect || (effect.turnsLeft ?? 0) <= 0) return sum;
    if (effect.type !== "pm") return sum;
    const amount = typeof effect.amount === "number" ? effect.amount : 0;
    return sum + amount;
  }, 0);
  const basePm =
    typeof entity.stats?.pm === "number" ? entity.stats.pm : state.pmRestants ?? 0;
  state.pmRestants = Math.max(0, basePm + pmBonus);
  const keep = [];
  for (const effect of effects) {
    if (!effect || (effect.turnsLeft ?? 0) <= 0) continue;
    if (effect.type !== "poison") {
      // Buffs (ex: puissance) : pas d'effet direct au start, on décrémente juste la durée.
      if (typeof effect.turnsLeft === "number") {
        effect.turnsLeft = effect.turnsLeft - 1;
      }
      if ((effect.turnsLeft ?? 0) > 0) {
        keep.push(effect);
      }
      continue;
    }

    const min = typeof effect.damageMin === "number" ? effect.damageMin : 0;
    const max = typeof effect.damageMax === "number" ? effect.damageMax : min;
    const safeMax = max >= min ? max : min;
    const rawDmg =
      min + Math.floor(Math.random() * (Math.max(0, safeMax - min) + 1));

    const reducedDamage = applyFixedResistanceToDamage(
      rawDmg,
      entity,
      effect.element ?? null
    );
    const shielded = applyShieldToDamage(entity, reducedDamage);
    const dmg = Math.max(0, shielded.damage);
    showShieldAbsorbText(scene, entity, shielded.absorbed);

    const currentHp =
      typeof entity.stats.hp === "number"
        ? entity.stats.hp
        : entity.stats.hpMax ?? 0;
    const newHp = Math.max(0, currentHp - Math.max(0, dmg));
    entity.stats.hp = newHp;

    if (dmg > 0) {
      showFloatingTextOverEntity(scene, entity, `-${dmg}`, {
        color: "#ff4444",
      });
    }

    const label = effect.label || "Poison";
    const targetName =
      entity === state.joueur
        ? "Vous"
        : entity.displayName || entity.label || entity.monsterId || "Monstre";

    if (state.joueur) {
      addChatMessage(
        {
          kind: "combat",
          channel: "global",
          author: "Combat",
          text: `${label} : ${targetName} subit -${dmg} PV (poison)`,
          element: effect.element ?? null,
        },
        { player: state.joueur }
      );
      if (shielded.absorbed > 0) {
        addChatMessage(
          {
            kind: "combat",
            channel: "global",
            author: "Combat",
            text: `Bouclier : ${targetName} -${shielded.absorbed} PV`,
            element: "bouclier",
          },
          { player: state.joueur }
        );
      }
    }

    if (entity === state.joueur && typeof entity.updateHudHp === "function") {
      const hpMax = entity.stats.hpMax ?? newHp;
      entity.updateHudHp(newHp, hpMax);
    }

    if (scene && typeof scene.updateCombatUi === "function") {
      scene.updateCombatUi();
    }

    effect.turnsLeft = (effect.turnsLeft ?? 0) - 1;
    if (effect.turnsLeft > 0) {
      keep.push(effect);
    }

    if (newHp <= 0) {
      if (entity === state.joueur) {
        state.issue = "defaite";
        endCombat(scene);
        return;
      }

      if (entity.isSummon || entity.isCombatAlly) {
        if (entity.isSummon && scene.combatSummons && Array.isArray(scene.combatSummons)) {
          scene.combatSummons = scene.combatSummons.filter((s) => s && s !== entity);
        }
        if (entity.isCombatAlly && scene.combatAllies && Array.isArray(scene.combatAllies)) {
          scene.combatAllies = scene.combatAllies.filter((s) => s && s !== entity);
        }
        if (entity.blocksMovement && entity._blockedTile) {
          unblockTile(scene, entity._blockedTile.x, entity._blockedTile.y);
          entity._blockedTile = null;
        }
        if (typeof entity.onKilled === "function") {
          entity.onKilled(scene, state.joueur);
        }
        if (typeof entity.destroy === "function") {
          entity.destroy();
        }
        cleanupDeadSummons(scene);
        cleanupDeadAllies(scene);
        return;
      }

      if (typeof entity.onKilled === "function") {
        entity.onKilled(scene, state.joueur);
      }
      if (typeof entity.destroy === "function") {
        entity.destroy();
      }

      if (scene.monsters) {
        scene.monsters = scene.monsters.filter((m) => m !== entity);
      }

      let remainingEnemies = 0;
      if (scene.combatMonsters && Array.isArray(scene.combatMonsters)) {
        scene.combatMonsters = scene.combatMonsters.filter(
          (m) => m && m !== entity
        );

        remainingEnemies = scene.combatMonsters.filter((m) => {
          const statsInner = m.stats || {};
          const hpInner =
            typeof statsInner.hp === "number"
              ? statsInner.hp
              : statsInner.hpMax ?? 0;
          return hpInner > 0;
        }).length;
      } else if (scene.monsters) {
        remainingEnemies = scene.monsters.length;
      }

      if (remainingEnemies <= 0) {
        if (maybeSpawnRiftWaveOnClear(scene)) return;
        state.issue = "victoire";
        endCombat(scene);
        return;
      }
    }
  }

  entity.statusEffects = keep;
}
