import { classes } from "../config/classes.js";
import { on as onStore } from "../state/store.js";
import {
  deleteCharacter,
  listCharacterMetas,
  upsertCharacterMeta,
} from "../save/index.js";

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

  const CLASS_ORDER = ["archer", "tank", "mage", "eryon"];
  const CAROUSEL_ORDER = ["archer", "tank", "mage", "eryon"];
  const classUi = {
    archer: {
      title: "Archer",
      desc: "Dégâts à distance, mobilité.",
      bullets: ["Attaques à distance", "Bon repositionnement", "Jeu safe"],
      previewImage: "assets/animations/animation archer/rotations/south.png",
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
    eryon: {
      title: "Eryon",
      desc: "Nouvelle classe en test.",
      bullets: ["Mobilité", "Dégâts", "Style Eryon"],
      previewImage: "assets/animations/animations-Eryon/rotations/south.png",
      selectable: true,
    },
  };

  const getAvailableClassIds = () => CLASS_ORDER.filter((id) => classes[id]);
  const getCarouselClassIds = () => CAROUSEL_ORDER.filter((id) => classes[id]);

  const getDefaultCreateClassId = () => {
    const ids = getAvailableClassIds();
    const firstPlayable = ids.find((id) => classUi[id]?.selectable !== false) || null;
    return firstPlayable || ids[0] || "archer";
  };

  const characters = [];
  let selectedCharacterId = null;
  let selectedClassId = null;

  // Hydrate depuis la sauvegarde locale (persistant entre rechargements).
  try {
    const metas = listCharacterMetas();
    metas.forEach((m) => {
      if (!m || !m.id) return;
      characters.push({
        id: m.id,
        name: m.name || "Joueur",
        classId: m.classId || "archer",
        level: m.level ?? 1,
      });
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[menu] failed to load saved characters:", err);
  }

  let carouselOrder = getCarouselClassIds();
  let carouselIds = getCarouselClassIds();
  const carouselSlotByClassId = new Map();
  const carouselSlotByKey = new Map();

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
    carouselSlotByKey.clear();

    nextIds.forEach((classId) => {
      const carouselKey = classId;
      const character =
        characters.find((c) => c && c.id === carouselKey) || null;
      const resolvedClassId = character?.classId || carouselKey;
      const ui = classUi[resolvedClassId] || {};
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "menu-class-slot";
      btn.dataset.classId = resolvedClassId;
      btn.dataset.carouselKey = carouselKey;

      if (character?.id) {
        btn.dataset.characterId = character.id;
        btn.setAttribute(
          "aria-label",
          `${character.name || "Joueur"} - ${ui.title || resolvedClassId}`
        );
      } else {
        btn.setAttribute("aria-label", ui.title || resolvedClassId);
      }

      if (ui.selectable === false) btn.classList.add("is-disabled");

      const img = document.createElement("img");
      img.alt = ui.title || resolvedClassId;
      img.draggable = false;
      img.src = ui.previewImage ? encodeURI(ui.previewImage) : "";
      btn.appendChild(img);

      const label = document.createElement("div");
      label.className = "menu-class-slot-label";
      label.textContent = ui.title || resolvedClassId;
      btn.appendChild(label);

      const sub = document.createElement("div");
      sub.className = "menu-class-slot-sub";
      if (character) {
        const lvl = character.level ?? 1;
        sub.textContent = `${character.name || "Joueur"} - Niv. ${lvl}`;
      }
      btn.appendChild(sub);

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        rotateCarouselTo(carouselKey);

        // En création, cliquer une classe la sélectionne (si dispo).
        if (isCreateMode() && classUi[resolvedClassId]?.selectable !== false) {
          selectedClassId = resolvedClassId;
          renderClasses();
          syncCreateButton();
          return;
        }

        // En sélection, cliquer une classe sélectionne un personnage de cette classe.
        if (!isCreateMode()) {
          const candidate =
            (character && character.id && character) ||
            characters.find((c) => c && c.classId === resolvedClassId) ||
            null;
          if (candidate && candidate.id) {
            selectedCharacterId = candidate.id;
            btnPlay.disabled = false;
            renderCharacters();
            renderCarouselMeta();
            setPreview(candidate.classId || resolvedClassId || "archer", {
              characterName: candidate.name || "Joueur",
            });
          }
        }
      });

      btn.addEventListener("dblclick", (e) => {
        e.preventDefault();
        e.stopPropagation();

        // En sélection : double-clic sur l'asset = jouer directement.
        if (isCreateMode()) return;
        if (!character || !character.id) return;
        selectedCharacterId = character.id;
        btnPlay.disabled = false;
        startGameWithCharacter(character);
      });

      carouselSlotByClassId.set(resolvedClassId, btn);
      carouselSlotByKey.set(carouselKey, btn);
      container.appendChild(btn);
    });
  }

  function applyCarouselPositions() {
    const idsForPos = carouselOrder.slice(0, POS_CLASSES.length);

    // Hide all by default
    carouselSlotByKey.forEach((el) => {
      el.hidden = true;
      POS_CLASSES.forEach((cls) => el.classList.remove(cls));
    });

    idsForPos.forEach((id, index) => {
      const el = carouselSlotByKey.get(id) || carouselSlotByClassId.get(id);
      if (!el) return;
      el.hidden = false;
      el.classList.add(POS_CLASSES[index]);
    });
  }

