export const VERSION = 2;

export const ELEMENTS = {
  fire: { id: 'fire', name: 'Feu', icon: '🔥', color: '#ff7048', soft: '#5c231c' },
  water: { id: 'water', name: 'Eau', icon: '💧', color: '#59b7ff', soft: '#173a58' },
  air: { id: 'air', name: 'Air', icon: '🌪️', color: '#9be7df', soft: '#244a48' },
  earth: { id: 'earth', name: 'Terre', icon: '🪨', color: '#d1a35b', soft: '#4b3820' },
  neutral: { id: 'neutral', name: 'Neutre', icon: '✦', color: '#ddd5ca', soft: '#42404a' }
};

export const ELEMENT_IDS = Object.keys(ELEMENTS);

// Cycle: Feu > Terre > Air > Eau > Feu. Le neutre ne possède ni avantage ni faiblesse.
export function elementMultiplier(attacking, defending) {
  if (!attacking || !defending || attacking === 'neutral' || defending === 'neutral' || attacking === defending) return 1;
  const strongAgainst = { fire: 'earth', earth: 'air', air: 'water', water: 'fire' };
  if (strongAgainst[attacking] === defending) return 1.35;
  if (strongAgainst[defending] === attacking) return 0.72;
  return 1;
}

export const PROFESSIONS = {
  novice: {
    id: 'novice', name: 'Aventurier', icon: '🗡️', cap: 20,
    description: 'Une voie libre qui permet de découvrir son style avant l’évolution.',
    startingSkills: ['basic_strike', 'guard', 'neutral_burst', 'first_aid']
  },
  swordsman: {
    id: 'swordsman', name: 'Épéiste', icon: '⚔️', cap: 60,
    description: 'Combattant robuste, spécialiste des frappes élémentaires et de la garde.',
    skills: ['blade_arc', 'flame_edge', 'stone_wall', 'tidal_slash', 'gale_rush']
  },
  archer: {
    id: 'archer', name: 'Archer', icon: '🏹', cap: 60,
    description: 'Attaquant rapide qui exploite les faiblesses et enchaîne les tours.',
    skills: ['quick_shot', 'ember_arrow', 'frost_arrow', 'cyclone_volley', 'rooting_shot']
  },
  mage: {
    id: 'mage', name: 'Mage', icon: '🔮', cap: 60,
    description: 'Maître des éléments, puissant mais dépendant de sa réserve de mana.',
    skills: ['arcane_orb', 'fireball', 'healing_rain', 'thunder_call', 'earth_spike']
  }
};

