import { StateStore } from './core.js';
import { SKILLS } from './data.js';
import { AudioEngine } from './audio.js';
import { WorldController } from './world.js';
import { CombatController } from './combat.js';
import { UIController } from './ui.js';

// ui.js affiche les icônes de compétences dans le choix de classe.
// Cette exposition évite de dupliquer la table de données dans l’interface.
globalThis.SKILLS = SKILLS;

const store = new StateStore();
if (store.hasSave()) store.load();
const audio = new AudioEngine(store);
const ui = new UIController({ store, audio });
let world = null;
let combat = null;
let currentNode = null;
let playTimer = null;

// Sécurité de fin de combat : vérifie les équipes avant chaque nouveau tour,
// y compris lorsqu’une brûlure élimine le dernier combattant au début de son tour.
const baseAdvance = CombatController.prototype.advance;
CombatController.prototype.advance = function patchedAdvance() {
  if (this.running && this.actors.length) {
    const allies = this.actors.some(actor => actor.side === 'ally' && actor.alive);
    const enemies = this.actors.some(actor => actor.side === 'enemy' && actor.alive);
    if (!allies || !enemies) {
      this.finishCombat(allies && !enemies);
      return;
    }
  }
  return baseAdvance.call(this);
};

function createControllers() {
  world?.stop();
  combat?.stop();
  world = new WorldController({
    canvas: document.getElementById('world-canvas'),
    store,
    joystick: document.getElementById('joystick'),
    interactButton: document.getElementById('world-interact'),
    onNpc: npc => ui.openNpc(npc),
    onEncounter: (encounter, node) => {
      audio.play('open');
      ui.openTeamPreparation(encounter, node, team => beginBattle(encounter, node, team));
    },
    onProximity: target => ui.setProximity(target),
    onZone: (zone, isNew) => ui.setZone(zone, isNew),
    onToast: message => ui.toast(message, 'info', '✦')
  });

  combat = new CombatController({
    root: document.getElementById('combat-screen'),
    store,
    onResult: result => finishBattle(result),
    onExit: () => returnToWorld(),
    onSound: name => audio.play(name),
    onToast: message => ui.toast(message, 'warning', '!')
  });

  ui.attach({
    world,
    combat,
    callbacks: {
      onTitle: showTitle,
      onReload: () => enterWorld(true)
    }
  });
}

function enterWorld(recreate = false) {
  if (!store.state) return showTitle();
  if (!world || recreate) createControllers();
  ui.closeAllModals();
  ui.showScreen('world');
  ui.renderHud();
  const zone = world.lastZone ? (awaitZone(world.lastZone)) : null;
  if (zone) ui.setZone(zone, false);
  world.setEnabled(true);
  world.start();
  audio.setMode('world');
  document.body.classList.toggle('reduce-motion', Boolean(store.state.settings.reducedMotion));
  store.startAutosave();
  startPlayTimer();
  setTimeout(() => ui.showIntro(), 520);
}

function awaitZone(id) {
  // Évite une dépendance circulaire supplémentaire : les données sont déjà
  // disponibles par l’état du contrôleur de monde.
  return world ? world.getMapData().zones.find(zone => zone.id === id) : null;
}

function beginBattle(encounter, node, team) {
  currentNode = node;
  store.save(true);
  world.setEnabled(false);
  ui.showScreen('combat');
  audio.setMode('battle');
  combat.start(encounter, node, team);
}

function finishBattle(result) {
  if (result.victory && result.node) world.markNodeDefeated(result.node.id);
  store.save(true);
  ui.showCombatResult(result, () => returnToWorld());
}

function returnToWorld() {
  currentNode = null;
  ui.showScreen('world');
  world.setEnabled(true);
  world.start();
  ui.renderHud();
  audio.setMode('world');
  store.save(true);
}

