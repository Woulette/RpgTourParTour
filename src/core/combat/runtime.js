// Démarrage / fin de combat, interaction avec l'UI et la regen.

import { startOutOfCombatRegen } from "../regen.js";
import { createCombatState, buildTurnOrder } from "./state.js";
import { onAfterCombatEnded } from "../../dungeons/runtime.js";
import { addChatMessage } from "../../chat/chat.js";
import { items } from "../../inventory/itemsConfig.js";
import { addItem } from "../../inventory/inventoryCore.js";
import { clearAllSummons } from "../../systems/combat/summons/summon.js";
import { addXpToPlayer } from "../../entities/player.js";
import { clearActiveSpell } from "../../systems/combat/spells/activeSpell.js";
import { queueMonsterRespawn } from "../../monsters/respawnState.js";
import { createMonster } from "../../entities/monster.js";
import {
  cleanupCombatChallenge,
  finalizeCombatChallenge,
  getChallengeBonusesIfSuccessful,
  initCombatChallenge,
} from "../../challenges/runtime.js";
import { resetEryonChargeState } from "../../systems/combat/eryon/charges.js";

function joinPartsWrapped(parts, maxLineLength = 70) {
  const safeMax = Math.max(20, maxLineLength | 0);
  const lines = [];
  let current = "";

  for (const raw of parts) {
    const part = String(raw || "").trim();
    if (!part) continue;
    if (!current) {
      current = part;
      continue;
    }
    const candidate = `${current}, ${part}`;
    if (candidate.length <= safeMax) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = part;
  }

  if (current) lines.push(current);
  return lines.join("\n");
}

function getWorldMapAndLayer(scene) {
  const map = scene?.map || scene?.combatMap || null;
  const layer = scene?.groundLayer || scene?.combatGroundLayer || null;
  return { map, layer };
}

function snapshotMonsterForWorld(scene, monster) {
  if (!scene || !monster) return null;

  const fromPrep = monster._worldSnapshotBeforeCombat;
  if (fromPrep && typeof fromPrep === "object") {
    return { ...fromPrep };
  }

  const stats = monster.stats || {};
  return {
    monsterId: monster.monsterId || null,
    tileX: monster.tileX,
    tileY: monster.tileY,
    x: monster.x,
    y: monster.y,
    level: typeof monster.level === "number" ? monster.level : null,
    hp: typeof stats.hp === "number" ? stats.hp : null,
    hpMax: typeof stats.hpMax === "number" ? stats.hpMax : null,
    spawnMapKey: monster.spawnMapKey ?? scene.currentMapKey ?? null,
    respawnEnabled:
      monster.respawnEnabled === undefined ? true : !!monster.respawnEnabled,
    respawnTemplate:
      monster.respawnTemplate && typeof monster.respawnTemplate === "object"
        ? {
            groupPool: Array.isArray(monster.respawnTemplate.groupPool)
              ? monster.respawnTemplate.groupPool.slice()
              : null,
            groupSizeMin: monster.respawnTemplate.groupSizeMin ?? null,
            groupSizeMax: monster.respawnTemplate.groupSizeMax ?? null,
            forceMixedGroup: monster.respawnTemplate.forceMixedGroup === true,
          }
        : null,
    groupId: monster.groupId ?? null,
    groupSize: monster.groupSize ?? null,
    groupLevels: Array.isArray(monster.groupLevels)
      ? monster.groupLevels.slice()
      : null,
    groupMonsterIds: Array.isArray(monster.groupMonsterIds)
      ? monster.groupMonsterIds.slice()
      : null,
    groupLevelTotal:
      typeof monster.groupLevelTotal === "number" ? monster.groupLevelTotal : null,
  };
}

