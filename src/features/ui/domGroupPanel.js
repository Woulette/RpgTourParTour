import { getNetClient, getNetPlayerId } from "../../app/session.js";
import { getPlayer, on as onStoreEvent } from "../../state/store.js";

const classPortraitById = {
  archer: "assets/animations/animation archer/rotations/south.png",
  tank: "assets/animations/animation tank/rotations/south.png",
  animiste: "assets/animations/animations-Animiste/rotations/south.png",
  eryon: "assets/animations/animations-Eryon/rotations/south.png",
};

let panelEl = null;
let listEl = null;
let titleEl = null;
let toolsEl = null;
let disbandBtn = null;
let currentGroup = null;
let dragState = null;

const PANEL_STORAGE_KEY = "andemia:groupPanelPos";

function ensurePanel() {
  if (panelEl) return;
  panelEl = document.createElement("div");
  panelEl.className = "group-panel";
  panelEl.innerHTML = `
    <div class="group-panel-header">
      <div class="group-panel-title">Groupe</div>
      <div class="group-panel-tools">
        <button type="button" class="group-panel-tool" data-action="disband" title="Dissoudre" aria-label="Dissoudre">D</button>
      </div>
    </div>
    <div class="group-panel-list"></div>
  `;
  titleEl = panelEl.querySelector(".group-panel-title");
  listEl = panelEl.querySelector(".group-panel-list");
  toolsEl = panelEl.querySelector(".group-panel-tools");
  disbandBtn = panelEl.querySelector("[data-action='disband']");
  document.body.appendChild(panelEl);

  const headerEl = panelEl.querySelector(".group-panel-header");
  if (headerEl) {
    headerEl.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const rect = panelEl.getBoundingClientRect();
      dragState = {
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
      };
      panelEl.classList.add("is-dragging");
      panelEl.style.right = "auto";
      panelEl.style.bottom = "auto";
    });
  }

  const applyDrag = (event) => {
    if (!dragState || !panelEl) return;
    const panelRect = panelEl.getBoundingClientRect();
    const width = panelRect.width || 0;
    const height = panelRect.height || 0;
    const maxLeft = Math.max(0, window.innerWidth - width);
    const maxTop = Math.max(0, window.innerHeight - height);
    const left = Math.min(
      maxLeft,
      Math.max(0, event.clientX - dragState.offsetX)
    );
    const top = Math.min(
      maxTop,
      Math.max(0, event.clientY - dragState.offsetY)
    );
    panelEl.style.left = `${left}px`;
    panelEl.style.top = `${top}px`;
  };

  const stopDrag = () => {
    if (!dragState || !panelEl) return;
    dragState = null;
    panelEl.classList.remove("is-dragging");
    const rect = panelEl.getBoundingClientRect();
    try {
      localStorage.setItem(
        PANEL_STORAGE_KEY,
        JSON.stringify({ left: rect.left, top: rect.top })
      );
    } catch (err) {
      // ignore storage issues
    }
  };

  window.addEventListener("mousemove", applyDrag);
  window.addEventListener("mouseup", stopDrag);

  try {
    const raw = localStorage.getItem(PANEL_STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (
        saved &&
        Number.isFinite(saved.left) &&
        Number.isFinite(saved.top)
      ) {
        panelEl.style.right = "auto";
        panelEl.style.bottom = "auto";
        panelEl.style.left = `${Math.max(0, saved.left)}px`;
        panelEl.style.top = `${Math.max(0, saved.top)}px`;
      }
    }
  } catch (err) {
    // ignore storage issues
  }

  disbandBtn.addEventListener("click", () => {
    const client = getNetClient();
    const playerId = getNetPlayerId();
    if (!client || !playerId || !currentGroup) return;
    if (currentGroup.leaderId !== playerId) return;
    client.sendCmd("CmdGroupDisband", { playerId });
  });
}

function resolvePortrait(classId) {
  const key = typeof classId === "string" ? classId : "archer";
  return classPortraitById[key] || classPortraitById.archer;
}

