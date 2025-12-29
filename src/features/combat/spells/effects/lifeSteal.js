import { showFloatingTextOverEntity } from "../../runtime/floatingText.js";

export function applyLifeStealEffect(ctx, effect) {
  const { scene, caster, spell } = ctx;
  if (!scene || !caster || !caster.stats || !spell) return false;
  const enabled = effect?.enabled !== false;
  if (!enabled) return false;

  const last = ctx.lastDamage || null;
  const amount =
    typeof last?.raw === "number"
      ? last.raw
      : typeof last?.final === "number"
        ? last.final
        : 0;
  if (amount <= 0) return false;

  const casterHp = typeof caster.stats.hp === "number" ? caster.stats.hp : caster.stats.hpMax ?? 0;
  const casterHpMax = caster.stats.hpMax ?? casterHp;
  const newCasterHp = Math.min(casterHpMax, casterHp + amount);
  caster.stats.hp = newCasterHp;

  if (typeof caster.updateHudHp === "function") {
    caster.updateHudHp(newCasterHp, casterHpMax);
  }
  if (scene && typeof scene.updateCombatUi === "function") {
    scene.updateCombatUi();
  }

  showFloatingTextOverEntity(scene, caster, `+${amount}`, { color: "#44ff44" });
  return true;
}