function applyLootToPlayerInventory(player, loot) {
  const finalLoot = [];
  if (!player || !player.inventory || !Array.isArray(loot)) return finalLoot;

  for (const entry of loot) {
    if (!entry || !entry.itemId) continue;
    const qty = entry.qty ?? 0;
    if (qty <= 0) continue;

    const remaining = addItem(player.inventory, entry.itemId, qty);
    const gained = qty - remaining;
    if (gained <= 0) continue;

    let slot = finalLoot.find((l) => l.itemId === entry.itemId);
    if (!slot) {
      slot = { itemId: entry.itemId, qty: 0 };
      finalLoot.push(slot);
    }
    slot.qty += gained;
  }

  return finalLoot;
}

function clampNonNegativeFinite(n) {
  return typeof n === "number" && Number.isFinite(n) ? Math.max(0, n) : 0;
}

function getJobLevel(player, jobId) {
  if (!player || !jobId) return 0;
  const level = player.metiers?.[jobId]?.level;
  return typeof level === "number" && level > 0 ? level : 0;
}

function rollLootFromSources(lootSources, dropMultiplier = 1, player = null) {
  const sources = Array.isArray(lootSources) ? lootSources : [];
  const mult = clampNonNegativeFinite(dropMultiplier) || 1;

  const aggregated = [];

  sources.forEach((src) => {
    const table = Array.isArray(src?.lootTable) ? src.lootTable : [];
    table.forEach((entry) => {
      if (!entry || !entry.itemId) return;

      const requiredJob = entry.requiresJob;
      if (requiredJob) {
        const minLevel =
          typeof entry.minJobLevel === "number" ? entry.minJobLevel : 1;
        if (getJobLevel(player, requiredJob) < minLevel) return;
      }

      const baseRate = typeof entry.dropRate === "number" ? entry.dropRate : 1.0;
      const finalRate = Math.min(1, Math.max(0, baseRate * mult));
      if (Math.random() > finalRate) return;

      const min = entry.min ?? 1;
      const max = entry.max ?? min;
      const qty = Math.max(0, Phaser.Math.Between(min, max));
      if (qty <= 0) return;

      let slot = aggregated.find((l) => l.itemId === entry.itemId);
      if (!slot) {
        slot = { itemId: entry.itemId, qty: 0 };
        aggregated.push(slot);
      }
      slot.qty += qty;
    });
  });

  return aggregated;
}

