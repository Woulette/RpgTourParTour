const { WebSocketServer, WebSocket } = require("ws");
const crypto = require("crypto");
const path = require("path");
const { pathToFileURL } = require("url");
const {
  PROTOCOL_VERSION,
  DEFAULT_GAME_DATA_VERSION,
  MAX_PLAYERS,
} = require("./protocol");
const { createInitialState, createPlayer } = require("./state");
const { createCombatHandlers } = require("./handlers/combat");
const { createMobHandlers } = require("./handlers/mobs");
const { createResourceHandlers } = require("./handlers/resources");
const { createPlayerHandlers } = require("./handlers/players");
const { createAccountStore } = require("./db/accounts");
const { createCharacterStore } = require("./db/characters");
const { buildMonsterStats } = require("./handlers/combat/monsterStats");
const { initializeMapState } = require("./maps/initMapState");
const { createRouterHandlers } = require("./app/router");
const { startServerTimers } = require("./app/timers");

const PORT = Number(process.env.PORT || 8080);
const GAME_DATA_VERSION =
  process.env.GAME_DATA_VERSION || DEFAULT_GAME_DATA_VERSION;

const wss = new WebSocketServer({ port: PORT });
const state = createInitialState();
let nextPlayerId = 1;
let nextEventId = 1;
let nextMonsterEntityId = 1;
let nextResourceEntityId = 1;
let nextCombatId = 1;
let nextGroupId = 1;
let hostId = null;
const MONSTER_STEP_DURATION_MS = 550;
const monsterMoveTimers = new Map();
const MOB_ROAM_TICK_MS = 500;
const MOB_RESPAWN_DELAY_MS = 5000;
const COMBAT_RECONNECT_GRACE_MS = 15000;
const monsterRespawnTimers = new Map();
const resourceRespawnTimers = new Map();
const mapInitRequests = new Map();
const DEBUG_COMBAT = process.env.LAN_COMBAT_DEBUG === "1";
const LAN_TRACE = process.env.LAN_TRACE === "1";
const characterStore = createCharacterStore({ dataDir: path.resolve(__dirname, "data") });
const accountStore = createAccountStore({ dataDir: path.resolve(__dirname, "data") });
const sessionTokens = new Map(); // token -> { accountId, issuedAt }

function issueSessionToken(accountId) {
  if (!accountId) return null;
  const token = crypto.randomBytes(24).toString("hex");
  sessionTokens.set(token, { accountId, issuedAt: Date.now() });
  return token;
}

function getAccountIdFromSession(token) {
  if (!token) return null;
  const entry = sessionTokens.get(token);
  return entry?.accountId || null;
}

let statsApi = null;
let statsApiFailed = false;
const statsApiPromise = import(
  pathToFileURL(path.resolve(__dirname, "../src/core/stats.js")).href
)
  .then((mod) => {
    statsApi = mod || null;
  })
  .catch((err) => {
    statsApiFailed = true;
    // eslint-disable-next-line no-console
    console.warn("[LAN] Failed to load stats module:", err?.message || err);
  });

let levelApi = null;
let levelApiFailed = false;
const levelApiPromise = import(
  pathToFileURL(path.resolve(__dirname, "../src/core/level.js")).href
)
  .then((mod) => {
    levelApi = mod || null;
  })
  .catch((err) => {
    levelApiFailed = true;
    // eslint-disable-next-line no-console
    console.warn("[LAN] Failed to load level module:", err?.message || err);
  });

let xpConfig = null;
let xpConfigFailed = false;
const xpConfigPromise = import(
  pathToFileURL(path.resolve(__dirname, "../src/config/xp.js")).href
)
  .then((mod) => {
    xpConfig = mod?.XP_CONFIG || null;
  })
  .catch((err) => {
    xpConfigFailed = true;
    // eslint-disable-next-line no-console
    console.warn("[LAN] Failed to load XP config:", err?.message || err);
  });

let classDefs = null;
let classDefsFailed = false;
const classDefsPromise = import(
  pathToFileURL(path.resolve(__dirname, "../src/config/classes.js")).href
)
  .then((mod) => {
    classDefs = mod?.classes || null;
  })
  .catch((err) => {
    classDefsFailed = true;
    // eslint-disable-next-line no-console
    console.warn("[LAN] Failed to load classes config:", err?.message || err);
  });

let mapDefs = null;
let mapDefsFailed = false;
const mapDefsPromise = import(
  pathToFileURL(path.resolve(__dirname, "../src/features/maps/index.js")).href
)
  .then((mod) => {
    mapDefs = mod?.maps || null;
  })
  .catch((err) => {
    mapDefsFailed = true;
    // eslint-disable-next-line no-console
    console.warn("[LAN] Failed to load map defs:", err?.message || err);
  });

let itemDefs = null;
let itemDefsFailed = false;
const itemDefsPromise = import(
  pathToFileURL(
    path.resolve(__dirname, "../src/features/inventory/data/itemsConfig.js")
  ).href
)
  .then((mod) => {
    itemDefs = mod?.items || null;
  })
  .catch((err) => {
    itemDefsFailed = true;
    // eslint-disable-next-line no-console
    console.warn("[LAN] Failed to load item defs:", err?.message || err);
  });

