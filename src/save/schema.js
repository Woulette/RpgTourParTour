import { SAVE_VERSION } from "./constants.js";

export function createEmptySave() {
  return {
    version: SAVE_VERSION,
    updatedAt: Date.now(),
    characters: {}, // id -> { meta, snapshot }
  };
}

function isPlainObject(value) {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value.constructor === Object || value.constructor == null)
  );
}

export function migrateSave(raw) {
  // Future-proof: migrations by version.
  if (!isPlainObject(raw)) return createEmptySave();

  const version = Number.isFinite(raw.version) ? raw.version : 0;
  if (version === SAVE_VERSION) {
    const next = createEmptySave();
    next.updatedAt = Number.isFinite(raw.updatedAt) ? raw.updatedAt : Date.now();
    next.characters = isPlainObject(raw.characters) ? raw.characters : {};
    return next;
  }

  // Unknown or old version -> keep what we can, but normalize structure.
  const next = createEmptySave();
  next.updatedAt = Date.now();
  next.characters = isPlainObject(raw.characters) ? raw.characters : {};
  return next;
}

