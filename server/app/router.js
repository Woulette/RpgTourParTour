function createRouterHandlers(ctx) {
  const {
    state,
    clients,
    send,
    broadcast,
    playerHandlers,
    combatHandlers,
    mobHandlers,
    resourceHandlers,
    debugCombatLog,
    isCmdDuplicate,
    isCmdRateLimited,
    isCmdSessionValid,
    sendMapSnapshotToClient,
    persistPlayerState,
    getHostId,
    setHostId,
    LAN_TRACE,
    COMBAT_RECONNECT_GRACE_MS,
  } = ctx;

  function handleMessage(ws, msg) {
    const clientInfo = clients.get(ws);
    if (!clientInfo) {
      if (msg?.t === "Hello") playerHandlers.handleHello(ws, msg);
      return;
    }

    if (msg?.t?.startsWith("Cmd")) {
      if (LAN_TRACE && msg.t === "CmdInventoryOp") {
        // Lightweight trace to confirm inventory ops reach the server.
        // eslint-disable-next-line no-console
        console.log("[LAN][Trace] CmdInventoryOp recv", {
          cmdId: msg.cmdId ?? null,
          playerId: msg.playerId ?? null,
          op: msg.op ?? null,
          itemId: msg.itemId ?? null,
          qty: msg.qty ?? null,
        });
      }
      if (isCmdDuplicate(clientInfo, msg.cmdId)) {
        debugCombatLog("Cmd drop: duplicate", {
          t: msg.t,
          cmdId: msg.cmdId,
          playerId: clientInfo.id,
        });
        return;
      }
      if (isCmdRateLimited(clientInfo, msg.t)) {
        debugCombatLog("Cmd drop: rate limited", {
          t: msg.t,
          cmdId: msg.cmdId ?? null,
          playerId: clientInfo.id,
        });
        return;
      }
      if (!isCmdSessionValid(clientInfo, msg)) {
        send(ws, { t: "EvRefuse", reason: "auth_required" });
        ws.close();
        return;
      }
    }

    switch (msg.t) {
      case "CmdAck": {
        const lastEventId = Number.isInteger(msg.lastEventId) ? msg.lastEventId : null;
        if (lastEventId !== null) {
          clientInfo.lastAckEventId = Math.max(
            clientInfo.lastAckEventId || 0,
            lastEventId
          );
        }
        break;
      }
      case "CmdEventReplay":
        break;
      case "CmdCombatReplay": {
        const combatId = Number.isInteger(msg.combatId) ? msg.combatId : null;
        const fromSeq = Number.isInteger(msg.fromSeq) ? msg.fromSeq : null;
        if (combatId !== null && fromSeq !== null) {
          const list = ctx.combatEventHistory.get(combatId) || [];
          list.filter((ev) => ev && ev.combatSeq >= fromSeq).forEach((ev) => send(ws, ev));
        }
        break;
      }
      case "CmdMove":
        playerHandlers.handleCmdMove(clientInfo, msg);
        break;
      case "CmdRequestMapPlayers":
        playerHandlers.handleCmdRequestMapPlayers(ws, clientInfo, msg);
        break;
      case "CmdPlayerSync":
        playerHandlers.handleCmdPlayerSync(clientInfo, msg);
        break;
      case "CmdInventoryOp":
        playerHandlers.handleCmdInventoryOp(ws, clientInfo, msg);
        break;
      case "CmdCraft":
        playerHandlers.handleCmdCraft(ws, clientInfo, msg);
        break;
      case "CmdGoldOp":
        playerHandlers.handleCmdGoldOp(ws, clientInfo, msg);
        break;
      case "CmdQuestAction":
        playerHandlers.handleCmdQuestAction(ws, clientInfo, msg);
        break;
      case "CmdChatMessage":
        playerHandlers.handleCmdChatMessage(clientInfo, msg);
        break;
      case "CmdWhisper":
        playerHandlers.handleCmdWhisper(clientInfo, msg);
        break;
      case "CmdGroupInvite":
        playerHandlers.handleCmdGroupInvite(clientInfo, msg);
        break;
      case "CmdGroupAccept":
        playerHandlers.handleCmdGroupAccept(clientInfo, msg);
        break;
      case "CmdGroupDecline":
        playerHandlers.handleCmdGroupDecline(clientInfo, msg);
        break;
      case "CmdGroupLeave":
        playerHandlers.handleCmdGroupLeave(clientInfo, msg);
        break;
      case "CmdGroupKick":
        playerHandlers.handleCmdGroupKick(clientInfo, msg);
        break;
      case "CmdGroupDisband":
        playerHandlers.handleCmdGroupDisband(clientInfo, msg);
        break;
      case "CmdLogout":
        ws.close();
        break;
      case "CmdFriendAdd":
        playerHandlers.handleCmdFriendAdd(clientInfo, msg);
        break;
      case "CmdFriendAddByName":
        playerHandlers.handleCmdFriendAddByName(clientInfo, msg);
        break;
      case "CmdFriendRemove":
        playerHandlers.handleCmdFriendRemove(clientInfo, msg);
        break;
      case "CmdIgnoreAccount":
        playerHandlers.handleCmdIgnoreAccount(clientInfo, msg);
        break;
      case "CmdFriendAccept":
        playerHandlers.handleCmdFriendAccept(clientInfo, msg);
        break;
      case "CmdFriendDecline":
        playerHandlers.handleCmdFriendDecline(clientInfo, msg);
        break;
      case "CmdIgnoreAdd":
        playerHandlers.handleCmdIgnoreAdd(clientInfo, msg);
        break;
      case "CmdMoveCombat":
        combatHandlers.handleCmdMoveCombat(clientInfo, msg);
        break;
      case "CmdCombatPlacement":
        combatHandlers.handleCmdCombatPlacement(clientInfo, msg);
        break;
      case "CmdMapMonsters":
        mobHandlers.handleCmdMapMonsters(ws, clientInfo, msg);
        break;
      case "CmdMapResources":
        resourceHandlers.handleCmdMapResources(ws, clientInfo, msg);
        break;
      case "CmdMobMoveStart":
        mobHandlers.handleCmdMobMoveStart(ws, clientInfo, msg);
        break;
      case "CmdMobDeath":
        mobHandlers.handleCmdMobDeath(ws, clientInfo, msg);
        break;
      case "CmdRequestMapMonsters":
        mobHandlers.handleCmdRequestMapMonsters(ws, clientInfo, msg);
        break;
      case "CmdRequestMapResources":
        resourceHandlers.handleCmdRequestMapResources(ws, clientInfo, msg);
        break;
      case "CmdResourceHarvest":
        resourceHandlers.handleCmdResourceHarvest(ws, clientInfo, msg);
        break;
      case "CmdMapChange":
        playerHandlers.handleCmdMapChange(clientInfo, msg);
        break;
      case "CmdCombatStart":
        combatHandlers.handleCmdCombatStart(ws, clientInfo, msg);
        break;
      case "CmdJoinCombat":
        combatHandlers.handleCmdJoinCombat(ws, clientInfo, msg);
        break;
      case "CmdGroupCombatJoin":
        combatHandlers.handleCmdGroupCombatJoin(ws, clientInfo, msg);
        break;
      case "CmdGroupCombatDecline":
        combatHandlers.handleCmdGroupCombatDecline(clientInfo, msg);
        break;
      case "CmdCombatReady":
        combatHandlers.handleCmdCombatReady(clientInfo, msg);
        break;
      case "CmdCombatEnd":
        combatHandlers.handleCmdCombatEnd(ws, clientInfo, msg);
        break;
      case "CmdCombatDamageApplied":
        debugCombatLog("CmdCombatDamageApplied recv", {
          cmdId: msg.cmdId ?? null,
          playerId: clientInfo.id,
          combatId: msg.combatId ?? null,
          source: msg.source ?? null,
          damage: msg.damage ?? null,
          targetX: msg.targetX ?? null,
          targetY: msg.targetY ?? null,
          targetKind: msg.targetKind ?? null,
          targetId: msg.targetId ?? null,
          targetIndex: msg.targetIndex ?? null,
          clientSeq: msg.clientSeq ?? null,
        });
        combatHandlers.handleCmdCombatDamageApplied(clientInfo, msg);
        break;
      case "CmdCombatState":
        combatHandlers.handleCmdCombatState(clientInfo, msg);
        break;
      case "CmdEndTurnCombat":
        combatHandlers.handleCmdEndTurnCombat(clientInfo, msg);
        break;
      case "CmdCombatMonsterMoveStart":
        combatHandlers.handleCmdCombatMonsterMoveStart(clientInfo, msg);
        break;
      case "CmdCombatChecksum":
        combatHandlers.handleCmdCombatChecksum(ws, clientInfo, msg);
        break;
      case "CmdEndTurn":
        playerHandlers.handleCmdEndTurn(clientInfo, msg);
        break;
      case "CmdCombatResync":
        playerHandlers.handleCmdCombatResync(clientInfo, msg);
        break;
      case "CmdMapResync": {
        if (clientInfo.id !== msg.playerId) break;
        const player = state.players[clientInfo.id];
        const mapId = typeof msg.mapId === "string" ? msg.mapId : null;
        if (!player || !mapId || player.mapId !== mapId) break;
        sendMapSnapshotToClient(ws, mapId);
        break;
      }
      case "CmdCastSpell":
        debugCombatLog("CmdCastSpell recv", {
          cmdId: msg.cmdId ?? null,
          playerId: clientInfo.id,
          combatId: msg.combatId ?? null,
          spellId: msg.spellId ?? null,
          targetX: msg.targetX ?? null,
          targetY: msg.targetY ?? null,
          targetKind: msg.targetKind ?? null,
          targetId: msg.targetId ?? null,
          targetIndex: msg.targetIndex ?? null,
        });
        combatHandlers.handleCmdCastSpell(clientInfo, msg);
        break;
      default:
        break;
    }
  }

  function handleClose(ws) {
    const clientInfo = clients.get(ws);
    if (!clientInfo) return;
    const player = state.players[clientInfo.id];
    if (player) {
      player.connected = false;
      persistPlayerState(player, { immediate: true });
    }
    if (typeof playerHandlers.handlePlayerDisconnect === "function") {
      playerHandlers.handlePlayerDisconnect(clientInfo.id);
    }
    clients.delete(ws);
    broadcast({
      t: "EvPlayerLeft",
      mapId: player?.mapId || null,
      playerId: clientInfo.id,
    });
    if (clientInfo.id === getHostId()) {
      const next = clients.values().next().value || null;
      setHostId(next ? next.id : null);
      if (getHostId()) {
        broadcast({ t: "EvHostChanged", hostId: getHostId() });
      }
    }
    if (player && Number.isInteger(player.combatId)) {
      const combat = state.combats[player.combatId];
      const participants = Array.isArray(combat?.participantIds)
        ? combat.participantIds
        : [];
      const anyConnected = participants.some((id) => state.players[id]?.connected);
      if (!anyConnected && combat) {
        if (!combat.pendingFinalizeTimer) {
          combat.pendingFinalizeAt = Date.now() + COMBAT_RECONNECT_GRACE_MS;
          combat.pendingFinalizeTimer = setTimeout(() => {
            const current = state.combats[combat.id];
            if (!current) return;
            const ids = Array.isArray(current.participantIds)
              ? current.participantIds
              : [];
            const stillConnected = ids.some((id) => state.players[id]?.connected);
            if (stillConnected) {
              current.pendingFinalizeTimer = null;
              current.pendingFinalizeAt = null;
              return;
            }
            current.pendingFinalizeTimer = null;
            current.pendingFinalizeAt = null;
            combatHandlers.finalizeCombat(current.id, "disconnect");
          }, COMBAT_RECONNECT_GRACE_MS);
        }
      }
    }
  }

  return {
    handleMessage,
    handleClose,
  };
}

module.exports = {
  createRouterHandlers,
};