export const SKILLS = {
  basic_strike: {
    id: 'basic_strike', name: 'Frappe', icon: '⚔️', element: 'neutral', mana: 0, power: 1,
    target: 'enemy', cooldown: 0, description: 'Une attaque fiable sans coût en mana.'
  },
  guard: {
    id: 'guard', name: 'Garde', icon: '🛡️', element: 'neutral', mana: 0, power: 0,
    target: 'self', cooldown: 2, status: { type: 'guard', turns: 1, value: 0.45 },
    description: 'Réduit fortement les dégâts reçus jusqu’au prochain tour.'
  },
  neutral_burst: {
    id: 'neutral_burst', name: 'Éclat neutre', icon: '✦', element: 'neutral', mana: 10, power: 1.35,
    target: 'enemy', cooldown: 1, description: 'Une décharge qui ignore le cycle élémentaire.'
  },
  first_aid: {
    id: 'first_aid', name: 'Premiers soins', icon: '✚', element: 'neutral', mana: 12, power: 0.85,
    target: 'ally', cooldown: 2, heal: true, description: 'Rend des PV à un allié.'
  },

  blade_arc: {
    id: 'blade_arc', name: 'Arc de lame', icon: '🗡️', element: 'neutral', mana: 8, power: 1.2,
    target: 'allEnemies', cooldown: 2, description: 'Une coupe circulaire qui touche tous les ennemis.'
  },
  flame_edge: {
    id: 'flame_edge', name: 'Lame ardente', icon: '🔥', element: 'fire', mana: 14, power: 1.7,
    target: 'enemy', cooldown: 2, status: { type: 'burn', turns: 2, value: 0.16 },
    description: 'Une frappe de feu pouvant brûler la cible.'
  },
  stone_wall: {
    id: 'stone_wall', name: 'Mur de pierre', icon: '🪨', element: 'earth', mana: 18, power: 0,
    target: 'allAllies', cooldown: 4, status: { type: 'barrier', turns: 2, value: 0.28 },
    description: 'Protège toute l’équipe pendant deux tours.'
  },
  tidal_slash: {
    id: 'tidal_slash', name: 'Taille des marées', icon: '🌊', element: 'water', mana: 16, power: 1.45,
    target: 'enemy', cooldown: 2, drain: 0.22, description: 'Draine une partie des dégâts infligés.'
  },
  gale_rush: {
    id: 'gale_rush', name: 'Ruée du zéphyr', icon: '🌪️', element: 'air', mana: 15, power: 1.25,
    target: 'enemy', cooldown: 2, extraInitiative: 0.4, description: 'Une attaque rapide qui rapproche le prochain tour.'
  },

  quick_shot: {
    id: 'quick_shot', name: 'Tir rapide', icon: '➶', element: 'neutral', mana: 6, power: 0.78,
    hits: 2, target: 'enemy', cooldown: 1, description: 'Deux flèches légères tirées en succession.'
  },
  ember_arrow: {
    id: 'ember_arrow', name: 'Flèche braise', icon: '🔥', element: 'fire', mana: 13, power: 1.45,
    target: 'enemy', cooldown: 2, status: { type: 'burn', turns: 3, value: 0.12 },
    description: 'Une flèche enflammée qui laisse une brûlure durable.'
  },
  frost_arrow: {
    id: 'frost_arrow', name: 'Flèche de givre', icon: '❄️', element: 'water', mana: 14, power: 1.3,
    target: 'enemy', cooldown: 2, status: { type: 'slow', turns: 2, value: 0.22 },
    description: 'Ralentit la cible et retarde ses prochains tours.'
  },
  cyclone_volley: {
    id: 'cyclone_volley', name: 'Volée cyclone', icon: '🌪️', element: 'air', mana: 22, power: 0.72,
    hits: 2, target: 'allEnemies', cooldown: 4, description: 'Deux vagues de projectiles sur tous les ennemis.'
  },
  rooting_shot: {
    id: 'rooting_shot', name: 'Tir enracinant', icon: '🌿', element: 'earth', mana: 16, power: 1.2,
    target: 'enemy', cooldown: 3, status: { type: 'weaken', turns: 2, value: 0.22 },
    description: 'Réduit l’attaque de la cible.'
  },

  arcane_orb: {
    id: 'arcane_orb', name: 'Orbe arcanique', icon: '🔮', element: 'neutral', mana: 12, power: 1.55,
    target: 'enemy', cooldown: 1, description: 'Un projectile neutre concentré.'
  },
  fireball: {
    id: 'fireball', name: 'Boule de feu', icon: '☄️', element: 'fire', mana: 22, power: 2.05,
    target: 'enemy', cooldown: 3, splash: 0.34, status: { type: 'burn', turns: 2, value: 0.18 },
    description: 'Une explosion majeure qui éclabousse les ennemis voisins.'
  },
  healing_rain: {
    id: 'healing_rain', name: 'Pluie régénérante', icon: '🌧️', element: 'water', mana: 26, power: 0.72,
    target: 'allAllies', cooldown: 4, heal: true, description: 'Soigne l’ensemble de l’équipe.'
  },
  thunder_call: {
    id: 'thunder_call', name: 'Appel de la foudre', icon: '⚡', element: 'air', mana: 24, power: 1.42,
    target: 'allEnemies', cooldown: 4, description: 'La foudre frappe tous les adversaires.'
  },
  earth_spike: {
    id: 'earth_spike', name: 'Pointe tellurique', icon: '⛰️', element: 'earth', mana: 19, power: 1.72,
    target: 'enemy', cooldown: 3, status: { type: 'stun', turns: 1, chance: 0.28 },
    description: 'Un pic rocheux qui peut étourdir.'
  },

  pyron_bite: {
    id: 'pyron_bite', name: 'Morsure braise', icon: '🔥', element: 'fire', mana: 0, power: 1.05,
    target: 'enemy', cooldown: 0, description: 'L’attaque de base de Pyron.'
  },
  pyron_nova: {
    id: 'pyron_nova', name: 'Nova ardente', icon: '☀️', element: 'fire', mana: 18, power: 1.34,
    target: 'allEnemies', cooldown: 3, status: { type: 'burn', turns: 2, value: 0.1 },
    description: 'Une vague de chaleur frappe tous les ennemis.'
  },
  neria_splash: {
    id: 'neria_splash', name: 'Jet azur', icon: '💧', element: 'water', mana: 0, power: 1.02,
    target: 'enemy', cooldown: 0, description: 'L’attaque de base de Néria.'
  },
  neria_mend: {
    id: 'neria_mend', name: 'Source claire', icon: '💠', element: 'water', mana: 16, power: 0.78,
    target: 'ally', cooldown: 2, heal: true, description: 'Une source apaise l’allié le plus blessé.'
  },
  sylph_gust: {
    id: 'sylph_gust', name: 'Rafale', icon: '🌪️', element: 'air', mana: 0, power: 1,
    target: 'enemy', cooldown: 0, description: 'L’attaque de base de Sylph.'
  },
  sylph_haste: {
    id: 'sylph_haste', name: 'Vent porteur', icon: '🪽', element: 'air', mana: 15, power: 0,
    target: 'allAllies', cooldown: 4, status: { type: 'haste', turns: 2, value: 0.2 },
    description: 'Augmente temporairement la vitesse de l’équipe.'
  },
  grom_slam: {
    id: 'grom_slam', name: 'Heurt rocheux', icon: '🪨', element: 'earth', mana: 0, power: 1.08,
    target: 'enemy', cooldown: 0, description: 'L’attaque de base de Grom.'
  },
  grom_shell: {
    id: 'grom_shell', name: 'Carapace minérale', icon: '🛡️', element: 'earth', mana: 15, power: 0,
    target: 'ally', cooldown: 3, status: { type: 'barrier', turns: 2, value: 0.38 },
    description: 'Crée une solide barrière autour d’un allié.'
  },

  enemy_bash: { id: 'enemy_bash', name: 'Heurt', icon: '💥', element: 'neutral', mana: 0, power: 1, target: 'enemy', cooldown: 0 },
  enemy_fire: { id: 'enemy_fire', name: 'Souffle ardent', icon: '🔥', element: 'fire', mana: 0, power: 1.3, target: 'enemy', cooldown: 2 },
  enemy_water: { id: 'enemy_water', name: 'Vague', icon: '🌊', element: 'water', mana: 0, power: 1.22, target: 'allEnemies', cooldown: 3 },
  enemy_air: { id: 'enemy_air', name: 'Lame de vent', icon: '🌪️', element: 'air', mana: 0, power: 1.26, target: 'enemy', cooldown: 2 },
  enemy_earth: { id: 'enemy_earth', name: 'Éboulement', icon: '🪨', element: 'earth', mana: 0, power: 1.18, target: 'allEnemies', cooldown: 3 },
  enemy_heal: { id: 'enemy_heal', name: 'Régénération', icon: '✚', element: 'neutral', mana: 0, power: 0.52, target: 'ally', cooldown: 3, heal: true }
};

