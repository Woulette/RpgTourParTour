function createInitialState() {
  return {
    mapId: "MapAndemiaNouvelleVersion1",
    players: {},
    mapMonsters: {},
    mapMeta: {},
    mapCollisions: {},
    mapResources: {},
    combats: {},
    groups: {},
    playerGroups: {},
    groupInvites: {},
    groupCombatInvites: {},
    friendInvites: {},
    combat: {
      inCombat: false,
      turnIndex: 0,
      activeId: null,
    },
  };
}

function createPlayer(id) {
  return {
    id,
    characterId: null,
    accountId: null,
    x: 0,
    y: 0,
    hp: 100,
    hpMax: 100,
    pa: 6,
    pm: 3,
    stats: null,
    baseStats: null,
    classId: null,
    displayName: null,
    level: null,
    initiative: null,
    capturedMonsterId: null,
    capturedMonsterLevel: null,
    inventory: null,
    gold: 0,
    honorPoints: 0,
    levelState: null,
    equipment: null,
    trash: null,
    quests: null,
    achievements: null,
    metiers: null,
    spellParchments: null,
    lastRegenAt: 0,
    connected: true,
    lastMoveSeq: 0,
    lastCombatMoveSeq: 0,
    mapId: null,
    inCombat: false,
    combatId: null,
  };
}

module.exports = {
  createInitialState,
  createPlayer,
};
