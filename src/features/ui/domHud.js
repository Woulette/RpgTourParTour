// Gestion du HUD HTML (en dehors de Phaser).
// - Bouton STATS + panneau de stats
// - Affichage PA / PM / PV du joueur dans le HUD bas
// - Repartition des points de caracteristiques (force, intel, agi, chance, vita)

import { classes } from "../../config/classes.js";
import { getXpTotalForLevel } from "../../core/level.js";
import { getPlayer, on as onStoreEvent } from "../../state/store.js";

let uiInputGuardMounted = false;

function mountUiInputGuard() {
  if (uiInputGuardMounted) return;
  uiInputGuardMounted = true;

  const blockIfUi = (event) => {
    const target = event.target;
    if (!target || !target.closest) return;

    const inUi = target.closest(
      "#hud-root, .craft-panel, .shop-panel, .npc-dialog-panel, #combat-result-overlay, #levelup-overlay, .menu-panel"
    );
    if (!inUi) return;

    window.__uiPointerBlock = true;
    setTimeout(() => {
      window.__uiPointerBlock = false;
    }, 0);
  };

  document.addEventListener("pointerdown", blockIfUi, true);
}

export function initDomHud(player) {
  const statsButtonEl = document.getElementById("hud-stats-button");
  const statsPanelEl = document.getElementById("hud-stats-panel");

  const apValueEl = document.getElementById("hud-ap-value");
  const mpValueEl = document.getElementById("hud-mp-value");
  const hpValueEl = document.getElementById("hud-hp-value");

  if (!statsButtonEl || !statsPanelEl) {
    return;
  }

  let hudPlayer = player || null;
  const getActivePlayer = () => getPlayer() || hudPlayer;

  mountUiInputGuard();

  // Aligne les boutons HUD dans le dock (layout unifie)
  mountHudDockMenu();

  // Panneau de stats joueur
  if (statsButtonEl.dataset.bound !== "true") {
    statsButtonEl.dataset.bound = "true";
    statsButtonEl.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = !document.body.classList.contains("hud-stats-open");
      document.body.classList.toggle("hud-stats-open");

      if (willOpen) {
        const current = getActivePlayer();
        if (current) mettreAJourStatsPanel(current);
      }
    });
  }

  initStatsTabs(statsPanelEl);

  // Initialisation des controles de stats (boutons +/- et inputs)
  initStatControls(getActivePlayer);

  // Initialisation PA / PM / PV dans le HUD bas
  const refreshHudStats = (targetPlayer) => {
    if (!targetPlayer?.stats) return;
    if (apValueEl) apValueEl.textContent = targetPlayer.stats.pa ?? 0;
    if (mpValueEl) mpValueEl.textContent = targetPlayer.stats.pm ?? 0;
    if (hpValueEl) {
      const hp = targetPlayer.stats.hp ?? targetPlayer.stats.hpMax ?? 0;
      const hpMax = targetPlayer.stats.hpMax ?? hp;
      hpValueEl.textContent = `${hp}/${hpMax}`;
    }
  };

  const current = getActivePlayer();
  refreshHudStats(current);

  // Utilitaire pour mettre a jour PA/PM depuis le jeu
  const attachHudHelpers = (targetPlayer) => {
    if (!targetPlayer) return;
    targetPlayer.updateHudApMp = (pa, pm) => {
      if (apValueEl) apValueEl.textContent = pa;
      if (mpValueEl) mpValueEl.textContent = pm;
    };
    targetPlayer.updateHudHp = (hp, hpMax) => {
      if (hpValueEl) hpValueEl.textContent = `${hp}/${hpMax}`;
      if (document.body.classList.contains("hud-stats-open")) {
        mettreAJourStatsPanel(targetPlayer);
      }
    };
  };
  attachHudHelpers(current);

  onStoreEvent("player:changed", (nextPlayer) => {
    hudPlayer = nextPlayer || hudPlayer;
    const active = getActivePlayer();
    if (!active) return;
    attachHudHelpers(active);
    refreshHudStats(active);
    if (document.body.classList.contains("hud-stats-open")) {
      mettreAJourStatsPanel(active);
    }
  });

  onStoreEvent("equipment:updated", () => {
    const active = getActivePlayer();
    if (!active) return;
    refreshHudStats(active);
    if (document.body.classList.contains("hud-stats-open")) {
      mettreAJourStatsPanel(active);
    }
  });
}

