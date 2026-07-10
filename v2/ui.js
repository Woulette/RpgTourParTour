import {
  ELEMENTS, ELEMENT_IDS, PROFESSIONS, COMPANIONS, ITEMS, ENEMIES, QUESTS, SHOP_STOCK,
  SLOT_LABELS, RARITIES, xpForLevel, jobXpForLevel, ZONES
} from './data.js';
import { clamp, formatNumber, describeStats } from './core.js';

const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

function percent(value, max) { return max > 0 ? clamp(value / max * 100, 0, 100) : 0; }
function rarityClass(item) { return `rarity-${item?.rarity || 'common'}`; }
function statText(stats = {}) {
  const labels = { hp: 'PV', mana: 'Mana', attack: 'Attaque', magic: 'Magie', defense: 'Défense', speed: 'Vitesse', fire: 'Feu', water: 'Eau', air: 'Air', earth: 'Terre', neutral: 'Neutre' };
  return Object.entries(stats).map(([key, value]) => `<span>${labels[key] || key} <b>${value > 0 ? '+' : ''}${value}</b></span>`).join('');
}

export class UIController {
  constructor({ store, audio }) {
    this.store = store;
    this.audio = audio;
    this.world = null;
    this.combat = null;
    this.callbacks = {};
    this.currentZone = ZONES.find(z => z.id === store.state?.world?.lastZone) || ZONES[0];
    this.modalStack = [];
    this.toastTimers = [];
    this.selectedInventoryItem = null;
    this.shopMode = 'buy';
    this.inventoryFilter = 'all';
    this.cacheElements();
    this.bindGlobalUi();
    this.store.bus.on('change', () => this.renderHud());
    this.store.bus.on('saved', () => this.showSavePulse());
  }

  cacheElements() {
    this.titleScreen = document.getElementById('title-screen');
    this.worldScreen = document.getElementById('world-screen');
    this.combatScreen = document.getElementById('combat-screen');
    this.modalLayer = document.getElementById('modal-layer');
    this.toastLayer = document.getElementById('toast-layer');
    this.hudName = document.getElementById('hud-name');
    this.hudLevel = document.getElementById('hud-level');
    this.hudJob = document.getElementById('hud-job');
    this.hudHp = document.getElementById('hud-hp');
    this.hudMana = document.getElementById('hud-mana');
    this.hudXp = document.getElementById('hud-xp');
    this.hudGold = document.getElementById('hud-gold');
    this.zoneName = document.getElementById('zone-name');
    this.zoneSubtitle = document.getElementById('zone-subtitle');
    this.interactButton = document.getElementById('world-interact');
    this.saveIndicator = document.getElementById('save-indicator');
  }

