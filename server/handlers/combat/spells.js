function createSpellHandlers(ctx, helpers) {
  const {
    state,
    broadcast,
    getSpellDef,
    isSimpleDamageSpell,
    rollSpellDamage,
    debugLog,
    finalizeCombat,
    serializeActorOrder,
  } = ctx;
  const { applyDamageToCombatSnapshot } = helpers;
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
    let authoritative = false;
    let damagePayload = null;
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

      const spellDef = getSpellDef(msg.spellId);
      const targetX = Number.isInteger(msg.targetX) ? msg.targetX : null;
      const targetY = Number.isInteger(msg.targetY) ? msg.targetY : null;
      if (spellDef && isSimpleDamageSpell(spellDef) && targetX !== null && targetY !== null) {
        authoritative = true;
        const damage = rollSpellDamage(spellDef);
        damagePayload = {
          t: "EvDamageApplied",
          combatId,
          casterId: clientInfo.id,
          spellId: msg.spellId,
          targetX,
          targetY,
          targetKind: typeof msg.targetKind === "string" ? msg.targetKind : null,
          targetId: Number.isInteger(msg.targetId) ? msg.targetId : null,
          targetIndex: Number.isInteger(msg.targetIndex) ? msg.targetIndex : null,
          damage,
        };
      } else if (spellDef && targetX !== null && targetY !== null) {
        debugLog("CmdCastSpell note: non-simple spell", {
          combatId,
          spellId: msg.spellId,
          effects: Array.isArray(spellDef.effects) ? spellDef.effects.length : null,
          effectPattern: !!spellDef.effectPattern,
        });
      }
    }

    debugLog("CmdCastSpell accept", {
      combatId,
      playerId: clientInfo.id,
      spellId: msg.spellId,
      targetX: msg.targetX ?? null,
      targetY: msg.targetY ?? null,
      authoritative,
    });

    broadcast({
      t: "EvSpellCast",
      combatId,
      authoritative,
      casterKind: "player",
      casterId: clientInfo.id,
      spellId: msg.spellId,
      targetX: msg.targetX ?? null,
      targetY: msg.targetY ?? null,
      targetId: msg.targetId ?? null,
    });

    if (damagePayload && combat) {
      broadcast(damagePayload);
      applyDamageToCombatSnapshot(combat, {
        targetKind: damagePayload.targetKind,
        targetId: damagePayload.targetId,
        targetIndex: damagePayload.targetIndex,
        targetX: damagePayload.targetX,
        targetY: damagePayload.targetY,
        damage: damagePayload.damage,
      });
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
          actorOrder: serializeActorOrder ? serializeActorOrder(combat) : undefined,
          players: Array.isArray(combat.stateSnapshot.players)
            ? combat.stateSnapshot.players
            : [],
          monsters: Array.isArray(combat.stateSnapshot.monsters)
            ? combat.stateSnapshot.monsters
            : [],
        });
      }
    }
  }

  function handleCmdCombatDamageApplied(clientInfo, msg) {
    const combatId = Number.isInteger(msg.combatId) ? msg.combatId : null;
    const sender = state.players[clientInfo.id];
    const resolvedCombatId =
      Number.isInteger(combatId) ? combatId : sender?.combatId ?? null;
    if (!resolvedCombatId) {
      debugLog("CmdCombatDamageApplied reject: no combatId", {
        playerId: clientInfo.id,
        msgCombatId: msg.combatId,
      });
      return;
    }
    const combat = state.combats[resolvedCombatId];
    if (!combat) {
      debugLog("CmdCombatDamageApplied reject: combat missing", {
        combatId: resolvedCombatId,
        playerId: clientInfo.id,
      });
      return;
    }
    if (combat.phase !== "combat") {
      debugLog("CmdCombatDamageApplied reject: phase", {
        combatId: combat.id,
        phase: combat.phase,
      });
      return;
    }

    const source = msg.source === "monster" ? "monster" : "player";
    if (source === "monster") {
      if (!Number.isInteger(combat.aiDriverId)) {
        debugLog("CmdCombatDamageApplied reject: monster source not host", {
          combatId: combat.id,
          playerId: clientInfo.id,
        });
        return;
      }
      if (clientInfo.id !== combat.aiDriverId) {
        debugLog("CmdCombatDamageApplied reject: monster source not ai driver", {
          combatId: combat.id,
          playerId: clientInfo.id,
          aiDriverId: combat.aiDriverId,
        });
        return;
      }
      if (combat.turn !== "monster") {
        debugLog("CmdCombatDamageApplied reject: not monster turn", {
          combatId: combat.id,
          turn: combat.turn,
        });
        return;
      }
    } else {
      if (!sender || sender.combatId !== combat.id) {
        debugLog("CmdCombatDamageApplied reject: sender combat mismatch", {
          combatId: combat.id,
          playerId: clientInfo.id,
          senderCombatId: sender?.combatId ?? null,
        });
        return;
      }
      if (combat.turn !== "player") {
        debugLog("CmdCombatDamageApplied reject: not player turn", {
          combatId: combat.id,
          turn: combat.turn,
        });
        return;
      }
      if (
        Number.isInteger(combat.activePlayerId) &&
        combat.activePlayerId !== clientInfo.id
      ) {
        debugLog("CmdCombatDamageApplied reject: not active player", {
          combatId: combat.id,
          activePlayerId: combat.activePlayerId,
          playerId: clientInfo.id,
        });
        return;
      }
    }
    const damage = Number.isFinite(msg.damage) ? Math.max(0, msg.damage) : 0;
    if (damage <= 0) {
      debugLog("CmdCombatDamageApplied reject: damage <= 0", {
        combatId: combat.id,
        playerId: clientInfo.id,
        damage,
      });
      return;
    }
    const targetX = Number.isInteger(msg.targetX) ? msg.targetX : null;
    const targetY = Number.isInteger(msg.targetY) ? msg.targetY : null;
    if (targetX === null || targetY === null) {
      debugLog("CmdCombatDamageApplied reject: missing target tile", {
        combatId: combat.id,
        playerId: clientInfo.id,
        targetX,
        targetY,
      });
      return;
    }

    debugLog("CmdCombatDamageApplied accept", {
      combatId: combat.id,
      playerId: clientInfo.id,
      source,
      damage,
      targetX,
      targetY,
      targetKind: msg.targetKind ?? null,
      targetId: msg.targetId ?? null,
      targetIndex: msg.targetIndex ?? null,
      clientSeq: msg.clientSeq ?? null,
    });

    broadcast({
      t: "EvDamageApplied",
      combatId: combat.id,
      casterId: msg.casterId ?? null,
      spellId: msg.spellId ?? null,
      targetX,
      targetY,
      damage,
      source,
      targetKind: typeof msg.targetKind === "string" ? msg.targetKind : null,
      targetId: Number.isInteger(msg.targetId) ? msg.targetId : null,
      targetIndex: Number.isInteger(msg.targetIndex) ? msg.targetIndex : null,
      clientSeq: Number.isInteger(msg.clientSeq) ? msg.clientSeq : null,
    });

    applyDamageToCombatSnapshot(combat, {
      targetKind: msg.targetKind,
      targetId: msg.targetId,
      targetIndex: msg.targetIndex,
      targetX,
      targetY,
      damage,
    });

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
        actorOrder: serializeActorOrder ? serializeActorOrder(combat) : undefined,
        players: Array.isArray(combat.stateSnapshot.players)
          ? combat.stateSnapshot.players
          : [],
        monsters: Array.isArray(combat.stateSnapshot.monsters)
          ? combat.stateSnapshot.monsters
          : [],
      });
    }
  }

  return {
    handleCmdCastSpell,
    handleCmdCombatDamageApplied,
  };
}

module.exports = {
  createSpellHandlers,
};
