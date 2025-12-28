import { SAVE_STORAGE_BACKUP_KEY, SAVE_STORAGE_KEY } from "./constants.js";
import { createEmptySave, migrateSave } from "./schema.js";

let memoryFallback = null;

export function loadSaveFile() {
  try {
    if (typeof localStorage === "undefined") {
      if (!memoryFallback) memoryFallback = createEmptySave();
      return migrateSave(memoryFallback);
    }
    const raw = localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return createEmptySave();
    return migrateSave(JSON.parse(raw));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[save] failed to load save file:", err);
    if (typeof localStorage === "undefined") {
      return createEmptySave();
    }
    try {
      const backup = localStorage.getItem(SAVE_STORAGE_BACKUP_KEY);
      if (!backup) return createEmptySave();
      // eslint-disable-next-line no-console
      console.warn("[save] restoring from backup");
      return migrateSave(JSON.parse(backup));
    } catch (backupErr) {
      // eslint-disable-next-line no-console
      console.warn("[save] failed to load backup save:", backupErr);
      return createEmptySave();
    }
  }
}

export function writeSaveFile(saveFile) {
  try {
    const payload = saveFile || createEmptySave();
    payload.updatedAt = Date.now();
    if (typeof localStorage === "undefined") {
      memoryFallback = payload;
      return true;
    }
    const existing = localStorage.getItem(SAVE_STORAGE_KEY);
    if (existing) {
      localStorage.setItem(SAVE_STORAGE_BACKUP_KEY, existing);
    }
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[save] failed to write save file:", err);
    return false;
  }
}
