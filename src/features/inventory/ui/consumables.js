export function applyConsumableEffect(player, def) {
  if (!player || !def) return false;
  const scene = player.scene || null;
  if (scene?.combatState?.enCours) return false;
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

  return didApply;
}