let equipmentSets = null;
let equipmentSetsFailed = false;
const equipmentSetsPromise = import(
  pathToFileURL(path.resolve(__dirname, "../src/features/inventory/data/sets.js")).href
)
  .then((mod) => {
    equipmentSets = mod?.equipmentSets || null;
  })
  .catch((err) => {
    equipmentSetsFailed = true;
    // eslint-disable-next-line no-console
    console.warn("[LAN] Failed to load equipment sets:", err?.message || err);
  });

let questDefs = null;
let questDefsFailed = false;
let questStates = null;
const questDefsPromise = import(
  pathToFileURL(path.resolve(__dirname, "../src/features/quests/catalog.js")).href
)
  .then((mod) => {
    questDefs = mod?.quests || null;
    questStates = mod?.QUEST_STATES || null;
  })
  .catch((err) => {
    questDefsFailed = true;
    // eslint-disable-next-line no-console
    console.warn("[LAN] Failed to load quest defs:", err?.message || err);
  });

let harvestResourceDefs = null;
let harvestResourceDefsFailed = false;
const harvestResourceDefsPromise = Promise.all([
  import(
    pathToFileURL(
      path.resolve(__dirname, "../src/features/metier/bucheron/resources.js")
    ).href
  ),
  import(
    pathToFileURL(
      path.resolve(__dirname, "../src/features/metier/alchimiste/resources.js")
    ).href
  ),
])
  .then(([bucheron, alchimiste]) => {
    harvestResourceDefs = {
      ...(bucheron?.bucheronResources || {}),
      ...(alchimiste?.alchimisteResources || {}),
    };
  })
  .catch((err) => {
    harvestResourceDefsFailed = true;
    // eslint-disable-next-line no-console
    console.warn("[LAN] Failed to load harvest defs:", err?.message || err);
  });

let craftDefs = null;
let craftDefsFailed = false;
const craftDefsPromise = Promise.all([
  import(
    pathToFileURL(
      path.resolve(__dirname, "../src/features/metier/tailleur/recipes.js")
    ).href
  ),
  import(
    pathToFileURL(
      path.resolve(__dirname, "../src/features/metier/cordonnier/recipes.js")
    ).href
  ),
  import(
    pathToFileURL(
      path.resolve(__dirname, "../src/features/metier/bijoutier/recipes.js")
    ).href
  ),
  import(
    pathToFileURL(
      path.resolve(__dirname, "../src/features/metier/alchimiste/recipes.js")
    ).href
  ),
  import(
    pathToFileURL(
      path.resolve(__dirname, "../src/features/metier/bucheron/recipes.js")
    ).href
  ),
  import(
    pathToFileURL(
      path.resolve(__dirname, "../src/features/metier/bricoleur/recipes.js")
    ).href
  ),
])
  .then(
    ([
      tailleur,
      cordonnier,
      bijoutier,
      alchimiste,
      bucheron,
      bricoleur,
    ]) => {
      craftDefs = {
        tailleur: Array.isArray(tailleur?.tailleurRecipes)
          ? tailleur.tailleurRecipes
          : [],
        cordonnier: Array.isArray(cordonnier?.cordonnierRecipes)
          ? cordonnier.cordonnierRecipes
          : [],
        bijoutier: Array.isArray(bijoutier?.bijoutierRecipes)
          ? bijoutier.bijoutierRecipes
          : [],
        alchimiste: [
          ...(Array.isArray(alchimiste?.alchimieRecipes)
            ? alchimiste.alchimieRecipes
            : []),
          ...(Array.isArray(alchimiste?.alchimieFusionRecipes)
            ? alchimiste.alchimieFusionRecipes
            : []),
        ],
        bucheron: Array.isArray(bucheron?.bucheronRecipes)
          ? bucheron.bucheronRecipes
          : [],
        bricoleur: Array.isArray(bricoleur?.bricoleurRecipes)
          ? bricoleur.bricoleurRecipes
          : [],
      };
    }
  )
  .catch((err) => {
    craftDefsFailed = true;
    // eslint-disable-next-line no-console
    console.warn("[LAN] Failed to load craft defs:", err?.message || err);
  });
const debugCombatLog = (...args) => {
  if (!DEBUG_COMBAT) return;
  // eslint-disable-next-line no-console
  console.log("[LAN][Combat]", ...args);
};

const clients = new Map(); // ws -> { id, lastCmdId, ready }
const eventHistory = [];
const MAX_EVENT_HISTORY = 0;
const combatEventHistory = new Map(); // combatId -> events
const MAX_COMBAT_EVENT_HISTORY = 200;
const COMBAT_EVENT_TYPES = new Set([
  "EvCombatCreated",
  "EvCombatUpdated",
  "EvCombatJoinReady",
  "EvCombatState",
  "EvCombatMoveStart",
  "EvCombatMonsterMoveStart",
  "EvCombatTurnStarted",
  "EvCombatTurnEnded",
  "EvCombatEnded",
  "EvSpellCast",
  "EvDamageApplied",
]);

