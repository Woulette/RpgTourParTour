import { openTailleurCraftPanel } from "../ui/craft/tailleurPanel.js";
import { createCalibratedWorldToTile } from "../maps/world/util.js";
import { blockTile, isTileBlocked } from "../collision/collisionGrid.js";
import { findPathForPlayer } from "../entities/movement/pathfinding.js";
import { movePlayerAlongPath } from "../entities/movement/runtime.js";

function destroyExistingWorkstations(scene) {
  if (Array.isArray(scene.workstations)) {
    scene.workstations.forEach((w) => {
      if (w?.hoverHighlight?.destroy) w.hoverHighlight.destroy();
      if (w?.sprite?.destroy) w.sprite.destroy();
    });
  }
  scene.workstations = [];
}

export function setupWorkstations(scene, map, groundLayer, mapDef) {
  destroyExistingWorkstations(scene);
  if (!scene || !map || !groundLayer || !mapDef) {
    return;
  }

  const created = [];
  const worldToTile = createCalibratedWorldToTile(map, groundLayer);

  const addWorkstation = (ws) => {
    if (!ws || typeof ws.tileX !== "number" || typeof ws.tileY !== "number") {
      return;
    }

    const center = map.tileToWorldXY(
      ws.tileX,
      ws.tileY,
      undefined,
      undefined,
      groundLayer
    );
    if (!center) return;

    const offsetX = typeof ws.offsetX === "number" ? ws.offsetX : 0;
    const offsetY = typeof ws.offsetY === "number" ? ws.offsetY : 0;

    const x = center.x + map.tileWidth / 2 + offsetX;
    // Base au pied de la tuile (comme les arbres), avec offsetY optionnel pour ajuster visuellement.
    const y = center.y + map.tileHeight + offsetY;

    const textureKey = ws.textureKey || "TableDeCraftTailleur";
    const frame = ws.frame ?? 0;

    const sprite = scene.add.sprite(x, y, textureKey, frame);
    sprite.setOrigin(0.5, 1);
    // Depth plus bas que le joueur pour qu'il passe toujours devant la table.
    sprite.setDepth(y - 1);
    sprite.setInteractive({ useHandCursor: true, pixelPerfect: true });
    if (scene.hudCamera) {
      scene.hudCamera.ignore(sprite);
    }

    // Bloque la tuile de la table
    blockTile(scene, ws.tileX, ws.tileY);

    const isAdjacent = () => {
      if (
        typeof scene.player?.currentTileX !== "number" ||
        typeof scene.player?.currentTileY !== "number"
      ) {
        return false;
      }
      const dx = Math.abs(scene.player.currentTileX - ws.tileX);
      const dy = Math.abs(scene.player.currentTileY - ws.tileY);
      return dx + dy === 1;
    };

    const findAdjacentFreeTile = () => {
      const candidates = [
        { x: ws.tileX + 1, y: ws.tileY },
        { x: ws.tileX - 1, y: ws.tileY },
        { x: ws.tileX, y: ws.tileY + 1 },
        { x: ws.tileX, y: ws.tileY - 1 },
      ];
      const inside = (t) =>
        t.x >= 0 && t.x < map.width && t.y >= 0 && t.y < map.height;
      const free = candidates.filter(
        (t) => inside(t) && !isTileBlocked(scene, t.x, t.y)
      );
      if (free.length === 0) return null;
      if (
        typeof scene.player?.currentTileX === "number" &&
        typeof scene.player?.currentTileY === "number"
      ) {
        free.sort((a, b) => {
          const da =
            (a.x - scene.player.currentTileX) ** 2 +
            (a.y - scene.player.currentTileY) ** 2;
          const db =
            (b.x - scene.player.currentTileX) ** 2 +
            (b.y - scene.player.currentTileY) ** 2;
          return da - db;
        });
      }
      return free[0];
    };

    sprite.on("pointerover", () => {
      if (sprite.hoverHighlight || !scene.add) return;
      const overlay = scene.add.sprite(sprite.x, sprite.y, textureKey, frame);
      overlay.setOrigin(sprite.originX, sprite.originY);
      overlay.setBlendMode(Phaser.BlendModes.ADD);
      overlay.setAlpha(0.35);
      overlay.setDepth(sprite.depth + 1);
      if (scene.hudCamera) scene.hudCamera.ignore(overlay);
      sprite.hoverHighlight = overlay;
    });

    sprite.on("pointerout", () => {
      if (sprite.hoverHighlight) {
        sprite.hoverHighlight.destroy();
        sprite.hoverHighlight = null;
      }
    });

    sprite.on("pointerdown", (pointer, lx, ly, event) => {
      if (event?.stopPropagation) event.stopPropagation();
      if (sprite.hoverHighlight) {
        sprite.hoverHighlight.destroy();
        sprite.hoverHighlight = null;
      }

      const player = scene.player;
      if (!player) return;

      // Stoppe un déplacement en cours pour éviter les jitters quand on change de cible
      if (player.currentMoveTween) {
        player.currentMoveTween.stop();
        player.currentMoveTween = null;
        player.isMoving = false;
        player.movePath = [];
      }

      const openPanel = () => {
        if (ws.id === "tailleur") {
          openTailleurCraftPanel(scene, scene?.player);
        }
      };

      if (isAdjacent()) {
        openPanel();
        return;
      }

      const targetTile = findAdjacentFreeTile();
      if (!targetTile) return;

      const allowDiagonal = !(scene.combatState && scene.combatState.enCours);
      const path = findPathForPlayer(
        scene,
        map,
        player.currentTileX,
        player.currentTileY,
        targetTile.x,
        targetTile.y,
        allowDiagonal
      );

      if (!path || path.length === 0) return;

      movePlayerAlongPath(
        scene,
        player,
        map,
        groundLayer,
        path,
        0,
        () => {
          if (isAdjacent()) {
            openPanel();
          }
        }
      );
    });

    created.push({ ...ws, sprite, hoverHighlight: null });
  };

  // 1) Définis dans mapDef (tileX/tileY)
  if (Array.isArray(mapDef.workstations)) {
    mapDef.workstations.forEach(addWorkstation);
  }

  // 2) Calque d'objets "workstations" (ou "Workstations") dans Tiled
  const layer =
    map.getObjectLayer("workstations") || map.getObjectLayer("Workstations");
  if (layer && Array.isArray(layer.objects)) {
    layer.objects.forEach((obj) => {
      if (!obj) return;

      const getProp = (name) => {
        if (!obj.properties) return undefined;
        const p = obj.properties.find((prop) => prop.name === name);
        return p ? p.value : undefined;
      };

      const id =
        getProp("workstationId") ||
        getProp("id") ||
        obj.type ||
        obj.name ||
        null;
      if (!id) return;

      let tileX = getProp("tileX");
      let tileY = getProp("tileY");

      if (
        (typeof tileX !== "number" || typeof tileY !== "number") &&
        typeof obj.x === "number" &&
        typeof obj.y === "number"
      ) {
        const t = worldToTile(obj.x, obj.y);
        if (t) {
          tileX = t.x;
          tileY = t.y;
        }
      }

      if (typeof tileX !== "number" || typeof tileY !== "number") return;

      addWorkstation({ id, tileX, tileY });
    });
  }

  scene.workstations = created;
}
