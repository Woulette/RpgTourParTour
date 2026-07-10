import {
  VERSION, ELEMENT_IDS, ITEMS, COMPANIONS, PROFESSIONS, SKILLS, QUESTS,
  SLOT_LABELS, xpForLevel, jobXpForLevel
} from './data.js';

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (min, max) => Math.random() * (max - min) + min;
export const randInt = (min, max) => Math.floor(rand(min, max + 1));
export const pick = list => list[Math.floor(Math.random() * list.length)];
export const uid = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
export const formatNumber = n => Math.round(n).toLocaleString('fr-FR');

export class EventBus {
  constructor() { this.listeners = new Map(); }
  on(name, fn) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(fn);
    return () => this.listeners.get(name)?.delete(fn);
  }
  emit(name, detail) { this.listeners.get(name)?.forEach(fn => fn(detail)); }
}

const START_EQUIPMENT = {
  weapon: 'novice_blade', armor: 'linen_tunic', head: 'traveler_cap', cape: null,
  necklace: null, ring1: 'copper_ring', ring2: null, belt: 'trail_belt', boots: 'swift_boots'
};

function baseQuestState() {
  const result = {};
  for (const id of Object.keys(QUESTS)) result[id] = { status: id === 'mastery' ? 'locked' : 'active', progress: {}, claimed: false };
  return result;
}

export function createNewState(name = 'Aventurier') {
  return {
    version: VERSION,
    createdAt: Date.now(),
    lastSavedAt: Date.now(),
    profile: { name: String(name || 'Aventurier').trim().slice(0, 16) || 'Aventurier' },
    player: {
      level: 1, xp: 0, profession: 'novice', jobLevel: 1, jobXp: 0, jobLocked: false,
      unspent: 5,
      elements: { fire: 0, water: 0, air: 0, earth: 0, neutral: 0 },
      hp: 100, mana: 40,
      gold: 120,
      position: { x: 690, y: 1100 },
      discovered: ['town'],
      selectedTeam: [],
      defeated: {},
      battlesWon: 0,
      playTime: 0
    },
    companions: {},
    inventory: [
      { id: 'summon_scroll', qty: 1 },
      { id: 'minor_potion', qty: 4 },
      { id: 'mana_tonic', qty: 2 }
    ],
    equipment: { ...START_EQUIPMENT },
    quests: baseQuestState(),
    world: { defeatedNodes: {}, lastZone: 'town' },
    settings: { music: true, sound: true, vibration: true, textSpeed: 1, reducedMotion: false, autoSave: true },
    flags: { introSeen: false, summonExplained: false, classExplained: false }
  };
}

function migrateState(raw) {
  const base = createNewState(raw?.profile?.name || 'Aventurier');
  if (!raw || typeof raw !== 'object') return base;
  const merged = {
    ...base,
    ...raw,
    profile: { ...base.profile, ...(raw.profile || {}) },
    player: {
      ...base.player,
      ...(raw.player || {}),
      elements: { ...base.player.elements, ...(raw.player?.elements || {}) },
      position: { ...base.player.position, ...(raw.player?.position || {}) }
    },
    companions: { ...(raw.companions || {}) },
    equipment: { ...base.equipment, ...(raw.equipment || {}) },
    quests: { ...base.quests, ...(raw.quests || {}) },
    world: { ...base.world, ...(raw.world || {}), defeatedNodes: { ...(raw.world?.defeatedNodes || {}) } },
    settings: { ...base.settings, ...(raw.settings || {}) },
    flags: { ...base.flags, ...(raw.flags || {}) }
  };
  merged.version = VERSION;
  merged.inventory = Array.isArray(raw.inventory) ? raw.inventory.filter(e => ITEMS[e.id] && e.qty > 0) : base.inventory;
  if (!Array.isArray(merged.player.discovered)) merged.player.discovered = ['town'];
  if (!Array.isArray(merged.player.selectedTeam)) merged.player.selectedTeam = [];
  return merged;
}

export class StateStore {
  static KEY = 'andemia_v2_save';

  constructor() {
    this.bus = new EventBus();
    this.state = null;
    this.saveTimer = null;
    this.dirty = false;
  }