export const COMPANIONS = {
  pyron: {
    id: 'pyron', name: 'Pyron', element: 'fire', icon: '🔥', role: 'Attaquant',
    description: 'Un petit drake audacieux. Il propage des brûlures et excelle contre la Terre.',
    base: { hp: 72, mana: 34, attack: 16, defense: 8, speed: 48 },
    growth: { hp: 11, mana: 4, attack: 3.2, defense: 1.4, speed: 1.2 },
    skills: ['pyron_bite', 'pyron_nova']
  },
  neria: {
    id: 'neria', name: 'Néria', element: 'water', icon: '💧', role: 'Soutien',
    description: 'Un esprit d’eau calme qui maintient l’équipe en vie.',
    base: { hp: 82, mana: 46, attack: 12, defense: 10, speed: 43 },
    growth: { hp: 13, mana: 6, attack: 2.3, defense: 1.8, speed: 1 },
    skills: ['neria_splash', 'neria_mend']
  },
  sylph: {
    id: 'sylph', name: 'Sylph', element: 'air', icon: '🌪️', role: 'Rapide',
    description: 'Une créature vive qui accélère ses alliés et multiplie les tours.',
    base: { hp: 66, mana: 40, attack: 13, defense: 7, speed: 61 },
    growth: { hp: 9, mana: 5, attack: 2.7, defense: 1.2, speed: 1.8 },
    skills: ['sylph_gust', 'sylph_haste']
  },
  grom: {
    id: 'grom', name: 'Grom', element: 'earth', icon: '🪨', role: 'Protecteur',
    description: 'Un gardien minéral très résistant qui absorbe les coups.',
    base: { hp: 104, mana: 30, attack: 13, defense: 16, speed: 35 },
    growth: { hp: 16, mana: 3, attack: 2.5, defense: 2.8, speed: 0.8 },
    skills: ['grom_slam', 'grom_shell']
  }
};

