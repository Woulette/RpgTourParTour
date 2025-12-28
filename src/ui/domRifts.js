let riftModalEl = null;
let riftTitleEl = null;
let riftRankEl = null;
let riftMonstersEl = null;
let riftWavesEl = null;
let riftStatusEl = null;
let riftTeleportBtn = null;
let riftCloseBtn = null;
let riftCancelBtn = null;
let currentRift = null;

function ensureModal() {
  if (riftModalEl) return;

  const overlay = document.createElement("div");
  overlay.id = "rift-modal-overlay";
  overlay.className = "rift-modal-overlay";

  const modal = document.createElement("div");
  modal.className = "rift-modal";

  modal.innerHTML = `
    <header class="rift-modal-header">
      <div class="rift-modal-title">Faille dimensionnelle</div>
      <button type="button" class="rift-modal-close" aria-label="Fermer">x</button>
    </header>
    <div class="rift-rank-badge">
      Rang <span class="rift-rank-core">F</span>
    </div>
    <div class="rift-modal-grid">
      <div class="rift-modal-line">
        <span>Monstres a battre</span>
        <span class="rift-monsters">-</span>
      </div>
      <div class="rift-modal-line">
        <span>Nombre de vagues</span>
        <span class="rift-waves">-</span>
      </div>
    </div>
    <div class="rift-modal-actions">
      <button type="button" class="rift-modal-btn rift-modal-btn-primary">Se teleporter</button>
      <button type="button" class="rift-modal-btn rift-modal-btn-secondary">Fermer</button>
    </div>
    <div class="rift-modal-status"></div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  riftModalEl = overlay;
  riftTitleEl = modal.querySelector(".rift-modal-title");
  riftRankEl = modal.querySelector(".rift-rank-core");
  riftMonstersEl = modal.querySelector(".rift-monsters");
  riftWavesEl = modal.querySelector(".rift-waves");
  riftStatusEl = modal.querySelector(".rift-modal-status");
  riftTeleportBtn = modal.querySelector(".rift-modal-btn-primary");
  riftCloseBtn = modal.querySelector(".rift-modal-close");
  riftCancelBtn = modal.querySelector(".rift-modal-btn-secondary");

  const close = () => closeRiftModal();
  riftCloseBtn.addEventListener("click", close);
  riftCancelBtn.addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });

  riftTeleportBtn.addEventListener("click", () => {
    if (!currentRift || typeof currentRift.onTeleport !== "function") return;
    if (currentRift.isClosed || !currentRift.canTeleport) return;
    currentRift.onTeleport(currentRift);
    closeRiftModal();
  });
}

export function initDomRifts() {
  ensureModal();
}

export function openRiftModal(payload) {
  ensureModal();
  currentRift = payload || null;

  const rank = payload?.rank || "?";
  const totalMonsters = Number.isFinite(payload?.totalMonsters)
    ? payload.totalMonsters
    : null;
  const waveSizes = Array.isArray(payload?.waveSizes) ? payload.waveSizes : null;
  const waveCount = Number.isFinite(payload?.waveCount) ? payload.waveCount : "-";
  const title = payload?.title || "Faille dimensionnelle";

  if (riftTitleEl) riftTitleEl.textContent = title;
  if (riftRankEl) riftRankEl.textContent = String(rank);
  if (riftMonstersEl) {
    if (waveSizes && waveSizes.length > 0) {
      const sum = waveSizes.reduce((acc, n) => acc + (Number(n) || 0), 0);
      const parts = waveSizes.map((n) => String(Number(n) || 0));
      riftMonstersEl.textContent = `${parts.join(" + ")} (${sum})`;
    } else {
      riftMonstersEl.textContent = totalMonsters !== null ? String(totalMonsters) : "-";
    }
  }
  if (riftWavesEl) riftWavesEl.textContent = String(waveCount);

  const isClosed = Boolean(payload?.isClosed);
  const canTeleport = Boolean(payload?.canTeleport);

  if (riftTeleportBtn) {
    riftTeleportBtn.disabled = isClosed || !canTeleport;
  }

  if (riftStatusEl) {
    if (isClosed) {
      riftStatusEl.textContent = "Faille deja fermee.";
    } else if (!canTeleport) {
      riftStatusEl.textContent = "Destination non configuree pour le moment.";
    } else {
      riftStatusEl.textContent = "Reste vigilant, l'energie est instable.";
    }
  }

  riftModalEl.classList.add("is-open");
}

export function closeRiftModal() {
  if (!riftModalEl) return;
  riftModalEl.classList.remove("is-open");
  currentRift = null;
}
