// ---------- Calcul des dégâts en fonction des stats ----------

function getElementStat(caster, spell) {
  if (!caster || !caster.stats || !spell) return 0;

  const stats = caster.stats;
  const element = spell.element;

  // Deux conventions possibles :
  //  - element: "force" / "intelligence" / "agilite" / "chance"
  //  - element: "terre" / "feu" / "air" / "eau"
  switch (element) {
    case "force":
    case "terre":
      return stats.force ?? 0;
    case "intelligence":
    case "feu":
      return stats.intelligence ?? 0;
    case "agilite":
    case "air":
      return stats.agilite ?? 0;
    case "chance":
    case "eau":
      return stats.chance ?? 0;
    default:
      return 0;
  }
}

// Calcule les dégâts finaux d'un sort pour un lanceur donné,
// en appliquant un bonus de 2% par point de stat élémentaire.
export function computeSpellDamage(caster, spell) {
  const dmgMin = spell.damageMin ?? 0;
  const dmgMax = spell.damageMax ?? dmgMin;
  const baseDamage = Phaser.Math.Between(dmgMin, dmgMax);

  const elemStat = getElementStat(caster, spell);
  const bonusPercent = elemStat * 0.02; // 2% par point
  const multiplier = 1 + bonusPercent;

  const finalDamage = Math.round(baseDamage * multiplier);
  return Math.max(0, finalDamage);
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

  const finalMin = Math.round(dmgMin * multiplier);
  const finalMax = Math.round(dmgMax * multiplier);

  return {
    min: Math.max(0, finalMin),
    max: Math.max(0, finalMax),
  };
}

