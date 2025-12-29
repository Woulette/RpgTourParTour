import { addChatMessage } from "../../../../chat/chat.js";
import { showFloatingTextOverEntity } from "../../runtime/floatingText.js";
import { computeSpellDamage } from "../utils/damage.js";
import {
  applyEryonElementAfterCast,
  convertEryonChargesToPuissance,
  consumeEryonCharges,
  getEryonChargeState,
} from "../../eryon/charges.js";

function isEryonCaster(caster) {
  const id = caster?.classId;
  return id === "eryon" || id === "assassin";
}

export function applyEryonAfterCast(scene, caster, spell, { isSelfCast = false } = {}) {
  if (!scene || !caster || !spell) return null;
  if (!isEryonCaster(caster)) return null;
  if (!spell.eryonCharges) return null;

  if (isSelfCast) {
    const res = convertEryonChargesToPuissance(caster);
    if (res?.bonusPuissance > 0 && scene.combatState?.joueur) {
      addChatMessage(
        {
          kind: "combat",
          channel: "global",
          author: "Eryon",
          text: `Conversion des charges : +${res.bonusPuissance} Puissance (3 tours).`,
        },
        { player: scene.combatState.joueur }
      );
      showFloatingTextOverEntity(scene, caster, `+${res.bonusPuissance} Puissance`, {
        color: "#fbbf24",
      });
    }
    if (scene && typeof scene.updateCombatUi === "function") {
      scene.updateCombatUi();
    }
    return res || null;
  }

  const gain = spell.eryonCharges.chargeGain ?? 1;
  const element = spell.eryonCharges.element ?? spell.element;
  const res = applyEryonElementAfterCast(caster, element, gain);

  if (scene && typeof scene.updateCombatUi === "function") {
    scene.updateCombatUi();
  }

  return res || null;
}

export function computeDamageForSpell(caster, spell) {
  if (!spell || !caster) return { damage: 0, consumedCharges: 0 };

  if (spell.id === "surcharge_instable" && isEryonCaster(caster)) {
    const before = getEryonChargeState(caster);
    const base = computeSpellDamage(caster, spell);

    let consumed = 0;
    if (before.element === "feu" && before.charges > 0) {
      consumed = consumeEryonCharges(caster, "feu", 5);
    }

    const mult = 1 + 0.1 * (consumed || 0);
    return { damage: Math.round(base * mult), consumedCharges: consumed };
  }

  return { damage: computeSpellDamage(caster, spell), consumedCharges: 0 };
}
