import { getNetClient, getNetPlayerId } from "../../app/session.js";
import { emit as emitStoreEvent } from "../../state/store.js";
import { showToast } from "../../features/ui/domToasts.js";
import {
  openGroupCombatInvite,
  closeGroupCombatInvite,
} from "../../features/ui/domGroupCombatInvite.js";
import { openGroupInvite, closeGroupInvite } from "../../features/ui/domGroupInvite.js";

export function createGroupHandlers({ scene, getCurrentMapKey, isSceneReady }) {
  let groupState = null;
  const combatInvites = new Map();

  const setGroupState = (payload) => {
    groupState = payload;
    if (scene) {
      scene.__lanGroupState = payload;
    }
    emitStoreEvent("group:updated", payload);
  };

  const clearGroupState = () => {
    groupState = null;
    if (scene) {
      scene.__lanGroupState = null;
    }
    emitStoreEvent("group:disband", null);
  };

  const purgeExpiredInvites = () => {
    const now = Date.now();
    Array.from(combatInvites.entries()).forEach(([combatId, invite]) => {
      if (invite.expiresAt && invite.expiresAt <= now) {
        combatInvites.delete(combatId);
      }
    });
  };

  const showInviteIfReady = () => {
    if (!isSceneReady || !isSceneReady()) return;
    const currentMap = getCurrentMapKey();
    if (!currentMap) return;
    purgeExpiredInvites();
    const now = Date.now();
    const pending = Array.from(combatInvites.values()).filter(
      (invite) => invite.mapId === currentMap && invite.expiresAt > now
    );
    if (pending.length === 0) return;
    const invite = pending.sort((a, b) => a.expiresAt - b.expiresAt)[0];
    openGroupCombatInvite(invite, {
      onJoin: (entry) => {
        const client = getNetClient();
        const playerId = getNetPlayerId();
        if (!client || !playerId) return;
        client.sendCmd("CmdGroupCombatJoin", {
          playerId,
          combatId: entry.combatId,
        });
        combatInvites.delete(entry.combatId);
      },
      onClose: (entry) => {
        const client = getNetClient();
        const playerId = getNetPlayerId();
        if (client && playerId) {
          client.sendCmd("CmdGroupCombatDecline", {
            playerId,
            combatId: entry.combatId,
          });
        }
        combatInvites.delete(entry.combatId);
      },
    });
  };

  const handleGroupUpdate = (msg) => {
    if (!msg?.group) return;
    setGroupState(msg.group);
  };

  const handleGroupDisband = () => {
    clearGroupState();
    closeGroupCombatInvite();
  };

  const handleGroupInvite = (msg) => {
    if (!msg) return;
    openGroupInvite(
      {
        inviterId: msg.inviterId || null,
        inviterName: msg.inviterName || "Un joueur",
        groupId: msg.groupId || null,
      },
      {
        onAccept: () => {
          const client = getNetClient();
          const playerId = getNetPlayerId();
          if (!client || !playerId) return;
          client.sendCmd("CmdGroupAccept", { playerId });
        },
        onDecline: () => {
          const client = getNetClient();
          const playerId = getNetPlayerId();
          if (!client || !playerId) return;
          client.sendCmd("CmdGroupDecline", { playerId });
        },
      }
    );
  };

  const handleGroupCombatInvite = (msg) => {
    if (!msg || !Number.isInteger(msg.combatId)) return;
    const expiresAt = Number.isFinite(msg.expiresAt)
      ? msg.expiresAt
      : Date.now() + 45000;
    combatInvites.set(msg.combatId, {
      combatId: msg.combatId,
      mapId: msg.mapId || null,
      inviterId: msg.inviterId || null,
      inviterName: msg.inviterName || null,
      createdAt: msg.createdAt || Date.now(),
      expiresAt,
    });
    showInviteIfReady();
  };

  const handleCombatState = (msg) => {
    if (!groupState || !Array.isArray(groupState.members)) return;
    if (!msg || !Array.isArray(msg.players)) return;
    const byId = new Map();
    msg.players.forEach((entry) => {
      if (!Number.isInteger(entry?.playerId)) return;
      const hp = Number.isFinite(entry.hp) ? entry.hp : null;
      const hpMax = Number.isFinite(entry.hpMax) ? entry.hpMax : null;
      byId.set(entry.playerId, { hp, hpMax });
    });
    if (byId.size === 0) return;
    let changed = false;
    const nextMembers = groupState.members.map((member) => {
      const match = byId.get(member.id);
      if (!match) return member;
      if (member.hp === match.hp && member.hpMax === match.hpMax) return member;
      changed = true;
      return {
        ...member,
        hp: match.hp,
        hpMax: match.hpMax,
      };
    });
    if (!changed) return;
    setGroupState({ ...groupState, members: nextMembers });
  };

  const handleCombatEnded = (msg) => {
    if (!Number.isInteger(msg?.combatId)) return;
    combatInvites.delete(msg.combatId);
    showInviteIfReady();
  };

  const handleMapChanged = () => {
    showInviteIfReady();
  };

  return {
    handleGroupUpdate,
    handleGroupDisband,
    handleGroupInvite,
    handleGroupCombatInvite,
    handleCombatState,
    handleCombatEnded,
    handleMapChanged,
    getGroupState: () => groupState,
  };
}
