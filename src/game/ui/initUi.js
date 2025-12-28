import { createHud, setupHudCamera } from "../../features/ui/hud.js";
import { setupCamera } from "../../features/maps/camera.js";
import { initDomHud } from "../../features/ui/domHud.js";
import { initDomCombat } from "../../features/combat/ui/domCombat.js";
import { initDomCombatResult } from "../../features/combat/ui/domCombatResult.js";
import { initDomCombatInspector } from "../../features/combat/ui/domCombatInspector.js";
import { initDomSpells } from "../../features/spells/ui/index.js";
import { initDomInventory } from "../../features/inventory/ui/index.js";
import { initDomMetiers } from "../../features/metier/ui/domMetiers.js";
import { initDomQuests } from "../../features/quests/ui/domQuests.js";
import { initDomAchievements } from "../../features/achievements/ui/domAchievements.js";
import { initDomAchievementClaimPanel } from "../../features/achievements/ui/domAchievementClaimPanel.js";
import { initAchievementClaimHint } from "../../features/achievements/ui/domAchievementClaimHint.js";
import { initDomLevelUpPopup } from "../../features/ui/domLevelUpPopup.js";
import { initDomPanelClose } from "../../features/ui/domPanelClose.js";
import { initQuestTracker } from "../../features/quests/ui/domQuestTracker.js";
import { initDomChat } from "../../features/ui/domChat.js";
import { initDomRewardPops } from "../../features/ui/domRewardPops.js";
import { initDomRifts } from "../../features/ui/domRifts.js";

export function setupHudAndCameras(scene, map, mapLayers, startX, startY, mapDef, grid) {
  const { hudY, uiElements } = createHud(scene);
  scene.hudY = hudY;

  const worldElements = [...mapLayers, scene.player];
  if (grid) worldElements.push(grid);
  if (scene.staticTrees) {
    scene.staticTrees.forEach((tree) => worldElements.push(tree));
  }
  if (scene.staticDecor) {
    scene.staticDecor.forEach((obj) => worldElements.push(obj));
  }
  if (scene.bucheronNodes) {
    scene.bucheronNodes.forEach((node) => {
      if (node.sprite) worldElements.push(node.sprite);
    });
  }
  if (scene.alchimisteNodes) {
    scene.alchimisteNodes.forEach((node) => {
      if (node.sprite) worldElements.push(node.sprite);
    });
  }
  if (scene.npcs) {
    scene.npcs.forEach((npc) => {
      if (npc.sprite) worldElements.push(npc.sprite);
    });
  }

  setupCamera(scene, map, startX, startY, mapDef.cameraOffsets);
  setupHudCamera(scene, uiElements, worldElements);

  if (scene.hudCamera && scene.monsters) {
    scene.monsters.forEach((m) => scene.hudCamera.ignore(m));
  }

  return hudY;
}

export function initDomUi(scene, player) {
  initDomHud(player);
  initDomRewardPops();
  initDomCombat(scene);
  initDomCombatInspector(scene);
  initDomSpells(player);
  initDomCombatResult(scene, player);
  initDomInventory(player);
  initDomMetiers(player);
  initDomQuests(player);
  initDomAchievements(player);
  initDomAchievementClaimPanel(player);
  initAchievementClaimHint(player);
  initDomLevelUpPopup();
  initDomPanelClose();
  initQuestTracker(player);
  initDomRifts();
  initDomChat(player);
}
