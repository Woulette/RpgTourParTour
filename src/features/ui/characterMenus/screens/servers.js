export function createServersScreen({
  elements,
  state,
  actions,
  ensureLayout,
}) {
  const {
    screenLoginEl,
    screenServersEl,
    screenSelectEl,
    screenCreateEl,
    btnServersBack,
    btnServersContinue,
    serverListEl,
  } = elements;

  function renderServers() {
    const servers = state.getServers();
    serverListEl.innerHTML = "";

    servers.forEach((server) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "server-card";
      card.dataset.serverId = server.id;
      if (server.id === state.getSelectedServerId()) {
        card.classList.add("is-selected");
      }

      const name = document.createElement("div");
      name.className = "server-name";
      name.textContent = server.name || server.id;

      const meta = document.createElement("div");
      meta.className = "server-meta";
      meta.textContent = server.url || "";

      card.appendChild(name);
      card.appendChild(meta);

      card.addEventListener("click", () => {
        state.setSelectedServerId(server.id);
        renderServers();
        btnServersContinue.disabled = false;
      });

      serverListEl.appendChild(card);
    });
  }

  function showServers() {
    ensureLayout();
    screenLoginEl.hidden = true;
    screenSelectEl.hidden = true;
    screenCreateEl.hidden = true;
    screenServersEl.hidden = false;
    document.body.classList.add("menu-open");
    document.body.classList.add("menu-servers");
    document.body.classList.remove("menu-login");

    renderServers();
    btnServersContinue.disabled = !state.getSelectedServerId();
  }

  function attachServersEvents() {
    btnServersBack.addEventListener("click", () => actions.showLogin());
    btnServersContinue.addEventListener("click", () => {
      if (!state.getSelectedServerId()) return;
      if (state.getCharactersLength() === 0) actions.showCreate();
      else actions.showSelect();
    });
  }

  return {
    showServers,
    renderServers,
    attachServersEvents,
  };
}