function restoreWorldMonsterFromSnapshot(scene, snapshot, fallbackRef) {
  if (!scene || !snapshot || !snapshot.monsterId) return;

  const { map, layer } = getWorldMapAndLayer(scene);
  const tileX = snapshot.tileX;
  const tileY = snapshot.tileY;

  const isValidTile =
    typeof tileX === "number" &&
    typeof tileY === "number" &&
    map &&
    layer &&
    tileX >= 0 &&
    tileY >= 0 &&
    tileX < map.width &&
    tileY < map.height;

  const ensurePos = (m) => {
    if (!m) return;
    if (typeof tileX === "number") m.tileX = tileX;
    if (typeof tileY === "number") m.tileY = tileY;

    if (isValidTile && typeof map.tileToWorldXY === "function") {
      const wp = map.tileToWorldXY(tileX, tileY, undefined, undefined, layer);
      const offX = typeof m.renderOffsetX === "number" ? m.renderOffsetX : 0;
      const offY = typeof m.renderOffsetY === "number" ? m.renderOffsetY : 0;
      m.x = wp.x + map.tileWidth / 2 + offX;
      m.y = wp.y + map.tileHeight + offY;
    } else if (typeof snapshot.x === "number" && typeof snapshot.y === "number") {
      m.x = snapshot.x;
      m.y = snapshot.y;
    }

    m.setVisible?.(true);
    m.setInteractive?.({ useHandCursor: true });
  };

  const inScene =
    fallbackRef && Array.isArray(scene.monsters)
      ? scene.monsters.includes(fallbackRef)
      : false;
  const canReuse =
    inScene &&
    !fallbackRef.destroyed &&
    typeof fallbackRef.monsterId === "string" &&
    fallbackRef.monsterId === snapshot.monsterId;

  if (canReuse) {
    fallbackRef.isCombatMember = false;
    fallbackRef.respawnEnabled =
      snapshot.respawnEnabled === undefined ? true : !!snapshot.respawnEnabled;
    fallbackRef.spawnMapKey = snapshot.spawnMapKey ?? scene.currentMapKey ?? null;
    if (snapshot.respawnTemplate && typeof snapshot.respawnTemplate === "object") {
      fallbackRef.respawnTemplate = {
        groupPool: Array.isArray(snapshot.respawnTemplate.groupPool)
          ? snapshot.respawnTemplate.groupPool.slice()
          : null,
        groupSizeMin: snapshot.respawnTemplate.groupSizeMin ?? null,
        groupSizeMax: snapshot.respawnTemplate.groupSizeMax ?? null,
        forceMixedGroup: snapshot.respawnTemplate.forceMixedGroup === true,
      };
    }
    if (typeof snapshot.level === "number") fallbackRef.level = snapshot.level;
    if (snapshot.groupId != null) fallbackRef.groupId = snapshot.groupId;
    if (typeof snapshot.groupSize === "number") fallbackRef.groupSize = snapshot.groupSize;
    if (Array.isArray(snapshot.groupLevels)) fallbackRef.groupLevels = snapshot.groupLevels.slice();
    if (Array.isArray(snapshot.groupMonsterIds))
      fallbackRef.groupMonsterIds = snapshot.groupMonsterIds.slice();
    if (typeof snapshot.groupLevelTotal === "number")
      fallbackRef.groupLevelTotal = snapshot.groupLevelTotal;

    fallbackRef.stats = fallbackRef.stats || {};
    if (typeof snapshot.hpMax === "number") fallbackRef.stats.hpMax = snapshot.hpMax;
    const hpToSet =
      typeof snapshot.hp === "number"
        ? snapshot.hp
        : typeof snapshot.hpMax === "number"
          ? snapshot.hpMax
          : null;
    if (typeof hpToSet === "number") fallbackRef.stats.hp = hpToSet;

    ensurePos(fallbackRef);
    delete fallbackRef._worldSnapshotBeforeCombat;
    return;
  }

  // Sinon, recrée un monstre monde à partir du snapshot.
  let spawnX = snapshot.x;
  let spawnY = snapshot.y;
  if (isValidTile && typeof map.tileToWorldXY === "function") {
    const wp = map.tileToWorldXY(tileX, tileY, undefined, undefined, layer);
    spawnX = wp.x + map.tileWidth / 2;
    spawnY = wp.y + map.tileHeight;
  }

  if (typeof spawnX !== "number" || typeof spawnY !== "number") return;

  const recreated = createMonster(scene, spawnX, spawnY, snapshot.monsterId, snapshot.level);
  recreated.isCombatMember = false;
  recreated.respawnEnabled =
    snapshot.respawnEnabled === undefined ? true : !!snapshot.respawnEnabled;
  recreated.spawnMapKey = snapshot.spawnMapKey ?? scene.currentMapKey ?? null;
  if (snapshot.respawnTemplate && typeof snapshot.respawnTemplate === "object") {
    recreated.respawnTemplate = {
      groupPool: Array.isArray(snapshot.respawnTemplate.groupPool)
        ? snapshot.respawnTemplate.groupPool.slice()
        : null,
      groupSizeMin: snapshot.respawnTemplate.groupSizeMin ?? null,
      groupSizeMax: snapshot.respawnTemplate.groupSizeMax ?? null,
      forceMixedGroup: snapshot.respawnTemplate.forceMixedGroup === true,
    };
  }
  if (typeof snapshot.level === "number") recreated.level = snapshot.level;
  if (snapshot.groupId != null) recreated.groupId = snapshot.groupId;
  if (typeof snapshot.groupSize === "number") recreated.groupSize = snapshot.groupSize;
  if (Array.isArray(snapshot.groupLevels)) recreated.groupLevels = snapshot.groupLevels.slice();
  if (Array.isArray(snapshot.groupMonsterIds))
    recreated.groupMonsterIds = snapshot.groupMonsterIds.slice();
  if (typeof snapshot.groupLevelTotal === "number")
    recreated.groupLevelTotal = snapshot.groupLevelTotal;

  recreated.stats = recreated.stats || {};
  if (typeof snapshot.hpMax === "number") recreated.stats.hpMax = snapshot.hpMax;
  const hpToSet =
    typeof snapshot.hp === "number"
      ? snapshot.hp
      : typeof snapshot.hpMax === "number"
        ? snapshot.hpMax
        : null;
  if (typeof hpToSet === "number") recreated.stats.hp = hpToSet;

  ensurePos(recreated);
  scene.monsters = scene.monsters || [];
  scene.monsters.push(recreated);
}