  hasSave() { return Boolean(localStorage.getItem(StateStore.KEY)); }

  load() {
    try {
      const raw = JSON.parse(localStorage.getItem(StateStore.KEY));
      this.state = migrateState(raw);
      this.normalizeVitals();
      return this.state;
    } catch (error) {
      console.warn('Sauvegarde illisible, nouvelle partie créée.', error);
      return null;
    }
  }

  newGame(name) {
    this.state = createNewState(name);
    const stats = this.getPlayerStats();
    this.state.player.hp = stats.maxHp;
    this.state.player.mana = stats.maxMana;
    this.save(true);
    this.bus.emit('newGame', this.state);
    return this.state;
  }

  save(force = false) {
    if (!this.state || (!force && !this.dirty)) return;
    this.state.lastSavedAt = Date.now();
    localStorage.setItem(StateStore.KEY, JSON.stringify(this.state));
    this.dirty = false;
    this.bus.emit('saved', this.state.lastSavedAt);
  }

  startAutosave() {
    clearInterval(this.saveTimer);
    this.saveTimer = setInterval(() => {
      if (this.state?.settings.autoSave) this.save();
    }, 12000);
  }

  touch(event = 'change', detail = null) {
    this.dirty = true;
    this.bus.emit(event, detail ?? this.state);
    this.bus.emit('change', this.state);
  }

  reset() {
    localStorage.removeItem(StateStore.KEY);
    this.state = null;
    this.bus.emit('reset');
  }

  exportSave() {
    if (!this.state) return '';
    const json = JSON.stringify(this.state);
    return btoa(unescape(encodeURIComponent(json)));
  }

  importSave(encoded) {
    const json = decodeURIComponent(escape(atob(String(encoded).trim())));
    const parsed = JSON.parse(json);
    this.state = migrateState(parsed);
    this.normalizeVitals();
    this.save(true);
    this.bus.emit('imported', this.state);
  }

  getEquipmentStats() {
    const total = { hp: 0, mana: 0, attack: 0, magic: 0, defense: 0, speed: 0, fire: 0, water: 0, air: 0, earth: 0, neutral: 0 };
    for (const itemId of Object.values(this.state?.equipment || {})) {
      const item = ITEMS[itemId];
      if (!item?.stats) continue;
      for (const [key, value] of Object.entries(item.stats)) total[key] = (total[key] || 0) + value;
    }
    return total;
  }

  getPlayerStats() {
    const p = this.state.player;
    const gear = this.getEquipmentStats();
    const cls = p.profession;
    const classHp = cls === 'swordsman' ? 1.16 : cls === 'archer' ? 0.96 : cls === 'mage' ? 0.9 : 1;
    const classAtk = cls === 'swordsman' ? 1.12 : cls === 'archer' ? 1.08 : cls === 'mage' ? 0.92 : 1;
    const classMagic = cls === 'mage' ? 1.3 : cls === 'archer' ? 1.02 : 0.9;
    const maxHp = Math.round((88 + p.level * 12 + p.elements.earth * 5 + p.elements.neutral * 2 + gear.hp) * classHp);
    const maxMana = Math.round(32 + p.level * 4 + p.elements.water * 3 + p.elements.neutral * 2 + gear.mana + (cls === 'mage' ? p.jobLevel * 4 : 0));
    const attack = Math.round((8 + p.level * 2.1 + p.elements.neutral * 0.55 + gear.attack) * classAtk);
    const magic = Math.round((8 + p.level * 1.65 + p.elements.neutral * 0.45 + gear.magic + (cls === 'mage' ? p.jobLevel * 1.8 : 0)) * classMagic);
    const defense = Math.round(4 + p.level * 1.15 + p.elements.earth * 0.65 + gear.defense + (cls === 'swordsman' ? p.jobLevel * 0.6 : 0));
    // Contrainte de design : aucun gain de vitesse caché. Vitesse = niveau de base + stuff.
    const speed = Math.max(1, Math.round(p.level + gear.speed));
    const affinities = {};
    for (const element of ELEMENT_IDS) affinities[element] = Math.round((p.elements[element] || 0) + (gear[element] || 0));
    const crit = clamp(0.05 + affinities.air * 0.0025 + (cls === 'archer' ? 0.06 : 0), 0.05, 0.35);
    return { maxHp, maxMana, attack, magic, defense, speed, crit, affinities, gear };
  }

