import { getNetClient, getNetPlayerId } from "../../app/session.js";

export function createCombatUiHandlers(ctx) {
  const {
    scene,
    activeCombats,
    combatJoinMarkers,
    getCurrentMapKey,
    getCurrentMapObj,
    getCurrentGroundLayer,
    isSceneReady,
  } = ctx;

  const combatWatchButton =
    typeof document !== "undefined"
      ? document.getElementById("hud-combat-watch")
      : null;
  const combatWatchCountEl =
    typeof document !== "undefined"
      ? document.getElementById("hud-combat-count")
      : null;

  const setCombatWatchOpen = (open) => {
    if (typeof document === "undefined" || !combatWatchButton) return;
    document.body.classList.toggle("hud-combat-watch-open", !!open);
    combatWatchButton.setAttribute("aria-pressed", open ? "true" : "false");
    combatWatchButton.title = open ? "Fermer le combat" : "Voir le combat";
    scene.__lanCombatWatchOpen = !!open;
  };

  const removeCombatJoinMarker = (combatId) => {
    const marker = combatJoinMarkers.get(combatId);
    if (!marker) return;
    if (marker.destroy) marker.destroy();
    combatJoinMarkers.delete(combatId);
  };

  const clearCombatJoinMarkers = () => {
    combatJoinMarkers.forEach((marker) => {
      if (marker?.destroy) marker.destroy();
    });
    combatJoinMarkers.clear();
  };

  const shouldShowCombatJoinMarker = (entry) => {
    if (!entry || !Number.isInteger(entry.combatId)) return false;
    if (entry.phase !== "prep") return false;
    if (scene.combatState?.enCours || scene.prepState?.actif) return false;
    const localId = getNetPlayerId();
    if (!localId) return false;
    const participantIds = Array.isArray(entry.participantIds)
      ? entry.participantIds
      : [];
    if (participantIds.includes(localId)) return false;
    const currentMap = getCurrentMapKey();
    if (!currentMap || entry.mapId !== currentMap) return false;
    if (!Number.isInteger(entry.tileX) || !Number.isInteger(entry.tileY)) return false;
    return true;
  };

  const createCombatJoinMarker = (entry) => {
    if (!isSceneReady()) return;
    if (!scene.textures?.exists || !scene.textures.exists("combat_join")) return;
    const currentMap = getCurrentMapObj();
    const currentLayer = getCurrentGroundLayer();
    if (!currentMap || !currentLayer) return;

    const wp = currentMap.tileToWorldXY(
      entry.tileX,
      entry.tileY,
      undefined,
      undefined,
      currentLayer
    );
    if (!wp) return;
    const x = wp.x + currentMap.tileWidth / 2;
    const y = wp.y + currentMap.tileHeight / 2;
    const marker = scene.add.image(x, y, "combat_join");
    marker.setDepth(marker.y);
    marker.setInteractive({ useHandCursor: true });
    marker.on("pointerdown", () => {
      if (scene.combatState?.enCours || scene.prepState?.actif) return;
      const client = getNetClient();
      if (!client) return;
      const playerId = getNetPlayerId();
      if (!playerId) return;
      client.sendCmd("CmdJoinCombat", {
        playerId,
        combatId: entry.combatId,
      });
    });
    combatJoinMarkers.set(entry.combatId, marker);
  };

  const refreshCombatJoinMarkers = () => {
    if (!isSceneReady()) return;
    const currentMap = getCurrentMapKey();
    combatJoinMarkers.forEach((marker, combatId) => {
      const entry = activeCombats.get(combatId) || null;
      if (!entry || entry.mapId !== currentMap || !shouldShowCombatJoinMarker(entry)) {
        if (marker?.destroy) marker.destroy();
        combatJoinMarkers.delete(combatId);
      }
    });
    activeCombats.forEach((entry) => {
      if (!shouldShowCombatJoinMarker(entry)) return;
      if (combatJoinMarkers.has(entry.combatId)) return;
      createCombatJoinMarker(entry);
    });
  };

  const updateCombatWatchUi = () => {
    const currentMap = getCurrentMapKey();
    const combatsOnMap = Array.from(activeCombats.values()).filter(
      (entry) => entry && entry.mapId === currentMap
    );
    const count = combatsOnMap.length;
    if (typeof document !== "undefined" && combatWatchButton) {
      document.body.classList.toggle("hud-combat-watch-available", count > 0);
      if (combatWatchCountEl) {
        combatWatchCountEl.textContent = String(count);
      }
      if (count === 0) {
        setCombatWatchOpen(false);
      }
    }
    refreshCombatJoinMarkers();
  };

  const initCombatWatchUi = () => {
    if (!combatWatchButton) return;
    combatWatchButton.addEventListener("click", (event) => {
      event.stopPropagation();
      const available = document.body.classList.contains("hud-combat-watch-available");
      if (!available) return;
      const willOpen = !document.body.classList.contains("hud-combat-watch-open");
      setCombatWatchOpen(willOpen);
    });
  };

  return {
    initCombatWatchUi,
    updateCombatWatchUi,
    clearCombatJoinMarkers,
    removeCombatJoinMarker,
  };
}
