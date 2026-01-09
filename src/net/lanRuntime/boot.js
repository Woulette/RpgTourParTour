import { getNetClient, getNetPlayerId } from "../../app/session.js";

export function createLanBootHandlers(ctx) {
  const { player, mobs, resources, players, ui, getCurrentMapKey } = ctx;

  const sendMapChange = () => {
    const client = getNetClient();
    if (!client) return;
    const playerId = getNetPlayerId();
    if (!playerId) return;
    const currentMap = getCurrentMapKey();
    if (!currentMap) return;
    if (
      !Number.isInteger(player?.currentTileX) ||
      !Number.isInteger(player?.currentTileY)
    ) {
      return;
    }
    client.sendCmd("CmdMapChange", {
      playerId,
      mapId: currentMap,
      tileX: player.currentTileX,
      tileY: player.currentTileY,
    });
  };

  const sendMapResync = () => {
    const client = getNetClient();
    if (!client) return;
    const playerId = getNetPlayerId();
    if (!playerId) return;
    const currentMap = getCurrentMapKey();
    if (!currentMap) return;
    client.sendCmd("CmdMapResync", {
      playerId,
      mapId: currentMap,
    });
  };

  const initialSync = () => {
    const client = getNetClient();
    if (!client) return;
    const playerId = getNetPlayerId();
    if (!playerId) return;
    if (!Number.isInteger(player?.currentTileX) || !Number.isInteger(player?.currentTileY)) {
      return;
    }
    client.sendCmd("CmdMove", {
      playerId,
      toX: player.currentTileX,
      toY: player.currentTileY,
    });
    sendMapChange();
    sendMapResync();
    players.requestMapPlayers();
    mobs.sendMapMonstersSnapshot();
    mobs.requestMapMonsters();
    resources.sendMapResourcesSnapshot();
    resources.requestMapResources();
  };

  const handleMapChanged = (payload) => {
    if (!payload?.mapKey) return;
    sendMapChange();
    sendMapResync();
    players.refreshRemoteSprites();
    players.requestMapPlayers();
    mobs.sendMapMonstersSnapshot();
    mobs.requestMapMonsters();
    resources.clearResourceNodes();
    resources.sendMapResourcesSnapshot();
    resources.requestMapResources();
    mobs.updateHostMobScheduler();
    ui.clearCombatJoinMarkers();
    ui.updateCombatWatchUi();
  };

  return {
    sendMapChange,
    initialSync,
    handleMapChanged,
  };
}
