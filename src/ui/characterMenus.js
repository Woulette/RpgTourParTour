import { classes } from "../config/classes.js";

export function initCharacterMenus({ onStartGame }) {
  const overlayEl = document.getElementById("menu-overlay");
  const panelEl = overlayEl ? overlayEl.querySelector(".menu-panel") : null;
  const screenSelectEl = document.getElementById("menu-screen-select");
  const screenCreateEl = document.getElementById("menu-screen-create");

  const characterListEl = document.getElementById("character-list");
  const classListEl = document.getElementById("class-list");

  const btnGoCreate = document.getElementById("btn-go-create");
  const btnPlay = document.getElementById("btn-play");
  const btnBackSelect = document.getElementById("btn-back-select");
  const formCreate = document.getElementById("character-create-form");
  const inputName = document.getElementById("character-name");
  const btnCreate = document.getElementById("btn-create");

  if (
    !overlayEl ||
    !panelEl ||
    !screenSelectEl ||
    !screenCreateEl ||
    !characterListEl ||
    !classListEl ||
    !btnGoCreate ||
    !btnPlay ||
    !btnBackSelect ||
    !formCreate ||
    !inputName ||
    !btnCreate
  ) {
    return null;
  }

  const CLASS_ORDER = ["archer", "tank", "mage"];
  const CAROUSEL_ORDER = ["archer", "tank", "mage", "assassin"];
  const classUi = {
    archer: {
      title: "Archer",
      desc: "Dégâts à distance, mobilité.",
      bullets: ["Attaques à distance", "Bon repositionnement", "Jeu safe"],
      previewImage: "assets/rotations/south.png",
      selectable: true,
    },
    tank: {
      title: "Tank",
      desc: "Dégâts au corps à corps, encaisse et contrôle.",
      bullets: ["Corps à corps", "Très résistant", "Contrôle de zone"],
      previewImage: "assets/animations/animation tank/rotations/south.png",
      selectable: true,
    },
    mage: {
      title: "Animiste",
      desc: "Magie spirituelle : soutien, capture et invocation.",
      bullets: ["Magie & altérations", "Capture d'essence", "Invocation capturée"],
      previewImage: "assets/animations/animations-Animiste/rotations/south.png",
      selectable: true,
    },
    assassin: {
      title: "Assassin",
      desc: "Bientôt disponible.",
      bullets: ["En développement", "À venir"],
      previewImage: "assets/rotations/south.png",
      selectable: false,
    },
  };

  const getAvailableClassIds = () => CLASS_ORDER.filter((id) => classes[id]);
  const getCarouselClassIds = () => CAROUSEL_ORDER.filter((id) => classes[id]);

  const characters = [];
  let selectedCharacterId = null;
  let selectedClassId = null;

  let carouselOrder = getCarouselClassIds();
  let carouselIds = getCarouselClassIds();
  const carouselSlotByClassId = new Map();

  // Mapping index -> position class (comme ton dessin : centre, haut, gauche, droite)
  const POS_CLASSES = ["pos-center", "pos-top", "pos-left", "pos-right"];

  const isCreateMode = () => !screenCreateEl.hidden;

  function ensureLayout() {
    if (panelEl.classList.contains("menu-v2")) return;
    panelEl.classList.add("menu-v2");

    const main = document.createElement("div");
    main.className = "menu-main";

    const left = document.createElement("div");
    left.className = "menu-left";
    left.appendChild(screenSelectEl);
    left.appendChild(screenCreateEl);

    const center = document.createElement("div");
    center.className = "menu-center";
    center.innerHTML = `
      <div class="menu-preview-stage">
        <div id="menu-preview-carousel" class="menu-preview-carousel" aria-label="Choix de classe"></div>
      </div>
    `;

    const right = document.createElement("div");
    right.className = "menu-right";
    right.innerHTML = `
      <div class="menu-details">
        <h2 id="menu-preview-title" class="menu-preview-title">-</h2>
        <p id="menu-preview-desc" class="menu-preview-desc"></p>
        <ul id="menu-preview-bullets" class="menu-preview-bullets"></ul>
      </div>
    `;

    main.appendChild(left);
    main.appendChild(center);
    main.appendChild(right);

    const footer = document.createElement("div");
    footer.className = "menu-footer";

    const actions = document.createElement("div");
    actions.className = "menu-footer-actions";

    btnCreate.setAttribute("form", "character-create-form");
    btnCreate.type = "submit";

    actions.appendChild(btnBackSelect);
    actions.appendChild(btnGoCreate);
    actions.appendChild(btnPlay);
    actions.appendChild(btnCreate);
    footer.appendChild(actions);

    // Supprime les anciens conteneurs d'actions (les boutons ont été déplacés).
    panelEl.querySelectorAll(".menu-actions").forEach((el) => el.remove());

    const header = panelEl.querySelector(".menu-header");
    if (header) {
      header.insertAdjacentElement("afterend", main);
      main.insertAdjacentElement("afterend", footer);
    } else {
      panelEl.appendChild(main);
      panelEl.appendChild(footer);
    }

    ensureCarousel(carouselIds);
    applyCarouselPositions();
  }

  function ensureCarousel(ids) {
    const container = overlayEl.querySelector("#menu-preview-carousel");
    if (!container) return;
    const nextIds = Array.isArray(ids) ? ids.filter(Boolean) : [];
    const key = nextIds.join("|");
    if (container.dataset.carouselKey === key) return;
    container.dataset.carouselKey = key;

    container.innerHTML = "";
    carouselSlotByClassId.clear();

    nextIds.forEach((classId) => {
      const ui = classUi[classId] || {};
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "menu-class-slot";
      btn.dataset.classId = classId;
      btn.setAttribute("aria-label", ui.title || classId);

      if (ui.selectable === false) btn.classList.add("is-disabled");

      const img = document.createElement("img");
      img.alt = ui.title || classId;
      img.draggable = false;
      img.src = ui.previewImage ? encodeURI(ui.previewImage) : "";
      btn.appendChild(img);

      const label = document.createElement("div");
      label.className = "menu-class-slot-label";
      label.textContent = ui.title || classId;
      btn.appendChild(label);

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        rotateCarouselTo(classId);

        // En création, cliquer une classe la sélectionne (si dispo).
        if (isCreateMode() && classUi[classId]?.selectable !== false) {
          selectedClassId = classId;
          renderClasses();
          syncCreateButton();
          return;
        }

        // En sélection, cliquer une classe sélectionne un personnage de cette classe.
        if (!isCreateMode()) {
          const candidate =
            characters.find((c) => c && c.classId === classId) || null;
          if (candidate && candidate.id) {
            selectedCharacterId = candidate.id;
            btnPlay.disabled = false;
            renderCharacters();
            setPreview(candidate.classId || "archer", {
              characterName: candidate.name || "Joueur",
            });
          }
        }
      });

      carouselSlotByClassId.set(classId, btn);
      container.appendChild(btn);
    });
  }

  function applyCarouselPositions() {
    const idsForPos = carouselOrder.slice(0, POS_CLASSES.length);

    // Hide all by default
    carouselSlotByClassId.forEach((el) => {
      el.hidden = true;
      POS_CLASSES.forEach((cls) => el.classList.remove(cls));
    });

    idsForPos.forEach((id, index) => {
      const el = carouselSlotByClassId.get(id);
      if (!el) return;
      el.hidden = false;
      el.classList.add(POS_CLASSES[index]);
    });
  }

  function rotateCarouselTo(classId) {
    if (!classId) return;
    const idx = carouselOrder.indexOf(classId);
    if (idx < 0) return;
    if (idx === 0) {
      // Déjà au premier plan : on rafraîchit la preview.
      setPreview(classId);
      return;
    }

    carouselOrder = [...carouselOrder.slice(idx), ...carouselOrder.slice(0, idx)];
    applyCarouselPositions();
    setPreview(classId);
  }

  function buildCarouselIdsForSelect() {
    const unique = Array.from(
      new Set(characters.map((c) => c && c.classId).filter(Boolean))
    );
    // Garde un ordre cohérent (archer/tank/mage/assassin)
    const ordered = CAROUSEL_ORDER.filter((id) => unique.includes(id));
    return ordered.length > 0 ? ordered : getCarouselClassIds();
  }

  function setPreview(classId, { characterName = null } = {}) {
    const ui = classUi[classId] || null;
    const title = overlayEl.querySelector("#menu-preview-title");
    const desc = overlayEl.querySelector("#menu-preview-desc");
    const bullets = overlayEl.querySelector("#menu-preview-bullets");

    const fallbackTitle = classes[classId]?.label || classId || "-";
    const finalTitle =
      characterName && characterName.length > 0
        ? `${characterName} — ${ui?.title || fallbackTitle}`
        : ui?.title || fallbackTitle;

    if (title) title.textContent = finalTitle;
    if (desc) desc.textContent = ui?.desc || "";
    if (bullets) {
      bullets.innerHTML = "";
      const lines = Array.isArray(ui?.bullets) ? ui.bullets : [];
      lines.forEach((line) => {
        const li = document.createElement("li");
        li.textContent = line;
        bullets.appendChild(li);
      });
    }
  }

  const showSelect = () => {
    ensureLayout();
    screenCreateEl.hidden = true;
    screenSelectEl.hidden = false;
    document.body.classList.add("menu-open");

    btnBackSelect.hidden = true;
    btnCreate.hidden = true;
    btnGoCreate.hidden = false;
    btnPlay.hidden = false;

    renderCharacters();

    const chosen = characters.find((c) => c.id === selectedCharacterId) || null;
    const classId = chosen?.classId || "archer";
    // En sélection : n'afficher que les classes réellement créées.
    carouselIds = buildCarouselIdsForSelect();
    ensureCarousel(carouselIds);
    carouselOrder = carouselIds.slice();
    // Mets la classe du perso au premier plan.
    if (carouselOrder.includes(classId)) {
      carouselOrder = [classId, ...carouselOrder.filter((id) => id !== classId)];
    }
    applyCarouselPositions();
    setPreview(classId, { characterName: chosen?.name || null });
  };

  const showCreate = () => {
    ensureLayout();
    screenSelectEl.hidden = true;
    screenCreateEl.hidden = false;
    document.body.classList.add("menu-open");

    btnBackSelect.hidden = false;
    btnCreate.hidden = false;
    btnGoCreate.hidden = true;
    btnPlay.hidden = true;

    selectedClassId = null;
    inputName.value = "";
    renderClasses();
    syncCreateButton();
    // En création, on remet l'ordre par défaut et on affiche l'aperçu.
    carouselIds = getCarouselClassIds();
    ensureCarousel(carouselIds);
    carouselOrder = carouselIds.slice();
    applyCarouselPositions();
    setPreview("archer");
  };

  const openMenu = () => {
    document.body.classList.add("menu-open");
    // Si on revient depuis le jeu, pré-sélectionne le personnage courant.
    const current = window.__andemiaSelectedCharacter || null;
    if (current && current.id) {
      const exists = characters.some((c) => c && c.id === current.id);
      if (exists) selectedCharacterId = current.id;
    }
    if (characters.length === 0) showCreate();
    else showSelect();
  };

  const closeMenu = () => {
    document.body.classList.remove("menu-open");
  };

  const renderCharacters = () => {
    characterListEl.innerHTML = "";
    btnPlay.disabled = true;

    if (characters.length === 0) {
      selectedCharacterId = null;
      const empty = document.createElement("div");
      empty.textContent = "Aucun personnage. Crée-en un pour commencer.";
      empty.style.opacity = "0.85";
      characterListEl.appendChild(empty);
      return;
    }

    // Si aucun perso n'est sélectionné, on sélectionne le premier pour éviter le "Jouer" bloqué.
    if (!selectedCharacterId && characters[0] && characters[0].id) {
      selectedCharacterId = characters[0].id;
    }

    btnPlay.disabled = !selectedCharacterId;

    characters.forEach((c) => {
      const card = document.createElement("div");
      card.className = "character-card";
      if (c.id === selectedCharacterId) card.classList.add("is-selected");

      const name = document.createElement("div");
      name.className = "character-name";
      name.textContent = c.name || "Joueur";

      const meta = document.createElement("div");
      meta.className = "character-meta";
      const classLabel = classes[c.classId]?.label || c.classId;
      meta.textContent = `${classLabel} · Niv. ${c.level ?? 1}`;

      card.appendChild(name);
      card.appendChild(meta);

      card.addEventListener("click", () => {
        selectedCharacterId = c.id;
        btnPlay.disabled = false;
        renderCharacters();
        const classId = c.classId || "archer";
        carouselIds = buildCarouselIdsForSelect();
        ensureCarousel(carouselIds);
        carouselOrder = carouselIds.slice();
        if (carouselOrder.includes(classId)) {
          carouselOrder = [classId, ...carouselOrder.filter((id) => id !== classId)];
        }
        applyCarouselPositions();
        setPreview(classId, { characterName: c.name || "Joueur" });
      });

      characterListEl.appendChild(card);
    });
  };

  const renderClasses = () => {
    classListEl.innerHTML = "";

    const classIds = getAvailableClassIds();
    classIds.forEach((id) => {
      const def = classes[id];
      const card = document.createElement("div");
      card.className = "class-card";
      if (id === selectedClassId) card.classList.add("is-selected");

      const title = document.createElement("div");
      title.className = "class-card-title";
      title.textContent = def?.label || id;

      const desc = document.createElement("div");
      desc.className = "class-card-desc";
      desc.textContent = classUi[id]?.desc || "Classe en développement.";

      card.appendChild(title);
      card.appendChild(desc);

      card.addEventListener("click", () => {
        if (classUi[id]?.selectable === false) {
          rotateCarouselTo(id);
          return;
        }
        selectedClassId = id;
        renderClasses();
        syncCreateButton();
        rotateCarouselTo(id);
      });

      classListEl.appendChild(card);
    });
  };

  const syncCreateButton = () => {
    btnCreate.disabled = !selectedClassId || classUi[selectedClassId]?.selectable === false;
  };

  btnGoCreate.addEventListener("click", () => showCreate());
  btnBackSelect.addEventListener("click", () => showSelect());

  btnPlay.addEventListener("click", () => {
    const chosen = characters.find((c) => c.id === selectedCharacterId);
    if (!chosen) return;
    closeMenu();
    if (typeof onStartGame === "function") onStartGame(chosen);
  });

  formCreate.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!selectedClassId) return;

    const rawName = String(inputName.value || "").trim();
    const name = rawName.length > 0 ? rawName : "Joueur";

    const character = {
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now()),
      name,
      classId: selectedClassId,
      level: 1,
    };

    characters.push(character);
    selectedCharacterId = character.id;
    showSelect();
    btnPlay.disabled = false;
  });

  openMenu();

  return {
    openMenu,
    closeMenu,
    getCharacters: () => characters.slice(),
  };
}