  normalizeVitals() {
    if (!this.state) return;
    const stats = this.getPlayerStats();
    this.state.player.hp = clamp(Number(this.state.player.hp) || stats.maxHp, 0, stats.maxHp);
    this.state.player.mana = clamp(Number(this.state.player.mana) || stats.maxMana, 0, stats.maxMana);
  }

  getPlayerSkills() {
    const p = this.state.player;
    if (p.profession === 'novice') return [...PROFESSIONS.novice.startingSkills];
    const classSkills = PROFESSIONS[p.profession]?.skills || [];
    const unlockedCount = clamp(2 + Math.floor(p.jobLevel / 5), 2, classSkills.length);
    return ['basic_strike', ...classSkills.slice(0, unlockedCount)];
  }

  getItemCount(itemId) { return this.state.inventory.find(e => e.id === itemId)?.qty || 0; }

  addItem(itemId, qty = 1, silent = false) {
    if (!ITEMS[itemId] || qty <= 0) return false;
    const entry = this.state.inventory.find(e => e.id === itemId);
    if (entry) entry.qty += qty;
    else this.state.inventory.push({ id: itemId, qty });
    if (!silent) this.touch('inventory', { type: 'add', itemId, qty });
    return true;
  }

  removeItem(itemId, qty = 1, silent = false) {
    const index = this.state.inventory.findIndex(e => e.id === itemId);
    if (index < 0 || this.state.inventory[index].qty < qty) return false;
    this.state.inventory[index].qty -= qty;
    if (this.state.inventory[index].qty <= 0) this.state.inventory.splice(index, 1);
    if (!silent) this.touch('inventory', { type: 'remove', itemId, qty });
    return true;
  }

  useItem(itemId) {
    const item = ITEMS[itemId];
    if (!item || item.type !== 'consumable' || this.getItemCount(itemId) <= 0) return { ok: false, message: 'Objet indisponible.' };
    if (item.action === 'summon') return { ok: true, action: 'summon' };
    const stats = this.getPlayerStats();
    if (item.action === 'heal') {
      if (this.state.player.hp >= stats.maxHp) return { ok: false, message: 'Tes PV sont déjà au maximum.' };
      this.removeItem(itemId, 1, true);
      const before = this.state.player.hp;
      this.state.player.hp = clamp(before + item.amount, 0, stats.maxHp);
      this.touch('itemUsed', { itemId, amount: this.state.player.hp - before, kind: 'heal' });
      return { ok: true, amount: this.state.player.hp - before, message: `+${this.state.player.hp - before} PV` };
    }
    if (item.action === 'mana') {
      if (this.state.player.mana >= stats.maxMana) return { ok: false, message: 'Ton mana est déjà au maximum.' };
      this.removeItem(itemId, 1, true);
      const before = this.state.player.mana;
      this.state.player.mana = clamp(before + item.amount, 0, stats.maxMana);
      this.touch('itemUsed', { itemId, amount: this.state.player.mana - before, kind: 'mana' });
      return { ok: true, amount: this.state.player.mana - before, message: `+${this.state.player.mana - before} mana` };
    }
    return { ok: false, message: 'Cet objet ne peut pas être utilisé ici.' };
  }

  equip(itemId, preferredSlot = null) {
    const item = ITEMS[itemId];
    if (!item || item.type !== 'equipment') return { ok: false, message: 'Ce n’est pas un équipement.' };
    if (this.getItemCount(itemId) <= 0) return { ok: false, message: 'Objet indisponible.' };
    if (this.state.player.level < (item.level || 1)) return { ok: false, message: `Niveau ${item.level} requis.` };
    let slot = preferredSlot || item.slot;
    if (item.slot === 'ring') {
      if (slot !== 'ring1' && slot !== 'ring2') slot = this.state.equipment.ring1 ? (this.state.equipment.ring2 ? 'ring1' : 'ring2') : 'ring1';
    }
    if (!(slot in this.state.equipment)) return { ok: false, message: 'Emplacement invalide.' };
    const old = this.state.equipment[slot];
    this.removeItem(itemId, 1, true);
    if (old) this.addItem(old, 1, true);
    this.state.equipment[slot] = itemId;
    this.normalizeVitals();
    this.touch('equipment', { slot, itemId, old });
    return { ok: true, message: `${item.name} équipé dans ${SLOT_LABELS[slot]}.` };
  }

