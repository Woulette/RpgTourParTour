const GROUP_INVITE_TTL_MS = 60000;

function createGroupHandlers(ctx) {
  const {
    state,
    sendToPlayerId,
    getNextEventId,
    getNextGroupId,
    accountStore,
  } = ctx;

  const getGroup = (groupId) => state.groups[groupId] || null;
  const lastHpByPlayerId = new Map();

  const toFinite = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const readHpPair = (player) => {
    if (!player) return { hp: null, hpMax: null };
    const hpMax =
      toFinite(player.hpMax) ??
      toFinite(player.stats?.hpMax) ??
      toFinite(player.stats?.hp);
    const hp = toFinite(player.hp) ?? toFinite(player.stats?.hp) ?? hpMax;
    return { hp, hpMax };
  };

  const buildMemberPayload = (playerId) => {
    const p = state.players[playerId];
    if (!p) return null;
    const { hp, hpMax } = readHpPair(p);
    return {
      id: p.id,
      displayName: p.displayName || null,
      classId: p.classId || null,
      mapId: p.mapId || null,
      inCombat: p.inCombat === true,
      hp,
      hpMax,
    };
  };

  const buildGroupPayload = (group) => {
    if (!group) return null;
    const members = Array.isArray(group.memberIds)
      ? group.memberIds.map(buildMemberPayload).filter(Boolean)
      : [];
    return {
      id: group.id,
      leaderId: group.leaderId,
      members,
    };
  };

  const sendGroupUpdate = (group) => {
    const payload = buildGroupPayload(group);
    if (!payload) return;
    const eventId = getNextEventId ? getNextEventId() : null;
    group.memberIds.forEach((id) => {
      sendToPlayerId(id, {
        t: "EvGroupUpdate",
        eventId,
        group: payload,
      });
    });
  };

  const sendGroupDisband = (memberIds, groupId) => {
    const eventId = getNextEventId ? getNextEventId() : null;
    memberIds.forEach((id) => {
      sendToPlayerId(id, {
        t: "EvGroupDisband",
        eventId,
        groupId,
      });
    });
  };

  const ensureGroupForLeader = (leaderId) => {
    const existingId = state.playerGroups[leaderId];
    if (existingId) return getGroup(existingId);
    const groupId = getNextGroupId();
    const group = {
      id: groupId,
      leaderId,
      memberIds: [leaderId],
      createdAt: Date.now(),
    };
    state.groups[groupId] = group;
    state.playerGroups[leaderId] = groupId;
    return group;
  };

  const removeInvite = (playerId) => {
    if (state.groupInvites[playerId]) {
      delete state.groupInvites[playerId];
    }
  };

  function handleCmdGroupInvite(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const targetId = Number(msg.targetId);
    if (!Number.isInteger(targetId)) return;
    if (targetId === clientInfo.id) return;
    const target = state.players[targetId];
    if (!target || target.connected === false) return;
    const inviter = state.players[clientInfo.id];
    if (!inviter) return;
    if (
      accountStore?.isIgnored &&
      target.accountId &&
      inviter.accountId &&
      accountStore.isIgnored(target.accountId, inviter.accountId)
    ) {
      return;
    }
    if (state.playerGroups[targetId]) return;

    const group = ensureGroupForLeader(clientInfo.id);
    if (!group) return;
    if (group.leaderId !== clientInfo.id) return;

    const invite = {
      groupId: group.id,
      inviterId: clientInfo.id,
      mapId: inviter.mapId || null,
      createdAt: Date.now(),
      expiresAt: Date.now() + GROUP_INVITE_TTL_MS,
    };
    state.groupInvites[targetId] = invite;
    sendToPlayerId(targetId, {
      t: "EvGroupInvite",
      eventId: getNextEventId ? getNextEventId() : null,
      groupId: invite.groupId,
      inviterId: invite.inviterId,
      inviterName: inviter.displayName || null,
      mapId: invite.mapId,
      expiresAt: invite.expiresAt,
    });
  }

  function handleCmdGroupAccept(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const invite = state.groupInvites[clientInfo.id];
    if (!invite) return;
    if (Date.now() > invite.expiresAt) {
      removeInvite(clientInfo.id);
      return;
    }
    const group = getGroup(invite.groupId);
    if (!group) {
      removeInvite(clientInfo.id);
      return;
    }
    if (!group.memberIds.includes(clientInfo.id)) {
      group.memberIds.push(clientInfo.id);
    }
    state.playerGroups[clientInfo.id] = group.id;
    removeInvite(clientInfo.id);
    sendGroupUpdate(group);
  }

  function handleCmdGroupDecline(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    removeInvite(clientInfo.id);
  }

  function handleCmdGroupLeave(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const groupId = state.playerGroups[clientInfo.id];
    if (!groupId) return;
    const group = getGroup(groupId);
    if (!group) return;
    group.memberIds = group.memberIds.filter((id) => id !== clientInfo.id);
    delete state.playerGroups[clientInfo.id];

    if (group.memberIds.length === 0) {
      delete state.groups[groupId];
      sendGroupDisband([clientInfo.id], groupId);
      return;
    }

    if (group.leaderId === clientInfo.id) {
      group.leaderId = group.memberIds[0];
    }
    sendGroupUpdate(group);
  }

  function handleCmdGroupKick(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const targetId = Number(msg.targetId);
    if (!Number.isInteger(targetId)) return;
    const groupId = state.playerGroups[clientInfo.id];
    if (!groupId) return;
    const group = getGroup(groupId);
    if (!group || group.leaderId !== clientInfo.id) return;
    if (!group.memberIds.includes(targetId)) return;

    group.memberIds = group.memberIds.filter((id) => id !== targetId);
    delete state.playerGroups[targetId];

    if (group.memberIds.length === 0) {
      delete state.groups[groupId];
      sendGroupDisband([targetId, clientInfo.id], groupId);
      return;
    }
    sendGroupUpdate(group);
  }

  function handleCmdGroupDisband(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) return;
    const groupId = state.playerGroups[clientInfo.id];
    if (!groupId) return;
    const group = getGroup(groupId);
    if (!group || group.leaderId !== clientInfo.id) return;
    const members = group.memberIds.slice();
    members.forEach((id) => {
      delete state.playerGroups[id];
    });
    delete state.groups[groupId];
    sendGroupDisband(members, groupId);
  }

  function handlePlayerDisconnect(playerId) {
    const groupId = state.playerGroups[playerId];
    if (!groupId) return;
    const group = getGroup(groupId);
    if (!group) return;
    group.memberIds = group.memberIds.filter((id) => id !== playerId);
    delete state.playerGroups[playerId];

    if (group.memberIds.length === 0) {
      delete state.groups[groupId];
      sendGroupDisband([playerId], groupId);
      return;
    }
    if (group.leaderId === playerId) {
      group.leaderId = group.memberIds[0];
    }
    sendGroupUpdate(group);
  }

  function handleGroupHpTick() {
    const groups = Object.values(state.groups || {});
    if (groups.length === 0) return;
    const activeMembers = new Set();
    groups.forEach((group) => {
      if (!group || !Array.isArray(group.memberIds)) return;
      let changed = false;
      group.memberIds.forEach((memberId) => {
        if (!Number.isInteger(memberId)) return;
        activeMembers.add(memberId);
        const { hp, hpMax } = readHpPair(state.players[memberId]);
        const prev = lastHpByPlayerId.get(memberId);
        if (!prev || prev.hp !== hp || prev.hpMax !== hpMax) {
          lastHpByPlayerId.set(memberId, { hp, hpMax });
          changed = true;
        }
      });
      if (changed) {
        sendGroupUpdate(group);
      }
    });

    Array.from(lastHpByPlayerId.keys()).forEach((playerId) => {
      if (!activeMembers.has(playerId)) {
        lastHpByPlayerId.delete(playerId);
      }
    });
  }

  return {
    handleCmdGroupInvite,
    handleCmdGroupAccept,
    handleCmdGroupDecline,
    handleCmdGroupLeave,
    handleCmdGroupKick,
    handleCmdGroupDisband,
    handlePlayerDisconnect,
    handleGroupHpTick,
  };
}

module.exports = {
  createGroupHandlers,
};