function mountHudDockMenu() {
  const menu = document.getElementById("hud-dock-menu");
  if (!menu) return;

  const ids = [
    "hud-metiers-button",
    "hud-quests-button",
    "hud-map-button",
    "hud-inventory-button",
    "hud-achievements-button",
    "hud-spells-button",
    "hud-stats-button",
  ];

  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.parentNode === menu) return;
    menu.appendChild(el);
  });
}

function initStatsTabs(panelEl) {
  if (!panelEl || panelEl.dataset.tabsInit === "true") return;
  panelEl.dataset.tabsInit = "true";

  const buttons = Array.from(panelEl.querySelectorAll(".stats-tab"));
  const sections = Array.from(panelEl.querySelectorAll(".stats-section"));

  const setActiveTab = (tabId) => {
    buttons.forEach((btn) => {
      const isActive = btn.dataset.tab === tabId;
      btn.classList.toggle("is-active", isActive);
    });
    sections.forEach((section) => {
      const isActive = section.dataset.tab === tabId;
      section.classList.toggle("is-active", isActive);
    });
  };

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.dataset.tab;
      if (!tabId) return;
      setActiveTab(tabId);
    });
  });
}

function mettreAJourStatsPanel(player) {
  const stats = player.stats || {};
  const level = player.levelState || {};

  const byId = (id) => document.getElementById(id);

  const setText = (id, value) => {
    const el = byId(id);
    if (el) el.textContent = value;
  };

  const classDef = classes[player.classId] || classes.archer;
  const classLabel = classDef?.label || player.classId || "-";
  const nameLabel = player.displayName || player.name || "Joueur";

  // Nom / classe
  setText("stat-player-name", nameLabel);
  setText("stat-player-class", classLabel);
  setText("stat-player-class-text", classLabel);

  // Niveau / XP
  const xp = level.xp ?? 0;
  const xpTotal = typeof level.xpTotal === "number" ? level.xpTotal : xp;
  const xpNextTotal = level.xpProchain ?? 0;
  const levelStartTotal = getXpTotalForLevel(level.niveau ?? 1);
  const xpNeeded = Math.max(0, xpNextTotal - levelStartTotal);
  setText("stat-level", level.niveau ?? 1);
  setText("stat-xp", xpTotal);
  setText("stat-xp-next", xpNextTotal);
  const xpFill = byId("stat-xp-fill");
  if (xpFill) {
    const ratio = xpNeeded > 0 ? Math.max(0, Math.min(1, xp / xpNeeded)) : 0;
    xpFill.style.width = `${Math.round(ratio * 100)}%`;
  }
  const statsPanelEl = byId("hud-stats-panel");
  const xpTooltip = byId("stat-xp-tooltip");
  if (xpTooltip) {
    xpTooltip.textContent = `${xp} / ${xpNeeded}`;
  }

  // PV / Initiative
  const hp = stats.hp ?? stats.hpMax ?? 0;
  const hpMax = stats.hpMax ?? hp;
  setText("stat-hp", `${hp}/${hpMax}`);
  setText("stat-hpMax", hpMax);
  setText("stat-initiative", stats.initiative ?? 0);
  setText("stat-initiative-util", stats.initiative ?? 0);

  // PA / PM
  setText("stat-pa", stats.pa ?? 0);
  setText("stat-pm", stats.pm ?? 0);
  setText("stat-tacle", stats.tacle ?? 0);
  setText("stat-fuite", stats.fuite ?? 0);

  // Autres stats d'affichage
  setText("stat-sagesse", stats.sagesse ?? 0);
  setText("stat-vitalite", stats.vitalite ?? 0);
  setText("stat-puissance", stats.puissance ?? 0);
  setText("stat-dmg", stats.dommage ?? 0);
  setText("stat-dmg-feu", stats.dommageFeu ?? 0);
  setText("stat-dmg-eau", stats.dommageEau ?? 0);
  setText("stat-dmg-air", stats.dommageAir ?? 0);
  setText("stat-dmg-terre", stats.dommageTerre ?? 0);
  setText("stat-crit", stats.critique ?? 0);
  setText("stat-resist", stats.resistance ?? 0);

  // Points de caracteristiques a repartir
  setText("stat-points-libres", level.pointsCaracLibres ?? 0);

  // Inputs de caracteristiques
  const inputs = {
    force: byId("stat-force-input"),
    intelligence: byId("stat-intelligence-input"),
    agilite: byId("stat-agilite-input"),
    chance: byId("stat-chance-input"),
    vitalite: byId("stat-vitalite-input"),
    sagesse: byId("stat-sagesse-input"),
  };

  Object.entries(inputs).forEach(([key, input]) => {
    if (!input) return;
    const value = stats[key] ?? 0;
    input.value = value;
  });
}