  unequip(slot) {
    if (!(slot in this.state.equipment) || !this.state.equipment[slot]) return false;
    const itemId = this.state.equipment[slot];
    this.state.equipment[slot] = null;
    this.addItem(itemId, 1, true);
    this.normalizeVitals();
    this.touch('equipment', { slot, itemId: null, old: itemId });
    return true;
  }

  allocate(element) {
    if (!ELEMENT_IDS.includes(element) || this.state.player.unspent <= 0) return false;
    this.state.player.elements[element] += 1;
    this.state.player.unspent -= 1;
    this.normalizeVitals();
    this.touch('stats', { element });
    return true;
  }

  gainXp(amount) {
    const p = this.state.player;
    p.xp += Math.max(0, Math.floor(amount));
    const levels = [];
    while (p.xp >= xpForLevel(p.level)) {
      p.xp -= xpForLevel(p.level);
      p.level += 1;
      p.unspent += 5;
      levels.push(p.level);
    }
    if (levels.length) {
      const stats = this.getPlayerStats();
      p.hp = stats.maxHp;
      p.mana = stats.maxMana;
    }
    this.touch('xp', { amount, levels });
    return levels;
  }

  gainJobXp(amount) {
    const p = this.state.player;
    if (p.profession === 'novice' && p.jobLevel >= 20) {
      p.jobLevel = 20;
      p.jobXp = 0;
      p.jobLocked = true;
      this.touch('jobLocked', { level: 20 });
      return [];
    }
    const cap = PROFESSIONS[p.profession]?.cap || 20;
    p.jobXp += Math.max(0, Math.floor(amount));
    const levels = [];
    while (p.jobLevel < cap && p.jobXp >= jobXpForLevel(p.jobLevel)) {
      p.jobXp -= jobXpForLevel(p.jobLevel);
      p.jobLevel += 1;
      levels.push(p.jobLevel);
      if (p.profession === 'novice' && p.jobLevel >= 20) {
        p.jobLevel = 20;
        p.jobXp = 0;
        p.jobLocked = true;
        break;
      }
    }
    this.touch('jobXp', { amount, levels, locked: p.jobLocked });
    return levels;
  }

  evolveProfession(classId) {
    const p = this.state.player;
    if (!['swordsman', 'archer', 'mage'].includes(classId)) return { ok: false, message: 'Voie inconnue.' };
    if (p.profession !== 'novice') return { ok: false, message: 'Ton évolution est déjà accomplie.' };
    if (p.jobLevel < 20) return { ok: false, message: 'Le niveau de métier 20 est requis.' };
    p.profession = classId;
    p.jobLocked = false;
    p.jobXp = 0;
    this.trackEvent('profession', classId, 1, true);
    this.touch('profession', { classId });
    return { ok: true, message: `Tu es maintenant ${PROFESSIONS[classId].name}.` };
  }

  summonCompanion(companionId) {
    const def = COMPANIONS[companionId];
    if (!def) return { ok: false, message: 'Compagnon inconnu.' };
    if (this.state.companions[companionId]) return { ok: false, message: `${def.name} t’accompagne déjà.` };
    if (!this.removeItem('summon_scroll', 1, true)) return { ok: false, message: 'Aucun parchemin primordial.' };
    this.state.companions[companionId] = { id: companionId, level: 1, xp: 0, bond: 0, hp: def.base.hp, mana: def.base.mana };
    if (this.state.player.selectedTeam.length < 3) this.state.player.selectedTeam.push(companionId);
    this.trackEvent('companionCount', companionId, 1, true);
    this.touch('companionSummoned', { companionId });
    return { ok: true, companion: this.state.companions[companionId], message: `${def.name} a répondu à ton appel !` };
  }

