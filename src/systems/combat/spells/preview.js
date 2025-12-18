import {
  isTileAvailableForSpell,
  isTileInRange,
  getCasterOriginTile,
  hasLineOfSight,
  isTileTargetableForSpell,
} from "./util.js";

// ---------- Prévisualisation de portée (cases bleues) ----------

export function clearSpellRangePreview(scene) {
  if (scene && scene.spellRangePreview) {
    scene.spellRangePreview.clear();
  }
  if (scene && scene.spellEffectPreview) {
    scene.spellEffectPreview.clear();
  }
  if (scene && scene.spellTargetPreview) {
    scene.spellTargetPreview.clear();
  }
}

export function updateSpellRangePreview(
  scene,
  map,
  groundLayer,
  caster,
  spell,
  hoverTileX = null,
  hoverTileY = null
) {
  if (!scene) return;

  if (!scene.spellRangePreview) {
    const g = scene.add.graphics();
    if (scene.hudCamera) {
      scene.hudCamera.ignore(g);
    }
    scene.spellRangePreview = g;
  }

  const g = scene.spellRangePreview;
  // La prévisu doit rester derrière les sprites (monstres/joueur),
  // mais au-dessus de la grille blanche (debug grid).
  g.setDepth(1.2);
  g.clear();

  if (!scene.spellEffectPreview) {
    const effectG = scene.add.graphics();
    if (scene.hudCamera) {
      scene.hudCamera.ignore(effectG);
    }
    scene.spellEffectPreview = effectG;
  }

  const eg = scene.spellEffectPreview;
  // Zone d'effet au-dessus de la portée bleue, mais sous la case ciblée.
  eg.setDepth(1.6);
  eg.clear();

  if (!scene.spellTargetPreview) {
    const targetG = scene.add.graphics();
    if (scene.hudCamera) {
      scene.hudCamera.ignore(targetG);
    }
    scene.spellTargetPreview = targetG;
  }

  const tg = scene.spellTargetPreview;
  // La case ciblée doit être au-dessus de la portée (bleu), mais derrière les sprites.
  tg.setDepth(1.7);
  tg.clear();

  const state = scene.combatState;
  if (!state || !state.enCours || state.tour !== "joueur") {
    return;
  }

  if (!caster || !spell || !map) return;

  const { x: originX, y: originY } = getCasterOriginTile(caster);

  const halfW = map.tileWidth / 2;
  const halfH = map.tileHeight / 2;

  const colorOk = 0x1d4ed8; // bleu foncé (attaquable)
  const colorBlocked = 0x60a5fa; // bleu clair (ligne de vue bloquée)

  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      if (!isTileAvailableForSpell(map, tx, ty)) continue;
      if (spell.castPattern === "line4") {
        if (!(tx === originX || ty === originY)) continue;
      }
      if (!isTileInRange(spell, originX, originY, tx, ty)) continue;

      const tileTargetable = isTileTargetableForSpell(scene, map, tx, ty);
      const losOk =
        !spell.lineOfSight || hasLineOfSight(scene, originX, originY, tx, ty);

      const worldPos = map.tileToWorldXY(tx, ty, undefined, undefined, groundLayer);
      const cx = worldPos.x + map.tileWidth / 2;
      const cy = worldPos.y + map.tileHeight / 2;

      const pts = [
        new Phaser.Math.Vector2(cx, cy - halfH),
        new Phaser.Math.Vector2(cx + halfW, cy),
        new Phaser.Math.Vector2(cx, cy + halfH),
        new Phaser.Math.Vector2(cx - halfW, cy),
      ];

      const canHitTile = tileTargetable && losOk;
      const c = canHitTile ? colorOk : colorBlocked;
      const outlineAlpha = canHitTile ? 0.98 : 0.78;
      const fillAlpha = canHitTile ? 0.30 : 0.18;
      g.lineStyle(1, c, outlineAlpha);
      g.fillStyle(c, fillAlpha);
      g.fillPoints(pts, true);
      g.strokePoints(pts, true);
    }
  }

  // ---------- Case ciblée (survol) ----------
  let tx = typeof hoverTileX === "number" ? hoverTileX : null;
  let ty = typeof hoverTileY === "number" ? hoverTileY : null;

  // Fallback : quand le tile hover n'est pas fiable, on le recalcule directement depuis le pointeur.
  if (
    (typeof tx !== "number" || typeof ty !== "number") &&
    map &&
    groundLayer &&
    scene.input &&
    scene.input.activePointer &&
    typeof map.worldToTileXY === "function"
  ) {
    try {
      const t = map.worldToTileXY(
        scene.input.activePointer.worldX,
        scene.input.activePointer.worldY,
        true,
        undefined,
        undefined,
        groundLayer
      );
      if (t && typeof t.x === "number" && typeof t.y === "number") {
        tx = t.x;
        ty = t.y;
      }
    } catch {
      // ignore
    }
  }

  if (typeof tx === "number" && typeof ty === "number") {
    const inBounds = tx >= 0 && ty >= 0 && tx < map.width && ty < map.height;

    if (inBounds && isTileAvailableForSpell(map, tx, ty)) {
      const isLineOk =
        spell.castPattern !== "line4" || tx === originX || ty === originY;
      const tileTargetable = isTileTargetableForSpell(scene, map, tx, ty);
      const losOk =
        !spell.lineOfSight || hasLineOfSight(scene, originX, originY, tx, ty);
      const isInRange =
        isLineOk &&
        isTileInRange(spell, originX, originY, tx, ty) &&
        losOk &&
        tileTargetable;

      const worldPos = map.tileToWorldXY(tx, ty, undefined, undefined, groundLayer);
      const cx = worldPos.x + map.tileWidth / 2;
      const cy = worldPos.y + map.tileHeight / 2;

      const pts = [
        new Phaser.Math.Vector2(cx, cy - halfH),
        new Phaser.Math.Vector2(cx + halfW, cy),
        new Phaser.Math.Vector2(cx, cy + halfH),
        new Phaser.Math.Vector2(cx - halfW, cy),
      ];

      // Case ciblée discrète (remplie), sans masquer les autres previews (dégâts, etc.).
      const hasZonePreview = !!spell.effectPattern;

      // Sorts mono-cible : on garde la case rouge discrète pour montrer exactement la cible.
      // Sorts de zone : on n'affiche pas la case rouge (évite la double prévisu).
      if (!hasZonePreview) {
        const outlineAlpha = isInRange ? 0.35 : 0.22;
        const fillAlpha = isInRange ? 0.82 : 0.06;
        tg.lineStyle(1, 0xff6666, outlineAlpha);
        tg.fillStyle(0xff6666, fillAlpha);
        tg.fillPoints(pts, true);
        tg.strokePoints(pts, true);
      }

      // ---------- Prévisu de zone d'effet (si applicable) ----------
      const computeEffectTiles = () => {
        const tiles = [];
        const pattern = spell.effectPattern;
        if (!pattern) return tiles;

        if (pattern === "front_cross") {
          const dx = tx === originX ? 0 : Math.sign(tx - originX);
          const dy = ty === originY ? 0 : Math.sign(ty - originY);
          const perpX = dx !== 0 ? 0 : 1;
          const perpY = dx !== 0 ? 1 : 0;
          tiles.push({ x: tx, y: ty });
          tiles.push({ x: tx + dx, y: ty + dy });
          tiles.push({ x: tx + perpX, y: ty + perpY });
          tiles.push({ x: tx - perpX, y: ty - perpY });
          return tiles;
        }

        if (pattern === "line_forward") {
          const dx = tx === originX ? 0 : Math.sign(tx - originX);
          const dy = ty === originY ? 0 : Math.sign(ty - originY);
          const length = spell.effectLength ?? 4;
          for (let i = 1; i <= length; i += 1) {
            tiles.push({ x: originX + dx * i, y: originY + dy * i });
          }
          return tiles;
        }

        return tiles;
      };

      const effectTiles = computeEffectTiles();
      if (effectTiles.length > 0) {
        const zoneOutlineAlpha = isInRange ? 0.28 : 0.16;
        const zoneFillAlpha = isInRange ? 0.62 : 0.05;
        eg.lineStyle(1, 0xff5533, zoneOutlineAlpha);
        eg.fillStyle(0xff5533, zoneFillAlpha);

        for (const tile of effectTiles) {
          if (!tile) continue;
          if (!isTileAvailableForSpell(map, tile.x, tile.y)) continue;

          const wp = map.tileToWorldXY(
            tile.x,
            tile.y,
            undefined,
            undefined,
            groundLayer
          );
          const ex = wp.x + map.tileWidth / 2;
          const ey = wp.y + map.tileHeight / 2;
          const poly = [
            new Phaser.Math.Vector2(ex, ey - halfH),
            new Phaser.Math.Vector2(ex + halfW, ey),
            new Phaser.Math.Vector2(ex, ey + halfH),
            new Phaser.Math.Vector2(ex - halfW, ey),
          ];
          eg.fillPoints(poly, true);
          eg.strokePoints(poly, true);
        }
      }
    }
  }
}