const REGEN_TICK_MS = 1000;
const REGEN_PER_TICK = 2;
const GROUP_HP_TICK_MS = 1000;
const PERSIST_TICK_MS = 10000;
const PERSIST_DEBOUNCE_MS = 250;
const PERSIST_SLOW_MS = 40;
const pendingPersist = new Map();

  let spellDefs = null;
  let spellDefsFailed = false;
  let monsterSpellDefs = null;
  let monsterSpellDefsFailed = false;
  const spellDefsPromise = import(
    pathToFileURL(path.resolve(__dirname, "../src/config/spells.js")).href
  )
  .then((mod) => {
    spellDefs = mod?.spells || null;
  })
    .catch((err) => {
      spellDefsFailed = true;
      // eslint-disable-next-line no-console
      console.warn("[LAN] Failed to load spells config:", err?.message || err);
    });

  const monsterSpellDefsPromise = import(
    pathToFileURL(path.resolve(__dirname, "../src/content/spells/monsters/index.js")).href
  )
    .then((mod) => {
      monsterSpellDefs = mod?.monsterSpells || null;
    })
    .catch((err) => {
      monsterSpellDefsFailed = true;
      // eslint-disable-next-line no-console
      console.warn("[LAN] Failed to load monster spells:", err?.message || err);
    });

  let monsterDefs = null;
  let monsterDefsFailed = false;
  const monsterDefsPromise = import(
    pathToFileURL(path.resolve(__dirname, "../src/content/monsters/index.js")).href
  )
    .then((mod) => {
      monsterDefs = mod?.monsters || null;
    })
    .catch((err) => {
      monsterDefsFailed = true;
      // eslint-disable-next-line no-console
      console.warn("[LAN] Failed to load monsters config:", err?.message || err);
    });

  let combatPatterns = null;
  let combatPatternsFailed = false;
  const combatPatternsPromise = import(
    pathToFileURL(path.resolve(__dirname, "../src/combatPatterns.js")).href
  )
    .then((mod) => {
      combatPatterns = mod?.COMBAT_PATTERNS || null;
    })
    .catch((err) => {
      combatPatternsFailed = true;
      // eslint-disable-next-line no-console
      console.warn("[LAN] Failed to load combat patterns:", err?.message || err);
    });

let combatStartPositions = null;
let combatStartPositionsFailed = false;
const combatStartPositionsPromise = import(
  pathToFileURL(path.resolve(__dirname, "../src/config/combatStartPositions.js")).href
)
    .then((mod) => {
      combatStartPositions = mod?.COMBAT_START_POSITIONS || null;
    })
    .catch((err) => {
      combatStartPositionsFailed = true;
      // eslint-disable-next-line no-console
    console.warn("[LAN] Failed to load combat start positions:", err?.message || err);
  });

let captureRules = null;
let captureRulesFailed = false;
const captureRulesPromise = import(
  pathToFileURL(path.resolve(__dirname, "../src/config/captureRules.js")).href
)
  .then((mod) => {
    captureRules = mod || null;
  })
  .catch((err) => {
    captureRulesFailed = true;
    // eslint-disable-next-line no-console
    console.warn("[LAN] Failed to load capture rules:", err?.message || err);
  });

function send(ws, payload) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
}

  function getSpellDef(spellId) {
    if (!spellId) return null;
    const base = spellDefs && spellDefs[spellId] ? spellDefs[spellId] : null;
    if (base) return base;
    if (!monsterSpellDefs) return null;
    for (const list of Object.values(monsterSpellDefs)) {
      if (!list) continue;
      const entry = list[spellId];
      if (entry) return entry;
    }
    return null;
  }

  function getMonsterDef(monsterId) {
    if (!monsterId || !monsterDefs) return null;
    return monsterDefs[monsterId] || null;
  }

  function isMonsterCapturable(monsterId) {
    if (!monsterId || !captureRules || captureRulesFailed) return true;
    const fn = captureRules.isMonsterCapturable;
    if (typeof fn !== "function") return true;
    return fn(monsterId);
  }

  function getCombatPattern(patternId) {
    if (!combatPatterns) return null;
    return combatPatterns[patternId] || null;
  }

function getCombatStartPositions(mapId) {
  if (!combatStartPositions || !mapId) return null;
  return combatStartPositions[mapId] || null;
}