function startPlayTimer() {
  clearInterval(playTimer);
  playTimer = setInterval(() => {
    if (store.state && document.visibilityState === 'visible' && document.body.dataset.screen === 'world') {
      store.state.player.playTime = (store.state.player.playTime || 0) + 1;
      store.dirty = true;
    }
  }, 1000);
}

function showTitle() {
  world?.setEnabled(false);
  combat?.stop();
  audio.stopMusic();
  store.save(true);
  if (store.hasSave() && !store.state) store.load();
  ui.showScreen('title');
  ui.renderTitle();
  clearInterval(playTimer);
}

function openNewGame() {
  const modal = ui.openModal({
    title: 'Créer ton aventurier',
    subtitle: 'Une nouvelle histoire commence',
    className: 'create-modal',
    content: `
      <form class="creation-form" autocomplete="off">
        <div class="creation-avatar">🗡️</div>
        <label><span>Nom du personnage</span><input id="creation-name" maxlength="16" minlength="2" placeholder="Aventurier" value="Aventurier" required></label>
        <div class="creation-notes"><p><b>Classe de départ :</b> Aventurier</p><p><b>Évolution :</b> Épéiste, Archer ou Mage au métier 20</p><p><b>Compagnon :</b> choisi ensuite grâce au parchemin primordial</p></div>
      </form>`,
    actions: '<button class="button ghost" data-cancel>Annuler</button><button class="button primary glow" data-create>Créer</button>',
    onOpen: node => {
      const input = node.querySelector('#creation-name');
      setTimeout(() => { input.focus(); input.select(); }, 250);
      node.querySelector('[data-cancel]').addEventListener('click', () => ui.closeModal(modal));
      const create = () => {
        const name = input.value.trim();
        if (name.length < 2) { ui.toast('Le nom doit contenir au moins deux caractères.', 'warning', '!'); return; }
        store.newGame(name);
        audio.ensure();
        ui.closeModal(modal, true);
        createControllers();
        enterWorld();
      };
      node.querySelector('[data-create]').addEventListener('click', create);
      node.querySelector('form').addEventListener('submit', event => { event.preventDefault(); create(); });
    }
  });
}

function continueGame() {
  if (!store.load()) { ui.toast('La sauvegarde est introuvable.', 'warning', '!'); return; }
  audio.ensure();
  createControllers();
  enterWorld();
}

document.getElementById('title-new').addEventListener('click', openNewGame);
document.getElementById('title-continue').addEventListener('click', continueGame);
document.getElementById('title-reset')?.addEventListener('click', () => {
  if (!store.hasSave()) return;
  const modal = ui.openModal({
    title: 'Effacer la sauvegarde ?', subtitle: 'Action irréversible', className: 'small-modal',
    content: '<div class="danger-confirm"><span>⚠️</span><p>Le personnage, les compagnons, l’inventaire et toute la progression seront supprimés.</p></div>',
    actions: '<button class="button ghost" data-cancel>Annuler</button><button class="button danger" data-confirm>Tout effacer</button>',
    onOpen: node => {
      node.querySelector('[data-cancel]').addEventListener('click', () => ui.closeModal(modal));
      node.querySelector('[data-confirm]').addEventListener('click', () => { store.reset(); ui.closeModal(modal); ui.renderTitle(); ui.toast('Sauvegarde supprimée.', 'info', '🗑️'); });
    }
  });
});

document.addEventListener('pointerdown', () => audio.ensure(), { once: true });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') store.save(true); });
window.addEventListener('beforeunload', () => store.save(true));
window.addEventListener('error', event => console.error('Andémia runtime error:', event.error || event.message));

// Installation PWA : le bouton apparaît seulement lorsque le navigateur le permet.
let installPrompt = null;
const installButton = document.getElementById('install-game');
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  installButton?.classList.add('visible');
});
installButton?.addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  installButton.classList.remove('visible');
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw-v2.js').catch(error => console.warn('Service worker:', error)));
}

showTitle();
