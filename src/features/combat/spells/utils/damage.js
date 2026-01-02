// ---------- Calcul des dégâts en fonction des stats ----------

function clampNonNegative(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function getBonusPuissanceFromStatusEffects(caster) {
  const effects = Array.isArray(caster?.statusEffects) ? caster.statusEffects : [];
  if (effects.length === 0) return 0;

  let sum = 0;
  for (const eff of effects) {
    if (!eff) continue;
    if (eff.type !== "puissance") continue;
    if ((eff.turnsLeft ?? 0) <= 0) continue;
    sum += clampNonNegative(eff.amount ?? 0);
  }
  return sum;
}

function getPuissanceForDamage(caster) {
  const stats = caster?.stats || {};
  const base = clampNonNegative(stats.puissance ?? 0);
  return base + getBonusPuissanceFromStatusEffects(caster);
}

function getElementStat(caster, spell) {
  if (!caster || !caster.stats || !spell) return 0;

  const stats = caster.stats;
  const element = spell.element;
  const puissance = getPuissanceForDamage(caster);

  // Deux conventions possibles :
  //  - element: "force" / "intelligence" / "agilite" / "chance"
  //  - element: "terre" / "feu" / "air" / "eau"
  switch (element) {
    case "force":
    case "terre":
      return (stats.force ?? 0) + puissance;
    case "intelligence":
    case "feu":
      return (stats.intelligence ?? 0) + puissance;
    case "agilite":
    case "air":
      return (stats.agilite ?? 0) + puissance;
    case "chance":
    case "eau":
      return (stats.chance ?? 0) + puissance;
    default:
      return 0;
  }
}

function getFlatDamageBonus(caster, spell) {
  if (!caster || !caster.stats || !spell) return 0;
  const stats = caster.stats;
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

export function getSpellDamageComponents(caster, spell, baseDamageOverride = null) {
  if (!caster || !spell) return { scaled: 0, flat: 0 };
  const dmgMin = spell.damageMin ?? 0;
  const dmgMax = spell.damageMax ?? dmgMin;
  const baseDamage =
    typeof baseDamageOverride === "number"
      ? baseDamageOverride
      : Phaser.Math.Between(dmgMin, dmgMax);

  const elemStat = getElementStat(caster, spell);
  const bonusPercent = elemStat * 0.02;
  const multiplier = 1 + bonusPercent;
  const parchmentMult = getSpellParchmentMultiplier(caster, spell);
  const scaled = Math.round(baseDamage * multiplier * parchmentMult);
  const flat = getFlatDamageBonus(caster, spell);
  return { scaled, flat };
}

// Calcule les dégâts finaux d'un sort pour un lanceur donné,
// en appliquant un bonus de 2% par point de stat élémentaire.
function getSpellParchmentMultiplier(caster, spell) {
  if (!caster || !spell) return 1;
  const tiers = caster.spellParchments || {};
  const tier = tiers[spell.id] || 0;
  if (!tier) return 1;
  return 1 + 0.1 * tier;
}

function getSurchargeInstableMultiplierForPreview(caster, spell) {
  if (!caster || !spell || spell.id !== "surcharge_instable") return 1;
  const classId = caster.classId;
  if (classId !== "eryon" && classId !== "assassin") return 1;
  const st = caster.eryonChargeState || null;
  if (!st || st.element !== "feu") return 1;
  const charges =
    typeof st.charges === "number" && Number.isFinite(st.charges) ? st.charges : 0;
  const consumed = Math.max(0, Math.min(5, Math.floor(charges)));
  return 1 + 0.1 * consumed;
}

export function computeSpellDamage(caster, spell) {
  const { scaled, flat } = getSpellDamageComponents(caster, spell);
  return Math.max(0, scaled + flat);
}

// Retourne la fourchette de dégâts (min, max) pour un sort
// en tenant compte des stats élémentaires du lanceur (sans aléatoire).
export function getSpellDamageRange(caster, spell) {
  if (!caster || !spell) {
    return { min: 0, max: 0 };
  }

  const dmgMin = spell.damageMin ?? 0;
  const dmgMax = spell.damageMax ?? dmgMin;

  const elemStat = getElementStat(caster, spell);
  const bonusPercent = elemStat * 0.02; // 2% par point
  const multiplier = 1 + bonusPercent;

  const parchmentMult = getSpellParchmentMultiplier(caster, spell);
  const finalMin = Math.round(dmgMin * multiplier * parchmentMult);
  const finalMax = Math.round(dmgMax * multiplier * parchmentMult);

  const extraMult = getSurchargeInstableMultiplierForPreview(caster, spell);
  const scaledMin = Math.round(finalMin * extraMult);
  const scaledMax = Math.round(finalMax * extraMult);
  const flatBonus = getFlatDamageBonus(caster, spell);
  const withFlatMin = scaledMin + flatBonus;
  const withFlatMax = scaledMax + flatBonus;

  return {
    min: Math.max(0, withFlatMin),
    max: Math.max(0, withFlatMax),
  };
}
