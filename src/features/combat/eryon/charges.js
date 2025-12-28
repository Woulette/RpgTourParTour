function clampInt(n, { min = 0, max = Infinity } = {}) {
  if (typeof n !== "number" || !Number.isFinite(n)) return min;
  const v = Math.round(n);
  return Math.max(min, Math.min(max, v));
}

export const ERYON_ELEMENTS = ["feu", "eau", "terre", "air"];
export const ERYON_MAX_CHARGES = 10;

export function ensureEryonChargeState(caster) {
  if (!caster) return null;
  if (!caster.eryonChargeState || typeof caster.eryonChargeState !== "object") {
    caster.eryonChargeState = { element: null, charges: 0 };
  }
  if (!ERYON_ELEMENTS.includes(caster.eryonChargeState.element)) {
    caster.eryonChargeState.element = null;
  }
  caster.eryonChargeState.charges = clampInt(caster.eryonChargeState.charges ?? 0, {
    min: 0,
    max: ERYON_MAX_CHARGES,
  });
  return caster.eryonChargeState;
}

export function resetEryonChargeState(caster) {
  const st = ensureEryonChargeState(caster);
  if (!st) return null;
  st.element = null;
  st.charges = 0;
  return st;
}

export function getEryonChargeState(caster) {
  const st = ensureEryonChargeState(caster);
  if (!st) return { element: null, charges: 0 };
  return { element: st.element, charges: st.charges };
}

export function consumeEryonCharges(caster, element, maxToConsume) {
  const st = ensureEryonChargeState(caster);
  if (!st) return 0;
  if (!element || st.element !== element) return 0;
  const wanted = clampInt(maxToConsume ?? 0, { min: 0, max: ERYON_MAX_CHARGES });
  const consumed = Math.min(st.charges, wanted);
  st.charges = clampInt(st.charges - consumed, { min: 0, max: ERYON_MAX_CHARGES });
  return consumed;
}

function upsertStatusEffect(entity, next) {
  if (!entity) return;
  entity.statusEffects = Array.isArray(entity.statusEffects) ? entity.statusEffects : [];
  const idx = entity.statusEffects.findIndex((e) => e && e.id === next.id);
  if (idx >= 0) entity.statusEffects[idx] = next;
  else entity.statusEffects.push(next);
}

export function applyEryonTransitionBuff(caster, chargesConsumed) {
  const consumed = clampInt(chargesConsumed ?? 0, { min: 0, max: ERYON_MAX_CHARGES });
  const raw = consumed * 10;
  const amount = clampInt(raw, { min: 0, max: 100 });
  if (amount <= 0) return 0;

  upsertStatusEffect(caster, {
    id: "eryon_transition_puissance",
    type: "puissance",
    label: "Transition élémentaire",
    turnsLeft: 3,
    amount,
  });
  return amount;
}

export function convertEryonChargesToPuissance(caster) {
  const st = ensureEryonChargeState(caster);
  if (!st) return { consumed: 0, bonusPuissance: 0, element: null, charges: 0 };

  const consumed = clampInt(st.charges ?? 0, { min: 0, max: ERYON_MAX_CHARGES });
  const bonusPuissance = applyEryonTransitionBuff(caster, consumed);
  st.charges = 0;

  return {
    consumed,
    bonusPuissance,
    element: st.element,
    charges: st.charges,
  };
}

export function applyEryonElementAfterCast(caster, element, chargeGain = 1) {
  const st = ensureEryonChargeState(caster);
  if (!st) return { switched: false, consumed: 0, bonusPuissance: 0, element: null, charges: 0 };

  const nextElement = ERYON_ELEMENTS.includes(element) ? element : null;
  const gain = clampInt(chargeGain ?? 0, { min: 0, max: ERYON_MAX_CHARGES });

  // Si pas d'élément (sort neutre), on ne fait rien.
  if (!nextElement) {
    return {
      switched: false,
      consumed: 0,
      bonusPuissance: 0,
      element: st.element,
      charges: st.charges,
    };
  }

  // Premier cast élémentaire : initialise l'élément courant.
  if (!st.element) {
    st.element = nextElement;
    st.charges = clampInt(st.charges + gain, { min: 0, max: ERYON_MAX_CHARGES });
    return { switched: false, consumed: 0, bonusPuissance: 0, element: st.element, charges: st.charges };
  }

  // Même élément : juste gain de charges (cap).
  if (st.element === nextElement) {
    st.charges = clampInt(st.charges + gain, { min: 0, max: ERYON_MAX_CHARGES });
    return { switched: false, consumed: 0, bonusPuissance: 0, element: st.element, charges: st.charges };
  }

  // Switch : écrase les charges (pas de bonus). On passe sur le nouvel élément et on génère les charges du sort.
  const consumed = st.charges;
  st.element = nextElement;
  st.charges = 0;
  st.charges = clampInt(st.charges + gain, { min: 0, max: ERYON_MAX_CHARGES });

  return {
    switched: true,
    consumed,
    bonusPuissance: 0,
    element: st.element,
    charges: st.charges,
  };
}
