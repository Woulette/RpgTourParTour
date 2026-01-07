function createInitialState() {
  return {
    mapId: "MapAndemiaNouvelleVersion1",
    players: {},
    mapMonsters: {},
    mapMeta: {},
    mapResources: {},
    combats: {},
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
    x: 0,
    y: 0,
    hp: 100,
    pa: 6,
    pm: 3,
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
