function clampNonNegative(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function clampPct(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function normalizePctInput(value, fallbackPct) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return clampPct(fallbackPct ?? 0);
  }
  if (value > 1) return clampPct(value);
  return clampPct(value * 100);
}

function randomBetween(min, max) {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (hi <= lo) return lo;
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function getFixedResistanceForElement(stats, element) {
  const s = stats || {};
  switch (element) {
    case "force":
    case "terre":
      return clampNonNegative(s.resistanceFixeTerre ?? 0);
    case "intelligence":
    case "feu":
      return clampNonNegative(s.resistanceFixeFeu ?? 0);
    case "agilite":
    case "air":
      return clampNonNegative(s.resistanceFixeAir ?? 0);
    case "chance":
    case "eau":
      return clampNonNegative(s.resistanceFixeEau ?? 0);
    default:
      return 0;
  }
}

function applyFixedResistanceToDamage(damage, stats, element) {
  const safeDamage = clampNonNegative(damage);
  const resist = getFixedResistanceForElement(stats, element);
  return Math.max(0, safeDamage - resist);
}

function applyShieldToDamage(targetEntry, damage) {
  if (!targetEntry || !Array.isArray(targetEntry.statusEffects)) {
    return { damage, absorbed: 0 };
  }
  let remaining = Math.max(0, damage);
  let absorbed = 0;
  let touched = false;

  targetEntry.statusEffects.forEach((effect) => {
    if (!effect || effect.type !== "shield") return;
    if ((effect.turnsLeft ?? 0) <= 0) return;
    if (remaining <= 0) return;
    const amount = typeof effect.amount === "number" ? effect.amount : 0;
    if (amount <= 0) return;
    const used = Math.min(amount, remaining);
    effect.amount = amount - used;
    remaining -= used;
    absorbed += used;
    touched = true;
    if (effect.amount <= 0) {
      effect.turnsLeft = 0;
    }
  });

  if (touched) {
    targetEntry.statusEffects = targetEntry.statusEffects.filter(
      (effect) =>
        effect &&
        (effect.type !== "shield" ||
          ((effect.turnsLeft ?? 0) > 0 && (effect.amount ?? 0) > 0))
    );
  }

  return { damage: remaining, absorbed };
}

function getSpellCritChancePct(casterStats, spell) {
  const basePct = normalizePctInput(spell?.critChanceBasePct, 5);
  const bonusPct =
    typeof casterStats?.critChancePct === "number" ? casterStats.critChancePct : 0;
  return clampPct(basePct + bonusPct);
}

function rollSpellCrit(casterStats, spell) {
  const chancePct = getSpellCritChancePct(casterStats, spell);
  if (chancePct <= 0) return false;
  return Math.random() < chancePct / 100;
}

function getBonusPuissanceFromStatusEffects(caster) {
  const effects = Array.isArray(caster?.statusEffects) ? caster.statusEffects : [];
  if (effects.length === 0) return 0;
  let sum = 0;
  effects.forEach((eff) => {
    if (!eff || eff.type !== "puissance") return;
    if ((eff.turnsLeft ?? 0) <= 0) return;
    sum += clampNonNegative(eff.amount ?? 0);
  });
  return sum;
}

function getPuissanceForDamage(caster, casterStats) {
  const base = clampNonNegative(casterStats?.puissance ?? 0);
  return base + getBonusPuissanceFromStatusEffects(caster);
}

function getElementStatWithPuissance(caster, casterStats, spell) {
  if (!casterStats || !spell) return 0;
  const element = spell.element;
  const puissance = getPuissanceForDamage(caster, casterStats);

  switch (element) {
    case "force":
    case "terre":
      return (casterStats.force ?? 0) + puissance;
    case "intelligence":
    case "feu":
      return (casterStats.intelligence ?? 0) + puissance;
    case "agilite":
    case "air":
      return (casterStats.agilite ?? 0) + puissance;
    case "chance":
    case "eau":
      return (casterStats.chance ?? 0) + puissance;
    default:
      return 0;
  }
}

function getFlatDamageBonus(casterStats, spell) {
  if (!casterStats || !spell) return 0;
  const stats = casterStats;
  const element = spell.element;
  const all = stats.dommage ?? 0;

  switch (element) {
    case "force":
    case "terre":
      return all + (stats.dommageTerre ?? 0);
    case "intelligence":
    case "feu":
      return all + (stats.dommageFeu ?? 0);
    case "agilite":
    case "air":
      return all + (stats.dommageAir ?? 0);
    case "chance":
    case "eau":
      return all + (stats.dommageEau ?? 0);
    default:
      return all;
  }
}

function computeSpellDamageWithCrit(caster, spell, { forceCrit = null } = {}) {
  const casterStats = caster?.stats || null;
  const isCrit = typeof forceCrit === "boolean" ? forceCrit : rollSpellCrit(casterStats, spell);
  const baseMin = spell?.damageMin ?? 0;
  const baseMax = spell?.damageMax ?? baseMin;
  const critMin = spell?.damageCritMin ?? baseMin;
  const critMax = typeof spell?.damageCritMax === "number" ? spell.damageCritMax : critMin;
  const baseDamage = isCrit ? randomBetween(critMin, critMax) : randomBetween(baseMin, baseMax);
  const elemStat = getElementStatWithPuissance(caster, casterStats, spell);
  const bonusPercent = elemStat * 0.02;
  const multiplier = 1 + bonusPercent;
  const scaled = Math.round(baseDamage * multiplier);
  const flat = getFlatDamageBonus(casterStats, spell);
  const critFlat = isCrit ? clampNonNegative(casterStats?.dommagesCrit ?? 0) : 0;
  let total = Math.max(0, scaled + flat + critFlat);

  if (spell?.id === "surcharge_instable" && caster?.classId === "eryon") {
    const charges = clampNonNegative(caster?.eryonChargeState?.charges ?? 0);
    const consumed = Math.min(5, Math.floor(charges));
    if (consumed > 0) {
      total = Math.round(total * (1 + 0.1 * consumed));
      caster.eryonChargeState.charges = Math.max(0, charges - consumed);
    }
  }

  const damage = isCrit ? Math.ceil(total) : total;
  return { damage, isCrit };
}

function ensureEryonChargeState(player) {
  if (!player) return null;
  if (!player.eryonChargeState || typeof player.eryonChargeState !== "object") {
    player.eryonChargeState = { element: null, charges: 0 };
  }
  const element = player.eryonChargeState.element;
  if (!["feu", "eau", "terre", "air"].includes(element)) {
    player.eryonChargeState.element = null;
  }
  const charges = clampNonNegative(player.eryonChargeState.charges ?? 0);
  player.eryonChargeState.charges = Math.min(10, Math.floor(charges));
  return player.eryonChargeState;
}

function applyEryonElementAfterCast(player, element, gain) {
  const st = ensureEryonChargeState(player);
  if (!st) return null;
  const nextElement = ["feu", "eau", "terre", "air"].includes(element) ? element : null;
  const chargeGain = Math.min(10, Math.max(0, Math.floor(gain ?? 0)));
  if (!nextElement || chargeGain <= 0) return st;
  if (!st.element) {
    st.element = nextElement;
    st.charges = Math.min(10, st.charges + chargeGain);
    return st;
  }
  if (st.element === nextElement) {
    st.charges = Math.min(10, st.charges + chargeGain);
    return st;
  }
  st.element = nextElement;
  st.charges = chargeGain;
  return st;
}

function resolveDamageSpell(spell, effect) {
  if (!spell || !effect) return spell;
  const hasMin = typeof effect.min === "number";
  const hasMax = typeof effect.max === "number";
  const hasElement = typeof effect.element === "string";
  if (!hasMin && !hasMax && !hasElement) return spell;
  return {
    ...spell,
    damageMin: hasMin ? effect.min : spell.damageMin,
    damageMax: hasMax ? effect.max : spell.damageMax,
    damageCritMin: hasMin ? effect.min : spell.damageCritMin,
    damageCritMax: hasMax ? effect.max : spell.damageCritMax,
    element: hasElement ? effect.element : spell.element,
  };
}

module.exports = {
  clampNonNegative,
  clampPct,
  normalizePctInput,
  randomBetween,
  getFixedResistanceForElement,
  applyFixedResistanceToDamage,
  applyShieldToDamage,
  getSpellCritChancePct,
  rollSpellCrit,
  getBonusPuissanceFromStatusEffects,
  getPuissanceForDamage,
  getElementStatWithPuissance,
  getFlatDamageBonus,
  computeSpellDamageWithCrit,
  ensureEryonChargeState,
  applyEryonElementAfterCast,
  resolveDamageSpell,
};
