import { openNpcDialog } from "../ui/domNpcDialog.js";
import {
  getQuestContextForNpc,
  getOfferableQuestsForNpc,
  QUEST_STATES,
  acceptQuest,
  advanceQuestStage,
  getQuestState,
  getCurrentQuestStage,
} from "../quests/index.js";
import { getNpcDialog } from "../dialog/npcs/index.js";
import { DIALOG_STATES } from "../dialog/npcs/dialogStates.js";
import {
  countItemInInventory,
  tryTurnInStage,
  getTurnInNpcId,
} from "../quests/runtime/objectives.js";
import { removeItem } from "../inventory/inventoryCore.js";
import { enterDungeon } from "../dungeons/runtime.js";
import { addChatMessage } from "../chat/chat.js";
import { startPrep } from "../core/combat.js";
import { createMonster } from "../entities/monster.js";
import { isTileBlocked } from "../collision/collisionGrid.js";

const DUNGEON_KEY_ITEM_ID = "clef_aluineeks";

function openDialogSequence(npc, player, screens, onDone) {
  const list = Array.isArray(screens) ? screens : [];
  if (list.length === 0) return;

  const openAt = (index) => {
    const screen = list[index];
    if (!screen) return;
    const isLast = index >= list.length - 1;

    openNpcDialog(npc, player, {
      ...screen,
      closeOnChoice: !isLast ? false : screen.closeOnChoice,
      onChoice: () => {
        if (!isLast) return openAt(index + 1);
        if (typeof onDone === "function") onDone();
      },
    });
  };

  openAt(0);
}

function openMultiNpcSequence(player, screens, onDone) {
  const list = Array.isArray(screens) ? screens : [];
  if (list.length === 0) return;

  const openAt = (index) => {
    const screen = list[index];
    if (!screen) return;
    const isLast = index >= list.length - 1;
    const screenNpc = screen.npc || null;
    if (!screenNpc) return;

    openNpcDialog(screenNpc, player, {
      ...screen,
      closeOnChoice: !isLast ? false : screen.closeOnChoice,
      onChoice: () => {
        if (!isLast) return openAt(index + 1);
        if (typeof onDone === "function") onDone();
      },
    });
  };

  openAt(0);
}

function findNpcById(scene, npcId) {
  if (!scene || !npcId || !Array.isArray(scene.npcs)) return null;
  return scene.npcs.find((n) => n && n.id === npcId) || null;
}

function openDialog(npc, player, dialogData, onDone) {
  if (!dialogData) return;

  if (Array.isArray(dialogData.sequence)) {
    const lastIndex = dialogData.sequence.length - 1;
    const screens = dialogData.sequence.map((screen, index) => {
      if (index !== lastIndex) return screen;
      return {
        ...screen,
        questOffer: dialogData.questOffer,
        questTurnIn: dialogData.questTurnIn,
        closeOnChoice:
          screen.closeOnChoice === undefined
            ? dialogData.closeOnChoice
            : screen.closeOnChoice,
      };
    });
    openDialogSequence(npc, player, screens, onDone);
    return;
  }

  openNpcDialog(npc, player, {
    ...dialogData,
    onChoice: () => {
      if (typeof onDone === "function") onDone();
    },
  });
}

function openOfferDialog(npc, player, questDef) {
  if (!npc || !player || !questDef) return;
  const offerState = getQuestState(player, questDef.id);
  const offerStage = getCurrentQuestStage(questDef, offerState);
  const offerDialogDef = getNpcDialog(
    npc.id,
    questDef.id,
    offerState?.state,
    offerStage?.id
  );

  const baseOffer =
    offerDialogDef || { text: "Je te confie une mission.", choice: "J'accepte" };

  openDialog(npc, player, { ...baseOffer, questOffer: true }, () => {
    acceptQuest(player, questDef.id);
  });
}

