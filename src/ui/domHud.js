// Gestion du HUD HTML (en dehors de Phaser).
// - Bouton STATS + panneau de stats
// - Affichage PA / PM / PV du joueur dans le HUD bas
// - Affichage des infos de la cible (monstre survolé)
// - Répartition des points de caractéristiques (force, intel, agi, chance, vita)

export function initDomHud(player) {
  const statsButtonEl = document.getElementById("hud-stats-button");
  const statsPanelEl = document.getElementById("hud-stats-panel");

  const apValueEl = document.getElementById("hud-ap-value");
  const mpValueEl = document.getElementById("hud-mp-value");
  const hpValueEl = document.getElementById("hud-hp-value");

  const targetNameEl = document.getElementById("hud-target-name");
  const targetHpEl = document.getElementById("hud-target-hp");
  const targetPaEl = document.getElementById("hud-target-pa");
  const targetPmEl = document.getElementById("hud-target-pm");

  if (!statsButtonEl || !statsPanelEl || !player) {
    return;
  }

  // --- Panneau de stats joueur ---
  statsButtonEl.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = !document.body.classList.contains("hud-stats-open");
    document.body.classList.toggle("hud-stats-open");

    if (willOpen) {
      mettreAJourStatsPanel(player);
    }
  });

  // Initialisation des contrôles de stats (boutons +/- et inputs)
  initStatControls(player);

  // --- Initialisation PA / PM / PV dans le HUD bas ---
  if (apValueEl && mpValueEl && hpValueEl && player.stats) {
    apValueEl.textContent = player.stats.pa ?? 0;
    mpValueEl.textContent = player.stats.pm ?? 0;
    const hp = player.stats.hp ?? player.stats.hpMax ?? 0;
    const hpMax = player.stats.hpMax ?? hp;
    hpValueEl.textContent = `${hp}/${hpMax}`;
  }

  // Utilitaire pour mettre à jour PA/PM depuis le jeu
  player.updateHudApMp = (pa, pm) => {
    if (apValueEl) apValueEl.textContent = pa;
    if (mpValueEl) mpValueEl.textContent = pm;
  };

  // Utilitaire pour mettre à jour les PV du joueur
  player.updateHudHp = (hp, hpMax) => {
    if (hpValueEl) hpValueEl.textContent = `${hp}/${hpMax}`;
  };

  // --- Infos de la cible (monstre survolé) ---
  const updateTargetHud = (monster) => {
    if (!targetNameEl || !targetHpEl || !targetPaEl || !targetPmEl) return;

    if (!monster) {
      targetNameEl.textContent = "";
      targetHpEl.textContent = "";
      targetPaEl.textContent = "";
      targetPmEl.textContent = "";
      document.body.classList.remove("hud-target-visible");
      return;
    }

    const stats = monster.stats || {};

    targetNameEl.textContent = monster.monsterId || "Cible";
    const hp = stats.hp ?? stats.hpMax ?? 0;
    const hpMax = stats.hpMax ?? hp;
    targetHpEl.textContent = `${hp}/${hpMax}`;
    targetPaEl.textContent = stats.pa ?? 0;
    targetPmEl.textContent = stats.pm ?? 0;

    document.body.classList.add("hud-target-visible");
  };

  // On expose cette fonction sur la scène pour que les monstres puissent l'appeler
  if (player.scene) {
    player.scene.updateHudTargetInfo = updateTargetHud;
  }
}