export const ITEMS = {
  summon_scroll: {
    id: 'summon_scroll', name: 'Parchemin primordial', icon: '📜', type: 'consumable', rarity: 'epic', value: 900,
    description: 'Permet d’invoquer définitivement un compagnon Feu, Eau, Air ou Terre.', action: 'summon'
  },
  minor_potion: {
    id: 'minor_potion', name: 'Petite potion', icon: '🧪', type: 'consumable', rarity: 'common', value: 24,
    description: 'Rend 45 PV au héros.', action: 'heal', amount: 45, stack: 30
  },
  mana_tonic: {
    id: 'mana_tonic', name: 'Tonique de mana', icon: '🔷', type: 'consumable', rarity: 'common', value: 28,
    description: 'Rend 35 points de mana.', action: 'mana', amount: 35, stack: 30
  },
  greater_potion: {
    id: 'greater_potion', name: 'Potion majeure', icon: '⚗️', type: 'consumable', rarity: 'rare', value: 95,
    description: 'Rend 140 PV au héros.', action: 'heal', amount: 140, stack: 20
  },
  ember_shard: { id: 'ember_shard', name: 'Éclat de braise', icon: '🔸', type: 'material', rarity: 'uncommon', value: 18, description: 'Matériau chaud récupéré dans les terres de feu.', stack: 99 },
  tide_pearl: { id: 'tide_pearl', name: 'Perle de marée', icon: '🔹', type: 'material', rarity: 'uncommon', value: 18, description: 'Une perle chargée d’énergie aquatique.', stack: 99 },
  breeze_feather: { id: 'breeze_feather', name: 'Plume du zéphyr', icon: '🪶', type: 'material', rarity: 'uncommon', value: 18, description: 'Une plume presque sans poids.', stack: 99 },
  stone_core: { id: 'stone_core', name: 'Cœur de pierre', icon: '🟫', type: 'material', rarity: 'uncommon', value: 18, description: 'Un noyau minéral très dense.', stack: 99 },
  ancient_sigill: { id: 'ancient_sigill', name: 'Sceau ancien', icon: '🜁', type: 'material', rarity: 'epic', value: 160, description: 'Un fragment provenant des ruines neutres.', stack: 99 },

  novice_blade: { id: 'novice_blade', name: 'Lame du voyageur', icon: '🗡️', type: 'equipment', slot: 'weapon', rarity: 'common', value: 35, level: 1, stats: { attack: 5 }, description: 'Une arme simple mais équilibrée.' },
  novice_bow: { id: 'novice_bow', name: 'Arc court', icon: '🏹', type: 'equipment', slot: 'weapon', rarity: 'common', value: 38, level: 1, stats: { attack: 4, speed: 5 }, description: 'Un arc léger destiné aux voyageurs.' },
  novice_staff: { id: 'novice_staff', name: 'Bâton de frêne', icon: '🪄', type: 'equipment', slot: 'weapon', rarity: 'common', value: 40, level: 1, stats: { magic: 6, mana: 12 }, description: 'Un bâton qui canalise facilement le mana.' },
  linen_tunic: { id: 'linen_tunic', name: 'Tunique renforcée', icon: '🥋', type: 'equipment', slot: 'armor', rarity: 'common', value: 44, level: 1, stats: { hp: 18, defense: 3 }, description: 'Une tunique légère avec quelques renforts.' },
  traveler_cap: { id: 'traveler_cap', name: 'Coiffe du voyageur', icon: '🧢', type: 'equipment', slot: 'head', rarity: 'common', value: 32, level: 1, stats: { hp: 10, neutral: 2 }, description: 'Protège du soleil et des petites frappes.' },
  green_cape: { id: 'green_cape', name: 'Cape des prés', icon: '🧣', type: 'equipment', slot: 'cape', rarity: 'uncommon', value: 62, level: 2, stats: { defense: 3, air: 3 }, description: 'Une cape légère qui suit le vent.' },
  copper_ring: { id: 'copper_ring', name: 'Anneau de cuivre', icon: '💍', type: 'equipment', slot: 'ring', rarity: 'common', value: 36, level: 1, stats: { neutral: 2, attack: 2 }, description: 'Un anneau sans prétention.' },
  spring_amulet: { id: 'spring_amulet', name: 'Amulette de source', icon: '📿', type: 'equipment', slot: 'necklace', rarity: 'uncommon', value: 78, level: 3, stats: { water: 4, mana: 14 }, description: 'Une goutte d’eau reste suspendue en son centre.' },
  trail_belt: { id: 'trail_belt', name: 'Ceinture de piste', icon: '🟤', type: 'equipment', slot: 'belt', rarity: 'common', value: 40, level: 1, stats: { hp: 12, defense: 2 }, description: 'Une ceinture avec plusieurs poches utiles.' },
  swift_boots: { id: 'swift_boots', name: 'Bottes véloces', icon: '🥾', type: 'equipment', slot: 'boots', rarity: 'uncommon', value: 90, level: 1, stats: { speed: 49 }, description: 'L’équipement de départ qui donne une vitesse correcte. La vitesse provient du niveau et du stuff.' },

  ember_helm: { id: 'ember_helm', name: 'Heaume des braises', icon: '⛑️', type: 'equipment', slot: 'head', rarity: 'rare', value: 260, level: 7, stats: { defense: 7, fire: 8, hp: 25 }, description: 'Forgé dans une roche toujours chaude.' },
  tidal_cloak: { id: 'tidal_cloak', name: 'Cape des marées', icon: '🧥', type: 'equipment', slot: 'cape', rarity: 'rare', value: 270, level: 7, stats: { water: 9, mana: 28, defense: 4 }, description: 'Sa surface ondule comme une mer calme.' },
  zephyr_ring: { id: 'zephyr_ring', name: 'Anneau du zéphyr', icon: '💍', type: 'equipment', slot: 'ring', rarity: 'rare', value: 290, level: 9, stats: { air: 8, speed: 24 }, description: 'Accélère les gestes de son porteur.' },
  granite_belt: { id: 'granite_belt', name: 'Ceinture de granite', icon: '🪨', type: 'equipment', slot: 'belt', rarity: 'rare', value: 300, level: 9, stats: { earth: 9, defense: 11, hp: 42, speed: -5 }, description: 'Très résistante, mais particulièrement lourde.' },
  equilibrium_charm: { id: 'equilibrium_charm', name: 'Charme d’équilibre', icon: '☯️', type: 'equipment', slot: 'necklace', rarity: 'epic', value: 640, level: 14, stats: { fire: 4, water: 4, air: 4, earth: 4, neutral: 8 }, description: 'Un talisman consacré aux cinq voies.' },
  relic_blade: { id: 'relic_blade', name: 'Lame des ruines', icon: '⚔️', type: 'equipment', slot: 'weapon', rarity: 'epic', value: 820, level: 16, stats: { attack: 24, neutral: 11, speed: 12 }, description: 'Une arme ancienne qui réagit aux sceaux neutres.' }
};

