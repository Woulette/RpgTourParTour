const effectHandlers = {};

export function registerEffect(type, handler) {
  if (!type || typeof handler !== "function") return;
  effectHandlers[type] = handler;
}

export function getEffectHandler(type) {
  return effectHandlers[type] || null;
}

export function getRegisteredEffects() {
  return { ...effectHandlers };
}