function rotateCarouselTo(key) {
    if (!key) return;
    const idx = carouselOrder.indexOf(key);
    if (idx < 0) return;

    const candidate = characters.find((c) => c && c.id === key) || null;

    if (idx === 0) {
      // Déjà au premier plan : on rafraîchit la preview.
      if (candidate && candidate.id) {
        selectedCharacterId = candidate.id;
        btnPlay.disabled = false;
        renderCharacters();
        setPreview(candidate.classId || "archer", {
          characterName: candidate.name || "Joueur",
        });
        renderCarouselMeta();
        return;
      }
      setPreview(key);
      renderCarouselMeta();
      return;
    }

    carouselOrder = [...carouselOrder.slice(idx), ...carouselOrder.slice(0, idx)];
    applyCarouselPositions();

    if (candidate && candidate.id) {
      selectedCharacterId = candidate.id;
      btnPlay.disabled = false;
      renderCharacters();
      setPreview(candidate.classId || "archer", {
        characterName: candidate.name || "Joueur",
      });
      renderCarouselMeta();
      return;
    }

    setPreview(key);
    renderCarouselMeta();
  }

function buildCarouselIdsForSelect() {
    // En sélection, on veut pouvoir afficher plusieurs persos de la même classe.
    // On construit un carousel de 4 vignettes max : [sélectionné] + 3 autres.
    const ids = characters.map((c) => c && c.id).filter(Boolean);
    const selectedFirst =
      selectedCharacterId && ids.includes(selectedCharacterId);
    const ordered = selectedFirst
      ? [selectedCharacterId, ...ids.filter((id) => id !== selectedCharacterId)]
      : ids;
    return ordered.slice(0, POS_CLASSES.length);
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

  function getSelectedCharacter() {
    return characters.find((c) => c && c.id === selectedCharacterId) || null;
  }

function renderCarouselMeta() {
    carouselSlotByKey.forEach((btn, key) => {
      const sub = btn.querySelector(".menu-class-slot-sub");
      if (!sub) return;
      const char = characters.find((c) => c && c.id === key) || null;
      if (!char) {
        sub.textContent = "";
        return;
      }
      sub.textContent = `${char.name || "Joueur"} - Niv. ${char.level ?? 1}`;
    });

    if (isCreateMode()) return;
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
    // Mets le perso au premier plan.
    if (selectedCharacterId && carouselOrder.includes(selectedCharacterId)) {
      carouselOrder = [
        selectedCharacterId,
        ...carouselOrder.filter((id) => id !== selectedCharacterId),
      ];
    }
    applyCarouselPositions();
    setPreview(classId, { characterName: chosen?.name || null });
    renderCarouselMeta();
  };

  function refreshSelectAfterCharactersChanged() {
    if (characters.length === 0) {
      showCreate();
      return;
    }

    ensureLayout();
    screenCreateEl.hidden = true;
    screenSelectEl.hidden = false;

    btnBackSelect.hidden = true;
    btnCreate.hidden = true;
    btnGoCreate.hidden = false;
    btnPlay.hidden = false;

    renderCharacters();

    const chosen = getSelectedCharacter();
    const classId = chosen?.classId || "archer";
    carouselIds = buildCarouselIdsForSelect();
    ensureCarousel(carouselIds);
    carouselOrder = carouselIds.slice();
    if (selectedCharacterId && carouselOrder.includes(selectedCharacterId)) {
      carouselOrder = [
        selectedCharacterId,
        ...carouselOrder.filter((id) => id !== selectedCharacterId),
      ];
    }
    applyCarouselPositions();
    setPreview(classId, { characterName: chosen?.name || null });
    renderCarouselMeta();
  }

  const showCreate = () => {
    ensureLayout();
    screenSelectEl.hidden = true;
    screenCreateEl.hidden = false;
    document.body.classList.add("menu-open");

    btnBackSelect.hidden = false;
    btnCreate.hidden = false;
    btnGoCreate.hidden = true;
    btnPlay.hidden = true;

    selectedClassId = getDefaultCreateClassId();
    inputName.value = "";
    renderClasses();
    syncCreateButton();
    // En création, on remet l'ordre par défaut et on affiche l'aperçu.
    carouselIds = getCarouselClassIds();
    ensureCarousel(carouselIds);
    carouselOrder = carouselIds.slice();
    applyCarouselPositions();
    setPreview(selectedClassId || "archer");
    renderCarouselMeta();

    // UX : focus direct sur le nom.
    try {
      inputName.focus();
    } catch {
      // ignore
    }
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

      const info = document.createElement("div");
      info.className = "character-info";

      const name = document.createElement("div");
      name.className = "character-name";
      name.textContent = c.name || "Joueur";

      const meta = document.createElement("div");
      meta.className = "character-meta";
      const classLabel = classes[c.classId]?.label || c.classId;
      meta.textContent = `${classLabel} · Niv. ${c.level ?? 1}`;

      info.appendChild(name);
      info.appendChild(meta);
      card.appendChild(info);

      const actions = document.createElement("div");
      actions.className = "character-actions";

      const btnDelete = document.createElement("button");
      btnDelete.type = "button";
      btnDelete.className = "character-delete";
      btnDelete.textContent = "Supprimer";
      btnDelete.setAttribute(
        "aria-label",
        `Supprimer le personnage ${c.name || "Joueur"}`
      );
      btnDelete.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const label = c.name || "Joueur";
        const ok = window.confirm(
          `Supprimer \"${label}\" ?\n\nCette action efface sa sauvegarde locale (irréversible).`
        );
        if (!ok) return;

        deleteCharacter(c.id);
        const idx = characters.findIndex((x) => x && x.id === c.id);
        if (idx >= 0) characters.splice(idx, 1);

        if (selectedCharacterId === c.id) selectedCharacterId = null;
        if (window.__andemiaSelectedCharacter?.id === c.id) {
          window.__andemiaSelectedCharacter = null;
        }

        refreshSelectAfterCharactersChanged();
      });

      actions.appendChild(btnDelete);
      card.appendChild(actions);

      card.addEventListener("click", () => {
        selectedCharacterId = c.id;
        btnPlay.disabled = false;
        renderCharacters();
        renderCarouselMeta();
        const classId = c.classId || "archer";
        carouselIds = buildCarouselIdsForSelect();
        ensureCarousel(carouselIds);
        carouselOrder = carouselIds.slice();
        if (carouselOrder.includes(c.id)) {
          carouselOrder = [c.id, ...carouselOrder.filter((id) => id !== c.id)];
        }
        applyCarouselPositions();
        setPreview(classId, { characterName: c.name || "Joueur" });
      });

      card.addEventListener("dblclick", (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectedCharacterId = c.id;
        btnPlay.disabled = false;
        startGameWithCharacter(c);
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
    const rawName = String(inputName.value || "").trim();
    const hasName = rawName.length > 0;
    const canCreate =
      hasName &&
      !!selectedClassId &&
      classUi[selectedClassId]?.selectable !== false;

    // On évite un bouton "mort" : on garde le bouton cliquable pour pouvoir
    // montrer un feedback (surbrillance du champ nom) si l'utilisateur tente
    // de créer sans nom.
    btnCreate.disabled = false;
    btnCreate.classList.toggle("is-disabled", !canCreate);
    btnCreate.setAttribute("aria-disabled", String(!canCreate));
  };

  btnGoCreate.addEventListener("click", () => showCreate());
  btnBackSelect.addEventListener("click", () => showSelect());
  inputName.addEventListener("input", () => syncCreateButton());

  let invalidNameTimeout = null;
  const flashInvalidName = () => {
    if (invalidNameTimeout) {
      clearTimeout(invalidNameTimeout);
      invalidNameTimeout = null;
    }
    inputName.classList.remove("is-invalid");
    // Force reflow so the animation restarts cleanly.
    // eslint-disable-next-line no-unused-expressions
    inputName.offsetWidth;
    inputName.classList.add("is-invalid");
    try {
      inputName.focus();
    } catch {
      // ignore
    }
    invalidNameTimeout = setTimeout(() => {
      inputName.classList.remove("is-invalid");
      invalidNameTimeout = null;
    }, 650);
  };

  btnCreate.addEventListener("click", (e) => {
    const rawName = String(inputName.value || "").trim();
    if (rawName.length > 0) return;
    e.preventDefault();
    e.stopPropagation();
    flashInvalidName();
  });

  function startGameWithCharacter(chosen) {
    if (!chosen) return;
    upsertCharacterMeta(chosen);
    closeMenu();
    if (typeof onStartGame === "function") onStartGame(chosen);
  }

  btnPlay.addEventListener("click", () => {
    const chosen = characters.find((c) => c.id === selectedCharacterId);
    if (!chosen) return;
    startGameWithCharacter(chosen);
  });

  // Sync du niveau (jeu -> menu)
  onStore("player:levelup", (payload) => {
    const levelAfter =
      payload?.data?.level ?? payload?.player?.levelState?.niveau ?? null;
    if (!levelAfter || !Number.isFinite(levelAfter)) return;

    const current = window.__andemiaSelectedCharacter || null;
    const id = current?.id ?? selectedCharacterId;
    if (!id) return;

    const char = characters.find((c) => c && c.id === id) || null;
    if (!char) return;

    char.level = levelAfter;
    if (current && current.id === id) current.level = levelAfter;
    upsertCharacterMeta(char);

    if (document.body.classList.contains("menu-open")) {
      renderCharacters();
      renderCarouselMeta();
    }
  });

  const makeUniqueName = (raw) => {
    const base = String(raw || "").trim();
    if (!base) return "";

    const exists = (name) =>
      characters.some(
        (c) =>
          c &&
          typeof c.name === "string" &&
          c.name.trim().toLowerCase() === name.trim().toLowerCase()
      );

    if (!exists(base)) return base;

    let n = 2;
    let next = `${base} ${n}`;
    while (exists(next) && n < 999) {
      n += 1;
      next = `${base} ${n}`;
    }
    return next;
  };

  formCreate.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!selectedClassId) selectedClassId = getDefaultCreateClassId();

    const rawName = String(inputName.value || "").trim();
    if (rawName.length === 0) {
      flashInvalidName();
      syncCreateButton();
      return;
    }

    const name = makeUniqueName(rawName);

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
    upsertCharacterMeta(character);
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
