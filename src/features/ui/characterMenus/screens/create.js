export function createCreateScreen({
  elements,
  classes,
  classUi,
  state,
  layout,
  actions,
}) {
  const {
    screenLoginEl,
    screenServersEl,
    screenSelectEl,
    screenCreateEl,
    btnBackSelect,
    btnCreate,
    btnGoCreate,
    btnPlay,
    btnLanConnect,
    formCreate,
    inputName,
    classListEl,
  } = elements;

  function renderClasses() {
    classListEl.innerHTML = "";

    const classIds = state.getAvailableClassIds();
    classIds.forEach((id) => {
      const def = classes[id];
      const card = document.createElement("div");
      card.className = "class-card";
      if (id === state.getSelectedClassId()) card.classList.add("is-selected");

      const title = document.createElement("div");
      title.className = "class-card-title";
      title.textContent = def?.label || id;

      const desc = document.createElement("div");
      desc.className = "class-card-desc";
      desc.textContent = classUi[id]?.desc || "Classe en developpement.";

      card.appendChild(title);
      card.appendChild(desc);

      card.addEventListener("click", () => {
        if (classUi[id]?.selectable === false) {
          layout.rotateCarouselTo(id);
          return;
        }
        state.setSelectedClassId(id);
        renderClasses();
        syncCreateButton();
        layout.rotateCarouselTo(id);
      });

      classListEl.appendChild(card);
    });
  }

  function syncCreateButton() {
    const rawName = String(inputName.value || "").trim();
    const hasName = rawName.length > 0;
    const canCreate =
      hasName &&
      !!state.getSelectedClassId() &&
      classUi[state.getSelectedClassId()]?.selectable !== false;

    btnCreate.disabled = false;
    btnCreate.classList.toggle("is-disabled", !canCreate);
    btnCreate.setAttribute("aria-disabled", String(!canCreate));
  }

  function showCreate() {
    if (!state.getActiveAccount()?.name || !state.getActiveAccount()?.password) {
      actions.showLogin();
      return;
    }
    layout.ensureLayout();
    screenLoginEl.hidden = true;
    screenServersEl.hidden = true;
    screenSelectEl.hidden = true;
    screenCreateEl.hidden = false;
    document.body.classList.add("menu-open");
    document.body.classList.remove("menu-login");
    document.body.classList.remove("menu-servers");

    btnBackSelect.hidden = false;
    btnCreate.hidden = false;
    btnGoCreate.hidden = true;
    btnPlay.hidden = true;
    btnLanConnect.hidden = false;

    state.setSelectedClassId(layout.getDefaultCreateClassId());
    inputName.value = "";
    renderClasses();
    syncCreateButton();
    layout.setCarouselIds(layout.getCarouselClassIds());
    layout.ensureCarousel(layout.getCarouselIds());
    layout.setCarouselOrder(layout.getCarouselIds());
    layout.applyCarouselPositions();
    layout.setPreview(state.getSelectedClassId() || "archer");
    layout.renderCarouselMeta();

    try {
      inputName.focus();
    } catch {
      // ignore
    }
  }

  function flashInvalidName() {
    inputName.classList.remove("is-invalid");
    // eslint-disable-next-line no-unused-expressions
    inputName.offsetWidth;
    inputName.classList.add("is-invalid");
    try {
      inputName.focus();
    } catch {
      // ignore
    }
    setTimeout(() => {
      inputName.classList.remove("is-invalid");
    }, 650);
  }

  function handleCreateSubmit(e) {
    e.preventDefault();
    if (!state.getSelectedClassId()) {
      state.setSelectedClassId(layout.getDefaultCreateClassId());
    }

    const rawName = String(inputName.value || "").trim();
    if (rawName.length === 0) {
      flashInvalidName();
      syncCreateButton();
      return;
    }

    if (typeof actions.createCharacter === "function") {
      actions.createCharacter({
        name: rawName,
        classId: state.getSelectedClassId(),
      });
    }
  }

  function attachCreateEvents() {
    inputName.addEventListener("input", () => syncCreateButton());
    formCreate.addEventListener("submit", handleCreateSubmit);
    btnCreate.addEventListener("click", (e) => {
      const rawName = String(inputName.value || "").trim();
      if (rawName.length > 0) return;
      e.preventDefault();
      e.stopPropagation();
      flashInvalidName();
    });
  }

  return {
    showCreate,
    renderClasses,
    syncCreateButton,
    attachCreateEvents,
  };
}