function mettreAJourStatsPanel(player) {
  const stats = player.stats || {};
  const level = player.levelState || {};

  const byId = (id) => document.getElementById(id);

  const setText = (id, value) => {
    const el = byId(id);
    if (el) el.textContent = value;
  };

  // Nom du joueur (placeholder pour l'instant)
  setText("stat-player-name", "---");

  // Niveau / XP
  setText("stat-level", level.niveau ?? 1);
  setText("stat-xp", level.xp ?? 0);
  setText("stat-xp-next", level.xpProchain ?? 0);

  // PV max / Initiative
  setText("stat-hpMax", stats.hpMax ?? 0);
  setText("stat-initiative", stats.initiative ?? 0);

  // PA / PM
  setText("stat-pa", stats.pa ?? 0);
  setText("stat-pm", stats.pm ?? 0);

  // Points de caractéristiques à répartir
  setText("stat-points-libres", level.pointsCaracLibres ?? 0);

  // Inputs de caractéristiques
  const inputs = {
    force: byId("stat-force-input"),
    intelligence: byId("stat-intelligence-input"),
    agilite: byId("stat-agilite-input"),
    chance: byId("stat-chance-input"),
    vitalite: byId("stat-vitalite-input"),
  };

  Object.entries(inputs).forEach(([key, input]) => {
    if (!input) return;
    const value = stats[key] ?? 0;
    input.value = value;
  });
}

function initStatControls(player) {
  const stats = player.stats || {};
  // S'assure qu'on a un levelState de base
  if (!player.levelState) {
    player.levelState = {
      niveau: 1,
      xp: 0,
      xpProchain: 50,
      pointsCaracLibres: 0,
    };
  }

  // Toujours lire l'état actuel (il peut être remplacé par addXpToPlayer)
  const getLevelState = () => {
    if (!player.levelState) {
      player.levelState = {
        niveau: 1,
        xp: 0,
        xpProchain: 50,
        pointsCaracLibres: 0,
      };
    }
    return player.levelState;
  };

  const statKeys = ["force", "intelligence", "agilite", "chance", "vitalite"];

  const getInput = (key) =>
    document.getElementById(`stat-${key}-input`);

  const updateAll = () => {
    mettreAJourStatsPanel(player);
  };

  // Boutons +/-
  const plusButtons = document.querySelectorAll(".stat-btn-plus");
  const minusButtons = document.querySelectorAll(".stat-btn-minus");

  plusButtons.forEach((btn) => {
    const key = btn.getAttribute("data-stat");
    if (!statKeys.includes(key)) return;

    btn.addEventListener("click", () => {
      const levelState = getLevelState();
      if ((levelState.pointsCaracLibres ?? 0) <= 0) return;
      const current = stats[key] ?? 0;
      stats[key] = current + 1;
      levelState.pointsCaracLibres = (levelState.pointsCaracLibres ?? 0) - 1;
      updateAll();
    });
  });

  minusButtons.forEach((btn) => {
    const key = btn.getAttribute("data-stat");
    if (!statKeys.includes(key)) return;

    btn.addEventListener("click", () => {
      const levelState = getLevelState();
      const current = stats[key] ?? 0;
      if (current <= 0) return; // on ne descend pas en dessous de 0 pour l'instant
      stats[key] = current - 1;
      levelState.pointsCaracLibres = (levelState.pointsCaracLibres ?? 0) + 1;
      updateAll();
    });
  });

  // Saisie directe
  statKeys.forEach((key) => {
    const input = getInput(key);
    if (!input) return;

    input.addEventListener("change", () => {
      const levelState = getLevelState();
      let newValue = parseInt(input.value, 10);
      if (Number.isNaN(newValue) || newValue < 0) {
        newValue = 0;
      }

      const current = stats[key] ?? 0;
      let delta = newValue - current;

      const pointsLibres = levelState.pointsCaracLibres ?? 0;

      if (delta > 0) {
        // On veut augmenter la stat
        if (delta > pointsLibres) {
          delta = pointsLibres;
        }
      }

      // Si delta < 0, on rend des points (tant qu'on ne passe pas sous 0)
      if (current + delta < 0) {
        delta = -current;
      }

      if (delta === 0) {
        // Rien à faire, on remet la valeur cohérente
        input.value = current;
        return;
      }

      stats[key] = current + delta;
      levelState.pointsCaracLibres =
        (levelState.pointsCaracLibres ?? 0) - delta;

      updateAll();
    });
  });

  // Premier affichage cohérent
  mettreAJourStatsPanel(player);
}