// Commence un combat : on crée l'état et on active l'UI.
export function startCombat(scene, player, monster) {
  // Si une régénération hors combat était en cours, on l'arrête
  if (scene.playerRegenEvent) {
    scene.playerRegenEvent.remove(false);
    scene.playerRegenEvent = null;
  }

  // Nettoie les effets temporaires (ex: poison) d'un combat précédent
  if (player) {
    player.statusEffects = [];
    if (player.classId === "eryon" || player.classId === "assassin") {
      resetEryonChargeState(player);
    }
    player.captureState = null;
    player.spellCooldowns = player.spellCooldowns || {};
    player.spellCooldowns.invocation_capturee = 0;
  }

  scene.combatState = createCombatState(player, monster);
  scene.combatState.worldMonsterSnapshot = snapshotMonsterForWorld(scene, monster);
  scene.combatSummons = [];
  document.body.classList.add("combat-active");

  // Si un challenge a été tiré pendant la préparation, on le réutilise.
  if (scene.prepState?.challenge && !scene.combatState.challenge) {
    scene.combatState.challenge = scene.prepState.challenge;
  }

  // Met à jour l'affichage des PA/PM du joueur dans le HUD, si dispo
  if (player && typeof player.updateHudApMp === "function") {
    player.updateHudApMp(
      scene.combatState.paRestants,
      scene.combatState.pmRestants
    );
  }

  // Construit l'ordre de tour multi‑acteurs (joueur + monstres).
  buildTurnOrder(scene);

  // Challenge : tirage aléatoire au début du combat.
  initCombatChallenge(scene);

  if (scene && typeof scene.updateCombatUi === "function") {
    scene.updateCombatUi();
  }
}

