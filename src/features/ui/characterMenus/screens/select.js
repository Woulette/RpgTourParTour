export function createSelectScreen({
  elements,
  classes,
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
    btnGoServers,
    btnPlay,
    btnLanConnect,
    characterListEl,
  } = elements;
  function showSelect() {
    const account = state.getActiveAccount();
    const hasToken = !!account?.sessionToken;
    if (!account?.name || (!account?.password && !hasToken)) {
      actions.showLogin();
      return;
    }
    layout.ensureLayout();
    screenLoginEl.hidden = true;
    screenServersEl.hidden = true;
    screenCreateEl.hidden = true;
    screenSelectEl.hidden = false;
    document.body.classList.add("menu-open");
    document.body.classList.remove("menu-login");
    document.body.classList.remove("menu-servers");

    btnBackSelect.hidden = true;
    btnCreate.hidden = true;
    btnGoCreate.hidden = false;
    btnGoServers.hidden = false;
    btnPlay.hidden = false;
    btnLanConnect.hidden = false;

    renderCharacters();

    const chosen =
      state.getCharacters().find((c) => c.id === state.getSelectedCharacterId()) ||
      null;
    const classId = chosen?.classId || "archer";
    layout.setCarouselIds(layout.buildCarouselIdsForSelect());
    layout.ensureCarousel(layout.getCarouselIds());
    layout.setCarouselOrder(layout.getCarouselIds());
    if (
      state.getSelectedCharacterId() &&
      layout.getCarouselOrder().includes(state.getSelectedCharacterId())
    ) {
      layout.setCarouselOrder([
        state.getSelectedCharacterId(),
        ...layout
          .getCarouselOrder()
          .filter((id) => id !== state.getSelectedCharacterId()),
      ]);
    }
    layout.applyCarouselPositions();
    layout.setPreview(classId, { characterName: chosen?.name || null });
    layout.renderCarouselMeta();
  }

  function refreshSelectAfterCharactersChanged() {
    const account = state.getActiveAccount();
    const hasToken = !!account?.sessionToken;
    if (!account?.name || (!account?.password && !hasToken)) {
      actions.showLogin();
      return;
    }
    if (state.getCharacters().length === 0) {
      actions.showCreate();
      return;
    }

    layout.ensureLayout();
    screenLoginEl.hidden = true;
    screenServersEl.hidden = true;
    screenCreateEl.hidden = true;
    screenSelectEl.hidden = false;

    btnBackSelect.hidden = true;
    btnCreate.hidden = true;
    btnGoCreate.hidden = false;
    btnGoServers.hidden = false;
    btnPlay.hidden = false;
    btnLanConnect.hidden = false;

    renderCharacters();

    const chosen = state.getSelectedCharacter();
    const classId = chosen?.classId || "archer";
    layout.setCarouselIds(layout.buildCarouselIdsForSelect());
    layout.ensureCarousel(layout.getCarouselIds());
    layout.setCarouselOrder(layout.getCarouselIds());
    if (
      state.getSelectedCharacterId() &&
      layout.getCarouselOrder().includes(state.getSelectedCharacterId())
    ) {
      layout.setCarouselOrder([
        state.getSelectedCharacterId(),
        ...layout
          .getCarouselOrder()
          .filter((id) => id !== state.getSelectedCharacterId()),
      ]);
    }
    layout.applyCarouselPositions();
    layout.setPreview(classId, { characterName: chosen?.name || null });
    layout.renderCarouselMeta();
  }

  function renderCharacters() {
    characterListEl.innerHTML = "";
    btnPlay.disabled = true;

    const characters = state.getCharacters();
    if (characters.length === 0) {
      state.setSelectedCharacterId(null);
      const empty = document.createElement("div");
      empty.textContent = "Aucun personnage. Cree-en un pour commencer.";
      empty.style.opacity = "0.85";
      characterListEl.appendChild(empty);
      return;
    }

    if (!state.getSelectedCharacterId() && characters[0] && characters[0].id) {
      state.setSelectedCharacterId(characters[0].id);
    }

    btnPlay.disabled = !state.getSelectedCharacterId();

    characters.forEach((c) => {
      const card = document.createElement("div");
      card.className = "character-card";
      if (c.id === state.getSelectedCharacterId()) {
        card.classList.add("is-selected");
      }

      const info = document.createElement("div");
      info.className = "character-info";

      const name = document.createElement("div");
      name.className = "character-name";
      name.textContent = c.name || "Joueur";

      const meta = document.createElement("div");
      meta.className = "character-meta";
      const classLabel = classes[c.classId]?.label || c.classId;
      meta.textContent = `${classLabel} - Niv. ${c.level ?? 1}`;

      info.appendChild(name);
      info.appendChild(meta);
      card.appendChild(info);

      const actionsWrap = document.createElement("div");
      actionsWrap.className = "character-actions";

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
          `Supprimer \"${label}\" ?\n\nCette action supprime le personnage cote serveur (irreversible).`
        );
        if (!ok) return;
        actions.deleteCharacter(c.id);
      });

      actionsWrap.appendChild(btnDelete);
      card.appendChild(actionsWrap);

      const applySelection = (shouldRender) => {
        state.setSelectedCharacterId(c.id);
        btnPlay.disabled = false;
        if (shouldRender) {
          renderCharacters();
        } else {
          const cards = characterListEl.querySelectorAll(".character-card");
          cards.forEach((node) => {
            node.classList.toggle("is-selected", node === card);
          });
        }
        layout.renderCarouselMeta();
        const classId = c.classId || "archer";
        layout.setCarouselIds(layout.buildCarouselIdsForSelect());
        layout.ensureCarousel(layout.getCarouselIds());
        layout.setCarouselOrder(layout.getCarouselIds());
        if (layout.getCarouselOrder().includes(c.id)) {
          layout.setCarouselOrder([
            c.id,
            ...layout.getCarouselOrder().filter((id) => id !== c.id),
          ]);
        }
        layout.applyCarouselPositions();
        layout.setPreview(classId, { characterName: c.name || "Joueur" });
      };

      card.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        applySelection(false);
      });

      card.addEventListener("dblclick", (event) => {
        event.preventDefault();
        event.stopPropagation();
        applySelection(false);
        actions.startGameWithCharacter(c);
      });

      characterListEl.appendChild(card);
    });
  }

  return {
    showSelect,
    refreshSelectAfterCharactersChanged,
    renderCharacters,
  };
}
