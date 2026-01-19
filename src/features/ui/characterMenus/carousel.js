export function createCarousel({
  overlayEl,
  classUi,
  classes,
  getCharacters,
  getSelectedCharacterId,
  setSelectedCharacterId,
  getSelectedClassId,
  setSelectedClassId,
  isCreateMode,
  onSelectCharacter,
  onCreateClassChange,
  onStartCharacter,
  setPlayEnabled,
  initialIds,
  initialOrder,
}) {
  const POS_CLASSES = ["pos-center", "pos-top", "pos-left", "pos-right"];
  let carouselOrder = Array.isArray(initialOrder) ? [...initialOrder] : [];
  let carouselIds = Array.isArray(initialIds) ? [...initialIds] : [];
  const carouselSlotByClassId = new Map();
  const carouselSlotByKey = new Map();

  function setPreview(classId, { characterName = null } = {}) {
    const ui = classUi[classId] || null;
    const title = overlayEl.querySelector("#menu-preview-title");
    const desc = overlayEl.querySelector("#menu-preview-desc");
    const bullets = overlayEl.querySelector("#menu-preview-bullets");

    const fallbackTitle = classes[classId]?.label || classId || "-";
    const finalTitle =
      characterName && characterName.length > 0
        ? `${characterName} - ${ui?.title || fallbackTitle}`
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

  function renderCarouselMeta() {
    carouselSlotByKey.forEach((btn, key) => {
      const sub = btn.querySelector(".menu-class-slot-sub");
      if (!sub) return;
      const char = getCharacters().find((c) => c && c.id === key) || null;
      if (!char) {
        sub.textContent = "";
        return;
      }
      sub.textContent = `${char.name || "Joueur"} - Niv. ${char.level ?? 1}`;
    });
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
        getCharacters().find((c) => c && c.id === carouselKey) || null;
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

        if (isCreateMode() && classUi[resolvedClassId]?.selectable !== false) {
          setSelectedClassId(resolvedClassId);
          if (typeof onCreateClassChange === "function") {
            onCreateClassChange(resolvedClassId);
          }
          return;
        }
      });

      btn.addEventListener("dblclick", (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (isCreateMode()) return;
        if (!character || !character.id) return;
        setSelectedCharacterId(character.id);
        if (typeof setPlayEnabled === "function") setPlayEnabled(true);
        if (typeof onStartCharacter === "function") {
          onStartCharacter(character);
        }
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

    const candidate = getCharacters().find((c) => c && c.id === key) || null;

    if (idx === 0) {
      if (candidate && candidate.id) {
        setSelectedCharacterId(candidate.id);
        if (typeof setPlayEnabled === "function") setPlayEnabled(true);
        if (typeof onSelectCharacter === "function") onSelectCharacter(candidate);
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

    carouselOrder = [
      ...carouselOrder.slice(idx),
      ...carouselOrder.slice(0, idx),
    ];
    applyCarouselPositions();

    if (candidate && candidate.id) {
      setSelectedCharacterId(candidate.id);
      if (typeof setPlayEnabled === "function") setPlayEnabled(true);
      if (typeof onSelectCharacter === "function") onSelectCharacter(candidate);
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
    // En selection, on veut pouvoir afficher plusieurs persos de la meme classe.
    // On construit un carousel de 4 vignettes max : [selectionne] + 3 autres.
    const ids = getCharacters().map((c) => c && c.id).filter(Boolean);
    const selectedFirst =
      getSelectedCharacterId() && ids.includes(getSelectedCharacterId());
    const ordered = selectedFirst
      ? [getSelectedCharacterId(), ...ids.filter((id) => id !== getSelectedCharacterId())]
      : ids;
    return ordered.slice(0, POS_CLASSES.length);
  }

  return {
    ensureCarousel,
    applyCarouselPositions,
    rotateCarouselTo,
    buildCarouselIdsForSelect,
    setPreview,
    renderCarouselMeta,
    setCarouselIds: (ids) => {
      carouselIds = Array.isArray(ids) ? [...ids] : [];
    },
    getCarouselIds: () => carouselIds,
    setCarouselOrder: (order) => {
      carouselOrder = Array.isArray(order) ? [...order] : [];
    },
    getCarouselOrder: () => carouselOrder,
    getSelectedClassId,
  };
}


