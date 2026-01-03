import { addChatMessage } from "../../../../chat/chat.js";

export function applyStatusEffect(ctx, effect) {
  const { scene, caster, spell, target, state } = ctx;
  if (!scene || !caster || !spell || !target || !state) return false;

  let status = null;
  if (effect?.status) status = effect.status;
  else if (effect?.useSpellStatus && spell?.statusEffect) status = spell.statusEffect;
  else if (spell?.statusEffect) status = spell.statusEffect;
  if (!status || status.type !== "poison") return false;

  const turns = typeof status.turns === "number" ? status.turns : status.turnsLeft ?? 0;
  const dmgMin =
    typeof status.damageMin === "number" ? status.damageMin : spell.damageMin ?? 0;
  const dmgMax =
    typeof status.damageMax === "number" ? status.damageMax : spell.damageMax ?? dmgMin;

  target.statusEffects = Array.isArray(target.statusEffects) ? target.statusEffects : [];

  const id = status.id || spell.id || "poison";
  const next = {
    id,
    type: "poison",
    label: status.label || spell.label || spell.id || "Poison",
    turnsLeft: Math.max(0, turns),
    damageMin: dmgMin,
    damageMax: dmgMax,
    sourceName: caster?.displayName || caster?.label || caster?.monsterId || "Monstre",
    element: spell?.element ?? null,
  };

  const idx = target.statusEffects.findIndex((e) => e && e.id === id);
  if (idx >= 0) target.statusEffects[idx] = next;
  else target.statusEffects.push(next);

  if (state.enCours && state.joueur) {
    const spellLabel = spell?.label || spell?.id || "Sort";
    const targetName =
      target === state.joueur
        ? "Vous"
        : target.displayName || target.label || target.monsterId || "Monstre";
    const message =
      target === state.joueur
        ? `${spellLabel} : vous etes empoisonne (${next.turnsLeft} tours).`
        : `${spellLabel} : ${targetName} est empoisonne (${next.turnsLeft} tours).`;
    addChatMessage(
      {
        kind: "combat",
        channel: "global",
        author: "Combat",
        text: message,
      },
      { player: state.joueur }
    );
  }

  return true;
}