function openOfferChoiceDialog(npc, player, offerableQuests) {
  const list = Array.isArray(offerableQuests) ? offerableQuests.slice() : [];
  list.sort((a, b) => {
    const aOrder = Number.isFinite(a?.offerChoiceOrder) ? a.offerChoiceOrder : 0;
    const bOrder = Number.isFinite(b?.offerChoiceOrder) ? b.offerChoiceOrder : 0;
    return aOrder - bOrder;
  });
  const first = list[0] || null;
  const second = list[1] || null;
  if (!first || !second) return false;

  const choice1 = first.offerChoiceLabel || first.title || "Mission";
  const choice2 = second.offerChoiceLabel || second.title || "Mission";

  openNpcDialog(npc, player, {
    text: "Que veux tu ?",
    choice: choice1,
    choice2: choice2,
    closeOnChoice: false,
    closeOnChoice2: false,
    onChoice: () => {
      openOfferDialog(npc, player, first);
    },
    onChoice2: () => {
      openOfferDialog(npc, player, second);
    },
  });

  return true;
}

function hasEquippedParchment(player) {
  if (!player || !player.spellParchments) return false;
  return Object.keys(player.spellParchments).length > 0;
}

function startDungeonKeeperDuel(scene, npcInstance, player) {
  if (!scene || !npcInstance || !player) return;
  if (scene.combatState?.enCours || scene.prepState?.actif) return;

  const map = scene.map || scene.combatMap;
  const groundLayer = scene.groundLayer || scene.combatGroundLayer;
  if (!map || !groundLayer) return;

  const sprite = npcInstance.sprite;
  const x = sprite?.x ?? player.x ?? 0;
  const y = sprite?.y ?? player.y ?? 0;
  const monster = createMonster(scene, x, y, "donjon_keeper");
  const tileX = npcInstance.tileX ?? npcInstance.def?.tileX ?? null;
  const tileY = npcInstance.tileY ?? npcInstance.def?.tileY ?? null;
  if (typeof tileX === "number") monster.tileX = tileX;
  if (typeof tileY === "number") monster.tileY = tileY;
  monster.spawnMapKey = scene.currentMapKey ?? scene.currentMapDef?.key ?? null;
  monster.respawnEnabled = false;
  monster.isCombatOnly = true;

  startPrep(scene, player, monster, map, groundLayer, {
    patternId: "mid_range",
    playerOrigin: { x: 12, y: 21 },
    enemyOrigin: { x: 12, y: 10 },
  });
}

function findFreeSpawnTile(scene, map, baseX, baseY) {
  if (!scene || !map) return null;
  const offsets = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
    { x: 1, y: -1 },
    { x: -1, y: -1 },
  ];

  for (const off of offsets) {
    const tx = baseX + off.x;
    const ty = baseY + off.y;
    if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
    if (isTileBlocked(scene, tx, ty)) continue;
    const occupied = Array.isArray(scene.monsters)
      ? scene.monsters.some((m) => m && m.tileX === tx && m.tileY === ty)
      : false;
    if (occupied) continue;
    return { x: tx, y: ty };
  }
  return null;
}

function spawnOmbreTitan(scene, npcInstance, player) {
  if (!scene || !scene.map || !scene.groundLayer) return;
  if (!player) return;
  const already =
    Array.isArray(scene.monsters) &&
    scene.monsters.some((m) => m && m.monsterId === "ombre_titan");
  if (already) return;

  const tile = findFreeSpawnTile(scene, scene.map, 12, 12);
  if (!tile) return;

  const wp = scene.map.tileToWorldXY(
    tile.x,
    tile.y,
    undefined,
    undefined,
    scene.groundLayer
  );
  const monster = createMonster(
    scene,
    wp.x + scene.map.tileWidth / 2,
    wp.y + scene.map.tileHeight,
    "ombre_titan"
  );
  monster.tileX = tile.x;
  monster.tileY = tile.y;
  monster.spawnMapKey = scene.currentMapKey ?? scene.currentMapDef?.key ?? null;
  monster.respawnEnabled = false;

  scene.monsters = scene.monsters || [];
  scene.monsters.push(monster);
}

