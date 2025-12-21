import { on as onStoreEvent } from "../state/store.js";

let initialized = false;
let unsubscribeLevelUp = null;

let overlayEl = null;
let titleEl = null;
let pvEl = null;
let caracEl = null;
let closeBtnEl = null;

function ensureOverlay() {
  if (overlayEl) return overlayEl;

  overlayEl = document.getElementById("levelup-overlay");
  if (overlayEl) {
    titleEl = overlayEl.querySelector("#levelup-title");
    pvEl = overlayEl.querySelector("#levelup-pv");
    caracEl = overlayEl.querySelector("#levelup-carac");
    closeBtnEl = overlayEl.querySelector("#levelup-close");
    return overlayEl;
  }

  overlayEl = document.createElement("div");
  overlayEl.id = "levelup-overlay";
  overlayEl.className = "levelup-hidden";

  overlayEl.innerHTML = `
    <div class="levelup-panel" role="dialog" aria-modal="true">
      <h3 class="levelup-title" id="levelup-title">NIVEAU</h3>
      <div class="levelup-sub">Augmentations</div>
      <div class="levelup-items">
        <div class="levelup-item">
          <div class="levelup-icon is-hp">❤</div>
          <div class="levelup-value" id="levelup-pv">+0</div>
          <div class="levelup-label">PV max</div>
        </div>
        <div class="levelup-item">
          <div class="levelup-icon is-carac">✦</div>
          <div class="levelup-value" id="levelup-carac">+0</div>
          <div class="levelup-label">Caractéristiques</div>
        </div>
      </div>
      <div class="levelup-actions">
        <button class="levelup-close" type="button" id="levelup-close">Fermer</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlayEl);

  titleEl = overlayEl.querySelector("#levelup-title");
  pvEl = overlayEl.querySelector("#levelup-pv");
  caracEl = overlayEl.querySelector("#levelup-carac");
  closeBtnEl = overlayEl.querySelector("#levelup-close");

  const hide = () => overlayEl?.classList.add("levelup-hidden");
  overlayEl.addEventListener("click", (e) => {
    if (e.target === overlayEl) hide();
  });
  closeBtnEl?.addEventListener("click", hide);

  return overlayEl;
}

export function showLevelUpPopup({ level, pvMaxGagnes, pointsCaracGagnes } = {}) {
  ensureOverlay();
  if (!overlayEl) return;

  if (titleEl) titleEl.textContent = `NIVEAU ${level ?? 1}`;
  if (pvEl) pvEl.textContent = `+${pvMaxGagnes ?? 0}`;
  if (caracEl) caracEl.textContent = `+${pointsCaracGagnes ?? 0}`;

  overlayEl.classList.remove("levelup-hidden");
}

export function initDomLevelUpPopup() {
  if (initialized) return;

  ensureOverlay();
  unsubscribeLevelUp = onStoreEvent("player:levelup", (payload) => {
    const data = payload?.data || payload || {};
    showLevelUpPopup({
      level: data.level,
      pvMaxGagnes: data.pvMaxGagnes,
      pointsCaracGagnes: data.pointsCaracGagnes,
    });
  });

  initialized = true;
}

export function teardownDomLevelUpPopup() {
  if (unsubscribeLevelUp) unsubscribeLevelUp();
  unsubscribeLevelUp = null;
  initialized = false;
}

