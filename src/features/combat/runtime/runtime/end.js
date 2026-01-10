import { startOutOfCombatRegen } from "../../../../core/regen.js";
import { onAfterCombatEnded } from "../../../../features/dungeons/runtime.js";
import { loadMapLikeMain } from "../../../../features/maps/world/load.js";
import { maps } from "../../../../features/maps/index.js";
import { closeRiftForPlayer } from "../../../../features/maps/world/rifts.js";
import { addChatMessage } from "../../../../chat/chat.js";
import { items } from "../../../inventory/data/itemsConfig.js";
import { addXpToPlayer } from "../../../../entities/player.js";
import { clearAllCombatAllies, clearAllSummons } from "../../summons/summon.js";
import { clearActiveSpell } from "../../spells/core/activeSpell.js";
import { queueMonsterRespawn } from "../../../../features/monsters/runtime/respawnState.js";
import {
  advanceQuestStage,
  getQuestState,
  QUEST_STATES,
} from "../../../quests/index.js";
import {
  cleanupCombatChallenge,
  finalizeCombatChallenge,
  getChallengeBonusesIfSuccessful,
} from "../../../challenges/runtime/index.js";
import { applyLootToPlayerInventory, rollLootFromSources } from "./loot.js";
import { restoreWorldMonsterFromSnapshot } from "./snapshots.js";
import { joinPartsWrapped } from "./utils.js";
import { setHarvestablesVisible } from "../../../maps/world/harvestables.js";
import { clearCombatAuras } from "../auras.js";
import { getNetClient, getNetPlayerId } from "../../../../app/session.js";
import { adjustGold } from "../../../inventory/runtime/goldAuthority.js";