export const ENEMIES = {
  green_slime: { id: 'green_slime', name: 'Slime verdoyant', element: 'neutral', icon: '🟢', base: { hp: 42, attack: 9, defense: 3, speed: 36 }, growth: 1.12, skills: ['enemy_bash'], xp: 22, jobXp: 12, gold: [4, 9], drops: [{ id: 'minor_potion', chance: 0.12 }] },
  moss_boar: { id: 'moss_boar', name: 'Sanglier moussu', element: 'earth', icon: '🐗', base: { hp: 78, attack: 14, defense: 7, speed: 31 }, growth: 1.13, skills: ['enemy_bash', 'enemy_earth'], xp: 34, jobXp: 18, gold: [7, 14], drops: [{ id: 'stone_core', chance: 0.26 }] },
  ember_imp: { id: 'ember_imp', name: 'Diablotin de braise', element: 'fire', icon: '👹', base: { hp: 72, attack: 18, defense: 5, speed: 55 }, growth: 1.14, skills: ['enemy_bash', 'enemy_fire'], xp: 46, jobXp: 24, gold: [10, 19], drops: [{ id: 'ember_shard', chance: 0.38 }, { id: 'ember_helm', chance: 0.025 }] },
  cinder_golem: { id: 'cinder_golem', name: 'Golem de cendre', element: 'earth', icon: '🗿', base: { hp: 138, attack: 22, defense: 17, speed: 24 }, growth: 1.15, skills: ['enemy_earth', 'enemy_bash'], xp: 72, jobXp: 36, gold: [16, 31], drops: [{ id: 'ember_shard', chance: 0.55 }, { id: 'stone_core', chance: 0.3 }] },
  tide_wisp: { id: 'tide_wisp', name: 'Feu follet marin', element: 'water', icon: '🪼', base: { hp: 68, attack: 16, defense: 6, speed: 52 }, growth: 1.14, skills: ['enemy_water', 'enemy_heal'], xp: 44, jobXp: 23, gold: [9, 18], drops: [{ id: 'tide_pearl', chance: 0.38 }, { id: 'tidal_cloak', chance: 0.025 }] },
  reef_guardian: { id: 'reef_guardian', name: 'Gardien du récif', element: 'water', icon: '🦀', base: { hp: 150, attack: 21, defense: 15, speed: 29 }, growth: 1.15, skills: ['enemy_bash', 'enemy_water'], xp: 76, jobXp: 38, gold: [18, 34], drops: [{ id: 'tide_pearl', chance: 0.58 }] },
  wind_raptor: { id: 'wind_raptor', name: 'Raptor des vents', element: 'air', icon: '🦅', base: { hp: 74, attack: 19, defense: 5, speed: 76 }, growth: 1.14, skills: ['enemy_air', 'enemy_bash'], xp: 49, jobXp: 25, gold: [10, 20], drops: [{ id: 'breeze_feather', chance: 0.4 }, { id: 'zephyr_ring', chance: 0.02 }] },
  storm_harpy: { id: 'storm_harpy', name: 'Harpie d’orage', element: 'air', icon: '🧝', base: { hp: 126, attack: 25, defense: 9, speed: 83 }, growth: 1.15, skills: ['enemy_air', 'enemy_heal'], xp: 82, jobXp: 41, gold: [19, 36], drops: [{ id: 'breeze_feather', chance: 0.58 }] },
  stonebeast: { id: 'stonebeast', name: 'Bête de pierre', element: 'earth', icon: '🦬', base: { hp: 162, attack: 23, defense: 21, speed: 26 }, growth: 1.15, skills: ['enemy_bash', 'enemy_earth'], xp: 80, jobXp: 40, gold: [18, 35], drops: [{ id: 'stone_core', chance: 0.56 }, { id: 'granite_belt', chance: 0.02 }] },
  crystal_turtle: { id: 'crystal_turtle', name: 'Tortue de cristal', element: 'earth', icon: '🐢', base: { hp: 208, attack: 20, defense: 27, speed: 18 }, growth: 1.16, skills: ['enemy_earth', 'enemy_heal'], xp: 98, jobXp: 48, gold: [23, 44], drops: [{ id: 'stone_core', chance: 0.68 }] },
  neutral_sentinel: { id: 'neutral_sentinel', name: 'Sentinelle antique', element: 'neutral', icon: '🤖', base: { hp: 195, attack: 31, defense: 19, speed: 58 }, growth: 1.17, skills: ['enemy_bash', 'enemy_air', 'enemy_earth'], xp: 122, jobXp: 58, gold: [31, 62], drops: [{ id: 'ancient_sigill', chance: 0.5 }, { id: 'relic_blade', chance: 0.015 }] },
  ruin_keeper: { id: 'ruin_keeper', name: 'Gardien de l’Équilibre', element: 'neutral', icon: '👁️', boss: true, base: { hp: 520, attack: 42, defense: 24, speed: 68 }, growth: 1.18, skills: ['enemy_fire', 'enemy_water', 'enemy_air', 'enemy_earth', 'enemy_heal'], xp: 420, jobXp: 190, gold: [130, 210], drops: [{ id: 'ancient_sigill', chance: 1 }, { id: 'equilibrium_charm', chance: 0.25 }, { id: 'summon_scroll', chance: 0.08 }] }
};

