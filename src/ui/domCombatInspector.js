let inspectorInitialized = false;

function getEntityLabel(scene, entity) {
  if (!entity) return "-";
  const state = scene?.combatState;
  const isPlayer = state && entity === state.joueur;
  return (
    entity.displayName ||
    entity.label ||
    entity.monsterId ||
    (isPlayer ? "Joueur" : "Cible")
  );
}

function getEntityHp(entity) {
  const stats = entity?.stats || {};
  const hp = typeof stats.hp === "number" ? stats.hp : stats.hpMax ?? 0;
  const hpMax = typeof stats.hpMax === "number" ? stats.hpMax : hp;
  return { hp, hpMax };
}

function getEntityApMp(scene, entity) {
  const state = scene?.combatState;
  const stats = entity?.stats || {};
  const basePa = stats.pa ?? 0;
  const basePm = stats.pm ?? 0;

  if (!state || !state.enCours) return { pa: basePa, pm: basePm, isCurrent: false };

  const isPlayer = entity === state.joueur;
  const isCurrent =
    (state.tour === "joueur" && isPlayer) ||
    (state.tour === "monstre" && state.monstre === entity);

  if (!isCurrent) return { pa: basePa, pm: basePm, isCurrent: false };
  return {
    pa: typeof state.paRestants === "number" ? state.paRestants : basePa,
    pm: typeof state.pmRestants === "number" ? state.pmRestants : basePm,
    isCurrent: true,
  };
}

function formatEffect(effect) {
  if (!effect) return null;
  const label = effect.label || effect.id || "Effet";
  const turns = effect.turnsLeft ?? effect.turns ?? 0;
  if (effect.type === "poison") {
    const min = effect.damageMin ?? 0;
    const max = effect.damageMax ?? min;
    return {
      name: label,
      meta: `Poison • ${turns} tour(s) • ${min}-${max} par tour`,
    };
  }
  return { name: label, meta: `${turns} tour(s)` };
}

function renderInspector(scene, root, titleEl, bodyEl, entity, expanded) {
  if (!root || !titleEl || !bodyEl) return;
  if (!scene?.combatState?.enCours || !entity) {
    root.classList.remove("combat-inspector-visible");
    return;
  }

  titleEl.textContent = getEntityLabel(scene, entity);
  bodyEl.innerHTML = "";

  const effects = Array.isArray(entity.statusEffects) ? entity.statusEffects : [];
  const formatted = effects
    .map(formatEffect)
    .filter((e) => e && e.name && e.meta);

  const section = document.createElement("div");
  section.className = "combat-inspector-section";
  const sectionTitle = document.createElement("div");
  sectionTitle.className = "combat-inspector-section-title";
  sectionTitle.textContent = "Effets";
  section.appendChild(sectionTitle);

  if (formatted.length === 0) {
    const empty = document.createElement("div");
    empty.className = "combat-inspector-effect";
    empty.textContent = "Aucun effet actif.";
    section.appendChild(empty);
  } else {
    formatted.forEach((e) => {
      const card = document.createElement("div");
      card.className = "combat-inspector-effect";
      const name = document.createElement("div");
      name.className = "combat-inspector-effect-name";
      name.textContent = e.name;
      const meta = document.createElement("div");
      meta.className = "combat-inspector-effect-meta";
      meta.textContent = e.meta;
      card.appendChild(name);
      card.appendChild(meta);
      section.appendChild(card);
    });
  }

  bodyEl.appendChild(section);
  root.classList.add("combat-inspector-visible");
}

export function initDomCombatInspector(scene) {
  if (inspectorInitialized) return;

  const root = document.getElementById("combat-inspector");
  const titleEl = document.getElementById("combat-inspector-title");
  const bodyEl = document.getElementById("combat-inspector-body");
  const btnClose = document.getElementById("combat-inspector-close");

  if (!root || !titleEl || !bodyEl || !btnClose) return;

  let selected = null;

  const close = () => {
    selected = null;
    root.classList.remove("combat-inspector-visible");
  };

  btnClose.addEventListener("click", (e) => {
    e.stopPropagation();
    close();
  });

  scene.showCombatInspector = (entity) => {
    const state = scene.combatState;
    if (!state || !state.enCours) return;
    if (!entity) return;
    if (selected === entity) {
      close();
      return;
    }
    selected = entity;
    renderInspector(scene, root, titleEl, bodyEl, selected, true);
  };

  scene.hideCombatInspector = close;

  scene.updateCombatInspector = () => {
    const state = scene.combatState;
    if (!state || !state.enCours) {
      close();
      return;
    }
    if (!selected) return;
    renderInspector(scene, root, titleEl, bodyEl, selected, true);
  };

  inspectorInitialized = true;
}