function rollMonsterLevel(monsterId) {
  const def = getMonsterDef(monsterId);
  if (!def) return 1;
  const baseLevel = Number.isFinite(def.baseLevel) ? def.baseLevel : 1;
  const levelMin = Number.isFinite(def.levelMin) ? def.levelMin : baseLevel;
  const levelMax = Number.isFinite(def.levelMax) ? def.levelMax : Math.max(levelMin, 4);
  const lo = Math.min(levelMin, levelMax);
  const hi = Math.max(levelMin, levelMax);
  if (hi <= lo) return lo;
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function buildBaseStatsForClass(classId) {
  if (!statsApi || !classDefs) return null;
  const {
    createStats,
    applyBonuses,
    applyDerivedAgilityStats,
  } = statsApi;
  if (!createStats || !applyBonuses || !applyDerivedAgilityStats) return null;
  const def = classDefs[classId] || classDefs.archer || null;
  const base = createStats();
  const withBonuses = applyBonuses(base, def?.statBonuses || []);
  const derived = applyDerivedAgilityStats({ ...withBonuses });
  const initBonus = derived.initiative ?? 0;
  derived.initiative = initBonus;
  return derived;
}

function computeFinalStats(baseStats, equipment = null) {
  if (!statsApi || !baseStats) return null;
  const { applyBonuses, applyDerivedAgilityStats } = statsApi;
  if (!applyBonuses || !applyDerivedAgilityStats) return null;

  let merged = { ...baseStats };
  if (equipment && itemDefs && equipmentSets) {
    const bonuses = [];
    const setCounts = {};
    for (const entry of Object.values(equipment)) {
      if (!entry || !entry.itemId) continue;
      const def = itemDefs[entry.itemId];
      if (!def) continue;
      if (def.statsBonus) {
        bonuses.push(def.statsBonus);
      }
      if (def.setId) {
        let setId = def.setId;
        if (setId === "corbeau") {
          const id = def.id || entry.itemId;
          const match =
            typeof id === "string" ? id.match(/_(air|eau|feu|terre)$/) : null;
          const element = match ? match[1] : "air";
          setId = `corbeau_${element}`;
        }
        setCounts[setId] = (setCounts[setId] || 0) + 1;
      }
    }

    for (const [setId, count] of Object.entries(setCounts)) {
      const setDef = equipmentSets[setId];
      if (!setDef || !setDef.thresholds) continue;
      let bestThreshold = -1;
      let bestBonus = null;
      for (const [thresholdStr, bonus] of Object.entries(setDef.thresholds)) {
        const threshold = parseInt(thresholdStr, 10);
        if (Number.isNaN(threshold)) continue;
        if (count >= threshold && bonus && threshold > bestThreshold) {
          bestThreshold = threshold;
          bestBonus = bonus;
        }
      }
      if (bestBonus) {
        bonuses.push(bestBonus);
      }
    }

    merged = applyBonuses(merged, bonuses);
  }

  const derived = applyDerivedAgilityStats({ ...merged });
  const initBonus = derived.initiative ?? 0;
  const derivedInit =
    (derived.force ?? 0) +
    (derived.intelligence ?? 0) +
    (derived.agilite ?? 0) +
    (derived.chance ?? 0);
  derived.initiative = initBonus + derivedInit;
  const baseHpMax = derived.hpMax ?? merged.hpMax ?? baseStats.hpMax ?? 50;
  const vit = derived.vitalite ?? 0;
  derived.hpMax = baseHpMax + vit;
  if (!Number.isFinite(derived.hp)) {
    derived.hp = derived.hpMax;
  }
  derived.hp = Math.min(derived.hp, derived.hpMax);
  return derived;
}

function buildCharacterEntryFromPlayer(player) {
  if (!player || !player.characterId) return null;
  const stats = player.stats || {};
  const hp = Number.isFinite(player.hp) ? player.hp : Number.isFinite(stats.hp) ? stats.hp : null;
  const hpMax =
    Number.isFinite(player.hpMax)
      ? player.hpMax
      : Number.isFinite(stats.hpMax)
        ? stats.hpMax
        : null;
  return {
    characterId: player.characterId,
    accountId: player.accountId || null,
    name: player.displayName || "Joueur",
    classId: player.classId || "archer",
    level: Number.isInteger(player.level) ? player.level : 1,
    baseStats: player.baseStats || null,
    levelState: player.levelState || null,
    mapId: player.mapId || null,
    posX: Number.isFinite(player.x) ? player.x : null,
    posY: Number.isFinite(player.y) ? player.y : null,
    hp,
    hpMax,
    capturedMonsterId:
      typeof player.capturedMonsterId === "string" ? player.capturedMonsterId : null,
    capturedMonsterLevel: Number.isFinite(player.capturedMonsterLevel)
      ? player.capturedMonsterLevel
      : null,
    inventory: player.inventory || null,
    gold: Number.isFinite(player.gold) ? player.gold : null,
    honorPoints: Number.isFinite(player.honorPoints) ? player.honorPoints : null,
    equipment: player.equipment || null,
    trash: player.trash || null,
    quests: player.quests || null,
    achievements: player.achievements || null,
    metiers: player.metiers || null,
    spellParchments: player.spellParchments || null,
  };
}

function persistPlayerStateNow(player) {
  if (!characterStore || !player) return;
  const entry = buildCharacterEntryFromPlayer(player);
  if (!entry) return;
  const start = Date.now();
  characterStore.upsertCharacter(entry);
  const elapsed = Date.now() - start;
  if (elapsed >= PERSIST_SLOW_MS) {
    // eslint-disable-next-line no-console
    console.warn("[LAN] Slow persist", {
      ms: elapsed,
      playerId: player.id ?? null,
      characterId: player.characterId ?? null,
    });
  }
}

function persistPlayerState(player, { immediate = false } = {}) {
  if (!player) return;
  const key = Number.isInteger(player.id) ? player.id : player.characterId || null;
  if (immediate || key === null) {
    if (key !== null) {
      const pending = pendingPersist.get(key);
      if (pending?.timer) clearTimeout(pending.timer);
      pendingPersist.delete(key);
    }
    persistPlayerStateNow(player);
    return;
  }
  const pending = pendingPersist.get(key) || { timer: null, player: null };
  pending.player = player;
  if (pending.timer) clearTimeout(pending.timer);
  pending.timer = setTimeout(() => {
    pendingPersist.delete(key);
    persistPlayerStateNow(pending.player);
  }, PERSIST_DEBOUNCE_MS);
  pendingPersist.set(key, pending);
}

function getMonsterCombatStats(def, level) {
  if (!def || !statsApi) return null;
  return buildMonsterStats(def, level, statsApi);
}

function isSimpleDamageSpell(spell) {
  if (!spell) return false;
  const effects = Array.isArray(spell.effects) ? spell.effects : null;
  if (!effects || effects.length !== 1) return false;
  if (effects[0]?.type !== "damage") return false;
  if (spell.effectPattern || spell.areaBuff || spell.summon) return false;
  if (spell.capture || spell.summonMonster || spell.summonCaptured) return false;
  return true;
}

function rollSpellDamage(spell) {
  const min = Number.isFinite(spell.damageMin) ? spell.damageMin : 0;
  const max = Number.isFinite(spell.damageMax) ? spell.damageMax : min;
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (hi <= lo) return lo;
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function buildEvent(payload) {
  const event = { ...payload };
  if (!event.eventId) {
    event.eventId = nextEventId++;
  }
  if (
    COMBAT_EVENT_TYPES.has(event.t) &&
    Number.isInteger(event.combatId) &&
    !Number.isInteger(event.combatSeq)
  ) {
    const combat = state.combats[event.combatId];
    if (combat) {
      combat.combatSeq = Number.isInteger(combat.combatSeq) ? combat.combatSeq + 1 : 1;
      event.combatSeq = combat.combatSeq;
    }
  }
  if (!COMBAT_EVENT_TYPES.has(event.t) && MAX_EVENT_HISTORY > 0) {
    eventHistory.push(event);
    if (eventHistory.length > MAX_EVENT_HISTORY) {
      eventHistory.shift();
    }
  }
  if (COMBAT_EVENT_TYPES.has(event.t) && Number.isInteger(event.combatId)) {
    const list = combatEventHistory.get(event.combatId) || [];
    list.push(event);
    if (list.length > MAX_COMBAT_EVENT_HISTORY) {
      list.shift();
    }
    combatEventHistory.set(event.combatId, list);
  }
  if (event.t === "EvCombatEnded" && Number.isInteger(event.combatId)) {
    combatEventHistory.delete(event.combatId);
  }
  if (DEBUG_COMBAT && (event.t === "EvDamageApplied" || event.t === "EvSpellCast")) {
    // eslint-disable-next-line no-console
    console.log("[LAN][Combat]", "broadcast", {
      t: event.t,
      eventId: event.eventId,
      combatId: event.combatId ?? null,
      casterId: event.casterId ?? null,
      spellId: event.spellId ?? null,
      targetX: event.targetX ?? null,
      targetY: event.targetY ?? null,
      targetKind: event.targetKind ?? null,
      targetId: event.targetId ?? null,
      targetIndex: event.targetIndex ?? null,
      damage: event.damage ?? null,
      source: event.source ?? null,
      authoritative: event.authoritative ?? null,
    });
  }
  return event;
}

function getSocketsForMap(mapId) {
  if (!mapId) return [];
  const sockets = [];
  for (const [ws, info] of clients.entries()) {
    if (!info || !Number.isInteger(info.id)) continue;
    const player = state.players[info.id];
    if (player && player.mapId === mapId && player.connected !== false) {
      sockets.push(ws);
    }
  }
  return sockets;
}

function getSocketsForCombat(combatId) {
  if (!Number.isInteger(combatId)) return [];
  const ids = new Set();
  const combat = state.combats[combatId];
  const participants = Array.isArray(combat?.participantIds) ? combat.participantIds : [];
  participants.forEach((id) => {
    if (Number.isInteger(id)) ids.add(id);
  });
  Object.values(state.players).forEach((player) => {
    if (player && player.combatId === combatId) ids.add(player.id);
  });

  const sockets = [];
  for (const [ws, info] of clients.entries()) {
    if (!info || !Number.isInteger(info.id)) continue;
    if (ids.has(info.id)) sockets.push(ws);
  }
  return sockets;
}

function sendEventToSockets(sockets, event) {
  if (!Array.isArray(sockets) || sockets.length === 0) return;
  sockets.forEach((ws) => send(ws, event));
}

function broadcast(payload) {
  const event = buildEvent(payload);
  if (COMBAT_EVENT_TYPES.has(event.t) && Number.isInteger(event.combatId)) {
    const combatSockets = getSocketsForCombat(event.combatId);
    if (
      (event.t === "EvCombatCreated" ||
        event.t === "EvCombatUpdated" ||
        event.t === "EvCombatEnded") &&
      typeof event.mapId === "string"
    ) {
      const mapSockets = getSocketsForMap(event.mapId);
      const unique = new Set([...combatSockets, ...mapSockets]);
      sendEventToSockets(Array.from(unique), event);
      return;
    }
    sendEventToSockets(combatSockets, event);
    return;
  }
  if (event.t === "EvPlayerMap" && typeof event.fromMapId === "string") {
    const toSockets = getSocketsForMap(event.mapId);
    const fromSockets = getSocketsForMap(event.fromMapId);
    const unique = new Set([...toSockets, ...fromSockets]);
    sendEventToSockets(Array.from(unique), event);
    return;
  }
  if (typeof event.mapId === "string") {
    sendEventToSockets(getSocketsForMap(event.mapId), event);
    return;
  }
  sendEventToSockets(Array.from(clients.keys()), event);
}

function getHostSocket() {
  if (!hostId) return null;
  for (const [ws, info] of clients.entries()) {
    if (info && info.id === hostId) return ws;
  }
  return null;
}

function buildMapPlayersSnapshot(mapId) {
  if (!mapId) return [];
  return Object.values(state.players)
    .filter((p) => p && p.connected !== false && p.mapId === mapId)
    .map((p) => ({
      id: p.id,
      mapId: p.mapId,
      x: Number.isFinite(p.x) ? p.x : 0,
      y: Number.isFinite(p.y) ? p.y : 0,
      classId: p.classId || null,
      displayName: p.displayName || null,
      inCombat: p.inCombat === true,
      combatId: Number.isInteger(p.combatId) ? p.combatId : null,
    }));
}

function sendMapSnapshotToClient(ws, mapId) {
  if (!mapId || !ws) return;
  ensureMapInitialized(mapId);
  const players = buildMapPlayersSnapshot(mapId);
  const monsters = mobHandlers.serializeMonsterEntries(
    Array.isArray(state.mapMonsters[mapId]) ? state.mapMonsters[mapId] : []
  );
  const resources = resourceHandlers.serializeResourceEntries(
    Array.isArray(state.mapResources[mapId]) ? state.mapResources[mapId] : []
  );
  send(ws, {
    t: "EvMapPlayers",
    eventId: nextEventId++,
    mapId,
    players,
  });
  send(ws, {
    t: "EvMapMonsters",
    eventId: nextEventId++,
    mapId,
    monsters,
  });
  send(ws, {
    t: "EvMapResources",
    eventId: nextEventId++,
    mapId,
    resources,
  });
}

  function ensureMapInitialized(mapId) {
    if (!mapId) return false;
    if (state.mapMonsters[mapId] && state.mapResources[mapId] && state.mapMeta[mapId]) {
      return true;
    }
    const now = Date.now();
    const last = mapInitRequests.get(mapId) || 0;
    if (now - last < 1500) return false;
    mapInitRequests.set(mapId, now);

    if (!mapDefs && !mapDefsFailed) {
      mapDefsPromise.then(() => ensureMapInitialized(mapId));
      return false;
    }
    if (!mapDefs) return false;

    const init = initializeMapState({
      mapId,
      maps: mapDefs,
      projectRoot: path.resolve(__dirname, ".."),
      getNextMonsterEntityId,
      getNextResourceEntityId,
      rollMonsterLevel,
    });
    if (!init) return false;

    state.mapMeta[mapId] = init.meta;
    state.mapCollisions[mapId] = init.collisions || new Set();
    state.mapMonsters[mapId] = init.monsters;
    state.mapResources[mapId] = init.resources;

    broadcast({
      t: "EvMapMonsters",
      mapId,
      monsters: mobHandlers.serializeMonsterEntries(init.monsters),
    });
    broadcast({
      t: "EvMapResources",
      mapId,
      resources: resourceHandlers.serializeResourceEntries(init.resources),
    });
    return true;
  }

function snapshotForClient() {
  return {
    mapId: state.mapId,
    players: Object.values(state.players).filter((p) => p && p.connected !== false),
    combat: state.combat,
    combats: combatHandlers.listActiveCombats(),
  };
}

function tryStartCombatIfNeeded() {
  const playerIds = Object.keys(state.players);
  if (playerIds.length === 0) return;
  if (!state.combat.activeId) {
    state.combat.activeId = Number(playerIds[0]);
    state.combat.turnIndex = 0;
  }
}

function isCmdDuplicate(clientInfo, cmdId) {
  if (!Number.isInteger(cmdId)) return true;
  if (cmdId <= clientInfo.lastCmdId) return true;
  clientInfo.lastCmdId = cmdId;
  return false;
}

const RATE_LIMITS = {
  CmdMove: { limit: 12, windowMs: 1000 },
  CmdMoveCombat: { limit: 6, windowMs: 1000 },
  CmdCastSpell: { limit: 4, windowMs: 1000 },
  CmdEndTurnCombat: { limit: 1, windowMs: 1000 },
  CmdCombatStart: { limit: 2, windowMs: 2000 },
  CmdJoinCombat: { limit: 2, windowMs: 2000 },
  CmdCombatReady: { limit: 2, windowMs: 2000 },
  CmdCombatPlacement: { limit: 6, windowMs: 1000 },
  CmdMapChange: { limit: 4, windowMs: 1000 },
  CmdMapMonsters: { limit: 2, windowMs: 2000 },
  CmdMapResources: { limit: 2, windowMs: 2000 },
  CmdRequestMapMonsters: { limit: 4, windowMs: 2000 },
  CmdRequestMapResources: { limit: 4, windowMs: 2000 },
  CmdResourceHarvest: { limit: 4, windowMs: 1000 },
  CmdPlayerSync: { limit: 4, windowMs: 2000 },
  CmdInventoryOp: { limit: 12, windowMs: 1000 },
  CmdGoldOp: { limit: 8, windowMs: 1000 },
  CmdCraft: { limit: 4, windowMs: 1000 },
  CmdQuestAction: { limit: 6, windowMs: 1000 },
  CmdChatMessage: { limit: 6, windowMs: 1000 },
  CmdGroupInvite: { limit: 4, windowMs: 2000 },
  CmdGroupAccept: { limit: 4, windowMs: 2000 },
  CmdGroupDecline: { limit: 4, windowMs: 2000 },
  CmdGroupLeave: { limit: 2, windowMs: 2000 },
  CmdGroupKick: { limit: 4, windowMs: 2000 },
  CmdGroupDisband: { limit: 2, windowMs: 2000 },
  CmdGroupCombatJoin: { limit: 4, windowMs: 2000 },
  CmdGroupCombatDecline: { limit: 6, windowMs: 2000 },
};

function isCmdRateLimited(clientInfo, cmdType) {
  const rule = RATE_LIMITS[cmdType];
  if (!rule) return false;
  const now = Date.now();
  if (!clientInfo.rateLimits) clientInfo.rateLimits = {};
  const entry = clientInfo.rateLimits[cmdType] || { count: 0, windowStart: now };
  if (now - entry.windowStart >= rule.windowMs) {
    entry.count = 0;
    entry.windowStart = now;
  }
  if (entry.count >= rule.limit) {
    clientInfo.rateLimits[cmdType] = entry;
    return true;
  }
  entry.count += 1;
  clientInfo.rateLimits[cmdType] = entry;
  return false;
}

function isCmdSessionValid(clientInfo, msg) {
  if (!clientInfo) return false;
  if (!clientInfo.accountId) return true;
  const token = typeof msg.sessionToken === "string" ? msg.sessionToken : null;
  const accountId = getAccountIdFromSession(token);
  return !!accountId && accountId === clientInfo.accountId;
}

function sanitizePlayerPath(raw, maxSteps = 32) {
  if (!Array.isArray(raw)) return [];
  const steps = [];
  for (const step of raw) {
    if (steps.length >= maxSteps) break;
    const x = Number.isInteger(step?.x) ? step.x : null;
    const y = Number.isInteger(step?.y) ? step.y : null;
    if (x === null || y === null) break;
    steps.push({ x, y });
  }
  return steps;
}

function tickPlayerRegen() {
  const now = Date.now();
  Object.values(state.players).forEach((player) => {
    if (!player || player.inCombat) return;
    const stats = player.stats || {};
    const hpMax =
      Number.isFinite(player.hpMax)
        ? player.hpMax
        : Number.isFinite(stats.hpMax)
          ? stats.hpMax
          : null;
    if (!Number.isFinite(hpMax) || hpMax <= 0) return;
    const hp =
      Number.isFinite(player.hp)
        ? player.hp
        : Number.isFinite(stats.hp)
          ? stats.hp
          : hpMax;
    if (hp >= hpMax) return;
    const nextHp = Math.min(hpMax, hp + REGEN_PER_TICK);
    player.hp = nextHp;
    if (player.stats) {
      player.stats.hp = nextHp;
      player.stats.hpMax = hpMax;
    }
    player.lastRegenAt = now;
  });
}

function persistAllPlayers() {
  Object.values(state.players).forEach((player) => {
    if (!player) return;
    persistPlayerState(player);
  });
}

const getNextEventId = () => nextEventId++;
const getNextPlayerId = () => nextPlayerId++;
const getNextMonsterEntityId = () => nextMonsterEntityId++;
const getNextResourceEntityId = () => nextResourceEntityId++;
const getNextCombatId = () => nextCombatId++;
const getNextGroupId = () => nextGroupId++;
let nextSummonId = 1;
const getNextSummonId = () => nextSummonId++;
const getHostId = () => hostId;
const setHostId = (id) => {
  hostId = id;
};

function sendToPlayerId(playerId, payload) {
  if (!Number.isInteger(playerId)) return;
  for (const [ws, info] of clients.entries()) {
    if (info && info.id === playerId) {
      send(ws, payload);
      return;
    }
  }
}

const mobHandlers = createMobHandlers({
  state,
  broadcast,
  send,
  getNextEventId,
  getNextMonsterEntityId,
  getHostId,
  ensureMapInitialized,
  monsterMoveTimers,
  monsterRespawnTimers,
  config: { MONSTER_STEP_DURATION_MS, MOB_RESPAWN_DELAY_MS },
});

let playerHandlers = null;

const resourceHandlers = createResourceHandlers({
  state,
  broadcast,
  send,
  getNextEventId,
  getNextResourceEntityId,
  getHostId,
  ensureMapInitialized,
  resourceRespawnTimers,
  getHarvestResourceDef: (resourceId) =>
    harvestResourceDefs ? harvestResourceDefs[resourceId] || null : null,
  getHarvestResourceDefsPromise: () => harvestResourceDefsPromise,
  getHarvestResourceDefsFailed: () => harvestResourceDefsFailed,
  applyInventoryOpFromServer: (...args) =>
    playerHandlers?.applyInventoryOpFromServer?.(...args),
});

const combatHandlers = createCombatHandlers({
    state,
    broadcast,
    send,
    sendToPlayerId,
    getNextCombatId,
    getNextEventId,
    getNextSummonId,
    getHostId,
    sanitizePlayerPath,
    serializeMonsterEntries: mobHandlers.serializeMonsterEntries,
    monsterMoveTimers,
    getSpellDef,
    isSimpleDamageSpell,
    rollSpellDamage,
    getMonsterDef,
    applyInventoryOpFromServer: (...args) =>
      playerHandlers?.applyInventoryOpFromServer?.(...args),
    applyQuestKillProgressForPlayer: (...args) =>
      playerHandlers?.applyQuestKillProgressForPlayer?.(...args),
    applyCombatRewardsForPlayer: (...args) =>
      playerHandlers?.applyCombatRewardsForPlayer?.(...args),
    getXpConfig: () => xpConfig,
    getMonsterCombatStats,
    isMonsterCapturable,
    getCombatPattern,
    getCombatStartPositions,
    persistPlayerState,
  });

function getCombatJoinPayload(playerId) {
  if (!Number.isInteger(playerId)) return null;
  const player = state.players[playerId];
  if (!player || !player.inCombat) return null;
  const combatId = Number.isInteger(player.combatId) ? player.combatId : null;
  if (!combatId) return null;
  const combat = state.combats[combatId];
  if (!combat) return null;
  const combatEntry = combatHandlers.serializeCombatEntry
    ? combatHandlers.serializeCombatEntry(combat)
    : null;
  if (!combatEntry) return null;
  const mobEntries = Array.isArray(combat.mobEntries) ? combat.mobEntries : [];
  return {
    combat: combatEntry,
    mobEntries: mobHandlers.serializeMonsterEntries(mobEntries),
  };
}

playerHandlers = createPlayerHandlers({
  state,
  clients,
  broadcast,
  send,
  sendToPlayerId,
  createPlayer,
  accountStore,
  config: {
    PROTOCOL_VERSION,
    GAME_DATA_VERSION,
    MAX_PLAYERS,
  },
  getNextPlayerId,
  getNextEventId,
  getNextGroupId,
  getHostId,
  setHostId,
  tryStartCombatIfNeeded,
  snapshotForClient,
  ensureMapInitialized,
  characterStore,
  issueSessionToken,
  getAccountIdFromSession,
  buildBaseStatsForClass,
  computeFinalStats,
  persistPlayerState,
  getCombatJoinPayload,
  ensureCombatSnapshot: combatHandlers.ensureCombatSnapshot,
  getItemDefs: () => itemDefs,
  getItemDefsPromise: () => itemDefsPromise,
  getItemDefsFailed: () => itemDefsFailed,
  getQuestDefs: () => questDefs,
  getQuestDefsPromise: () => questDefsPromise,
  getQuestDefsFailed: () => questDefsFailed,
  getQuestStates: () => questStates,
  getLevelApi: () => levelApi,
  getLevelApiFailed: () => levelApiFailed,
  getMonsterDef,
  getCraftRecipe: (metierId, recipeId) => {
    if (!craftDefs || !metierId || !recipeId) return null;
    const list = craftDefs[metierId];
    if (!Array.isArray(list)) return null;
    return list.find((r) => r && r.id === recipeId) || null;
  },
  getCraftDefsPromise: () => craftDefsPromise,
  getCraftDefsFailed: () => craftDefsFailed,
});

ensureMapInitialized(state.mapId);

const router = createRouterHandlers({
  state,
  clients,
  send,
  broadcast,
  playerHandlers,
  combatHandlers,
  mobHandlers,
  resourceHandlers,
  debugCombatLog,
  isCmdDuplicate,
  isCmdRateLimited,
  isCmdSessionValid,
  sendMapSnapshotToClient,
  persistPlayerState,
  getHostId,
  setHostId,
  LAN_TRACE,
  COMBAT_RECONNECT_GRACE_MS,
  combatEventHistory,
});

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let msg = null;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    router.handleMessage(ws, msg);
  });

  ws.on("close", () => {
    router.handleClose(ws);
  });
});

startServerTimers({
  mobHandlers,
  tickPlayerRegen,
  tickGroupHpUpdates: () => playerHandlers?.handleGroupHpTick?.(),
  persistAllPlayers,
  MOB_ROAM_TICK_MS,
  REGEN_TICK_MS,
  GROUP_HP_TICK_MS,
  PERSIST_TICK_MS,
});

// eslint-disable-next-line no-console
console.log(`[LAN] WebSocket server on ws://localhost:${PORT}`);
