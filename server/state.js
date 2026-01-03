function createInitialState() {
  return {
    mapId: "MapAndemiaNouvelleVersion1",
    players: {},
    mapMonsters: {},
    mapMeta: {},
    mapResources: {},
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
    mapId: null,
  };
}

module.exports = {
  createInitialState,
  createPlayer,
};
