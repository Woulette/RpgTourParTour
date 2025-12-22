import { isEnemyAdjacentToPlayer } from "../challenges/runtime.js";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/constants.js";

function pct(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "0%";
  return `${Math.round(n * 100)}%`;
}

function formatBonus(p) {
  if (typeof p !== "number" || !Number.isFinite(p)) return "0%";
  return `+${Math.round(p * 100)}%`;
}

const CHALLENGE_BADGE_LABEL_BY_ID = {
  hp_70: "1",
  finish_on_tile: "2",
  no_cast_melee: "3",
};

const STORAGE_KEY = "andemia:ui:combatChallengePos";

function readSavedPos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const x = parsed?.x;
    const y = parsed?.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
  } catch {
    return null;
  }
}

function writeSavedPos(x, y) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ x, y }));
  } catch {
    // ignore
  }
}

function computeGameFrameRect() {
  const vw = window.innerWidth || 0;
  const vh = window.innerHeight || 0;
  const ratio = GAME_WIDTH / GAME_HEIGHT;
  const gameWidth = Math.min(vw, vh * ratio);
  const gameHeight = gameWidth / ratio;
  const left = (vw - gameWidth) / 2;
  const top = (vh - gameHeight) / 2;
  return {
    left,
    top,
    right: left + gameWidth,
    bottom: top + gameHeight,
    width: gameWidth,
    height: gameHeight,
  };
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function getOrCreatePanel() {
  const root = document.getElementById("combat-ui-root");
  if (!root) return null;

  let panel = document.getElementById("combat-challenge-panel");
  if (panel) return panel;

  panel = document.createElement("div");
  panel.id = "combat-challenge-panel";
  panel.innerHTML = `
    <div id="combat-challenge-badge" class="combat-challenge-badge" aria-label="Challenge actif">
      <span id="combat-challenge-badge-text" class="combat-challenge-badge-text">?</span>
    </div>
    <div class="combat-challenge-tooltip" role="tooltip" aria-label="Détails du challenge">
      <div class="combat-challenge-title">Challenge</div>
      <div id="combat-challenge-name" class="combat-challenge-name">-</div>
      <div id="combat-challenge-desc" class="combat-challenge-desc"></div>
      <div id="combat-challenge-progress" class="combat-challenge-progress"></div>
      <div id="combat-challenge-rewards" class="combat-challenge-rewards"></div>
      <div id="combat-challenge-status" class="combat-challenge-status"></div>
    </div>
  `;

  root.appendChild(panel);

  // Restore last position (or default).
  const saved = readSavedPos();
  const x = saved?.x ?? 12;
  const y = saved?.y ?? 12;
  panel.style.left = `${x}px`;
  panel.style.top = `${y}px`;

  return panel;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function enableDragging(panel) {
  if (!panel) return;
  const badge = panel.querySelector("#combat-challenge-badge");
  if (!badge) return;

  const SNAP_PX = 18;
  const MARGIN_PX = 8;

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  const readPos = () => {
    const x = parseFloat(panel.style.left || "0");
    const y = parseFloat(panel.style.top || "0");
    return {
      x: Number.isFinite(x) ? x : 0,
      y: Number.isFinite(y) ? y : 0,
    };
  };

  const setPos = (x, y, { snap = null } = {}) => {
    panel.style.left = `${x}px`;
    panel.style.top = `${y}px`;
    if (snap) {
      panel.dataset.snap = snap;
    } else {
      delete panel.dataset.snap;
    }
  };

  const applySnapping = (x, y) => {
    const rect = computeGameFrameRect();
    const snapTargets = [
      { edge: "left", value: rect.left + MARGIN_PX, d: Math.abs(x - (rect.left + MARGIN_PX)) },
      { edge: "top", value: rect.top + MARGIN_PX, d: Math.abs(y - (rect.top + MARGIN_PX)) },
      {
        edge: "right",
        value: rect.right - MARGIN_PX - 54, // badge width
        d: Math.abs(x - (rect.right - MARGIN_PX - 54)),
      },
      {
        edge: "bottom",
        value: rect.bottom - MARGIN_PX - 54, // badge height
        d: Math.abs(y - (rect.bottom - MARGIN_PX - 54)),
      },
    ];

    let snap = null;
    snapTargets.forEach((t) => {
      if (t.d <= SNAP_PX && (!snap || t.d < snap.d)) snap = t;
    });

    const nextX = snap?.edge === "left" || snap?.edge === "right" ? snap.value : x;
    const nextY = snap?.edge === "top" || snap?.edge === "bottom" ? snap.value : y;
    return { x: nextX, y: nextY, snap: snap?.edge || null };
  };

  const onMove = (e) => {
    if (!dragging) return;
    e.preventDefault();

    const vw = window.innerWidth || 0;
    const vh = window.innerHeight || 0;
    const badgeSize = 54;

    let x = e.clientX - offsetX;
    let y = e.clientY - offsetY;
    x = clamp(x, 0, Math.max(0, vw - badgeSize));
    y = clamp(y, 0, Math.max(0, vh - badgeSize));

    const snapped = applySnapping(x, y);
    setPos(snapped.x, snapped.y, { snap: snapped.snap });
  };

  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    panel.classList.remove("is-dragging");
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);

    const { x, y } = readPos();
    writeSavedPos(x, y);
  };

  badge.addEventListener("pointerdown", (e) => {
    // Only left click / primary pointer
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    dragging = true;
    panel.classList.add("is-dragging");

    const { x, y } = readPos();
    offsetX = e.clientX - x;
    offsetY = e.clientY - y;

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp, { passive: true });
  });
}

