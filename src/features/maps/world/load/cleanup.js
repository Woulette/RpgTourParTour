import { clearStoryPortals } from "../storyPortals.js";

export function cleanupSceneForMapLoad(scene) {
  if (!scene) return;

  // Reset any pending combat target when changing maps.
  scene.pendingCombatTarget = null;
  if (scene.hideMonsterTooltip) {
    scene.hideMonsterTooltip();
  }
  if (scene.clearDamagePreview) {
    scene.clearDamagePreview();
  }
  if (scene.hideCombatTargetPanel) {
    scene.hideCombatTargetPanel();
  }
  scene.__combatSpriteHoverLock = false;
  scene.__combatSpriteHoverEntity = null;

  if (Array.isArray(scene.workstations)) {
    scene.workstations.forEach((w) => {
      if (w?.hoverHighlight?.destroy) w.hoverHighlight.destroy();
      if (w?.sprite?.hoverHighlight?.destroy) w.sprite.hoverHighlight.destroy();
      if (w?.sprite) w.sprite.hoverHighlight = null;
      if (w?.sprite?.destroy) w.sprite.destroy();
    });
  }
  scene.workstations = [];

  if (Array.isArray(scene.monsters)) {
    scene.monsters.forEach((m) => {
      if (m?.hoverHighlight?.destroy) m.hoverHighlight.destroy();
      m.hoverHighlight = null;
      if (m?.roamTween?.stop) m.roamTween.stop();
      if (m?.roamTimer?.remove) m.roamTimer.remove(false);
      if (m?.destroy) m.destroy();
    });
    scene.monsters = [];
  }

  if (Array.isArray(scene.npcs)) {
    scene.npcs.forEach((npc) => {
      if (npc?.hoverHighlight?.destroy) npc.hoverHighlight.destroy();
      npc.hoverHighlight = null;
      if (npc?.questMarker?.destroy) npc.questMarker.destroy();
      npc.questMarker = null;
      if (npc?.sprite?.destroy) npc.sprite.destroy();
    });
    scene.npcs = [];
  }

  if (Array.isArray(scene.bucheronNodes)) {
    scene.bucheronNodes.forEach((node) => {
      if (node?.hoverHighlight?.destroy) node.hoverHighlight.destroy();
      node.hoverHighlight = null;
      if (node?.sprite?.destroy) node.sprite.destroy();
    });
    scene.bucheronNodes = [];
  }

  if (Array.isArray(scene.alchimisteNodes)) {
    scene.alchimisteNodes.forEach((node) => {
      if (node?.hoverHighlight?.destroy) node.hoverHighlight.destroy();
      node.hoverHighlight = null;
      if (node?.sprite?.destroy) node.sprite.destroy();
    });
    scene.alchimisteNodes = [];
  }

  if (Array.isArray(scene.wellNodes)) {
    scene.wellNodes.forEach((node) => {
      if (node?.hoverHighlight?.destroy) node.hoverHighlight.destroy();
      node.hoverHighlight = null;
      if (node?.sprite?.destroy) node.sprite.destroy();
    });
    scene.wellNodes = [];
  }

  if (Array.isArray(scene.riftNodes)) {
    scene.riftNodes.forEach((node) => {
      if (node?.hoverHighlight?.destroy) node.hoverHighlight.destroy();
      node.hoverHighlight = null;
      if (node?.sprite?.destroy) node.sprite.destroy();
    });
    scene.riftNodes = [];
  }

  clearStoryPortals(scene);

  if (Array.isArray(scene.staticTrees)) {
    scene.staticTrees.forEach((s) => {
      if (s?.destroy) s.destroy();
    });
    scene.staticTrees = [];
  }

  if (Array.isArray(scene.staticDecor)) {
    scene.staticDecor.forEach((s) => {
      if (s?.destroy) s.destroy();
    });
    scene.staticDecor = [];
  }

  if (Array.isArray(scene.mapLayers) && scene.mapLayers.length > 0) {
    scene.mapLayers.forEach((layer) => {
      if (layer?.setVisible) layer.setVisible(false);
    });
  } else if (scene.groundLayer?.setVisible) {
    scene.groundLayer.setVisible(false);
  }
}
