import {
  getActiveSpell,
  getSpellDamageRange,
  canCastSpellAtTile,
} from "../core/spellSystem.js";

// Attache � la sc�ne Phaser la logique d'affichage
// de la pr�visualisation de d�g�ts au survol d'un monstre.
export function attachCombatPreview(scene) {
  if (!scene) return;

  scene.damagePreviewText = null;
  scene.damagePreviewBg = null;

  scene.showDamagePreview = (monster) => {
    const state = scene.combatState;
    if (!state || !state.enCours || state.tour !== "joueur") return;
    if (!monster || typeof monster.tileX !== "number" || typeof monster.tileY !== "number") {
      return;
    }

    const spell = getActiveSpell(scene.player);
    if (!spell) {
      return;
    }

    const mapForCombat = scene.combatMap || scene.map;
    const layerForCombat = scene.combatGroundLayer || scene.groundLayer;
    if (!mapForCombat || !layerForCombat) return;

    const tileX = monster.tileX;
    const tileY = monster.tileY;

    // Si le sort ne peut pas �tre lanc� sur cette case, on ne montre rien
    if (
      !canCastSpellAtTile(
        scene,
        scene.player,
        spell,
        tileX,
        tileY,
        mapForCombat
      )
    ) {
      scene.clearDamagePreview();
      return;
    }

    const { min, max } = getSpellDamageRange(scene.player, spell);
    const text = `${min} - ${max}`;

    const worldPos = mapForCombat.tileToWorldXY(
      tileX,
      tileY,
      undefined,
      undefined,
      layerForCombat
    );
    const cx = worldPos.x + mapForCombat.tileWidth / 2;
    const cy = worldPos.y + mapForCombat.tileHeight / 2;

    if (scene.damagePreviewText) {
      scene.damagePreviewText.destroy();
      scene.damagePreviewText = null;
    }
    if (scene.damagePreviewBg) {
      scene.damagePreviewBg.destroy();
      scene.damagePreviewBg = null;
    }

    // Position du centre de la bulle (un peu au-dessus du monstre)
    const bubbleCenterX = cx;
    const bubbleCenterY = cy - mapForCombat.tileHeight * 1.2;

    const dmgText = scene.add.text(bubbleCenterX, bubbleCenterY, text, {
      fontFamily: "Arial",
      fontSize: 14,
      color: "#000000",
      stroke: "#ffffff",
      strokeThickness: 1,
      align: "center",
    });
    dmgText.setOrigin(0.5, 0.5);

    const paddingX = 6;
    const paddingY = 2;
    const bgWidth = dmgText.width + paddingX * 2;
    const bgHeight = dmgText.height + paddingY * 2;

    const bg = scene.add.graphics();
    bg.fillStyle(0xffffff, 0.85);
    bg.lineStyle(1, 0x000000, 0.6);
    const radius = 6;
    const bgX = bubbleCenterX - bgWidth / 2;
    const bgY = bubbleCenterY - bgHeight / 2;

    bg.fillRoundedRect(bgX, bgY, bgWidth, bgHeight, radius);
    bg.strokeRoundedRect(bgX, bgY, bgWidth, bgHeight, radius);

    if (scene.hudCamera) {
      scene.hudCamera.ignore(bg);
      scene.hudCamera.ignore(dmgText);
    }
    bg.setDepth(9);
    dmgText.setDepth(10);

    scene.damagePreviewBg = bg;
    scene.damagePreviewText = dmgText;
  };

  scene.clearDamagePreview = () => {
    if (scene.damagePreviewText) {
      scene.damagePreviewText.destroy();
      scene.damagePreviewText = null;
    }
    if (scene.damagePreviewBg) {
      scene.damagePreviewBg.destroy();
      scene.damagePreviewBg = null;
    }
  };
}