export const ENCOUNTERS = {
  meadow_1: { id: 'meadow_1', name: 'Créatures des prés', danger: 1, enemies: [{ id: 'green_slime', level: 1 }, { id: 'green_slime', level: 1 }] },
  meadow_2: { id: 'meadow_2', name: 'Sangliers du vieux sentier', danger: 3, enemies: [{ id: 'moss_boar', level: 3 }, { id: 'green_slime', level: 2 }] },
  ember_1: { id: 'ember_1', name: 'Patrouille des braises', danger: 7, enemies: [{ id: 'ember_imp', level: 7 }, { id: 'ember_imp', level: 8 }] },
  ember_2: { id: 'ember_2', name: 'Cœur de la caldeira', danger: 12, enemies: [{ id: 'cinder_golem', level: 12 }, { id: 'ember_imp', level: 11 }] },
  tide_1: { id: 'tide_1', name: 'Esprits de la côte', danger: 6, enemies: [{ id: 'tide_wisp', level: 6 }, { id: 'tide_wisp', level: 6 }] },
  tide_2: { id: 'tide_2', name: 'Récif vivant', danger: 13, enemies: [{ id: 'reef_guardian', level: 13 }, { id: 'tide_wisp', level: 12 }] },
  air_1: { id: 'air_1', name: 'Chasseurs du zéphyr', danger: 9, enemies: [{ id: 'wind_raptor', level: 9 }, { id: 'wind_raptor', level: 10 }] },
  air_2: { id: 'air_2', name: 'Nid de l’orage', danger: 15, enemies: [{ id: 'storm_harpy', level: 15 }, { id: 'wind_raptor', level: 14 }] },
  earth_1: { id: 'earth_1', name: 'Colosses sauvages', danger: 8, enemies: [{ id: 'stonebeast', level: 8 }] },
  earth_2: { id: 'earth_2', name: 'Grotte cristalline', danger: 16, enemies: [{ id: 'crystal_turtle', level: 16 }, { id: 'stonebeast', level: 15 }] },
  ruins_1: { id: 'ruins_1', name: 'Veilleurs des ruines', danger: 18, enemies: [{ id: 'neutral_sentinel', level: 18 }, { id: 'neutral_sentinel', level: 19 }] },
  ruins_boss: { id: 'ruins_boss', name: 'Sanctuaire de l’Équilibre', danger: 24, boss: true, enemies: [{ id: 'ruin_keeper', level: 24 }] }
};