  toggleTeamMember(companionId) {
    if (!this.state.companions[companionId]) return false;
    const team = this.state.player.selectedTeam;
    const index = team.indexOf(companionId);
    if (index >= 0) team.splice(index, 1);
    else if (team.length < 3) team.push(companionId);
    else return false;
    this.touch('team', { team: [...team] });
    return true;
  }

  getCompanionStats(companionId) {
    const owned = this.state.companions[companionId];
    const def = COMPANIONS[companionId];
    if (!owned || !def) return null;
    const n = owned.level - 1;
    return {
      maxHp: Math.round(def.base.hp + def.growth.hp * n),
      maxMana: Math.round(def.base.mana + def.growth.mana * n),
      attack: Math.round(def.base.attack + def.growth.attack * n),
      magic: Math.round(def.base.attack * 0.9 + def.growth.attack * 0.9 * n),
      defense: Math.round(def.base.defense + def.growth.defense * n),
      speed: Math.round(def.base.speed + def.growth.speed * n),
      crit: def.element === 'air' ? 0.12 : 0.06,
      affinities: { fire: 0, water: 0, air: 0, earth: 0, neutral: 0, [def.element]: 8 + owned.level * 2 }
    };
  }

  gainCompanionXp(companionId, amount) {
    const owned = this.state.companions[companionId];
    if (!owned) return [];
    owned.xp += Math.max(0, Math.floor(amount));
    owned.bond = clamp((owned.bond || 0) + Math.ceil(amount / 20), 0, 100);
    const levels = [];
    while (owned.xp >= xpForLevel(owned.level)) {
      owned.xp -= xpForLevel(owned.level);
      owned.level += 1;
      levels.push(owned.level);
    }
    const stats = this.getCompanionStats(companionId);
    owned.hp = stats.maxHp;
    owned.mana = stats.maxMana;
    this.touch('companionXp', { companionId, amount, levels });
    return levels;
  }

  healParty() {
    const stats = this.getPlayerStats();
    this.state.player.hp = stats.maxHp;
    this.state.player.mana = stats.maxMana;
    for (const id of Object.keys(this.state.companions)) {
      const cstats = this.getCompanionStats(id);
      this.state.companions[id].hp = cstats.maxHp;
      this.state.companions[id].mana = cstats.maxMana;
    }
    this.touch('healed');
  }

  buy(itemId, qty = 1) {
    const item = ITEMS[itemId];
    const cost = Math.ceil((item?.value || 0) * 1.15) * qty;
    if (!item) return { ok: false, message: 'Objet inconnu.' };
    if (this.state.player.gold < cost) return { ok: false, message: 'Pas assez d’or.' };
    this.state.player.gold -= cost;
    this.addItem(itemId, qty, true);
    this.touch('shop', { type: 'buy', itemId, qty, cost });
    return { ok: true, cost, message: `${item.name} acheté.` };
  }

  sell(itemId, qty = 1) {
    const item = ITEMS[itemId];
    if (!item || this.getItemCount(itemId) < qty) return { ok: false, message: 'Objet indisponible.' };
    if (itemId === 'summon_scroll') return { ok: false, message: 'Les parchemins primordiaux ne peuvent pas être vendus.' };
    const gain = Math.max(1, Math.floor(item.value * 0.55)) * qty;
    this.removeItem(itemId, qty, true);
    this.state.player.gold += gain;
    this.touch('shop', { type: 'sell', itemId, qty, gain });
    return { ok: true, gain, message: `${item.name} vendu pour ${gain} or.` };
  }

  recordBattle(rewards, enemies) {
    const p = this.state.player;
    p.battlesWon += 1;
    p.gold += rewards.gold;
    for (const drop of rewards.items) this.addItem(drop.id, drop.qty, true);
    for (const enemy of enemies) {
      p.defeated[enemy.id] = (p.defeated[enemy.id] || 0) + 1;
      this.trackEvent('kill', enemy.id, 1, true);
    }
    this.gainXp(rewards.xp);
    this.gainJobXp(rewards.jobXp);
    for (const companionId of p.selectedTeam) this.gainCompanionXp(companionId, rewards.companionXp);
    this.touch('battleRewards', rewards);
  }

  discoverZone(zoneId) {
    if (this.state.player.discovered.includes(zoneId)) return false;
    this.state.player.discovered.push(zoneId);
    this.trackEvent('discover', zoneId, 1, true);
    this.touch('discover', { zoneId });
    return true;
  }

