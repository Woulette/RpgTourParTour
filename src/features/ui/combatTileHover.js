import { findMonsterAtTile } from "../monsters/runtime/index.js";
import { findAliveCombatAllyAtTile, findAliveSummonAtTile } from "../combat/summons/summon.js";
import { createCalibratedWorldToTile } from "../maps/world/util.js";

export function attachCombatTileHover(scene, hudY) {
  if (!scene || !scene.input) return;

  const isPointerOverHud = (pointer) => {
    if (!pointer) return false;
    if (typeof hudY === "number" && pointer.y > hudY) return true;
    return false;
  };

  const clear = (force = false) => {
    const state = scene.combatState;
    const active = !!(state && state.enCours);
    if (!active && !force) return;
    if (scene.__combatHudHoverLock && !force) return;
    if (scene.__combatSpriteHoverLock && !force) return;
    if (scene.hideMonsterTooltip) scene.hideMonsterTooltip();
    if (scene.clearDamagePreview) scene.clearDamagePreview();
    if (scene.hideCombatTargetPanel) scene.hideCombatTargetPanel();
    scene.__combatTileHoverKey = null;
    scene.__combatTileHoverEntity = null;
    scene.__combatTileHoverWasActive = false;
  };

  const update = (pointer) => {
    const state = scene.combatState;
    if (!state || !state.enCours) {
      // Ne pas impacter le survol hors combat.
      // On nettoie uniquement si on sort d'un combat et qu'il restait une UI active.
      if (scene.__combatTileHoverWasActive) {
        clear(true);
      }
      return;
    }
    scene.__combatTileHoverWasActive = true;
    if (scene.__combatSpriteHoverLock) {
      return;
    }
    if (isPointerOverHud(pointer)) {
      if (scene.__combatHudHoverLock) return;
      clear();
      return;
    }

    const map = scene.combatMap;
    const groundLayer = scene.combatGroundLayer;
    if (!map || !groundLayer) {
      clear();
      return;
    }

    const cacheKey = map.key || scene.currentMapKey || "default";
    scene._combatHoverWorldToTileCache = scene._combatHoverWorldToTileCache || {};
    if (!scene._combatHoverWorldToTileCache[cacheKey]) {
      scene._combatHoverWorldToTileCache[cacheKey] = createCalibratedWorldToTile(
        map,
        groundLayer
      );
    }
    const worldToTile = scene._combatHoverWorldToTileCache[cacheKey];
    const t = worldToTile(pointer.worldX, pointer.worldY);
    if (!t) {
      clear();
      return;
    }

    const key = `${t.x},${t.y}`;
    if (scene.__combatTileHoverKey === key) return;
    scene.__combatTileHoverKey = key;

    const monster = findMonsterAtTile(scene, t.x, t.y);
    const ally = !monster ? findAliveCombatAllyAtTile(scene, t.x, t.y) : null;
    const summon = !monster && !ally ? findAliveSummonAtTile(scene, t.x, t.y) : null;
    const player = state.joueur;
    const isPlayerTile =
      player &&
      typeof player.currentTileX === "number" &&
      typeof player.currentTileY === "number" &&
      player.currentTileX === t.x &&
      player.currentTileY === t.y;

    const entity = monster || ally || summon || (isPlayerTile ? player : null);
    if (scene.__combatTileHoverEntity === entity) return;
    scene.__combatTileHoverEntity = entity;

    if (!entity) {
      clear();
      return;
    }

    if ((monster || ally || summon) && scene.showDamagePreview) {
      scene.showDamagePreview(monster || ally || summon);
    } else if (scene.clearDamagePreview) {
      scene.clearDamagePreview();
    }

    if ((monster || ally || summon) && scene.showMonsterTooltip) {
      scene.showMonsterTooltip(monster || ally || summon);
    } else if (scene.hideMonsterTooltip) {
      scene.hideMonsterTooltip();
    }

    if (scene.showCombatTargetPanel) {
      scene.showCombatTargetPanel(entity);
    }
  };

  scene.input.on("pointermove", update);
  scene.input.on("pointerout", () => clear());

  // Si la souris quitte le canvas (over DOM), on nettoie.
  scene.game?.canvas?.addEventListener?.("mouseleave", () => clear());
}