export function startNpcDialogFlow(scene, player, npc) {
  if (!scene || !player || !npc || !npc.sprite) return;

  const questContext = getQuestContextForNpc(player, npc.id);
  const offerableQuests = getOfferableQuestsForNpc(player, npc.id);
  const isDungeonKeeper = npc.id === "donjonaluineekspnj";
  const resumeState = player?.dungeonResume || null;
  const canResumeDungeon =
    isDungeonKeeper &&
    resumeState &&
    resumeState.dungeonId === "aluineeks" &&
    typeof resumeState.roomIndex === "number";
  const resumeRoomIndex = canResumeDungeon ? resumeState.roomIndex : null;

  // Donjon Aluineeks : si le joueur a la clef et aucune quête en cours sur ce PNJ,
  // on affiche l'option "entrer".
  const keeperAllowsEntry =
    isDungeonKeeper &&
    !questContext &&
    (canResumeDungeon || countItemInInventory(player, DUNGEON_KEY_ITEM_ID) > 0);

  let dialogData = null;
  let onDone = null;

  if (questContext) {
    const { quest, state, stage, offerable, turnInReady } = questContext;

    const objectiveType = stage?.objective?.type;
    const dialogState =
      state.state === QUEST_STATES.IN_PROGRESS &&
      turnInReady &&
      objectiveType &&
      objectiveType !== "talk_to_npc"
        ? DIALOG_STATES.READY_TO_TURN_IN
        : state.state;

    const dialogDef = getNpcDialog(npc.id, quest.id, dialogState, stage?.id);

    if (
      quest.id === "alchimiste_marchand_5" &&
      stage?.id === "craft_parchemin" &&
      state.state === QUEST_STATES.IN_PROGRESS &&
      turnInReady &&
      objectiveType === "craft_items"
    ) {
      const base =
        dialogDef || { text: "Parfait ! Montre moi le parchemin.", choice: "D'accord." };
      openDialog(
        npc,
        player,
        { ...base, questTurnIn: true, closeOnChoice: false },
        () => {
          const result = tryTurnInStage(scene, player, quest.id, quest, state, stage);
          if (!result.ok) return;
          advanceQuestStage(player, quest.id, { scene });

          const nextState = getQuestState(player, quest.id, { emit: false });
          const nextStage = getCurrentQuestStage(quest, nextState);
          if (!nextStage || nextStage.npcId !== npc.id) return;
          const nextDialog = getNpcDialog(
            npc.id,
            quest.id,
            QUEST_STATES.IN_PROGRESS,
            nextStage.id
          );
          const fallback = {
            text:
              "Parfait ! Le plus dur est derriere nous.\n" +
              "Il reste a appliquer le parchemin sur un de tes sorts.\n" +
              "Fais-le, puis reviens me voir.",
            choice: "D'accord.",
          };
          openDialog(
            npc,
            player,
            { ...(nextDialog || fallback), closeOnChoice: true },
            () => {
              const followState = getQuestState(player, quest.id);
              const followStage = getCurrentQuestStage(quest, followState);
              if (!followStage || followStage.npcId !== npc.id) return;
              const turnIn = tryTurnInStage(
                scene,
                player,
                quest.id,
                quest,
                followState,
                followStage
              );
              if (!turnIn.ok) return;
              advanceQuestStage(player, quest.id, { scene });
            }
          );
        }
      );
      return;
    }

    if (
      quest.id === "alchimiste_marchand_3" &&
      stage?.id === "meet_maire_marchand" &&
      npc.id === "maire_albinos_marchand" &&
      state.state === QUEST_STATES.IN_PROGRESS &&
      turnInReady
    ) {
      const marchandNpc = findNpcById(scene, "marchand_boutique") || npc;
      const screens = [
        {
          npc,
          text: "Peux-tu me confirmer les faits devant le marchand ?",
          choice: "Oui.",
        },
        {
          npc: marchandNpc,
          text: "Je nie les faits.",
          choice: "Pointer du doigt les potions.",
        },
        {
          npc,
          text:
            "Si tu ne rembourses pas les potions, tu devras plier bagage.",
          choice: "Merci.",
        },
        {
          npc: marchandNpc,
          text: "Je m'excuse. Je vais rembourser.",
          choice: "D'accord.",
        },
      ];

      openMultiNpcSequence(player, screens, () => {
        const questDef = quest;
        const remaining = questDef.stages.length - (state.stageIndex || 0);
        for (let i = 0; i < remaining; i += 1) {
          advanceQuestStage(player, quest.id, { scene });
        }
      });
      return;
    }

    if (
      quest.id === "maire_donjon_keeper_1" &&
      stage?.id === "talk_to_keeper" &&
      npc.id === "donjonaluineekspnj" &&
      state.state === QUEST_STATES.IN_PROGRESS
    ) {
      const base = dialogDef || {
        text: "Qu'est-ce que tu fais la ?",
        choice: "Le maire m'envoie.",
      };
      openDialog(npc, player, base, () => {
        scene.pendingQuestAfterDuel = {
          questId: quest.id,
          monsterId: "donjon_keeper",
        };
        startDungeonKeeperDuel(scene, npc, player);
      });
      return;
    }

    if (offerable && state.state === QUEST_STATES.NOT_STARTED) {
      if (offerableQuests.length > 1) {
        const opened = openOfferChoiceDialog(npc, player, offerableQuests);
        if (opened) return;
      }
      const base = dialogDef || { text: "Salut, tu veux aider ?", choice: "J'accepte" };
      dialogData = { ...base, questOffer: true };
      onDone = () => {
        acceptQuest(player, quest.id);
      };
    } else if (state.state === QUEST_STATES.IN_PROGRESS && turnInReady) {
      const base = dialogDef || {
        text: "Merci pour le coup de main !",
        choice: "A plus tard.",
      };
      const shouldChainOffer =
        (npc.id === "meme_village" && quest.id === "andemia_intro_1") ||
        (npc.id === "alchimiste_provisoire" && quest.id === "andemia_intro_2") ||
        (npc.id === "alchimiste_provisoire" && quest.id === "andemia_intro_3") ||
        (npc.id === "marchand_boutique" && quest.id === "alchimiste_marchand_1") ||
        (npc.id === "alchimiste_provisoire" && quest.id === "alchimiste_marchand_2") ||
        (npc.id === "marchand_boutique" && quest.id === "alchimiste_marchand_3") ||
        (npc.id === "marchand_boutique" && quest.id === "alchimiste_marchand_4") ||
        (npc.id === "maire_albinos" && quest.id === "maire_corbeaux_1") ||
        (npc.id === "maire_albinos" && quest.id === "maire_gobelins_cazards_1") ||
        (npc.id === "maire_albinos" && quest.id === "maire_goush_cedre_1") ||
        (npc.id === "maire_albinos" && quest.id === "maire_libarene_liburion_1") ||
        (npc.id === "donjonaluineekspnj" && quest.id === "keeper_senbone_1");
      dialogData = {
        ...base,
        questTurnIn: true,
        closeOnChoice: shouldChainOffer ? false : undefined,
      };
      let hasTurnedIn = false;
      onDone = () => {
        if (hasTurnedIn) return;
        hasTurnedIn = true;
        if (objectiveType === "talk_to_npc") {
          const turnInNpcId = getTurnInNpcId(stage);
          if (turnInNpcId && turnInNpcId !== npc.id) {
            hasTurnedIn = false;
            return;
          }
          if (
            quest.id === "alchimiste_marchand_5" &&
            stage?.id === "apply_parchemin" &&
            !hasEquippedParchment(player)
          ) {
            openDialog(npc, player, {
              text: "Tu dois d'abord equiper le parchemin sur un sort.",
              choice: "D'accord.",
              closeOnChoice: true,
            });
            hasTurnedIn = false;
            return;
          }
        }
        const result = tryTurnInStage(scene, player, quest.id, quest, state, stage);
        if (!result.ok) return;
        advanceQuestStage(player, quest.id, { scene });

        const nextState = getQuestState(player, quest.id, { emit: false });
        const nextStage = getCurrentQuestStage(quest, nextState);
        if (
          quest.id === "keeper_north_explosion_1" &&
          stage?.id === "return_to_maire_north" &&
          nextStage?.id === "kill_ombre_titan"
        ) {
          spawnOmbreTitan(scene, npc, player);
        }
        const offersAfter = getOfferableQuestsForNpc(player, npc.id);
        if (
          nextState.state === QUEST_STATES.IN_PROGRESS &&
          nextStage &&
          nextStage.npcId === npc.id &&
          nextStage.objective?.type === "talk_to_npc"
        ) {
          const nextDialogDef = getNpcDialog(
            npc.id,
            quest.id,
            QUEST_STATES.IN_PROGRESS,
            nextStage.id
          );
          const fallback = { text: "Bien. On continue.", choice: "D'accord." };
          openDialog(npc, player, nextDialogDef || fallback);
          return;
        }

        // Chain offer: after completing intro 1 at Meme, she proposes intro 2.
        if (shouldChainOffer) {
          const offers = getOfferableQuestsForNpc(player, npc.id);
          let forcedQuestId = null;
          if (npc.id === "meme_village" && quest.id === "andemia_intro_1") {
            forcedQuestId = "andemia_intro_2";
          } else if (
            npc.id === "alchimiste_provisoire" &&
            quest.id === "andemia_intro_2"
          ) {
            forcedQuestId = "andemia_intro_3";
          } else if (
            npc.id === "alchimiste_provisoire" &&
            quest.id === "andemia_intro_3"
          ) {
            forcedQuestId = "andemia_intro_4";
          } else if (
            npc.id === "marchand_boutique" &&
            quest.id === "alchimiste_marchand_1"
          ) {
            forcedQuestId = "alchimiste_marchand_2";
          } else if (
            npc.id === "alchimiste_provisoire" &&
            quest.id === "alchimiste_marchand_2"
          ) {
            forcedQuestId = "alchimiste_marchand_3";
          } else if (
            npc.id === "marchand_boutique" &&
            quest.id === "alchimiste_marchand_3"
          ) {
            forcedQuestId = "alchimiste_marchand_4";
          } else if (
            npc.id === "marchand_boutique" &&
            quest.id === "alchimiste_marchand_4"
          ) {
            forcedQuestId = "alchimiste_marchand_5";
          } else if (
            npc.id === "maire_albinos" &&
            quest.id === "maire_corbeaux_1"
          ) {
            forcedQuestId = "maire_gobelins_cazards_1";
          } else if (
            npc.id === "maire_albinos" &&
            quest.id === "maire_gobelins_cazards_1"
          ) {
            forcedQuestId = "maire_goush_cedre_1";
          } else if (
            npc.id === "maire_albinos" &&
            quest.id === "maire_goush_cedre_1"
          ) {
            forcedQuestId = "maire_libarene_liburion_1";
          } else if (
            npc.id === "donjonaluineekspnj" &&
            quest.id === "keeper_senbone_1"
          ) {
            forcedQuestId = "keeper_north_explosion_1";
          }

          if (forcedQuestId) {
            const forced = offers.find((o) => o.id === forcedQuestId);
            if (forced) {
              openOfferDialog(npc, player, forced);
              return;
            }
          }

          if (offers.length > 1) {
            openOfferChoiceDialog(npc, player, offers);
            return;
          }
          if (offers.length === 1) {
            openOfferDialog(npc, player, offers[0]);
          }
        }

        if (offersAfter.length > 0) {
          if (offersAfter.length > 1) {
            openOfferChoiceDialog(npc, player, offersAfter);
            return;
          }
          openOfferDialog(npc, player, offersAfter[0]);
        }
      };
    } else {
      if (
        npc.id === "donjonaluineekspnj" &&
        quest.id === "keeper_senbone_1" &&
        state.state === QUEST_STATES.IN_PROGRESS &&
        !turnInReady
      ) {
        const base = dialogDef || getNpcDialog(npc.id) || {
          text: "Bonjour.",
          choice: "A plus tard.",
        };
        const hasKey = countItemInInventory(player, DUNGEON_KEY_ITEM_ID) > 0;
        if (canResumeDungeon && typeof resumeRoomIndex === "number" && hasKey) {
          openNpcDialog(npc, player, {
            ...base,
            choice: "Presenter sa clef",
            choice2: "Reprendre ou tu en etais",
            closeOnChoice: true,
            closeOnChoice2: true,
            onChoice: () => {
              const removed = removeItem(player.inventory, DUNGEON_KEY_ITEM_ID, 1);
              if (removed > 0) {
                addChatMessage(
                  {
                    kind: "info",
                    channel: "quest",
                    author: "Donjon",
                    text: "Clef de donjon consommee.",
                  },
                  { player }
                );
                enterDungeon(scene, "aluineeks");
              }
            },
            onChoice2: () => {
              player.dungeonResume = null;
              enterDungeon(scene, "aluineeks", { roomIndex: resumeRoomIndex });
            },
          });
          return;
        }
        if (canResumeDungeon && typeof resumeRoomIndex === "number") {
          openNpcDialog(npc, player, {
            ...base,
            choice2: "Reprendre ou tu en etais",
            closeOnChoice: false,
            closeOnChoice2: true,
            onChoice: () => {
              if (typeof onDone === "function") onDone();
            },
            onChoice2: () => {
              player.dungeonResume = null;
              enterDungeon(scene, "aluineeks", { roomIndex: resumeRoomIndex });
            },
          });
          return;
        }
        if (hasKey) {
          openNpcDialog(npc, player, {
            ...base,
            choice2: "Presenter sa clef",
            closeOnChoice: true,
            closeOnChoice2: true,
            onChoice: () => {
              if (typeof onDone === "function") onDone();
            },
            onChoice2: () => {
              const removed = removeItem(player.inventory, DUNGEON_KEY_ITEM_ID, 1);
              if (removed > 0) {
                addChatMessage(
                  {
                    kind: "info",
                    channel: "quest",
                    author: "Donjon",
                    text: "Clef de donjon consommee.",
                  },
                  { player }
                );
                enterDungeon(scene, "aluineeks");
              }
            },
          });
          return;
        }
      }

      dialogData = dialogDef || getNpcDialog(npc.id) || {
        text: "Bonjour.",
        choice: "A plus tard.",
      };
    }
  } else {
    dialogData = getNpcDialog(npc.id) || { text: "Bonjour.", choice: "A plus tard." };
  }

  if (keeperAllowsEntry && dialogData) {
    const hasKey = countItemInInventory(player, DUNGEON_KEY_ITEM_ID) > 0;
    openNpcDialog(npc, player, {
      ...dialogData,
      choice: hasKey ? "Presenter sa clef" : dialogData.choice,
      choice2: canResumeDungeon ? "Reprendre ou tu en etais" : null,
      closeOnChoice: !!hasKey,
      closeOnChoice2: canResumeDungeon ? true : undefined,
      onChoice: () => {
        if (!hasKey) {
          if (typeof onDone === "function") onDone();
          return;
        }
        const removed = removeItem(player.inventory, DUNGEON_KEY_ITEM_ID, 1);
        if (removed > 0) {
          addChatMessage(
            {
              kind: "info",
              channel: "quest",
              author: "Donjon",
              text: "Clef de donjon consommee.",
            },
            { player }
          );
          enterDungeon(scene, "aluineeks");
        }
      },
      onChoice2: () => {
        if (canResumeDungeon && typeof resumeRoomIndex === "number") {
          player.dungeonResume = null;
          enterDungeon(scene, "aluineeks", { roomIndex: resumeRoomIndex });
        }
      },
    });
    return;
  }

  openDialog(npc, player, dialogData, onDone);
}