  trackEvent(type, target, amount = 1, silent = false) {
    for (const [questId, questState] of Object.entries(this.state.quests)) {
      if (questState.status !== 'active') continue;
      const quest = QUESTS[questId];
      quest.objectives.forEach((objective, index) => {
        if (objective.type !== type) return;
        if (objective.type === 'kill' && objective.target !== target) return;
        if (objective.type === 'profession' && !objective.target.includes(target)) return;
        const key = String(index);
        questState.progress[key] = clamp((questState.progress[key] || 0) + amount, 0, objective.amount);
      });
      if (this.isQuestComplete(questId)) questState.status = 'complete';
    }
    if (!silent) this.touch('quests', { type, target, amount });
  }

  isQuestComplete(questId) {
    const quest = QUESTS[questId];
    const state = this.state.quests[questId];
    if (!quest || !state) return false;
    return quest.objectives.every((objective, index) => (state.progress[String(index)] || 0) >= objective.amount);
  }

  claimQuest(questId) {
    const quest = QUESTS[questId];
    const qstate = this.state.quests[questId];
    if (!quest || !qstate || qstate.status !== 'complete' || qstate.claimed) return { ok: false, message: 'Récompense indisponible.' };
    const rewards = quest.rewards;
    if (rewards.gold) this.state.player.gold += rewards.gold;
    if (rewards.xp) this.gainXp(rewards.xp);
    if (rewards.jobXp) this.gainJobXp(rewards.jobXp);
    for (const item of rewards.items || []) this.addItem(item.id, item.qty, true);
    qstate.status = 'claimed';
    qstate.claimed = true;
    if (questId === 'slime_problem') this.state.quests.horizons.status = this.state.quests.horizons.status === 'locked' ? 'active' : this.state.quests.horizons.status;
    if (questId === 'horizons') this.state.quests.mastery.status = 'active';
    this.touch('questClaimed', { questId, rewards });
    return { ok: true, rewards, message: `Quête terminée : ${quest.name}` };
  }

  setPosition(x, y) {
    this.state.player.position.x = x;
    this.state.player.position.y = y;
    this.dirty = true;
  }
}

export function buildPlayerActor(store) {
  const stats = store.getPlayerStats();
  const p = store.state.player;
  return {
    uid: 'hero', sourceId: 'hero', side: 'ally', kind: 'hero', name: store.state.profile.name,
    level: p.level, element: 'neutral', hp: clamp(p.hp, 1, stats.maxHp), maxHp: stats.maxHp,
    mana: clamp(p.mana, 0, stats.maxMana), maxMana: stats.maxMana,
    attack: stats.attack, magic: stats.magic, defense: stats.defense, speed: stats.speed,
    crit: stats.crit, affinities: { ...stats.affinities }, skills: store.getPlayerSkills(),
    statuses: [], cooldowns: {}, initiative: 0, alive: true
  };
}

export function buildCompanionActor(store, companionId) {
  const def = COMPANIONS[companionId];
  const owned = store.state.companions[companionId];
  const stats = store.getCompanionStats(companionId);
  if (!def || !owned || !stats) return null;
  return {
    uid: `companion_${companionId}`, sourceId: companionId, side: 'ally', kind: 'companion', name: def.name,
    level: owned.level, element: def.element, hp: clamp(owned.hp || stats.maxHp, 1, stats.maxHp), maxHp: stats.maxHp,
    mana: clamp(owned.mana ?? stats.maxMana, 0, stats.maxMana), maxMana: stats.maxMana,
    attack: stats.attack, magic: stats.magic, defense: stats.defense, speed: stats.speed,
    crit: stats.crit, affinities: { ...stats.affinities }, skills: [...def.skills],
    statuses: [], cooldowns: {}, initiative: 0, alive: true
  };
}

export function describeStats(stats) {
  return [
    ['PV', stats.maxHp], ['Mana', stats.maxMana], ['Attaque', stats.attack], ['Magie', stats.magic],
    ['Défense', stats.defense], ['Vitesse', stats.speed], ['Critique', `${Math.round(stats.crit * 100)} %`]
  ];
}
