function createSpellHandlers(ctx, helpers) {
  const {
    state,
    broadcast,
    debugLog,
    finalizeCombat,
    serializeActorOrder,
  } = ctx;
  const { resolveSpellCast } = helpers;
  const countLivingMonsters = (combat) => {
    const monsters = Array.isArray(combat?.stateSnapshot?.monsters)
      ? combat.stateSnapshot.monsters
      : [];
    return monsters.filter((m) => {
      const hp = Number.isFinite(m?.hp) ? m.hp : Number.isFinite(m?.hpMax) ? m.hpMax : 0;
      return hp > 0;
    }).length;
  };

  function handleCmdCastSpell(clientInfo, msg) {
    if (clientInfo.id !== msg.playerId) {
      debugLog("CmdCastSpell reject: sender mismatch", {
        clientId: clientInfo.id,
        playerId: msg.playerId,
      });
      return;
    }
    if (!msg.spellId) {
      debugLog("CmdCastSpell reject: missing spellId", { playerId: msg.playerId });
      return;
    }

    const player = state.players[clientInfo.id];
    let combatId = null;
    let combat = null;
    if (player && player.inCombat) {
      combat = player.combatId ? state.combats[player.combatId] : null;
      if (!combat) {
        debugLog("CmdCastSpell reject: combat not found", {
          playerId: clientInfo.id,
          combatId: player.combatId,
        });
        return;
      }
      if (combat.turn !== "player") {
        debugLog("CmdCastSpell reject: not player turn", {
          combatId: combat.id,
          playerId: clientInfo.id,
          turn: combat.turn,
        });
        return;
      }
      if (
        Number.isInteger(combat.activePlayerId) &&
        combat.activePlayerId !== clientInfo.id
      ) {
        debugLog("CmdCastSpell reject: not active player", {
          combatId: combat.id,
          activePlayerId: combat.activePlayerId,
          playerId: clientInfo.id,
        });
        return;
      }
      if (
        Array.isArray(combat.participantIds) &&
        !combat.participantIds.includes(clientInfo.id)
      ) {
        debugLog("CmdCastSpell reject: not participant", {
          combatId: combat.id,
          playerId: clientInfo.id,
        });
        return;
      }
      if (combat.mapId && player.mapId && combat.mapId !== player.mapId) {
        debugLog("CmdCastSpell reject: map mismatch", {
          combatId: combat.id,
          combatMap: combat.mapId,
          playerMap: player.mapId,
        });
        return;
      }
      combatId = combat.id;
    }

    debugLog("CmdCastSpell accept", {
      combatId,
      playerId: clientInfo.id,
      spellId: msg.spellId,
      targetX: msg.targetX ?? null,
      targetY: msg.targetY ?? null,
      authoritative: true,
    });

    if (!combat || typeof resolveSpellCast !== "function") return;
    resolveSpellCast(
      combat,
      { kind: "player", playerId: clientInfo.id },
      msg.spellId,
      Number.isInteger(msg.targetX) ? msg.targetX : null,
      Number.isInteger(msg.targetY) ? msg.targetY : null
    );
    if (typeof finalizeCombat === "function" && countLivingMonsters(combat) === 0) {
      finalizeCombat(combat.id);
      return;
    }
    if (combat.stateSnapshot) {
      broadcast({
        t: "EvCombatState",
        combatId: combat.id,
        mapId: combat.mapId || null,
        turn: combat.turn || null,
        round: Number.isInteger(combat.round) ? combat.round : null,
        activePlayerId: Number.isInteger(combat.activePlayerId)
          ? combat.activePlayerId
          : null,
        activeMonsterId: Number.isInteger(combat.activeMonsterId)
          ? combat.activeMonsterId
          : null,
        activeMonsterIndex: Number.isInteger(combat.activeMonsterIndex)
          ? combat.activeMonsterIndex
          : null,
        activeSummonId: Number.isInteger(combat.activeSummonId)
          ? combat.activeSummonId
          : null,
        actorOrder: serializeActorOrder ? serializeActorOrder(combat) : undefined,
        players: Array.isArray(combat.stateSnapshot.players)
          ? combat.stateSnapshot.players
          : [],
        monsters: Array.isArray(combat.stateSnapshot.monsters)
          ? combat.stateSnapshot.monsters
          : [],
        summons: Array.isArray(combat.stateSnapshot.summons)
          ? combat.stateSnapshot.summons
          : [],
      });
    }
  }

  function handleCmdCombatDamageApplied(clientInfo, msg) {
    debugLog("CmdCombatDamageApplied reject: server authoritative", {
      playerId: clientInfo.id,
      combatId: msg.combatId ?? null,
    });
    return;
  }

  return {
    handleCmdCastSpell,
    handleCmdCombatDamageApplied,
  };
}

module.exports = {
  createSpellHandlers,
};
