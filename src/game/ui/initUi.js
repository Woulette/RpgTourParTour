import { createHud, setupHudCamera } from "../../ui/hud.js";
import { setupCamera } from "../../maps/camera.js";
import { initDomHud } from "../../ui/domHud.js";
import { initDomCombat } from "../../ui/domCombat.js";
import { initDomCombatResult } from "../../ui/domCombatResult.js";
import { initDomCombatInspector } from "../../ui/domCombatInspector.js";
import { initDomSpells } from "../../ui/domSpells/index.js";
import { initDomInventory } from "../../ui/domInventory/index.js";
import { initDomMetiers } from "../../ui/domMetiers.js";
import { initDomQuests } from "../../ui/domQuests.js";
import { initDomAchievements } from "../../ui/domAchievements.js";
import { initDomAchievementClaimPanel } from "../../ui/domAchievementClaimPanel.js";
import { initAchievementClaimHint } from "../../ui/domAchievementClaimHint.js";
import { initDomLevelUpPopup } from "../../ui/domLevelUpPopup.js";
import { initDomPanelClose } from "../../ui/domPanelClose.js";
import { initQuestTracker } from "../../ui/domQuestTracker.js";
import { initDomChat } from "../../ui/domChat.js";
import { initDomRewardPops } from "../../ui/domRewardPops.js";
import { initDomRifts } from "../../ui/domRifts.js";

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
