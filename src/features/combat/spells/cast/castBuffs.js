import { addChatMessage } from "../../../../chat/chat.js";
import { showFloatingTextOverEntity } from "../../runtime/floatingText.js";
import { getEntityTile } from "./castPosition.js";

export function applyStatusEffectToEntity(entity, effect, caster) {
  if (!entity || !effect) return;
  const turns =
    typeof effect.turns === "number"
      ? effect.turns
      : typeof effect.turnsLeft === "number"
        ? effect.turnsLeft
        : 0;
  const next = {
    id: effect.id || effect.type || "buff",
    type: effect.type || "buff",
    label: effect.label || effect.type || "Buff",
    turnsLeft: Math.max(0, turns),
    amount: typeof effect.amount === "number" ? effect.amount : 0,
    sourceName: caster?.displayName || caster?.label || caster?.monsterId || "Monstre",
  };

  entity.statusEffects = Array.isArray(entity.statusEffects) ? entity.statusEffects : [];
  const idx = entity.statusEffects.findIndex((e) => e && e.id === next.id);
  if (idx >= 0) entity.statusEffects[idx] = next;
  else entity.statusEffects.push(next);
}

export function applyShieldToDamage(entity, damage) {
  if (!entity || !Array.isArray(entity.statusEffects)) {
    return { damage, absorbed: 0 };
  }
  let remaining = Math.max(0, damage);
  let absorbed = 0;
  let touched = false;

  entity.statusEffects.forEach((effect) => {
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
    entity.statusEffects = entity.statusEffects.filter(
      (effect) =>
        effect &&
        (effect.type !== "shield" ||
          ((effect.turnsLeft ?? 0) > 0 && (effect.amount ?? 0) > 0))
    );
  }

  return { damage: remaining, absorbed };
}

export function showShieldAbsorbText(scene, target, absorbed) {
  if (!scene || !target) return;
  if (typeof absorbed !== "number" || absorbed <= 0) return;
  showFloatingTextOverEntity(scene, target, `-${absorbed}`, { color: "#4aa8ff" });
}

export function addShieldAbsorbChat(scene, state, spellLabel, targetName, absorbed) {
  if (!scene || !state || !state.enCours || !state.joueur) return;
  if (typeof absorbed !== "number" || absorbed <= 0) return;
  addChatMessage(
    {
      kind: "combat",
      channel: "global",
      author: "Combat",
      text: `${spellLabel} : ${targetName} -${absorbed} PV (bouclier)`,
      element: "bouclier",
    },
    { player: state.joueur }
  );
}

export function applyAreaBuffToMonsters(scene, map, groundLayer, caster, buffDef) {
  const radius =
    typeof buffDef?.radius === "number" && buffDef.radius >= 0
      ? buffDef.radius
      : 0;
  const effects = Array.isArray(buffDef?.effects) ? buffDef.effects : [];
  if (effects.length === 0) return;

  const state = scene?.combatState;
  const activeEntity =
    state?.tour === "joueur" ? state.joueur : state?.monstre || null;

  const origin = getEntityTile(caster, map, groundLayer);
  if (!origin) return;

  const list =
    scene?.combatMonsters && Array.isArray(scene.combatMonsters)
      ? scene.combatMonsters
      : [caster];

  const targets = list.filter((m) => {
    if (!m || !m.stats) return false;
    const hp =
      typeof m.stats.hp === "number" ? m.stats.hp : m.stats.hpMax ?? 0;
    if (hp <= 0) return false;
    const pos = getEntityTile(m, map, groundLayer);
    if (!pos) return false;
    const dist = Math.abs(pos.x - origin.x) + Math.abs(pos.y - origin.y);
    return dist <= radius;
  });

  effects.forEach((effect) => {
    targets.forEach((target) => {
      let resolved = effect;
      if (effect?.type === "shield") {
        const casterHpMax =
          typeof caster?.stats?.hpMax === "number"
            ? caster.stats.hpMax
            : typeof caster?.stats?.hp === "number"
              ? caster.stats.hp
              : 0;
        const percent =
          typeof effect.percent === "number" ? effect.percent : null;
        const amount =
          typeof effect.amount === "number"
            ? effect.amount
            : percent !== null
              ? Math.round(casterHpMax * percent)
              : 0;
        resolved = {
          ...effect,
          amount,
          label: effect.label || `Bouclier ${amount}`,
        };
      }

      applyStatusEffectToEntity(target, resolved, caster);
      if (effect?.type === "pm" && target && activeEntity === target && state) {
        const bonus = typeof effect.amount === "number" ? effect.amount : 0;
        if (bonus !== 0) {
          state.pmRestants = Math.max(0, (state.pmRestants ?? 0) + bonus);
        }
      }
    });
  });
}

export function applyAreaBuffToAllies(scene, map, groundLayer, caster, buffDef) {
  const radius =
    typeof buffDef?.radius === "number" && buffDef.radius >= 0
      ? buffDef.radius
      : 0;
  const effects = Array.isArray(buffDef?.effects) ? buffDef.effects : [];
  if (effects.length === 0) return;

  const state = scene?.combatState;
  const activeEntity =
    state?.tour === "joueur" ? state.joueur : state?.monstre || null;
  const origin = getEntityTile(caster, map, groundLayer);
  if (!origin) return;

  const allies =
    scene?.combatSummons && Array.isArray(scene.combatSummons)
      ? scene.combatSummons
      : [];
  const targets = [
    state?.joueur || null,
    caster || null,
    ...allies,
  ].filter((m, index, list) => m && list.indexOf(m) === index);

  const inRange = targets.filter((m) => {
    if (!m || !m.stats) return false;
    const hp = typeof m.stats.hp === "number" ? m.stats.hp : m.stats.hpMax ?? 0;
    if (hp <= 0) return false;
    const pos = getEntityTile(m, map, groundLayer);
    if (!pos) return false;
    const dist = Math.abs(pos.x - origin.x) + Math.abs(pos.y - origin.y);
    return dist <= radius;
  });

  effects.forEach((effect) => {
    inRange.forEach((target) => {
      let resolved = effect;
      if (effect?.type === "shield") {
        const casterHpMax =
          typeof caster?.stats?.hpMax === "number"
            ? caster.stats.hpMax
            : typeof caster?.stats?.hp === "number"
              ? caster.stats.hp
              : 0;
        const percent =
          typeof effect.percent === "number" ? effect.percent : null;
        const amount =
          typeof effect.amount === "number"
            ? effect.amount
            : percent !== null
              ? Math.round(casterHpMax * percent)
              : 0;
        resolved = {
          ...effect,
          amount,
          label: effect.label || `Bouclier ${amount}`,
        };
      }

      applyStatusEffectToEntity(target, resolved, caster);
      if (effect?.type === "pm" && target && activeEntity === target && state) {
        const bonus = typeof effect.amount === "number" ? effect.amount : 0;
        if (bonus !== 0) {
          state.pmRestants = Math.max(0, (state.pmRestants ?? 0) + bonus);
        }
      }
    });
  });
}