  bindGlobalUi() {
    document.querySelectorAll('[data-panel]').forEach(button => {
      button.addEventListener('click', () => {
        const panel = button.dataset.panel;
        if (panel === 'inventory') this.openInventory();
        if (panel === 'character') this.openCharacter();
        if (panel === 'companions') this.openCompanions();
        if (panel === 'quests') this.openQuests();
        if (panel === 'map') this.openMap();
        if (panel === 'settings') this.openSettings();
      });
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && this.modalStack.length) this.closeModal();
      if (event.code === 'KeyI' && this.worldScreen.classList.contains('active')) this.openInventory();
      if (event.code === 'KeyC' && this.worldScreen.classList.contains('active')) this.openCharacter();
      if (event.code === 'KeyM' && this.worldScreen.classList.contains('active')) this.openMap();
    });
  }

  attach({ world, combat, callbacks }) {
    this.world = world;
    this.combat = combat;
    this.callbacks = callbacks || {};
  }

  showScreen(name) {
    this.titleScreen.classList.toggle('active', name === 'title');
    this.worldScreen.classList.toggle('active', name === 'world');
    this.combatScreen.classList.toggle('active', name === 'combat');
    document.body.dataset.screen = name;
    if (name !== 'world') this.interactButton?.classList.remove('visible');
  }

  renderTitle() {
    const continueButton = document.getElementById('title-continue');
    if (continueButton) continueButton.disabled = !this.store.hasSave();
    const meta = document.getElementById('title-save-meta');
    if (meta) {
      if (this.store.hasSave() && this.store.state) {
        const p = this.store.state.player;
        meta.innerHTML = `<strong>${esc(this.store.state.profile.name)}</strong><span>Nv.${p.level} · ${PROFESSIONS[p.profession].name} ${p.jobLevel}</span>`;
      } else meta.innerHTML = '<span>Aucune aventure sauvegardée</span>';
    }
  }

  renderHud() {
    if (!this.store.state) return;
    const p = this.store.state.player;
    const stats = this.store.getPlayerStats();
    if (this.hudName) this.hudName.textContent = this.store.state.profile.name;
    if (this.hudLevel) this.hudLevel.textContent = `Nv.${p.level}`;
    if (this.hudJob) this.hudJob.textContent = `${PROFESSIONS[p.profession].icon} ${PROFESSIONS[p.profession].name} ${p.jobLevel}${p.jobLocked ? ' · BLOQUÉ' : ''}`;
    if (this.hudHp) {
      this.hudHp.style.setProperty('--value', `${percent(p.hp, stats.maxHp)}%`);
      this.hudHp.querySelector('span').textContent = `${Math.ceil(p.hp)} / ${stats.maxHp}`;
    }
    if (this.hudMana) {
      this.hudMana.style.setProperty('--value', `${percent(p.mana, stats.maxMana)}%`);
      this.hudMana.querySelector('span').textContent = `${Math.ceil(p.mana)} / ${stats.maxMana}`;
    }
    if (this.hudXp) {
      this.hudXp.style.setProperty('--value', `${percent(p.xp, xpForLevel(p.level))}%`);
      this.hudXp.title = `${p.xp} / ${xpForLevel(p.level)} XP`;
    }
    if (this.hudGold) this.hudGold.textContent = formatNumber(p.gold);
  }

  setZone(zone, isNew = false) {
    this.currentZone = zone;
    if (this.zoneName) this.zoneName.textContent = zone.name;
    if (this.zoneSubtitle) this.zoneSubtitle.textContent = zone.level;
    const banner = document.getElementById('zone-banner');
    if (banner) {
      banner.classList.remove('show');
      void banner.offsetWidth;
      banner.querySelector('strong').textContent = zone.name;
      banner.querySelector('span').textContent = `${zone.subtitle} · ${zone.level}`;
      banner.classList.add('show');
      setTimeout(() => banner.classList.remove('show'), 3000);
    }
    if (isNew) {
      this.toast(`Nouvelle région découverte : ${zone.name}`, 'discover', '🗺️');
      this.audio.play('open');
    }
  }

  setProximity(target) {
    if (!this.interactButton) return;
    if (!target) {
      this.interactButton.classList.remove('visible');
      return;
    }
    this.interactButton.classList.add('visible');
    const label = this.interactButton.querySelector('span');
    const icon = this.interactButton.querySelector('b');
    if (target.type === 'npc') {
      label.textContent = target.data.name;
      icon.textContent = target.data.icon;
    } else {
      label.textContent = 'Combattre';
      icon.textContent = '⚔️';
    }
  }

  toast(message, type = 'info', icon = '✦', duration = 2800) {
    const element = document.createElement('div');
    element.className = `toast toast-${type}`;
    element.innerHTML = `<b>${icon}</b><span>${esc(message)}</span>`;
    this.toastLayer.appendChild(element);
    requestAnimationFrame(() => element.classList.add('show'));
    const timer = setTimeout(() => {
      element.classList.remove('show');
      setTimeout(() => element.remove(), 350);
    }, duration);
    this.toastTimers.push(timer);
  }

  showSavePulse() {
    if (!this.saveIndicator) return;
    this.saveIndicator.classList.add('show');
    setTimeout(() => this.saveIndicator.classList.remove('show'), 1200);
  }

  openModal({ title = '', subtitle = '', content = '', actions = '', className = '', closable = true, onOpen = null }) {
    this.audio.play('open');
    const modal = document.createElement('section');
    modal.className = `modal-shell ${className}`;
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-card" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <header class="modal-header">
          <div><small>${esc(subtitle)}</small><h2>${esc(title)}</h2></div>
          ${closable ? '<button class="modal-close" type="button" aria-label="Fermer">×</button>' : ''}
        </header>
        <div class="modal-content">${content}</div>
        ${actions ? `<footer class="modal-actions">${actions}</footer>` : ''}
      </div>
    `;
    this.modalLayer.appendChild(modal);
    this.modalStack.push(modal);
    this.modalLayer.classList.add('active');
    this.world?.setEnabled(false);
    modal.querySelector('.modal-close')?.addEventListener('click', () => this.closeModal(modal));
    modal.querySelector('.modal-backdrop')?.addEventListener('click', () => { if (closable) this.closeModal(modal); });
    requestAnimationFrame(() => modal.classList.add('show'));
    onOpen?.(modal);
    return modal;
  }

  closeModal(modal = this.modalStack[this.modalStack.length - 1], silent = false) {
    if (!modal) return;
    if (!silent) this.audio.play('close');
    const index = this.modalStack.indexOf(modal);
    if (index >= 0) this.modalStack.splice(index, 1);
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 280);
    if (!this.modalStack.length) {
      this.modalLayer.classList.remove('active');
      if (this.worldScreen.classList.contains('active')) this.world?.setEnabled(true);
    }
  }

  closeAllModals() {
    [...this.modalStack].forEach(modal => this.closeModal(modal, true));
    this.modalStack = [];
    this.modalLayer.classList.remove('active');
  }

  showIntro() {
    if (this.store.state.flags.introSeen) return;
    const content = `
      <div class="story-panel">
        <div class="story-crest">✦</div>
        <p>Tu arrives à <strong>Clairval</strong>, une ville paisible bâtie au croisement de cinq énergies.</p>
        <p>Le monde d’Andémia ne ferme aucune route. Les terres dangereuses sont accessibles dès maintenant, mais leurs habitants ne retiendront pas leurs coups.</p>
        <p>Sélène t’a confié un <strong>Parchemin primordial</strong>. Ouvre ton inventaire et invoque le premier compagnon de ton équipe.</p>
      </div>`;
    const modal = this.openModal({
      title: 'Bienvenue en Andémia', subtitle: 'Chapitre I · L’éveil', content,
      actions: '<button class="button primary" data-continue>Commencer l’aventure</button>', closable: false, className: 'story-modal',
      onOpen: node => node.querySelector('[data-continue]').addEventListener('click', () => {
        this.store.state.flags.introSeen = true;
        this.store.touch('intro');
        this.closeModal(modal);
        setTimeout(() => this.openInventory('summon_scroll'), 380);
      })
    });
  }

  openNpc(npc) {
    const actionButtons = [];
    if (npc.kind === 'shop' || npc.kind === 'forge') actionButtons.push('<button class="button primary" data-npc-action="shop">Voir la boutique</button>');
    if (npc.kind === 'class') actionButtons.push('<button class="button primary" data-npc-action="class">Parler des évolutions</button>');
    if (npc.kind === 'summon') actionButtons.push('<button class="button primary" data-npc-action="summon">Gérer les invocations</button>');
    if (npc.kind === 'heal') actionButtons.push('<button class="button primary" data-npc-action="heal">Reposer l’équipe</button>');
    if (npc.kind === 'guide') actionButtons.push('<button class="button primary" data-npc-action="quests">Voir les quêtes</button>');
    const modal = this.openModal({
      title: npc.name, subtitle: npc.title,
      content: `<div class="npc-dialog"><div class="npc-portrait">${npc.icon}</div><p>« ${esc(npc.dialogue)} »</p></div>`,
      actions: `${actionButtons.join('')}<button class="button ghost" data-close>Au revoir</button>`, className: 'dialog-modal',
      onOpen: node => {
        node.querySelector('[data-close]').addEventListener('click', () => this.closeModal(modal));
        node.querySelector('[data-npc-action="shop"]')?.addEventListener('click', () => { this.closeModal(modal, true); this.openShop(npc.kind === 'forge'); });
        node.querySelector('[data-npc-action="class"]')?.addEventListener('click', () => { this.closeModal(modal, true); this.openClassEvolution(); });
        node.querySelector('[data-npc-action="summon"]')?.addEventListener('click', () => { this.closeModal(modal, true); this.openCompanions(); });
        node.querySelector('[data-npc-action="heal"]')?.addEventListener('click', () => {
          this.store.healParty(); this.audio.play('heal'); this.toast('Toute l’équipe a récupéré ses PV et son mana.', 'success', '✨'); this.closeModal(modal);
        });
        node.querySelector('[data-npc-action="quests"]')?.addEventListener('click', () => { this.closeModal(modal, true); this.openQuests(); });
      }
    });
  }

  openInventory(focusItem = null) {
    this.selectedInventoryItem = focusItem || this.selectedInventoryItem || this.store.state.inventory[0]?.id || null;
    const render = modal => {
      const entries = this.store.state.inventory.filter(entry => {
        const item = ITEMS[entry.id];
        return this.inventoryFilter === 'all' || item.type === this.inventoryFilter;
      });
      const selected = ITEMS[this.selectedInventoryItem];
      modal.querySelector('.modal-content').innerHTML = `
        <div class="inventory-layout">
          <aside class="inventory-filters">
            ${[['all','Tout','✦'],['equipment','Équipement','🛡️'],['consumable','Objets','🧪'],['material','Matériaux','🧱']].map(([id,label,icon]) => `<button class="filter-button ${this.inventoryFilter === id ? 'active' : ''}" data-filter="${id}"><b>${icon}</b><span>${label}</span></button>`).join('')}
          </aside>
          <section class="inventory-grid-wrap">
            <div class="inventory-grid">
              ${entries.length ? entries.map(entry => {
                const item = ITEMS[entry.id];
                return `<button class="item-cell ${rarityClass(item)} ${this.selectedInventoryItem === item.id ? 'selected' : ''}" data-item="${item.id}" title="${esc(item.name)}"><span>${item.icon}</span><small>${entry.qty > 1 ? `×${entry.qty}` : ''}</small></button>`;
              }).join('') : '<div class="empty-state"><b>🎒</b><span>Aucun objet dans cette catégorie</span></div>'}
            </div>
          </section>
          <aside class="item-details">
            ${selected ? this.itemDetailsHtml(selected) : '<div class="empty-state"><b>✦</b><span>Sélectionne un objet</span></div>'}
          </aside>
        </div>`;
      modal.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { this.inventoryFilter = button.dataset.filter; render(modal); }));
      modal.querySelectorAll('[data-item]').forEach(button => button.addEventListener('click', () => { this.selectedInventoryItem = button.dataset.item; render(modal); }));
      modal.querySelector('[data-use-item]')?.addEventListener('click', () => {
        const item = ITEMS[this.selectedInventoryItem];
        if (item.action === 'summon') { this.closeModal(modal, true); this.openSummon(); return; }
        const result = this.store.useItem(item.id);
        this.toast(result.message, result.ok ? 'success' : 'warning', result.ok ? item.icon : '!');
        if (result.ok) this.audio.play(item.action === 'heal' ? 'heal' : 'water');
        render(modal);
      });
      modal.querySelector('[data-equip-item]')?.addEventListener('click', () => {
        const result = this.store.equip(this.selectedInventoryItem);
        this.toast(result.message, result.ok ? 'success' : 'warning', result.ok ? '🛡️' : '!');
        if (result.ok) this.audio.play('open');
        render(modal);
      });
    };
    this.openModal({ title: 'Inventaire', subtitle: `${this.store.state.inventory.reduce((sum,e)=>sum+e.qty,0)} objets`, className: 'wide-modal inventory-modal', content: '', onOpen: render });
  }

  itemDetailsHtml(item) {
    const count = this.store.getItemCount(item.id);
    const rarity = RARITIES[item.rarity || 'common'];
    let action = '';
    if (item.type === 'equipment') action = `<button class="button primary full" data-equip-item>Équiper</button>`;
    if (item.type === 'consumable') action = `<button class="button primary full" data-use-item>${item.action === 'summon' ? 'Ouvrir le parchemin' : 'Utiliser'}</button>`;
    return `
      <div class="detail-icon ${rarityClass(item)}">${item.icon}</div>
      <small style="color:${rarity.color}">${rarity.name} · ${item.type === 'equipment' ? SLOT_LABELS[item.slot] || item.slot : item.type}</small>
      <h3>${esc(item.name)}</h3>
      <p>${esc(item.description)}</p>
      ${item.level ? `<div class="requirement">Niveau requis : ${item.level}</div>` : ''}
      ${item.stats ? `<div class="item-stats">${statText(item.stats)}</div>` : ''}
      <div class="detail-meta"><span>Possédé : <b>${count}</b></span><span>Valeur : <b>${item.value} or</b></span></div>
      ${action}`;
  }

  openCharacter() {
    const render = modal => {
      const p = this.store.state.player;
      const stats = this.store.getPlayerStats();
      const jobCap = PROFESSIONS[p.profession].cap;
      const equipmentSlots = Object.entries(SLOT_LABELS).map(([slot, label]) => {
        const itemId = this.store.state.equipment[slot];
        const item = ITEMS[itemId];
        return `<button class="equipment-slot ${item ? rarityClass(item) : 'empty'}" data-slot="${slot}" ${item ? `title="${esc(item.name)}"` : ''}><small>${label}</small><span>${item?.icon || '＋'}</span><b>${item?.name || 'Vide'}</b></button>`;
      }).join('');
      const statRows = describeStats(stats).map(([label,value]) => `<div class="derived-row"><span>${label}</span><b>${value}</b></div>`).join('');
      const elements = ELEMENT_IDS.map(id => {
        const el = ELEMENTS[id];
        const base = p.elements[id];
        const total = stats.affinities[id];
        return `<div class="element-allocation" style="--element:${el.color}"><span class="element-orb">${el.icon}</span><div><strong>${el.name}</strong><small>Base ${base} · Total ${total}</small></div><b>${base}</b><button data-allocate="${id}" ${p.unspent <= 0 ? 'disabled' : ''}>＋</button></div>`;
      }).join('');
      modal.querySelector('.modal-content').innerHTML = `
        <div class="character-layout">
          <section class="paperdoll-panel">
            <div class="character-summary"><div class="character-avatar">🗡️</div><div><h3>${esc(this.store.state.profile.name)}</h3><span>Niveau ${p.level}</span><small>${PROFESSIONS[p.profession].icon} ${PROFESSIONS[p.profession].name} · Métier ${p.jobLevel}/${jobCap}</small></div></div>
            <div class="equipment-grid">${equipmentSlots}</div>
          </section>
          <section class="progression-panel">
            <div class="progress-card"><div><span>Niveau de base</span><b>${p.level}</b></div><div class="progress-line"><i style="width:${percent(p.xp, xpForLevel(p.level))}%"></i></div><small>${p.xp} / ${xpForLevel(p.level)} XP · +5 points par niveau</small></div>
            <div class="progress-card ${p.jobLocked ? 'locked' : ''}"><div><span>Maîtrise du métier</span><b>${p.jobLevel}</b></div><div class="progress-line job"><i style="width:${p.jobLocked ? 100 : percent(p.jobXp, jobXpForLevel(p.jobLevel))}%"></i></div><small>${p.jobLocked ? 'XP BLOQUÉE — va voir Orlan pour évoluer' : `${p.jobXp} / ${jobXpForLevel(p.jobLevel)} XP métier`}</small></div>
            <div class="derived-stats">${statRows}</div>
          </section>
          <section class="elements-panel"><header><div><small>Caractéristiques élémentaires</small><h3>Points à répartir</h3></div><strong>${p.unspent}</strong></header>${elements}<p class="hint">La vitesse est volontairement exclue : elle provient uniquement de ton niveau de base (+1 par niveau) et de ton équipement.</p></section>
        </div>`;
      modal.querySelectorAll('[data-allocate]').forEach(button => button.addEventListener('click', () => {
        if (this.store.allocate(button.dataset.allocate)) { this.audio.play('select'); render(modal); }
      }));
      modal.querySelectorAll('[data-slot]').forEach(button => button.addEventListener('click', () => {
        const slot = button.dataset.slot;
        const itemId = this.store.state.equipment[slot];
        if (!itemId) return;
        const item = ITEMS[itemId];
        const confirm = this.openModal({
          title: item.name, subtitle: SLOT_LABELS[slot], content: `<div class="compact-item-preview"><span>${item.icon}</span><div><p>${esc(item.description)}</p><div class="item-stats">${statText(item.stats)}</div></div></div>`,
          actions: '<button class="button danger" data-unequip>Retirer</button><button class="button ghost" data-cancel>Annuler</button>', className: 'small-modal',
          onOpen: node => {
            node.querySelector('[data-cancel]').addEventListener('click', () => this.closeModal(confirm));
            node.querySelector('[data-unequip]').addEventListener('click', () => { this.store.unequip(slot); this.closeModal(confirm); render(modal); });
          }
        });
      }));
    };
    this.openModal({ title: 'Personnage', subtitle: 'Équipement et caractéristiques', className: 'wide-modal character-modal', content: '', onOpen: render });
  }

  openCompanions() {
    const render = modal => {
      const ownedIds = Object.keys(this.store.state.companions);
      const selected = this.store.state.player.selectedTeam;
      const cards = ownedIds.map(id => {
        const def = COMPANIONS[id];
        const owned = this.store.state.companions[id];
        const stats = this.store.getCompanionStats(id);
        const inTeam = selected.includes(id);
        return `<article class="companion-card element-card-${def.element} ${inTeam ? 'selected' : ''}">
          <div class="companion-art">${def.icon}</div><div class="companion-info"><small>${ELEMENTS[def.element].name} · ${def.role}</small><h3>${def.name} <span>Nv.${owned.level}</span></h3><p>${def.description}</p><div class="companion-mini-stats"><span>PV <b>${stats.maxHp}</b></span><span>ATQ <b>${stats.attack}</b></span><span>DEF <b>${stats.defense}</b></span><span>VIT <b>${stats.speed}</b></span></div><div class="bond-line"><i style="width:${owned.bond || 0}%"></i><span>Lien ${owned.bond || 0}/100</span></div></div>
          <button class="team-toggle" data-team="${id}">${inTeam ? 'Retirer' : 'Ajouter'}</button>
        </article>`;
      }).join('');
      const scrolls = this.store.getItemCount('summon_scroll');
      modal.querySelector('.modal-content').innerHTML = `
        <div class="team-header"><div><h3>Équipe active</h3><p>Le héros est toujours présent. Tu peux ajouter jusqu’à trois compagnons, pour un maximum de quatre combattants.</p></div><div class="team-count"><b>${1 + selected.length}</b><span>/ 4</span></div></div>
        <div class="companion-list">${cards || '<div class="empty-state large"><b>📜</b><span>Aucun compagnon invoqué</span><small>Utilise ton parchemin primordial pour créer ton premier pacte.</small></div>'}</div>
        <div class="summon-footer"><div><span>📜</span><p><strong>Parchemins primordiaux</strong><small>${scrolls} disponible${scrolls > 1 ? 's' : ''}</small></p></div><button class="button primary" data-summon ${scrolls <= 0 ? 'disabled' : ''}>Invoquer</button></div>`;
      modal.querySelectorAll('[data-team]').forEach(button => button.addEventListener('click', () => {
        const ok = this.store.toggleTeamMember(button.dataset.team);
        if (!ok) this.toast('L’équipe possède déjà quatre combattants.', 'warning', '!');
        else this.audio.play('select');
        render(modal);
      }));
      modal.querySelector('[data-summon]')?.addEventListener('click', () => { this.closeModal(modal, true); this.openSummon(); });
    };
    this.openModal({ title: 'Compagnons', subtitle: 'Composition de l’équipe', className: 'wide-modal companions-modal', content: '', onOpen: render });
  }

  openSummon() {
    if (this.store.getItemCount('summon_scroll') <= 0) {
      this.toast('Aucun parchemin primordial disponible.', 'warning', '📜');
      return;
    }
    let choice = Object.keys(COMPANIONS).find(id => !this.store.state.companions[id]) || 'pyron';
    const render = modal => {
      modal.querySelector('.modal-content').innerHTML = `
        <div class="summon-scene"><div class="summon-runes"><i></i><i></i><i></i></div><div class="summon-copy"><p>Le parchemin ne peut appeler qu’un esprit à la fois. Ce choix est définitif pour ce parchemin, mais d’autres pourront être trouvés dans le monde.</p></div></div>
        <div class="summon-choices">${Object.values(COMPANIONS).map(def => {
          const owned = Boolean(this.store.state.companions[def.id]);
          return `<button class="summon-choice element-card-${def.element} ${choice === def.id ? 'selected' : ''}" data-choice="${def.id}" ${owned ? 'disabled' : ''}><span class="summon-creature">${def.icon}</span><small>${ELEMENTS[def.element].name} · ${def.role}</small><strong>${def.name}</strong><p>${owned ? 'Déjà invoqué' : def.description}</p></button>`;
        }).join('')}</div>`;
      modal.querySelectorAll('[data-choice]').forEach(button => button.addEventListener('click', () => { choice = button.dataset.choice; this.audio.play('select'); render(modal); }));
      const confirm = modal.querySelector('[data-confirm-summon]');
      if (confirm) confirm.textContent = `Invoquer ${COMPANIONS[choice].name}`;
    };
    const modal = this.openModal({
      title: 'Invocation primordiale', subtitle: 'Choisis un pacte élémentaire', className: 'wide-modal summon-modal', content: '',
      actions: '<button class="button ghost" data-cancel>Annuler</button><button class="button primary glow" data-confirm-summon>Invoquer</button>',
      onOpen: node => {
        render(node);
        node.querySelector('[data-cancel]').addEventListener('click', () => this.closeModal(modal));
        node.querySelector('[data-confirm-summon]').addEventListener('click', () => {
          const result = this.store.summonCompanion(choice);
          if (!result.ok) { this.toast(result.message, 'warning', '!'); return; }
          this.audio.play('summon');
          node.querySelector('.modal-card').classList.add('summon-success');
          node.querySelector('.modal-content').innerHTML = `<div class="summon-reveal element-card-${COMPANIONS[choice].element}"><div>${COMPANIONS[choice].icon}</div><small>Nouveau compagnon</small><h2>${COMPANIONS[choice].name}</h2><p>${COMPANIONS[choice].description}</p></div>`;
          node.querySelector('.modal-actions').innerHTML = '<button class="button primary" data-finish>Poursuivre</button>';
          node.querySelector('[data-finish]').addEventListener('click', () => { this.closeModal(modal); this.toast(result.message, 'discover', COMPANIONS[choice].icon, 3600); });
        });
      }
    });
  }

  openQuests() {
    const render = modal => {
      const questCards = Object.entries(QUESTS).map(([id, quest]) => {
        const state = this.store.state.quests[id];
        if (state.status === 'locked') return '';
        const objectives = quest.objectives.map((objective, index) => {
          const value = state.progress[String(index)] || 0;
          return `<div class="quest-objective ${value >= objective.amount ? 'done' : ''}"><span>${value >= objective.amount ? '✓' : '○'}</span><p>${objective.label}</p><b>${value}/${objective.amount}</b></div>`;
        }).join('');
        const rewardText = [quest.rewards.xp ? `${quest.rewards.xp} XP` : '', quest.rewards.jobXp ? `${quest.rewards.jobXp} XP métier` : '', quest.rewards.gold ? `${quest.rewards.gold} or` : '', ...(quest.rewards.items || []).map(e => `${ITEMS[e.id].icon} ${ITEMS[e.id].name} ×${e.qty}`)].filter(Boolean).join(' · ');
        return `<article class="quest-card status-${state.status}"><header><div><small>${quest.giver}</small><h3>${quest.name}</h3></div><span>${state.status === 'claimed' ? 'Terminée' : state.status === 'complete' ? 'À récupérer' : 'En cours'}</span></header><p>${quest.description}</p><div class="quest-objectives">${objectives}</div><footer><small>${rewardText}</small>${state.status === 'complete' ? `<button class="button primary small" data-claim="${id}">Récupérer</button>` : ''}</footer></article>`;
      }).join('');
      modal.querySelector('.modal-content').innerHTML = `<div class="quest-list">${questCards}</div>`;
      modal.querySelectorAll('[data-claim]').forEach(button => button.addEventListener('click', () => {
        const result = this.store.claimQuest(button.dataset.claim);
        this.toast(result.message, result.ok ? 'success' : 'warning', result.ok ? '🏆' : '!');
        if (result.ok) this.audio.play('victory');
        render(modal);
      }));
    };
    this.openModal({ title: 'Journal de quêtes', subtitle: 'Les récits de Clairval', className: 'wide-modal quest-modal', content: '', onOpen: render });
  }

  openShop(forge = false) {
    this.shopMode = 'buy';
    let selectedId = SHOP_STOCK[0];
    const render = modal => {
      const entries = this.shopMode === 'buy'
        ? SHOP_STOCK.map(id => ({ id, qty: null }))
        : this.store.state.inventory.filter(entry => entry.id !== 'summon_scroll');
      if (!entries.some(e => e.id === selectedId)) selectedId = entries[0]?.id || null;
      const selected = ITEMS[selectedId];
      modal.querySelector('.modal-content').innerHTML = `
        <div class="shop-layout">
          <header class="shop-tabs"><button class="${this.shopMode === 'buy' ? 'active' : ''}" data-shop-mode="buy">Acheter</button><button class="${this.shopMode === 'sell' ? 'active' : ''}" data-shop-mode="sell">Vendre</button><div class="shop-wallet">🪙 <b>${formatNumber(this.store.state.player.gold)}</b></div></header>
          <section class="shop-list">${entries.length ? entries.map(entry => { const item = ITEMS[entry.id]; const price = this.shopMode === 'buy' ? Math.ceil(item.value * 1.15) : Math.max(1, Math.floor(item.value * 0.55)); return `<button class="shop-row ${selectedId === item.id ? 'selected' : ''}" data-shop-item="${item.id}"><span class="${rarityClass(item)}">${item.icon}</span><div><strong>${item.name}</strong><small>${RARITIES[item.rarity || 'common'].name}${entry.qty ? ` · ×${entry.qty}` : ''}</small></div><b>${price} 🪙</b></button>`; }).join('') : '<div class="empty-state"><b>🎒</b><span>Rien à vendre</span></div>'}</section>
          <aside class="shop-detail">${selected ? this.itemDetailsHtml(selected).replace(/<button[\s\S]*?<\/button>/g, '') : ''}<button class="button primary full" data-shop-confirm ${!selected ? 'disabled' : ''}>${this.shopMode === 'buy' ? `Acheter · ${selected ? Math.ceil(selected.value * 1.15) : 0} or` : `Vendre · ${selected ? Math.max(1, Math.floor(selected.value * .55)) : 0} or`}</button></aside>
        </div>`;
      modal.querySelectorAll('[data-shop-mode]').forEach(button => button.addEventListener('click', () => { this.shopMode = button.dataset.shopMode; render(modal); }));
      modal.querySelectorAll('[data-shop-item]').forEach(button => button.addEventListener('click', () => { selectedId = button.dataset.shopItem; this.audio.play('select'); render(modal); }));
      modal.querySelector('[data-shop-confirm]')?.addEventListener('click', () => {
        const result = this.shopMode === 'buy' ? this.store.buy(selectedId) : this.store.sell(selectedId);
        this.toast(result.message, result.ok ? 'success' : 'warning', result.ok ? '🪙' : '!');
        if (result.ok) this.audio.play('coin');
        render(modal);
      });
    };
    this.openModal({ title: forge ? 'Étal de Brann' : 'Marché de Méron', subtitle: forge ? 'Équipement de voyage' : 'Acheter et vendre', className: 'wide-modal shop-modal', content: '', onOpen: render });
  }

  openClassEvolution() {
    const p = this.store.state.player;
    if (p.profession !== 'novice') {
      const profession = PROFESSIONS[p.profession];
      this.openModal({ title: profession.name, subtitle: 'Voie accomplie', content: `<div class="class-current"><span>${profession.icon}</span><h3>${profession.name}</h3><p>${profession.description}</p></div>`, actions: '<button class="button primary modal-close-proxy">Compris</button>', className: 'small-modal', onOpen: node => node.querySelector('.modal-close-proxy').addEventListener('click', () => this.closeModal(node)) });
      return;
    }
    if (p.jobLevel < 20) {
      this.openModal({ title: 'La voie véritable', subtitle: 'Orlan, maître des voies', content: `<div class="locked-class"><span>⚜️</span><h3>Maîtrise ${p.jobLevel}/20</h3><p>Continue à combattre pour gagner de l’XP métier. Au niveau 20, cette XP sera bloquée jusqu’à ton retour auprès d’Orlan.</p><div class="progress-line job"><i style="width:${p.jobLevel / 20 * 100}%"></i></div></div>`, className: 'small-modal' });
      return;
    }
    let choice = 'swordsman';
    const render = modal => {
      modal.querySelector('.modal-content').innerHTML = `<div class="class-choices">${['swordsman','archer','mage'].map(id => { const cls = PROFESSIONS[id]; const skills = cls.skills.slice(0,3).map(skillId => `<span title="${SKILLS?.[skillId]?.name || skillId}">${skillId.includes('fire') || skillId.includes('flame') || skillId.includes('ember') ? '🔥' : skillId.includes('water') || skillId.includes('tidal') || skillId.includes('frost') || skillId.includes('healing') ? '💧' : skillId.includes('air') || skillId.includes('gale') || skillId.includes('cyclone') || skillId.includes('thunder') ? '🌪️' : skillId.includes('earth') || skillId.includes('stone') || skillId.includes('root') ? '🪨' : '✦'}</span>`).join(''); return `<button class="class-choice ${choice === id ? 'selected' : ''}" data-class="${id}"><b>${cls.icon}</b><h3>${cls.name}</h3><p>${cls.description}</p><div>${skills}</div></button>`; }).join('')}</div><p class="warning-copy">Ce choix change définitivement les compétences de métier de ce personnage.</p>`;
      modal.querySelectorAll('[data-class]').forEach(button => button.addEventListener('click', () => { choice = button.dataset.class; this.audio.play('select'); render(modal); }));
      modal.querySelector('[data-confirm-class]').textContent = `Devenir ${PROFESSIONS[choice].name}`;
    };
    const modal = this.openModal({ title: 'Choisis ta classe', subtitle: 'Évolution de métier', className: 'wide-modal class-modal', content: '', actions: '<button class="button ghost" data-cancel>Plus tard</button><button class="button primary glow" data-confirm-class>Évoluer</button>', closable: false, onOpen: node => {
      render(node);
      node.querySelector('[data-cancel]').addEventListener('click', () => this.closeModal(modal));
      node.querySelector('[data-confirm-class]').addEventListener('click', () => {
        const result = this.store.evolveProfession(choice);
        if (!result.ok) { this.toast(result.message, 'warning', '!'); return; }
        this.audio.play('level');
        node.querySelector('.modal-content').innerHTML = `<div class="class-reveal"><span>${PROFESSIONS[choice].icon}</span><small>Nouvelle voie</small><h2>${PROFESSIONS[choice].name}</h2><p>${PROFESSIONS[choice].description}</p></div>`;
        node.querySelector('.modal-actions').innerHTML = '<button class="button primary" data-finish>Continuer</button>';
        node.querySelector('[data-finish]').addEventListener('click', () => { this.closeModal(modal); this.toast(result.message, 'discover', PROFESSIONS[choice].icon, 4000); });
      });
    }});
  }

  openMap() {
    const discovered = new Set(this.store.state.player.discovered);
    const p = this.store.state.player.position;
    const content = `
      <div class="world-map">
        <div class="map-canvas">${ZONES.map(zone => `<div class="map-zone zone-${zone.id} ${discovered.has(zone.id) ? 'discovered' : 'unknown'}" style="--x:${zone.x/32}%;--y:${zone.y/22}%;--w:${zone.w/32}%;--h:${zone.h/22}%;--zone:${zone.color}"><strong>${discovered.has(zone.id) ? zone.name : '???'}</strong><small>${discovered.has(zone.id) ? zone.level : 'Zone non découverte'}</small></div>`).join('')}<span class="map-player" style="--x:${p.x/32}%;--y:${p.y/22}%">◆</span></div>
        <aside class="map-legend"><h3>Monde ouvert</h3><p>Aucune zone n’est verrouillée par ton niveau. Les indications sont des conseils, pas des barrières.</p>${ZONES.filter(z=>discovered.has(z.id)).map(z=>`<div><span style="background:${z.color}"></span><p><strong>${z.name}</strong><small>${z.level}</small></p></div>`).join('')}</aside>
      </div>`;
    this.openModal({ title: 'Carte d’Andémia', subtitle: `${discovered.size}/${ZONES.length} régions découvertes`, className: 'wide-modal map-modal', content });
  }

  openSettings() {
    const render = modal => {
      const s = this.store.state.settings;
      modal.querySelector('.modal-content').innerHTML = `
        <div class="settings-list">
          <label><div><b>Musique</b><small>Ambiance générée en temps réel</small></div><input type="checkbox" data-setting="music" ${s.music ? 'checked' : ''}><span></span></label>
          <label><div><b>Effets sonores</b><small>Attaques, menus et récompenses</small></div><input type="checkbox" data-setting="sound" ${s.sound ? 'checked' : ''}><span></span></label>
          <label><div><b>Vibrations</b><small>Retour haptique sur mobile</small></div><input type="checkbox" data-setting="vibration" ${s.vibration ? 'checked' : ''}><span></span></label>
          <label><div><b>Animations réduites</b><small>Diminue les mouvements d’interface</small></div><input type="checkbox" data-setting="reducedMotion" ${s.reducedMotion ? 'checked' : ''}><span></span></label>
          <label><div><b>Sauvegarde automatique</b><small>Toutes les douze secondes et après les actions importantes</small></div><input type="checkbox" data-setting="autoSave" ${s.autoSave ? 'checked' : ''}><span></span></label>
        </div>
        <div class="save-tools"><button class="button ghost" data-export>Exporter la sauvegarde</button><button class="button ghost" data-import>Importer</button><button class="button danger" data-title>Retour à l’écran titre</button></div>`;
      modal.querySelectorAll('[data-setting]').forEach(input => input.addEventListener('change', () => {
        this.store.state.settings[input.dataset.setting] = input.checked;
        document.body.classList.toggle('reduce-motion', this.store.state.settings.reducedMotion);
        this.store.touch('settings');
        this.audio.syncSettings();
      }));
      modal.querySelector('[data-export]').addEventListener('click', async () => {
        const encoded = this.store.exportSave();
        try { await navigator.clipboard.writeText(encoded); this.toast('Sauvegarde copiée dans le presse-papiers.', 'success', '📋'); }
        catch { prompt('Copie ce code de sauvegarde :', encoded); }
      });
      modal.querySelector('[data-import]').addEventListener('click', () => {
        const encoded = prompt('Colle le code de sauvegarde :');
        if (!encoded) return;
        try { this.store.importSave(encoded); this.toast('Sauvegarde importée.', 'success', '✓'); this.closeAllModals(); this.callbacks.onReload?.(); }
        catch { this.toast('Code de sauvegarde invalide.', 'warning', '!'); }
      });
      modal.querySelector('[data-title]').addEventListener('click', () => { this.store.save(true); this.closeAllModals(); this.callbacks.onTitle?.(); });
    };
    this.openModal({ title: 'Réglages', subtitle: 'Confort et sauvegarde', className: 'settings-modal', content: '', onOpen: render });
  }

  openTeamPreparation(encounter, node, onStart) {
    const selected = new Set(this.store.state.player.selectedTeam.filter(id => this.store.state.companions[id]).slice(0, 3));
    const render = modal => {
      const enemies = encounter.enemies.map(entry => { const enemy = ENEMIES[entry.id]; return `<article class="enemy-preview element-card-${enemy.element}"><span>${enemy.icon}</span><div><small>${ELEMENTS[enemy.element].name}</small><strong>${enemy.name}</strong><b>Nv.${entry.level}</b></div></article>`; }).join('');
      const companionCards = Object.keys(this.store.state.companions).map(id => { const def = COMPANIONS[id]; const owned = this.store.state.companions[id]; const active = selected.has(id); return `<button class="prep-companion element-card-${def.element} ${active ? 'selected' : ''}" data-prep-companion="${id}"><span>${def.icon}</span><div><small>${def.role}</small><strong>${def.name}</strong><b>Nv.${owned.level}</b></div><i>${active ? '✓' : '+'}</i></button>`; }).join('');
      const dangerDelta = encounter.danger - this.store.state.player.level;
      modal.querySelector('.modal-content').innerHTML = `
        <div class="prep-layout">
          <section class="prep-enemies"><header><div><small>Adversaires</small><h3>${encounter.name}</h3></div><span class="danger-pill ${dangerDelta > 5 ? 'lethal' : dangerDelta > 1 ? 'hard' : 'fair'}">Danger ${encounter.danger}</span></header><div>${enemies}</div><p>${dangerDelta > 5 ? 'Combat extrêmement dangereux pour ton niveau. Tu peux tout de même le tenter.' : dangerDelta > 1 ? 'Combat difficile. Prépare une équipe équilibrée.' : 'Défi adapté à ton niveau actuel.'}</p></section>
          <section class="prep-team"><header><div><small>Formation</small><h3>Choisis ton équipe</h3></div><span>${1 + selected.size}/4</span></header><div class="hero-prep-card"><span>🗡️</span><div><small>${PROFESSIONS[this.store.state.player.profession].name}</small><strong>${esc(this.store.state.profile.name)}</strong><b>Nv.${this.store.state.player.level}</b></div><i>Chef</i></div><div class="prep-companions">${companionCards || '<div class="empty-state"><b>📜</b><span>Aucun compagnon invoqué</span></div>'}</div></section>
        </div>`;
      modal.querySelectorAll('[data-prep-companion]').forEach(button => button.addEventListener('click', () => {
        const id = button.dataset.prepCompanion;
        if (selected.has(id)) selected.delete(id);
        else if (selected.size < 3) selected.add(id);
        else { this.toast('Trois compagnons maximum.', 'warning', '!'); return; }
        this.audio.play('select'); render(modal);
      }));
      modal.querySelector('[data-start-battle]').textContent = `Début du combat · ${1 + selected.size} combattant${selected.size ? 's' : ''}`;
    };
    const modal = this.openModal({ title: 'Préparation du combat', subtitle: 'Formation et analyse', className: 'wide-modal prep-modal', content: '', actions: '<button class="button ghost" data-cancel>Annuler</button><button class="button primary glow" data-start-battle>Début du combat</button>', onOpen: node => {
      render(node);
      node.querySelector('[data-cancel]').addEventListener('click', () => this.closeModal(modal));
      node.querySelector('[data-start-battle]').addEventListener('click', () => {
        this.store.state.player.selectedTeam = [...selected];
        this.store.touch('team');
        this.closeModal(modal, true);
        onStart([...selected]);
      });
    }});
  }

  showCombatResult(result, onClose) {
    this.closeAllModals();
    const victory = result.victory;
    const rewards = result.rewards;
    const p = this.store.state.player;
    const itemCards = victory && rewards.items.length ? rewards.items.map(drop => { const item = ITEMS[drop.id]; return `<div class="loot-card ${rarityClass(item)}"><span>${item.icon}</span><div><strong>${item.name}</strong><small>×${drop.qty} · ${RARITIES[item.rarity || 'common'].name}</small></div></div>`; }).join('') : '<div class="no-loot">Aucun objet supplémentaire</div>';
    const companions = victory ? p.selectedTeam.map(id => { const owned = this.store.state.companions[id]; const def = COMPANIONS[id]; return `<div class="result-companion"><span>${def.icon}</span><div><strong>${def.name} · Nv.${owned.level}</strong><div class="progress-line"><i style="width:${percent(owned.xp, xpForLevel(owned.level))}%"></i></div><small>+${rewards.companionXp} XP compagnon</small></div></div>`; }).join('') : '';
    const content = victory ? `
      <div class="result-hero"><div class="result-emblem">🏆</div><small>Combat terminé</small><h2>Victoire</h2><p>${esc(result.encounter.name)}</p></div>
      <div class="reward-grid"><div><span>✦</span><b>+${rewards.xp}</b><small>XP héros</small></div><div><span>⚜️</span><b>+${rewards.jobXp}</b><small>XP métier</small></div><div><span>🪙</span><b>+${rewards.gold}</b><small>Or</small></div><div><span>⏱️</span><b>${Math.max(1, Math.round(result.duration / 1000))}s</b><small>Durée</small></div></div>
      <section class="result-progress"><h3>Progression de l’équipe</h3><div class="result-player"><span>🗡️</span><div><strong>${esc(this.store.state.profile.name)} · Nv.${p.level}</strong><div class="progress-line"><i style="width:${percent(p.xp, xpForLevel(p.level))}%"></i></div><small>${p.xp} / ${xpForLevel(p.level)} XP</small></div></div>${companions}</section>
      <section class="result-loot"><h3>Butin obtenu</h3><div>${itemCards}</div></section>` : `
      <div class="result-hero defeat"><div class="result-emblem">☾</div><small>Combat terminé</small><h2>Défaite</h2><p>Élia t’a ramené à Clairval. Tu conserves ton équipement et ton inventaire.</p></div><div class="defeat-tip"><b>Conseil</b><p>Améliore ton équipement, répartis tes points élémentaires ou ajoute un compagnon adapté à l’ennemi.</p></div>`;
    const modal = this.openModal({ title: victory ? 'Récompenses' : 'Retour à Clairval', subtitle: victory ? 'Progression enregistrée' : 'Aucune perte permanente', className: `result-modal ${victory ? 'victory' : 'defeat'}`, content, actions: `<button class="button primary glow" data-result-close>${victory ? 'Fermer' : 'Retourner en ville'}</button>`, closable: false, onOpen: node => node.querySelector('[data-result-close]').addEventListener('click', () => { this.closeModal(modal, true); onClose(); }) });
  }
}