function toFinite(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function buildHpText(hp, hpMax) {
  const safeHp = toFinite(hp);
  const safeHpMax = toFinite(hpMax);
  if (!Number.isFinite(safeHp) || !Number.isFinite(safeHpMax)) return "HP -/-";
  return `${Math.max(0, Math.round(safeHp))}/${Math.max(
    0,
    Math.round(safeHpMax)
  )} HP`;
}

function renderGroup(group) {
  ensurePanel();
  if (
    !group ||
    !Array.isArray(group.members) ||
    group.members.length < 2
  ) {
    currentGroup = null;
    panelEl.classList.remove("is-open");
    listEl.innerHTML = "";
    if (toolsEl) toolsEl.style.display = "none";
    return;
  }
  currentGroup = group;
  const playerId = getNetPlayerId();
  const isLeader = Number.isInteger(playerId) && playerId === group.leaderId;
  titleEl.textContent = `Groupe`;
  listEl.innerHTML = "";
  group.members.forEach((member) => {
    const row = document.createElement("div");
    row.className = "group-panel-member";

    const avatar = document.createElement("div");
    avatar.className = "group-panel-avatar";
    const portrait = resolvePortrait(member.classId);
    avatar.style.backgroundImage = portrait ? `url("${portrait}")` : "";
    avatar.title = member.displayName || `Joueur ${member.id}`;

    let hp = toFinite(member.hp);
    let hpMax = toFinite(member.hpMax);
    if ((!Number.isFinite(hp) || !Number.isFinite(hpMax)) && member.id === playerId) {
      const local = getPlayer();
      hp = toFinite(local?.stats?.hp) ?? toFinite(local?.hp) ?? hp;
      hpMax =
        toFinite(local?.stats?.hpMax) ?? toFinite(local?.hpMax) ?? hpMax;
    }
    const ratio =
      Number.isFinite(hp) && Number.isFinite(hpMax) && hpMax > 0
        ? Math.max(0, Math.min(1, hp / hpMax))
        : 1;

    const hpBar = document.createElement("div");
    hpBar.className = "group-panel-hp-bar";
    const hpFill = document.createElement("div");
    hpFill.className = "group-panel-hp-fill";
    hpFill.style.width = `${Math.round(ratio * 100)}%`;
    hpBar.appendChild(hpFill);
    avatar.appendChild(hpBar);

    const tooltip = document.createElement("div");
    tooltip.className = "group-panel-tooltip";
    const tooltipName = document.createElement("div");
    tooltipName.className = "group-panel-tooltip-name";
    tooltipName.textContent = member.displayName || `Joueur ${member.id}`;
    const tooltipHp = document.createElement("div");
    tooltipHp.className = "group-panel-tooltip-hp";
    tooltipHp.textContent = buildHpText(hp, hpMax);
    tooltip.appendChild(tooltipName);
    tooltip.appendChild(tooltipHp);
    avatar.appendChild(tooltip);

    if (member.id === group.leaderId) {
      const leader = document.createElement("div");
      leader.className = "group-panel-badge";
      leader.setAttribute("aria-label", "Chef");
      leader.title = "Chef";
      avatar.appendChild(leader);
    }

    const actions = document.createElement("div");
    actions.className = "group-panel-actions";
    if (Number.isInteger(playerId)) {
      if (member.id === playerId) {
        const leaveBtn = document.createElement("button");
        leaveBtn.type = "button";
        leaveBtn.className = "group-panel-action";
        leaveBtn.textContent = "Q";
        leaveBtn.title = "Quitter";
        leaveBtn.setAttribute("aria-label", "Quitter le groupe");
        leaveBtn.addEventListener("click", () => {
          const client = getNetClient();
          if (!client) return;
          client.sendCmd("CmdGroupLeave", { playerId });
        });
        actions.appendChild(leaveBtn);
      } else if (isLeader) {
        const kickBtn = document.createElement("button");
        kickBtn.type = "button";
        kickBtn.className = "group-panel-action danger";
        kickBtn.textContent = "K";
        kickBtn.title = "Kick";
        kickBtn.setAttribute("aria-label", "Kick du groupe");
        kickBtn.addEventListener("click", () => {
          const client = getNetClient();
          if (!client) return;
          client.sendCmd("CmdGroupKick", {
            playerId,
            targetId: member.id,
          });
        });
        actions.appendChild(kickBtn);
      }
    }

    row.appendChild(avatar);
    row.appendChild(actions);
    listEl.appendChild(row);
  });
  panelEl.classList.add("is-open");
  if (toolsEl) toolsEl.style.display = isLeader ? "flex" : "none";
}

export function initDomGroupPanel() {
  ensurePanel();
  onStoreEvent("group:updated", renderGroup);
  onStoreEvent("group:disband", () => renderGroup(null));
}