export function endCombat(scene) {
  if (!scene.combatState) return;

  const state = scene.combatState;
  state.enCours = false;

  const client = getNetClient();
  const playerId = getNetPlayerId();
  const combatId = scene.__lanCombatId;
  if (client && playerId && Number.isInteger(combatId)) {
    const mapId = scene.currentMapKey || scene.currentMapDef?.key || null;
    client.sendCmd("CmdCombatEnd", {
      playerId,
      combatId,
      mapId,
    });
  }
  scene.__lanCombatId = null;
  scene.__lanCombatStartSent = false;

  clearAllSummons(scene);
  clearAllCombatAllies(scene);
  cleanupCombatChallenge(scene);

  if (state.joueur) {
    state.joueur.statusEffects = [];
    state.joueur.hasAliveSummon = false;
  }
  state.summonActing = false;
  state.activeSummonId = null;
  state.actors = [];
  scene.__lanCombatActorsCache = null;
  scene.combatSummons = [];

  const cam = scene.cameras && scene.cameras.main;
  if (cam && cam.fadeOut && cam.fadeIn) {
    cam.once("camerafadeoutcomplete", () => {
      cam.fadeIn(1300, 0, 0, 0);
    });
    cam.fadeOut(0, 0, 0, 0);
  }

  const now = Date.now();
  const durationMs = state.startTime ? now - state.startTime : 0;

  let issue = state.issue;
  if (!issue) {
    const joueurHp = state.joueur?.stats?.hp ?? 0;
    const monstreHp = state.monstre?.stats?.hp ?? 0;
    if (joueurHp <= 0 && monstreHp > 0) {
      issue = "defaite";
    } else if (monstreHp <= 0 && joueurHp > 0) {
      issue = "victoire";
    } else {
      issue = "inconnu";
    }
  }

  finalizeCombatChallenge(scene, { issue });

  const player = state.joueur;
  const levelBefore = player?.levelState?.niveau ?? 1;
  const pointsBefore = player?.levelState?.pointsCaracLibres ?? 0;

  if (
    scene.combatMonsters &&
    Array.isArray(scene.combatMonsters) &&
    Array.isArray(scene.monsters)
  ) {
    const combatOnly = scene.combatMonsters.filter((m) => m && m.isCombatOnly);
    if (combatOnly.length > 0) {
      combatOnly.forEach((m) => {
        if (!m) return;
        if (typeof m.destroy === "function") {
          m.destroy();
        }
      });
      scene.monsters = scene.monsters.filter((m) => !m || !m.isCombatOnly);
    }
  }

  let xpGagne = 0;
  let goldGagne = 0;
  let lootGagne = [];
  let niveauxGagnes = 0;
  let pointsCaracGagnes = 0;
  let pvMaxGagnes = 0;

  if (issue === "victoire") {
    xpGagne = state.xpGagne || 0;
    goldGagne = state.goldGagne || 0;

    const { ok: challengeOk, xpBonusPct, dropBonusPct } =
      getChallengeBonusesIfSuccessful(scene, { issue });

    if (challengeOk && xpGagne > 0) {
      xpGagne = Math.round(xpGagne * (1 + xpBonusPct));
    }

    const prospectionValue =
      typeof player?.stats?.prospection === "number" &&
      Number.isFinite(player.stats.prospection)
        ? player.stats.prospection
        : 100;
    const prospectionMult = Math.max(0, prospectionValue) / 100;
    const dropMult = prospectionMult * (1 + (challengeOk ? dropBonusPct : 0));
    const lootRolls = rollLootFromSources(
      state.lootSources || [],
      dropMult,
      player
    );
    lootGagne = applyLootToPlayerInventory(player, lootRolls);

    if (player && typeof addXpToPlayer === "function" && xpGagne > 0) {
      addXpToPlayer(player, xpGagne);
      const levelAfter = player?.levelState?.niveau ?? levelBefore;
      const pointsAfter = player?.levelState?.pointsCaracLibres ?? pointsBefore;
      niveauxGagnes = Math.max(0, levelAfter - levelBefore);
      pointsCaracGagnes = Math.max(0, pointsAfter - pointsBefore);
      pvMaxGagnes = niveauxGagnes * 5;
    }
    if (player && typeof goldGagne === "number" && goldGagne > 0) {
      adjustGold(player, goldGagne, "combat_reward");
    }

    if (
      state.worldMonsterSnapshot &&
      state.worldMonsterSnapshot.respawnEnabled !== false
    ) {
      queueMonsterRespawn(scene, state.worldMonsterSnapshot, 5000);
    }
  } else {
    if (!state.monstre?.isCombatOnly) {
      restoreWorldMonsterFromSnapshot(scene, state.worldMonsterSnapshot, state.monstre);
    }
  }

  if (player) {
    player.spellCooldowns = {};
    clearActiveSpell(player);
  }

  const result = {
    issue,
    durationMs,
    xpGagne,
    goldGagne,
    loot: lootGagne,
    niveauxGagnes,
    pointsCaracGagnes,
    pvMaxGagnes,
    playerLevel: player?.levelState?.niveau ?? 1,
    playerXpTotal: player?.levelState?.xpTotal ?? player?.levelState?.xp ?? 0,
    playerXpNext: player?.levelState?.xpProchain ?? 0,
    monsterId: state.worldMonsterSnapshot?.monsterId || state.monstre?.monsterId || null,
    monsterHpEnd: state.monstre?.stats?.hp ?? 0,
    challenge: state.challenge
      ? {
          id: state.challenge.id || null,
          label: state.challenge.label || null,
          description: state.challenge.description || null,
          rewards: state.challenge.rewards || null,
          status: state.challenge.status || "active",
          failReason: state.challenge.failReason || null,
        }
      : null,
  };

  const playerForChat = state.joueur;
  if (playerForChat && result.issue === "victoire") {
    const xp = result.xpGagne ?? 0;
    const gold = result.goldGagne ?? 0;
    const loot = Array.isArray(result.loot) ? result.loot : [];

    const parts = [];
    if (xp > 0) parts.push(`+${xp} XP`);
    if (gold > 0) parts.push(`+${gold} or`);
    loot.forEach((entry) => {
      if (!entry || !entry.itemId) return;
      const qty = entry.qty ?? 0;
      if (qty <= 0) return;
      const def = items?.[entry.itemId];
      const label = def?.label || entry.itemId;
      parts.push(`${label} x${qty}`);
    });

    if (parts.length > 0) {
      const text = `Gains : ${joinPartsWrapped(parts, 70)}`;
      addChatMessage(
        { kind: "combat", channel: "global", author: "Combat", text },
        { player: playerForChat }
      );
    }
  }

  if (scene.prepState) {
    if (scene.prepState.highlights) {
      scene.prepState.highlights.forEach((g) => g.destroy());
    }
    scene.prepState = null;
  }

  document.body.classList.remove("combat-active");
  document.body.classList.remove("combat-prep");

  scene.combatMap = null;
  scene.combatGroundLayer = null;

  setHarvestablesVisible(scene, true);

  if (scene.combatMonsters && Array.isArray(scene.combatMonsters)) {
    scene.combatMonsters.forEach((m) => {
      if (!m) return;
      m.isCombatMember = false;
    });
    scene.combatMonsters = null;
  }

  if (scene.hiddenWorldMonsters && Array.isArray(scene.hiddenWorldMonsters)) {
    scene.hiddenWorldMonsters.forEach((m) => {
      if (!m || m.destroyed) return;

      m.setVisible(true);
      if (m.setInteractive) {
        m.setInteractive({ useHandCursor: true });
      }
    });
    scene.hiddenWorldMonsters = null;
  }

  if (scene.clearDamagePreview) {
    scene.clearDamagePreview();
  }
  if (scene.hideMonsterTooltip) {
    scene.hideMonsterTooltip();
  }
  if (scene.hideCombatTargetPanel) {
    scene.hideCombatTargetPanel();
  }
  clearCombatAuras(scene);

  const allMonsters = scene.monsters || [];
  allMonsters.forEach((m) => {
    if (!m || !m.hoverHighlight) return;
    if (m.hoverHighlight.destroy) {
      m.hoverHighlight.destroy();
    }
    m.hoverHighlight = null;
  });

  startOutOfCombatRegen(scene, player);

  if (player && typeof player.updateHudApMp === "function") {
    const basePa = player.stats?.pa ?? 0;
    const basePm = player.stats?.pm ?? 0;
    player.updateHudApMp(basePa, basePm);
  }

  if (typeof scene.showCombatResult === "function") {
    scene.showCombatResult(result);
  }

  if (scene && typeof scene.updateCombatUi === "function") {
    scene.updateCombatUi();
  }

  scene.combatState = null;

  if (scene?.pendingQuestAfterDuel) {
    const { questId, monsterId } = scene.pendingQuestAfterDuel;
    scene.pendingQuestAfterDuel = null;
    if (issue === "victoire" && questId && monsterId) {
      const expected = result?.monsterId;
      if (!expected || expected === monsterId) {
        const qState = getQuestState(scene.player, questId, { emit: false });
        if (qState?.state === QUEST_STATES.IN_PROGRESS) {
          advanceQuestStage(scene.player, questId, { scene });
        }
      }
    }
  }

  if (
    result?.issue === "victoire" &&
    scene?.currentMapDef?.riftEncounter &&
    player
  ) {
    const returnKey = player.riftReturnMapKey || "MapAndemiaNouvelleVersion10";
    const returnMap = maps?.[returnKey] || null;
    const returnTile =
      player.riftReturnTile &&
      typeof player.riftReturnTile.x === "number" &&
      typeof player.riftReturnTile.y === "number"
        ? player.riftReturnTile
        : null;

    if (player.activeRiftId) {
      closeRiftForPlayer(scene, player.activeRiftId);
    }

    player.activeRiftId = null;
    player.riftReturnMapKey = null;
    player.riftReturnTile = null;

    if (returnMap) {
      loadMapLikeMain(scene, returnMap, returnTile ? { startTile: returnTile } : undefined);
    }
  }

  onAfterCombatEnded(scene, result);
}
