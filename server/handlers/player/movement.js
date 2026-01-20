function createMovementHandlers({
  state,
  broadcast,
  send,
  ensureMapInitialized,
  persistPlayerState,
  getNextEventId,
  tryStartCombatIfNeeded,
  onPlayerTradeCancel,
}) {
  function findPathOnGrid(startX, startY, endX, endY, meta, blocked, allowDiagonal, maxSteps) {
    if (!meta) return null;
    if (startX === endX && startY === endY) return [];
    const width = meta.width;
    const height = meta.height;
    if (
      startX < 0 ||
      startY < 0 ||
      endX < 0 ||
      endY < 0 ||
      startX >= width ||
      startY >= height ||
      endX >= width ||
      endY >= height
    ) {
      return null;
    }
    if (blocked && blocked.has(`${endX},${endY}`)) return null;

    const dirs4 = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];
    const dirs8 = [
      ...dirs4,
      { dx: 1, dy: 1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: 1 },
      { dx: -1, dy: -1 },
    ];
    const dirs = allowDiagonal ? dirs8 : dirs4;

    const key = (x, y) => `${x},${y}`;
    const visited = new Set([key(startX, startY)]);
    const prev = new Map();
    const queue = [{ x: startX, y: startY }];
    let qi = 0;

    while (qi < queue.length) {
      const current = queue[qi++];
      for (const { dx, dy } of dirs) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const k = key(nx, ny);
        if (visited.has(k)) continue;
        if (blocked && blocked.has(k)) continue;
        if (dx !== 0 && dy !== 0) {
          const sideA = `${current.x + dx},${current.y}`;
          const sideB = `${current.x},${current.y + dy}`;
          if (blocked && (blocked.has(sideA) || blocked.has(sideB))) {
            continue;
          }
        }
        visited.add(k);
        prev.set(k, current);
        if (nx === endX && ny === endY) {
          const path = [{ x: nx, y: ny }];
          let back = current;
          while (back && !(back.x === startX && back.y === startY)) {
            path.push({ x: back.x, y: back.y });
            back = prev.get(key(back.x, back.y));
          }
          path.reverse();
          if (Number.isInteger(maxSteps) && path.length > maxSteps) {
            return null;
          }
          return path;
        }
        if (
          Number.isInteger(maxSteps) &&
          Math.abs(nx - startX) + Math.abs(ny - startY) > maxSteps
        ) {
          continue;
        }
        queue.push({ x: nx, y: ny });
      }
    }

    return null;
  }

  function handleCmdMove(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    if (!Number.isInteger(msg.toX) || !Number.isInteger(msg.toY)) return;

    const player = state.players[clientInfo.id];
    if (!player) return;
    if (Number.isInteger(player.tradeId)) {
      return;
    }
    const seq = Number.isInteger(msg.seq) ? msg.seq : 0;
    const mapId = player.mapId;
    if (msg?.debug === true) {
      // eslint-disable-next-line no-console
      console.log("[LAN] CmdMove", {
        playerId: player.id,
        mapId,
        seq,
        fromX: msg.fromX,
        fromY: msg.fromY,
        toX: msg.toX,
        toY: msg.toY,
      });
    }
    const sendMoveCorrection = (reason, details) => {
      broadcast({
        t: "EvMoveStart",
        seq,
        playerId: player.id,
        mapId,
        fromX: Number.isInteger(player.x) ? player.x : 0,
        fromY: Number.isInteger(player.y) ? player.y : 0,
        toX: Number.isInteger(player.x) ? player.x : 0,
        toY: Number.isInteger(player.y) ? player.y : 0,
        path: [],
        rejected: true,
        reason,
        ...(details || null),
      });
    };

    if (player.inCombat) {
      sendMoveCorrection("in_combat");
      return;
    }
    if (seq <= (player.lastMoveSeq || 0)) {
      if (msg?.debug === true) {
        // eslint-disable-next-line no-console
        console.log("[LAN] CmdMove drop (seq)", {
          playerId: player.id,
          mapId,
          seq,
          lastMoveSeq: player.lastMoveSeq || 0,
        });
      }
      sendMoveCorrection("seq_out_of_order", {
        serverLastMoveSeq: player.lastMoveSeq || 0,
        clientSeq: seq,
      });
      return;
    }
    player.lastMoveSeq = seq;
    player.lastMoveAt = 0;

    const meta = mapId ? state.mapMeta[mapId] : null;
    const blocked = mapId ? state.mapCollisions?.[mapId] : null;
    if (!meta || !Number.isInteger(meta.width) || !Number.isInteger(meta.height)) {
      if (typeof ensureMapInitialized === "function" && mapId) {
        ensureMapInitialized(mapId);
      }
      sendMoveCorrection("map_not_ready");
      return;
    }

    const MAX_PATH_STEPS = 200;
    const MIN_MOVE_MS = 120;
    const now = Date.now();
    const cmdFromX = Number.isInteger(msg.fromX) ? msg.fromX : null;
    const cmdFromY = Number.isInteger(msg.fromY) ? msg.fromY : null;
    if (
      cmdFromX !== null &&
      cmdFromY !== null &&
      cmdFromX >= 0 &&
      cmdFromY >= 0 &&
      cmdFromX < meta.width &&
      cmdFromY < meta.height
    ) {
      const dx = Math.abs(cmdFromX - player.x);
      const dy = Math.abs(cmdFromY - player.y);
      const dist = dx + dy;
      const MAX_DESYNC_TILES = 200;
      if (dist > 0 && dist <= MAX_DESYNC_TILES) {
        player.x = cmdFromX;
        player.y = cmdFromY;
      }
    }

    const prevX = Number.isInteger(player.x) ? player.x : null;
    const prevY = Number.isInteger(player.y) ? player.y : null;
    if (prevX === null || prevY === null) {
      sendMoveCorrection("invalid_position");
      return;
    }

    const from = { x: player.x, y: player.y };
    const targetX = msg.toX;
    const targetY = msg.toY;
    if (
      targetX < 0 ||
      targetY < 0 ||
      targetX >= meta.width ||
      targetY >= meta.height
    ) {
      sendMoveCorrection("out_of_bounds");
      return;
    }
    if (blocked && blocked.has(`${targetX},${targetY}`)) {
      sendMoveCorrection("blocked_target");
      return;
    }

    const serverPath = findPathOnGrid(
      from.x,
      from.y,
      targetX,
      targetY,
      meta,
      blocked,
      true,
      MAX_PATH_STEPS
    );
    if (!serverPath) {
      sendMoveCorrection("no_path");
      return;
    }

    const lastMoveAt = Number.isFinite(player.lastMoveAt) ? player.lastMoveAt : 0;
    if (lastMoveAt && now - lastMoveAt < MIN_MOVE_MS) {
      sendMoveCorrection("rate_limited");
      return;
    }

    player.x = targetX;
    player.y = targetY;
    player.lastMoveAt = now;

    broadcast({
      t: "EvMoveStart",
      seq,
      playerId: player.id,
      mapId,
      fromX: from.x,
      fromY: from.y,
      toX: player.x,
      toY: player.y,
      path: serverPath,
    });

    if (typeof tryStartCombatIfNeeded === "function") {
      tryStartCombatIfNeeded();
    }
  }

  function handleCmdMapChange(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const mapId = typeof msg.mapId === "string" ? msg.mapId : null;
    if (!mapId) return;

    const player = state.players[clientInfo.id];
    if (!player) return;
    if (player.inCombat) return;
    if (Number.isInteger(player.tradeId)) {
      if (typeof onPlayerTradeCancel === "function") {
        onPlayerTradeCancel(player.id, "map_change");
      }
    }

    const fromMapId = player.mapId;
    player.mapId = mapId;

    if (Number.isInteger(msg.tileX) && Number.isInteger(msg.tileY)) {
      player.x = msg.tileX;
      player.y = msg.tileY;
    }
    if (typeof persistPlayerState === "function") {
      persistPlayerState(player);
    }

    broadcast({
      t: "EvPlayerMap",
      playerId: player.id,
      mapId: player.mapId,
      fromMapId: typeof fromMapId === "string" ? fromMapId : null,
      tileX: player.x,
      tileY: player.y,
    });

    ensureMapInitialized(mapId);
  }

  function handleCmdRequestMapPlayers(ws, clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const player = state.players[clientInfo.id];
    if (!player) return;
    const mapId = typeof msg.mapId === "string" ? msg.mapId : null;
    if (!mapId || player.mapId !== mapId) return;
    const list = Object.values(state.players)
      .filter((p) => p && p.connected !== false && p.mapId === mapId)
      .map((p) => ({
        id: p.id,
        mapId: p.mapId,
        x: Number.isFinite(p.x) ? p.x : 0,
        y: Number.isFinite(p.y) ? p.y : 0,
        classId: p.classId || null,
        displayName: p.displayName || null,
        inCombat: p.inCombat === true,
        combatId: Number.isInteger(p.combatId) ? p.combatId : null,
      }));
    send(ws, {
      t: "EvMapPlayers",
      eventId: getNextEventId(),
      mapId,
      players: list,
    });
  }

  return {
    handleCmdMove,
    handleCmdMapChange,
    handleCmdRequestMapPlayers,
  };
}

module.exports = {
  createMovementHandlers,
};