function initStatControls(getActivePlayer) {
  // Stats de base "nues" (sans equipement), qu'on modifie quand on depense des points
  const getBaseStats = (player) => {
    if (!player.baseStats) {
      player.baseStats = { ...(player.stats || {}) };
    }
    return player.baseStats;
  };

  // S'assure qu'on a un levelState de base
  // Toujours lire l'etat actuel (il peut etre remplace par addXpToPlayer)
  const getLevelState = (player) => {
    if (!player.levelState) {
      player.levelState = {
        niveau: 1,
        xp: 0,
        xpTotal: 0,
        xpProchain: getXpTotalForLevel(2),
        pointsCaracLibres: 0,
      };
    }
    return player.levelState;
  };

  const statKeys = [
    "force",
    "intelligence",
    "agilite",
    "chance",
    "vitalite",
    "sagesse",
  ];
  const statCosts = {
    sagesse: 2,
  };

  const getInput = (key) => document.getElementById(`stat-${key}-input`);

  const updateAll = (player) => {
    mettreAJourStatsPanel(player);
  };

  // Boutons +/-
  const plusButtons = document.querySelectorAll(".stat-btn-plus");
  const minusButtons = document.querySelectorAll(".stat-btn-minus");

  plusButtons.forEach((btn) => {
    const key = btn.getAttribute("data-stat");
    if (!statKeys.includes(key)) return;

    btn.addEventListener("click", () => {
      const player = getActivePlayer();
      if (!player) return;
      const levelState = getLevelState(player);
      if ((levelState.pointsCaracLibres ?? 0) <= 0) return;
      const base = getBaseStats(player);
      const current = base[key] ?? 0;
      const cost = statCosts[key] ?? 1;
      if ((levelState.pointsCaracLibres ?? 0) < cost) return;
      base[key] = current + 1;
      levelState.pointsCaracLibres =
        (levelState.pointsCaracLibres ?? 0) - cost;
      if (typeof player.recomputeStatsWithEquipment === "function") {
        player.recomputeStatsWithEquipment();
      }
      updateAll(player);
    });
  });

  minusButtons.forEach((btn) => {
    const key = btn.getAttribute("data-stat");
    if (!statKeys.includes(key)) return;

    btn.addEventListener("click", () => {
      const player = getActivePlayer();
      if (!player) return;
      const levelState = getLevelState(player);
      const base = getBaseStats(player);
      const current = base[key] ?? 0;
      if (current <= 0) return;
      const cost = statCosts[key] ?? 1;
      base[key] = current - 1;
      levelState.pointsCaracLibres =
        (levelState.pointsCaracLibres ?? 0) + cost;
      if (typeof player.recomputeStatsWithEquipment === "function") {
        player.recomputeStatsWithEquipment();
      }
      updateAll(player);
    });
  });

  // Saisie directe
  statKeys.forEach((key) => {
    const input = getInput(key);
    if (!input) return;

    input.addEventListener("change", () => {
      const player = getActivePlayer();
      if (!player) return;
      const levelState = getLevelState(player);
      const base = getBaseStats(player);
      let newValue = parseInt(input.value, 10);
      if (Number.isNaN(newValue) || newValue < 0) {
        newValue = 0;
      }

      const current = base[key] ?? 0;
      let delta = newValue - current;
      const costPerPoint = statCosts[key] ?? 1;
      const pointsLibres = levelState.pointsCaracLibres ?? 0;

      if (delta > 0) {
        const maxIncrease = Math.floor(pointsLibres / costPerPoint);
        if (delta > maxIncrease) {
          delta = maxIncrease;
        }
      }

      if (current + delta < 0) {
        delta = -current;
      }

      if (delta === 0) {
        input.value = current;
        return;
      }

      base[key] = current + delta;
      levelState.pointsCaracLibres =
        (levelState.pointsCaracLibres ?? 0) - delta * costPerPoint;

      if (typeof player.recomputeStatsWithEquipment === "function") {
        player.recomputeStatsWithEquipment();
      }
      updateAll(player);
    });
  });

  const initial = getActivePlayer();
  if (initial) mettreAJourStatsPanel(initial);
}