export const ZONES = [
  { id: 'town', name: 'Clairval', subtitle: 'Ville de départ', element: 'neutral', x: 260, y: 720, w: 900, h: 820, color: '#6fbb72', level: 'Paisible' },
  { id: 'meadow', name: 'Prés de l’Aube', subtitle: 'Prairies accueillantes', element: 'neutral', x: 960, y: 610, w: 1050, h: 930, color: '#78bd68', level: 'Niveau conseillé 1–5' },
  { id: 'earthlands', name: 'Marches de Granite', subtitle: 'Falaises et cavernes', element: 'earth', x: 0, y: 0, w: 1120, h: 780, color: '#9c865d', level: 'Niveau conseillé 8–17' },
  { id: 'airlands', name: 'Hauts du Zéphyr', subtitle: 'Plateaux suspendus', element: 'air', x: 1080, y: 0, w: 1180, h: 650, color: '#77b7a7', level: 'Niveau conseillé 9–16' },
  { id: 'firelands', name: 'Étendues de Cendre', subtitle: 'Caldeiras ardentes', element: 'fire', x: 2040, y: 560, w: 1160, h: 940, color: '#9b5546', level: 'Niveau conseillé 7–14' },
  { id: 'waterlands', name: 'Côte d’Azurine', subtitle: 'Rivages enchantés', element: 'water', x: 980, y: 1460, w: 1280, h: 740, color: '#4d91a7', level: 'Niveau conseillé 6–14' },
  { id: 'ruins', name: 'Ruines de l’Équilibre', subtitle: 'Territoire neutre oublié', element: 'neutral', x: 2220, y: 0, w: 980, h: 620, color: '#666477', level: 'Niveau conseillé 18–25' }
];

export const WORLD_NPCS = [
  { id: 'lyra', name: 'Lyra', title: 'Guide de Clairval', kind: 'guide', x: 650, y: 1030, icon: '🧭', dialogue: 'Bienvenue à Clairval. Le monde est ouvert : aucune route ne t’est interdite, mais observe le niveau conseillé avant de t’éloigner.' },
  { id: 'meron', name: 'Méron', title: 'Marchand', kind: 'shop', x: 440, y: 960, icon: '🛒', dialogue: 'J’achète presque tout, et je vends ce qui peut garder un aventurier en vie.' },
  { id: 'orlan', name: 'Orlan', title: 'Maître des voies', kind: 'class', x: 830, y: 900, icon: '⚜️', dialogue: 'À la maîtrise 20, ton expérience de métier se figera. Reviens me voir pour choisir ta véritable voie.' },
  { id: 'selene', name: 'Sélène', title: 'Invocatrice', kind: 'summon', x: 745, y: 1210, icon: '📜', dialogue: 'Les pactes élémentaires naissent d’un parchemin primordial. Choisis avec soin le premier esprit qui marchera à tes côtés.' },
  { id: 'brann', name: 'Brann', title: 'Forgeron', kind: 'forge', x: 355, y: 1190, icon: '🔨', dialogue: 'Je n’ai pas encore ouvert la forge avancée, mais mon étal contient de l’équipement solide.' },
  { id: 'elia', name: 'Élia', title: 'Guérisseuse', kind: 'heal', x: 900, y: 1130, icon: '✨', dialogue: 'Un instant de repos, et toute ton équipe retrouvera ses forces.' }
];

