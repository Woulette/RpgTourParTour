function createInitialState() {
  return {
    mapId: "MapAndemiaNouvelleVersion1",
    players: {},
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
  };
}

module.exports = {
  createInitialState,
  createPlayer,
};