// Termine le combat, nettoie l'état et l'UI.
export function endCombat(scene) {
  if (!scene.combatState) return;

  const state = scene.combatState;
  state.enCours = false;

  clearAllSummons(scene);
  cleanupCombatChallenge(scene);

  // Nettoie les effets temporaires restants sur le joueur
  if (state.joueur) {
    state.joueur.statusEffects = [];
  }

  // Petit fondu noir � la sortie de combat (retour exploration)
  const cam = scene.cameras && scene.cameras.main;
  if (cam && cam.fadeOut && cam.fadeIn) {
    cam.once("camerafadeoutcomplete", () => {
      cam.fadeIn(1300, 0, 0, 0);
    });
    cam.fadeOut(0, 0, 0, 0);
  }

  // Prépare un petit récapitulatif pour l'UI
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

  // Challenge : finalise pour avoir un statut stable (success/failed) dans le résultat UI.
  finalizeCombatChallenge(scene, { issue });

  const player = state.joueur;
  const levelBefore = player?.levelState?.niveau ?? 1;
  const pointsBefore = player?.levelState?.pointsCaracLibres ?? 0;

  // Nettoyage des monstres "combat only" (membres de pack créés uniquement pour le combat).
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

  // Récompenses : uniquement en victoire, appliquées à la fin (évite les ups en plein combat).
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

    // XP bonus (avant sagesse/level up).
    if (challengeOk && xpGagne > 0) {
      xpGagne = Math.round(xpGagne * (1 + xpBonusPct));
    }

    // Loot : roll en fin de combat, avec bonus de drop si challenge réussi.
    const dropMult = 1 + (challengeOk ? dropBonusPct : 0);
    const lootRolls = rollLootFromSources(state.lootSources || [], dropMult, player);
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
      const currentGold =
        typeof player.gold === "number" && !Number.isNaN(player.gold)
          ? player.gold
          : 0;
      player.gold = currentGold + goldGagne;
    }

    // Respawn du pack leader (monstre monde) après victoire.
    if (
      state.worldMonsterSnapshot &&
      state.worldMonsterSnapshot.respawnEnabled !== false
    ) {
      queueMonsterRespawn(scene, state.worldMonsterSnapshot, 5000);
    }
  } else {
    // Défaite / inconnu : pas de récompenses, et on restaure le monstre monde (PV/position).
    restoreWorldMonsterFromSnapshot(scene, state.worldMonsterSnapshot, state.monstre);
  }

  // Reset des cooldowns à la sortie du combat.
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
    playerXpTotal: player?.levelState?.xp ?? 0,
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

  // Chat (général) : récap XP/or en fin de combat.
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

  // Nettoyage éventuel d'une phase de préparation restante
  if (scene.prepState) {
    if (scene.prepState.highlights) {
      scene.prepState.highlights.forEach((g) => g.destroy());
    }
    scene.prepState = null;
  }

  document.body.classList.remove("combat-active");
  document.body.classList.remove("combat-prep");

  // Nettoyage des références de carte de combat
  scene.combatMap = null;
  scene.combatGroundLayer = null;

  // Liste des monstres engagés dans ce combat (pack éventuel)
  if (scene.combatMonsters && Array.isArray(scene.combatMonsters)) {
    // On marque les membres de ce combat comme n'étant plus "en combat".
    scene.combatMonsters.forEach((m) => {
      if (!m) return;
      m.isCombatMember = false;
    });
    scene.combatMonsters = null;
  }

  // Restaure les monstres du monde cach�s pendant ce combat.
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

  // Nettoyage des �l�ments d'interface li�s � la cible.
  if (scene.clearDamagePreview) {
    scene.clearDamagePreview();
  }
  if (scene.hideMonsterTooltip) {
    scene.hideMonsterTooltip();
  }
  if (scene.hideCombatTargetPanel) {
    scene.hideCombatTargetPanel();
  }

  // Supprime les effets de survol restants sur les monstres.
  const allMonsters = scene.monsters || [];
  allMonsters.forEach((m) => {
    if (!m || !m.hoverHighlight) return;
    if (m.hoverHighlight.destroy) {
      m.hoverHighlight.destroy();
    }
    m.hoverHighlight = null;
  });

  // Démarre la régénération hors combat (+2 PV/s)
  startOutOfCombatRegen(scene, player);

  // Remet l'affichage PA/PM du HUD aux valeurs de base du joueur (exploration)
  if (player && typeof player.updateHudApMp === "function") {
    const basePa = player.stats?.pa ?? 0;
    const basePm = player.stats?.pm ?? 0;
    player.updateHudApMp(basePa, basePm);
  }

  // Notifie l'UI si un gestionnaire est disponible
  if (typeof scene.showCombatResult === "function") {
    scene.showCombatResult(result);
  }

  if (scene && typeof scene.updateCombatUi === "function") {
    scene.updateCombatUi();
  }

  scene.combatState = null;

  // Donjons : auto-exit after boss kill.
  onAfterCombatEnded(scene, result);
}
