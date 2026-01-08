export const SAVE_VERSION = 1;

const PROFILE_STORAGE_SUFFIX = (() => {
  if (typeof window === "undefined") return "";
  try {
    const params = new URLSearchParams(window.location.search || "");
    const profile = params.get("profile");
    if (!profile) return "";
    return `:profile:${profile}`;
  } catch {
    return "";
  }
})();

export const SAVE_STORAGE_KEY = `andemia:save${PROFILE_STORAGE_SUFFIX}`;
export const SAVE_STORAGE_BACKUP_KEY = `andemia:save:backup${PROFILE_STORAGE_SUFFIX}`;
