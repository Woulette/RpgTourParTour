import { getNetPlayerId } from "../../../../app/session.js";
import { startPrep } from "../../../../features/combat/runtime/prep.js";

export function createCombatPrepPlacementHandlers(ctx, helpers, alliesHandlers) {
  const {
    scene,
    player,
    getCurrentMapObj,
    getCurrentGroundLayer,
  } = ctx;
  const { buildCombatLeaderFromEntry, getEntityTile, updateBlockedTile } = helpers;
  const { syncCombatPlayerAllies } = alliesHandlers;

  const assignCombatMonstersFromEntries = (mobEntries) => {
    if (!Array.isArray(mobEntries) || mobEntries.length === 0) return;
    if (!Array.isArray(scene.combatMonsters) || scene.combatMonsters.length === 0) {
      return;
    }

    const existingEntityIds = new Set(
      scene.combatMonsters
        .map((m) => (m && Number.isInteger(m.entityId) ? m.entityId : null))
        .filter((id) => Number.isInteger(id))
    );

    const unassigned = scene.combatMonsters.filter(
      (m) => m && !Number.isInteger(m.entityId)
    );
    if (unassigned.length === 0) return;

    const byMonsterId = new Map();
    unassigned.forEach((m) => {
      const key = m.monsterId || "__unknown";
      if (!byMonsterId.has(key)) byMonsterId.set(key, []);
      byMonsterId.get(key).push(m);
    });

    mobEntries.forEach((entry) => {
      const entityId = Number.isInteger(entry?.entityId) ? entry.entityId : null;
      if (!entityId) return;
      if (existingEntityIds.has(entityId)) return;
      const combatIndex = Number.isInteger(entry?.combatIndex) ? entry.combatIndex : null;
      let target = null;
      if (combatIndex !== null && scene.combatMonsters[combatIndex]) {
        target = scene.combatMonsters[combatIndex];
      }
      if (!target) {
        const monsterId = entry.monsterId || "__unknown";
        const bucket = byMonsterId.get(monsterId) || [];
        target = bucket.length > 0 ? bucket.shift() : unassigned.shift() || null;
      }
      if (!target) return;
      target.entityId = entityId;
      if (combatIndex !== null) {
        target.combatIndex = combatIndex;
      }
      existingEntityIds.add(entityId);
      if (typeof entry.spawnMapKey === "string") {
        target.spawnMapKey = entry.spawnMapKey;
      }
      target.isCombatMember = true;
    });
  };

  const startJoinCombatPrep = (entry, mobEntries) => {
    if (!entry || !Number.isInteger(entry.combatId)) return;
    if (scene.combatState?.enCours || scene.prepState?.actif) return;
    const localId = getNetPlayerId();
    if (!localId) return;
    const participantIds = Array.isArray(entry.participantIds)
      ? entry.participantIds
      : [];
    if (!participantIds.includes(localId)) return;
    const leaderEntry = Array.isArray(mobEntries) ? mobEntries[0] : null;
    if (!leaderEntry) return;
    const leader = buildCombatLeaderFromEntry(leaderEntry);
    if (!leader) return;
    const currentMap = getCurrentMapObj();
    const currentLayer = getCurrentGroundLayer();
    if (!currentMap || !currentLayer) return;

    // eslint-disable-next-line no-console
    console.log("[LAN] JoinCombat prep start", {
      combatId: entry.combatId,
      mapId: entry.mapId,
      participants: entry.participantIds,
      phase: entry.phase,
    });

    scene.__lanCombatId = entry.combatId;
    scene.__lanCombatStartSent = true;
    startPrep(scene, player, leader, currentMap, currentLayer, {
      allowLanLocalStart: true,
    });
    assignCombatMonstersFromEntries(mobEntries);
    const localTile = getEntityTile(player);
    if (localTile) {
      updateBlockedTile(player, localTile.x, localTile.y);
    }
    syncCombatPlayerAllies(entry);
  };

  return { startJoinCombatPrep };
}
