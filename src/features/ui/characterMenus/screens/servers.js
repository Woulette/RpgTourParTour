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
    btnServersLogout,
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

      const header = document.createElement("div");
      header.className = "server-header";

      const name = document.createElement("div");
      name.className = "server-name";
      name.textContent = server.name || server.id;

      const status = document.createElement("div");
      status.className = "server-status";
      status.dataset.status = server.status || "online";
      status.textContent = server.status || "online";

      header.appendChild(name);
      header.appendChild(status);

      const meta = document.createElement("div");
      meta.className = "server-meta";
      meta.textContent = server.url || "";

      const stats = document.createElement("div");
      stats.className = "server-stats";
      stats.innerHTML = `
        <div class="server-stat">
          <span class="server-stat-label">Ping</span>
          <span class="server-stat-value">${server.ping ?? "--"} ms</span>
        </div>
        <div class="server-stat">
          <span class="server-stat-label">Population</span>
          <span class="server-stat-value">${server.population ?? "--"}</span>
        </div>
      `;

      card.appendChild(header);
      card.appendChild(meta);
      card.appendChild(stats);

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
    // Pas d'auto-connexion: on laisse l'utilisateur valider le serveur.
  }

  function attachServersEvents() {
    if (btnServersLogout) {
      btnServersLogout.addEventListener("click", () => {
        if (typeof actions.logoutAccount === "function") {
          actions.logoutAccount();
        } else {
          actions.showLogin();
        }
      });
    }
    btnServersContinue.addEventListener("click", () => {
      if (!state.getSelectedServerId()) return;
      if (typeof actions.connectAccount === "function") {
        actions.connectAccount();
        return;
      }
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
