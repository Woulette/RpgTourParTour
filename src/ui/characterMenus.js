import { classes } from "../config/classes.js";

export function initCharacterMenus({ onStartGame }) {
  const overlayEl = document.getElementById("menu-overlay");
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

  const characters = [];
  let selectedCharacterId = null;
  let selectedClassId = null;

  const classDescriptions = {
    archer: "Attaques à distance, mobilité.",
    tank: "Résistant, contrôle de zone.",
    mage: "Dégâts magiques, effets.",
    assassin: "Burst au corps à corps, esquive.",
  };

  const getAvailableClassIds = () => Object.keys(classes);

  const showSelect = () => {
    screenCreateEl.hidden = true;
    screenSelectEl.hidden = false;
    document.body.classList.add("menu-open");
    renderCharacters();
  };

  const showCreate = () => {
    screenSelectEl.hidden = true;
    screenCreateEl.hidden = false;
    document.body.classList.add("menu-open");
    selectedClassId = null;
    inputName.value = "";
    renderClasses();
    syncCreateButton();
  };

  const openMenu = () => {
    document.body.classList.add("menu-open");
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
      meta.textContent = `${classLabel} • Niv. ${c.level ?? 1}`;

      card.appendChild(name);
      card.appendChild(meta);

      card.addEventListener("click", () => {
        selectedCharacterId = c.id;
        btnPlay.disabled = false;
        renderCharacters();
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
      desc.textContent = classDescriptions[id] || "Classe en développement.";

      card.appendChild(title);
      card.appendChild(desc);

      card.addEventListener("click", () => {
        selectedClassId = id;
        renderClasses();
        syncCreateButton();
      });

      classListEl.appendChild(card);
    });
  };

  const syncCreateButton = () => {
    btnCreate.disabled = !selectedClassId;
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

  // Boot: si aucun perso => création, sinon sélection.
  openMenu();

  return {
    openMenu,
    closeMenu,
    getCharacters: () => characters.slice(),
  };
}

