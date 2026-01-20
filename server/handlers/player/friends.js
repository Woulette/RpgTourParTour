function createFriendHandlers({
  state,
  accountStore,
  characterStore,
  sendToPlayerId,
  getNextEventId,
}) {
  const FRIEND_INVITE_TTL_MS = 45000;

  const findOnlinePlayerByAccountId = (accountId) => {
    if (!accountId) return null;
    return Object.values(state.players).find(
      (p) => p && p.accountId === accountId && p.connected !== false
    );
  };

  const getInviteBucket = (accountId) => {
    if (!accountId) return null;
    if (!state.friendInvites[accountId]) {
      state.friendInvites[accountId] = {};
    }
    return state.friendInvites[accountId];
  };

  const sendInviteResult = (playerId, status, targetAccountId, targetName) => {
    if (!sendToPlayerId || !playerId) return;
    sendToPlayerId(playerId, {
      t: "EvFriendInviteResult",
      eventId: getNextEventId ? getNextEventId() : null,
      status,
      targetAccountId: targetAccountId || null,
      targetName: targetName || null,
    });
  };

  const buildEntry = (accountId) => {
    if (!accountId) return null;
    const onlinePlayer = findOnlinePlayerByAccountId(accountId);
    if (onlinePlayer) {
      const level =
        Number.isInteger(onlinePlayer.level) ? onlinePlayer.level : null;
      const honorPoints = Number.isFinite(onlinePlayer.honorPoints)
        ? onlinePlayer.honorPoints
        : null;
      return {
        accountId,
        playerId: onlinePlayer.id,
        displayName:
          onlinePlayer.displayName || onlinePlayer.name || `Joueur ${onlinePlayer.id}`,
        level,
        honorPoints,
        online: true,
      };
    }
    const stored = characterStore?.getCharacterByAccountId
      ? characterStore.getCharacterByAccountId(accountId)
      : null;
    if (!stored) {
      return {
        accountId,
        displayName: "Joueur",
        level: null,
        online: false,
      };
    }
    return {
      accountId,
      displayName: stored.name || "Joueur",
      level: Number.isInteger(stored.level) ? stored.level : null,
      honorPoints: Number.isFinite(stored.honorPoints) ? stored.honorPoints : null,
      online: false,
    };
  };

  const sendFriendsSync = (playerId) => {
    const player = state.players[playerId];
    if (!player || !player.accountId || !sendToPlayerId) return;
    const friends = accountStore?.getFriends
      ? accountStore.getFriends(player.accountId)
      : [];
    const ignored = accountStore?.getIgnored
      ? accountStore.getIgnored(player.accountId)
      : [];
    const payload = {
      t: "EvFriendsSync",
      eventId: getNextEventId ? getNextEventId() : null,
      friends: friends.map(buildEntry).filter(Boolean),
      ignored: ignored.map(buildEntry).filter(Boolean),
    };
    sendToPlayerId(playerId, payload);
  };

  const notifyFriendsOfAccount = (accountId) => {
    if (!accountId || !accountStore?.getFriends) return;
    const list = accountStore.getFriends(accountId);
    const reverse = accountStore.getFriendsOf ? accountStore.getFriendsOf(accountId) : [];
    const targets = new Set([...(list || []), ...(reverse || [])]);
    targets.forEach((friendAccountId) => {
      const onlineFriend = findOnlinePlayerByAccountId(friendAccountId);
      if (onlineFriend) {
        sendFriendsSync(onlineFriend.id);
      }
    });
  };

  const normalizeName = (raw) => String(raw || "").trim().toLowerCase();

  const findOnlinePlayerByName = (name) => {
    if (!name) return null;
    const normalized = normalizeName(name);
    if (!normalized) return null;
    return Object.values(state.players).find((p) => {
      if (!p || p.connected === false) return false;
      const display = normalizeName(p.displayName || p.name || "");
      return display === normalized;
    });
  };

  const sendFriendInvite = (player, target) => {
    if (!player || !target || !player.accountId || !target.accountId) return;
    if (player.accountId === target.accountId) return;

    const existing = accountStore?.getFriends
      ? accountStore.getFriends(player.accountId)
      : [];
    if (existing.includes(target.accountId)) {
      sendInviteResult(player.id, "already_friends", target.accountId, target.name);
      return;
    }
    if (accountStore?.isIgnored?.(target.accountId, player.accountId)) {
      sendInviteResult(player.id, "blocked", target.accountId, target.name);
      return;
    }

    const targetOnline = findOnlinePlayerByAccountId(target.accountId);
    if (!targetOnline) {
      sendInviteResult(player.id, "offline", target.accountId, target.name);
      return;
    }

    const bucket = getInviteBucket(target.accountId);
    if (!bucket) return;
    bucket[player.accountId] = {
      inviterAccountId: player.accountId,
      inviterPlayerId: player.id,
      inviterName: player.displayName || player.name || `Joueur ${player.id}`,
      createdAt: Date.now(),
    };

    accountStore?.removeIgnored?.(player.accountId, target.accountId);

    if (sendToPlayerId) {
      sendToPlayerId(targetOnline.id, {
        t: "EvFriendInvite",
        eventId: getNextEventId ? getNextEventId() : null,
        inviterAccountId: player.accountId,
        inviterName: player.displayName || player.name || `Joueur ${player.id}`,
      });
    }
  };

  function handleCmdFriendAdd(clientInfo, msg) {
    if (!clientInfo || clientInfo.id !== msg.playerId) return;
    const targetId = Number(msg.targetId);
    if (!Number.isInteger(targetId)) return;
    const player = state.players[clientInfo.id];
    const target = state.players[targetId];
    if (!player || !target || !player.accountId || !target.accountId) return;
    sendFriendInvite(player, target);
  }

  function handleCmdFriendAddByName(clientInfo, msg) {
    if (!clientInfo || clientInfo.id !== msg.playerId) return;
    const rawName = msg.targetName || msg.name || null;
    const player = state.players[clientInfo.id];
    if (!player?.accountId) return;
    const normalized = normalizeName(rawName);
    if (!normalized) return;

    const onlineTarget = findOnlinePlayerByName(normalized);
    if (onlineTarget) {
      sendFriendInvite(player, onlineTarget);
      return;
    }

    const stored = characterStore?.getCharacterByName
      ? characterStore.getCharacterByName(normalized)
      : null;
    if (!stored || !stored.accountId) {
      sendInviteResult(clientInfo.id, "not_found", null, rawName);
      return;
    }

    sendInviteResult(clientInfo.id, "offline", stored.accountId, stored.name);
  }

  function handleCmdIgnoreAdd(clientInfo, msg) {
    if (!clientInfo || clientInfo.id !== msg.playerId) return;
    const targetId = Number(msg.targetId);
    if (!Number.isInteger(targetId)) return;
    const player = state.players[clientInfo.id];
    const target = state.players[targetId];
    if (!player || !target || !player.accountId || !target.accountId) return;

    accountStore?.addIgnored?.(player.accountId, target.accountId);
    accountStore?.removeFriend?.(player.accountId, target.accountId);
    accountStore?.removeFriend?.(target.accountId, player.accountId);
    sendFriendsSync(clientInfo.id);
    notifyFriendsOfAccount(player.accountId);
  }

  function handleCmdIgnoreAccount(clientInfo, msg) {
    if (!clientInfo || clientInfo.id !== msg.playerId) return;
    const targetAccountId = msg.targetAccountId || msg.accountId || null;
    const player = state.players[clientInfo.id];
    if (!player?.accountId || !targetAccountId) return;
    if (player.accountId === targetAccountId) return;

    accountStore?.addIgnored?.(player.accountId, targetAccountId);
    accountStore?.removeFriend?.(player.accountId, targetAccountId);
    accountStore?.removeFriend?.(targetAccountId, player.accountId);
    sendFriendsSync(clientInfo.id);
    notifyFriendsOfAccount(player.accountId);
    const targetOnline = findOnlinePlayerByAccountId(targetAccountId);
    if (targetOnline) {
      sendFriendsSync(targetOnline.id);
    }
  }

  function handleCmdFriendRemove(clientInfo, msg) {
    if (!clientInfo || clientInfo.id !== msg.playerId) return;
    const targetAccountId = msg.targetAccountId || msg.accountId || null;
    const player = state.players[clientInfo.id];
    if (!player?.accountId || !targetAccountId) return;
    if (player.accountId === targetAccountId) return;

    accountStore?.removeFriend?.(player.accountId, targetAccountId);
    accountStore?.removeFriend?.(targetAccountId, player.accountId);
    sendFriendsSync(clientInfo.id);
    notifyFriendsOfAccount(player.accountId);
    const targetOnline = findOnlinePlayerByAccountId(targetAccountId);
    if (targetOnline) {
      sendFriendsSync(targetOnline.id);
    }
  }

  function handleCmdFriendAccept(clientInfo, msg) {
    if (!clientInfo || clientInfo.id !== msg.playerId) return;
    const inviterAccountId = msg.inviterAccountId || msg.accountId || null;
    if (!inviterAccountId) return;
    const player = state.players[clientInfo.id];
    if (!player?.accountId) return;

    const bucket = getInviteBucket(player.accountId);
    const invite = bucket ? bucket[inviterAccountId] : null;
    if (!invite) return;
    if (Date.now() - invite.createdAt > FRIEND_INVITE_TTL_MS) {
      delete bucket[inviterAccountId];
      return;
    }
    delete bucket[inviterAccountId];

    accountStore?.addFriend?.(player.accountId, inviterAccountId);
    accountStore?.addFriend?.(inviterAccountId, player.accountId);
    accountStore?.removeIgnored?.(player.accountId, inviterAccountId);
    accountStore?.removeIgnored?.(inviterAccountId, player.accountId);

    sendFriendsSync(clientInfo.id);
    const inviterOnline = findOnlinePlayerByAccountId(inviterAccountId);
    if (inviterOnline) {
      sendFriendsSync(inviterOnline.id);
      sendInviteResult(inviterOnline.id, "accepted", player.accountId, player.name);
    }
  }

  function handleCmdFriendDecline(clientInfo, msg) {
    if (!clientInfo || clientInfo.id !== msg.playerId) return;
    const inviterAccountId = msg.inviterAccountId || msg.accountId || null;
    if (!inviterAccountId) return;
    const player = state.players[clientInfo.id];
    if (!player?.accountId) return;

    const bucket = getInviteBucket(player.accountId);
    const invite = bucket ? bucket[inviterAccountId] : null;
    if (!invite) return;
    delete bucket[inviterAccountId];

    const inviterOnline = findOnlinePlayerByAccountId(inviterAccountId);
    if (inviterOnline) {
      sendInviteResult(inviterOnline.id, "declined", player.accountId, player.name);
    }
  }

  function handlePlayerConnected(playerId) {
    const player = state.players[playerId];
    if (!player?.accountId) return;
    sendFriendsSync(playerId);
    notifyFriendsOfAccount(player.accountId);
  }

  function handlePlayerDisconnect(playerId) {
    const player = state.players[playerId];
    if (!player?.accountId) return;
    notifyFriendsOfAccount(player.accountId);
  }

  return {
    handleCmdFriendAdd,
    handleCmdFriendAddByName,
    handleCmdIgnoreAdd,
    handleCmdIgnoreAccount,
    handleCmdFriendAccept,
    handleCmdFriendDecline,
    handleCmdFriendRemove,
    handlePlayerConnected,
    handlePlayerDisconnect,
    sendFriendsSync,
  };
}

module.exports = {
  createFriendHandlers,
};
