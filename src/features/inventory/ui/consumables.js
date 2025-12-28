export function applyConsumableEffect(player, def) {
  if (!player || !def) return false;
  const effect = def.effect || {};
  const stats = player.stats || {};
  let didApply = false;

  if (typeof effect.hpPlus === "number" && effect.hpPlus !== 0) {
    const hp = stats.hp ?? stats.hpMax ?? 0;
    const hpMax = stats.hpMax ?? hp;
    const nextHp = Math.min(hpMax, hp + effect.hpPlus);
    stats.hp = nextHp;
    if (typeof player.updateHudHp === "function") {
      player.updateHudHp(nextHp, hpMax);
    }
    didApply = true;
  }

  const scene = player.scene || null;
  const combat = scene?.combatState?.enCours ? scene.combatState : null;
  if (combat) {
    if (typeof effect.paPlusCombat === "number" && effect.paPlusCombat !== 0) {
      combat.paRestants = Math.max(0, (combat.paRestants ?? 0) + effect.paPlusCombat);
      didApply = true;
    }
    if (typeof effect.pmPlusCombat === "number" && effect.pmPlusCombat !== 0) {
      combat.pmRestants = Math.max(0, (combat.pmRestants ?? 0) + effect.pmPlusCombat);
      didApply = true;
    }
    if (typeof player.updateHudApMp === "function") {
      player.updateHudApMp(combat.paRestants ?? 0, combat.pmRestants ?? 0);
    }
    if (scene && typeof scene.updateCombatUi === "function") {
      scene.updateCombatUi();
    }
  } else {
    if (typeof effect.paPlus === "number" && effect.paPlus !== 0) {
      stats.pa = (stats.pa ?? 0) + effect.paPlus;
      didApply = true;
    }
    if (typeof effect.pmPlus === "number" && effect.pmPlus !== 0) {
      stats.pm = (stats.pm ?? 0) + effect.pmPlus;
      didApply = true;
    }
    if (didApply && typeof player.updateHudApMp === "function") {
      player.updateHudApMp(stats.pa ?? 0, stats.pm ?? 0);
    }
  }

  return didApply;
}