export const WORLD_ENCOUNTER_NODES = [
  { id: 'm1', encounter: 'meadow_1', x: 1280, y: 930, respawn: 18 },
  { id: 'm2', encounter: 'meadow_1', x: 1590, y: 1210, respawn: 18 },
  { id: 'm3', encounter: 'meadow_2', x: 1810, y: 790, respawn: 25 },
  { id: 'e1', encounter: 'ember_1', x: 2370, y: 910, respawn: 32 },
  { id: 'e2', encounter: 'ember_1', x: 2760, y: 1220, respawn: 32 },
  { id: 'e3', encounter: 'ember_2', x: 2920, y: 790, respawn: 45 },
  { id: 'w1', encounter: 'tide_1', x: 1330, y: 1760, respawn: 30 },
  { id: 'w2', encounter: 'tide_1', x: 1770, y: 1930, respawn: 30 },
  { id: 'w3', encounter: 'tide_2', x: 2110, y: 1710, respawn: 42 },
  { id: 'a1', encounter: 'air_1', x: 1390, y: 340, respawn: 34 },
  { id: 'a2', encounter: 'air_1', x: 1940, y: 210, respawn: 34 },
  { id: 'a3', encounter: 'air_2', x: 1770, y: 510, respawn: 46 },
  { id: 't1', encounter: 'earth_1', x: 650, y: 370, respawn: 34 },
  { id: 't2', encounter: 'earth_2', x: 250, y: 190, respawn: 48 },
  { id: 'r1', encounter: 'ruins_1', x: 2480, y: 330, respawn: 55 },
  { id: 'r2', encounter: 'ruins_1', x: 2840, y: 190, respawn: 55 },
  { id: 'rb', encounter: 'ruins_boss', x: 3030, y: 430, respawn: 180 }
];

export const SHOP_STOCK = [
  'minor_potion', 'mana_tonic', 'greater_potion', 'novice_blade', 'novice_bow', 'novice_staff',
  'linen_tunic', 'traveler_cap', 'green_cape', 'copper_ring', 'spring_amulet', 'trail_belt', 'swift_boots'
];

export const QUESTS = {
  awakening: {
    id: 'awakening', name: 'Le premier pacte', giver: 'Sélène', description: 'Utilise le parchemin primordial et invoque ton premier compagnon.',
    objectives: [{ type: 'companionCount', amount: 1, label: 'Compagnon invoqué' }], rewards: { gold: 80, xp: 45, items: [{ id: 'minor_potion', qty: 3 }] }
  },
  slime_problem: {
    id: 'slime_problem', name: 'Les prés s’agitent', giver: 'Lyra', description: 'Élimine trois Slimes verdoyants dans les Prés de l’Aube.',
    objectives: [{ type: 'kill', target: 'green_slime', amount: 3, label: 'Slimes vaincus' }], rewards: { gold: 110, xp: 90, jobXp: 45, items: [{ id: 'green_cape', qty: 1 }] }
  },
  horizons: {
    id: 'horizons', name: 'Un monde sans barrières', giver: 'Lyra', description: 'Découvre trois biomes en dehors de Clairval. Tu peux aller partout dès le début, à tes risques et périls.',
    objectives: [{ type: 'discover', amount: 3, label: 'Biomes découverts' }], rewards: { gold: 160, xp: 130, items: [{ id: 'mana_tonic', qty: 4 }] }
  },
  mastery: {
    id: 'mastery', name: 'La voie véritable', giver: 'Orlan', description: 'Atteins le niveau de métier 20 puis choisis Épéiste, Archer ou Mage.',
    objectives: [{ type: 'profession', target: ['swordsman', 'archer', 'mage'], amount: 1, label: 'Évolution accomplie' }], rewards: { gold: 500, xp: 400, items: [{ id: 'equilibrium_charm', qty: 1 }] }
  }
};

export const SLOT_LABELS = {
  weapon: 'Arme', armor: 'Armure', head: 'Coiffe', cape: 'Cape', necklace: 'Amulette',
  ring1: 'Anneau I', ring2: 'Anneau II', belt: 'Ceinture', boots: 'Bottes'
};

export const RARITIES = {
  common: { name: 'Commun', color: '#cbd2d2' },
  uncommon: { name: 'Inhabituel', color: '#70d98c' },
  rare: { name: 'Rare', color: '#68aaff' },
  epic: { name: 'Épique', color: '#c882ff' },
  legendary: { name: 'Légendaire', color: '#ffc35b' }
};

export function xpForLevel(level) {
  return Math.floor(55 + Math.pow(level, 1.55) * 34);
}

export function jobXpForLevel(level) {
  return Math.floor(45 + Math.pow(level, 1.48) * 29);
}