export function initDomCombatChallenge(scene) {
  const panel = getOrCreatePanel();
  if (!scene || !panel) return;

  enableDragging(panel);

  scene.updateCombatChallengeUi = () => {
    const state = scene.combatState;
    if (!state || !state.enCours || !state.challenge) {
      panel.style.display = "none";
      return;
    }

    panel.style.display = "block";

    const c = state.challenge;
    const badgeLabel = CHALLENGE_BADGE_LABEL_BY_ID[c.id] || c.id || "?";
    setText("combat-challenge-badge-text", badgeLabel);
    panel.dataset.challengeId = c.id || "";
    panel.dataset.badge = String(badgeLabel);
    setText("combat-challenge-name", c.label || c.id || "-");
    setText("combat-challenge-desc", c.description || "");

    const xpBonus = c.rewards?.xpBonusPct ?? 0;
    const dropBonus = c.rewards?.dropBonusPct ?? 0;
    setText(
      "combat-challenge-rewards",
      `Récompenses (si réussi) : XP ${formatBonus(xpBonus)} • Drop ${formatBonus(
        dropBonus
      )}`
    );

    const player = state.joueur;
    const progressEl = document.getElementById("combat-challenge-progress");
    if (progressEl) progressEl.textContent = "";

    if (c.kind === "hp_threshold_end") {
      const hp = player?.stats?.hp ?? 0;
      const hpMaxStart = c.data?.hpMaxStart ?? player?.stats?.hpMax ?? 0;
      const ratio = hpMaxStart > 0 ? hp / hpMaxStart : 0;
      const minRatio = c.params?.minHpRatio ?? 0.7;
      if (progressEl) {
        progressEl.textContent = `PV actuels : ${pct(ratio)} (objectif : ${pct(minRatio)})`;
      }
    } else if (c.kind === "finish_on_tile") {
      const t = c.data?.targetTile;
      const px = player?.currentTileX;
      const py = player?.currentTileY;
      const onTile =
        t && typeof px === "number" && typeof py === "number"
          ? px === t.x && py === t.y
          : false;
      if (progressEl) {
        progressEl.textContent = t
          ? `Case cible : (${t.x},${t.y}) • Position : (${px ?? "?"},${py ?? "?"})${
              onTile ? " • OK" : ""
            }`
          : "Case cible : -";
      }
    } else if (c.kind === "no_cast_when_enemy_melee") {
      const blocked = isEnemyAdjacentToPlayer(scene, player);
      if (progressEl) {
        progressEl.textContent = blocked
          ? "Un ennemi est au corps à corps : sorts bloqués."
          : "Aucun ennemi au corps à corps.";
      }
    }

    const status =
      c.status === "success"
        ? "Réussi"
        : c.status === "failed"
          ? "Échoué"
          : "En cours";
    setText("combat-challenge-status", status);
    panel.setAttribute("data-status", c.status || "active");
  };

  // Premier rendu
  if (typeof scene.updateCombatChallengeUi === "function") {
    scene.updateCombatChallengeUi();
  }
}
