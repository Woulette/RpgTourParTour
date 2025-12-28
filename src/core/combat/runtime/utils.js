export function joinPartsWrapped(parts, maxLineLength = 70) {
  const safeMax = Math.max(20, maxLineLength | 0);
  const lines = [];
  let current = "";

  for (const raw of parts) {
    const part = String(raw || "").trim();
    if (!part) continue;
    if (!current) {
      current = part;
      continue;
    }
    const candidate = `${current}, ${part}`;
    if (candidate.length <= safeMax) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = part;
  }

  if (current) lines.push(current);
  return lines.join("\n");
}

export function clampNonNegativeFinite(n) {
  return typeof n === "number" && Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function getJobLevel(player, jobId) {
  if (!player || !jobId) return 0;
  const level = player.metiers?.[jobId]?.level;
  return typeof level === "number" && level > 0 ? level : 0;
}

export function hasItem(player, itemId) {
  if (!player || !player.inventory || !itemId) return false;
  const slots = player.inventory.slots;
  if (!Array.isArray(slots)) return false;
  return slots.some((slot) => slot && slot.itemId === itemId && slot.qty > 0);
}
