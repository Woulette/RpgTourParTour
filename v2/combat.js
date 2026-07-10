import { ENEMIES, SKILLS, ELEMENTS, ITEMS, elementMultiplier } from './data.js';
import { clamp, rand, randInt, pick, buildPlayerActor, buildCompanionActor, formatNumber } from './core.js';
import { fitCanvas, drawHero, drawCompanion, drawEnemy, drawElementAura, drawWorldLabel } from './art.js';

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function effectiveSpeed(actor) {
  let speed = Math.max(1, actor.speed);
  for (const status of actor.statuses) {
    if (status.type === 'haste') speed *= 1 + status.value;
    if (status.type === 'slow') speed *= 1 - status.value;
  }
  return Math.max(1, speed);
}

function statusLabel(type) {
  return { burn: 'Brûlure', guard: 'Garde', barrier: 'Barrière', slow: 'Ralenti', haste: 'Hâte', weaken: 'Affaibli', stun: 'Étourdi' }[type] || type;
}

export class CombatController {
  constructor({ root, store, onResult, onExit, onSound, onToast }) {
    this.root = root;
    this.store = store;
    this.callbacks = { onResult, onExit, onSound, onToast };
    this.encounter = null;
    this.node = null;
    this.actors = [];
    this.current = null;
    this.selectedTarget = null;
    this.auto = false;
    this.running = false;
    this.awaitingInput = false;
    this.clock = 0;
    this.turn = 0;
    this.actionToken = 0;
    this.animationFrame = 0;
    this.actorEls = new Map();
    this.startedAt = 0;
    this.backgroundElement = 'neutral';
  }

  buildEnemy(definition, index) {
    const def = ENEMIES[definition.id];
    const level = definition.level || 1;
    const scale = Math.pow(def.growth || 1.12, level - 1);
    const hp = Math.round(def.base.hp * scale);
    const attack = Math.round(def.base.attack * scale);
    const defense = Math.round(def.base.defense * (0.8 + scale * 0.2));
    const speed = Math.round(def.base.speed + (level - 1) * 1.25);
    return {
      uid: `enemy_${index}_${def.id}`, sourceId: def.id, side: 'enemy', kind: 'enemy', name: def.name,
      level, element: def.element, hp, maxHp: hp, mana: 0, maxMana: 0,
      attack, magic: Math.round(attack * 0.95), defense, speed,
      crit: def.boss ? 0.12 : 0.05,
      affinities: { fire: 0, water: 0, air: 0, earth: 0, neutral: 0, [def.element]: 6 + level * 1.4 },
      skills: [...def.skills], statuses: [], cooldowns: {}, alive: true, nextAt: 0,
      boss: Boolean(def.boss), reward: def
    };
  }

  start(encounter, node = null, teamIds = []) {
    this.stop();
    this.encounter = encounter;
    this.node = node;
    this.clock = 0;
    this.turn = 0;
    this.auto = false;
    this.running = true;
    this.awaitingInput = false;
    this.current = null;
    this.selectedTarget = null;
    this.actionToken += 1;
    this.startedAt = performance.now();

    const allies = [buildPlayerActor(this.store)];
    for (const id of teamIds.slice(0, 3)) {
      const actor = buildCompanionActor(this.store, id);
      if (actor) allies.push(actor);
    }
    const enemies = encounter.enemies.slice(0, 4).map((entry, index) => this.buildEnemy(entry, index));
    this.actors = [...allies, ...enemies];
    for (const actor of this.actors) actor.nextAt = (1000 / effectiveSpeed(actor)) * rand(0.35, 1.05);
    this.backgroundElement = enemies[0]?.element || 'neutral';

    this.renderShell();
    this.renderAll();
    this.startVisualLoop();
    this.callbacks.onSound?.('battleStart');
    setTimeout(() => this.advance(), 650);
  }

  stop() {
    this.running = false;
    this.awaitingInput = false;
    this.actionToken += 1;
    cancelAnimationFrame(this.animationFrame);
  }

  renderShell() {
    this.root.innerHTML = `
      <canvas class="combat-bg" aria-hidden="true"></canvas>
      <div class="combat-shade"></div>
      <header class="combat-topbar">
        <button class="combat-round-button combat-exit" type="button" aria-label="Quitter le combat">×</button>
        <div class="combat-title-wrap">
          <span class="combat-kicker">Affrontement</span>
          <strong class="combat-title">${this.encounter.name}</strong>
        </div>
        <div class="turn-timeline" aria-label="Ordre des prochains tours"></div>
      </header>
      <div class="battlefield" aria-label="Champ de bataille">
        <section class="actor-side allies" aria-label="Équipe"></section>
        <div class="battle-center-mark"><span>✦</span></div>
        <section class="actor-side enemies" aria-label="Adversaires"></section>
      </div>
      <div class="combat-message" aria-live="polite"></div>
      <footer class="combat-controls">
        <div class="current-actor-card"></div>
        <div class="skill-bar" aria-label="Compétences"></div>
        <button class="auto-toggle" type="button" aria-label="Activer le combat automatique" aria-pressed="false">
          <span class="auto-icon">▶</span><span class="auto-label">AUTO</span>
        </button>
      </footer>
    `;
    this.canvas = this.root.querySelector('.combat-bg');
    this.alliesEl = this.root.querySelector('.actor-side.allies');
    this.enemiesEl = this.root.querySelector('.actor-side.enemies');
    this.timelineEl = this.root.querySelector('.turn-timeline');
    this.skillBarEl = this.root.querySelector('.skill-bar');
    this.currentActorEl = this.root.querySelector('.current-actor-card');
    this.messageEl = this.root.querySelector('.combat-message');
    this.autoButton = this.root.querySelector('.auto-toggle');

    this.root.querySelector('.combat-exit').addEventListener('click', () => {
      if (!this.running) return;
      const boss = this.encounter.boss;
      if (boss) this.callbacks.onToast?.('Impossible de fuir ce combat de boss.');
      else this.requestFlee();
    });
    this.autoButton.addEventListener('click', () => this.toggleAuto());

    this.actorEls.clear();
    const allies = this.actors.filter(a => a.side === 'ally');
    const enemies = this.actors.filter(a => a.side === 'enemy');
    allies.forEach((actor, index) => this.createActorElement(actor, this.alliesEl, index, allies.length));
    enemies.forEach((actor, index) => this.createActorElement(actor, this.enemiesEl, index, enemies.length));
  }

  createActorElement(actor, parent, index, count) {
    const element = document.createElement('article');
    element.className = `battle-actor ${actor.side} ${actor.kind}${actor.boss ? ' boss' : ''}`;
    element.dataset.uid = actor.uid;
    element.style.setProperty('--index', index);
    element.style.setProperty('--count', count);
    const elementDef = ELEMENTS[actor.element] || ELEMENTS.neutral;
    element.innerHTML = `
      <div class="actor-overhead">
        <div class="actor-name-line"><span class="actor-element" style="--element:${elementDef.color}">${elementDef.icon}</span><strong>${actor.name}</strong><span>Nv.${actor.level}</span></div>
        <div class="mini-bar hp"><i></i><span></span></div>
        ${actor.maxMana > 0 ? '<div class="mini-bar mana"><i></i><span></span></div>' : ''}
        <div class="status-row"></div>
      </div>
      <div class="skill-callout"></div>
      <canvas class="actor-canvas" width="180" height="190" aria-hidden="true"></canvas>
      <div class="floating-layer"></div>
      <div class="target-ring"></div>
    `;
    element.addEventListener('click', () => this.selectTarget(actor.uid));
    parent.appendChild(element);
    this.actorEls.set(actor.uid, element);
  }

  startVisualLoop() {
    const draw = time => {
      if (!this.running) return;
      this.drawVisuals(time / 1000);
      this.animationFrame = requestAnimationFrame(draw);
    };
    this.animationFrame = requestAnimationFrame(draw);
  }

  drawVisuals(t) {
    this.drawBackground(t);
    for (const actor of this.actors) {
      const element = this.actorEls.get(actor.uid);
      if (!element) continue;
      const canvas = element.querySelector('.actor-canvas');
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height * 0.72);
      const pulse = this.current?.uid === actor.uid ? 1 + Math.sin(t * 6) * 0.025 : 1;
      const alpha = actor.alive ? 1 : 0.25;
      ctx.globalAlpha = alpha;
      if (this.current?.uid === actor.uid && actor.alive) drawElementAura(ctx, 0, 15, actor.element, actor.boss ? 56 : 43, t);
      if (actor.kind === 'hero') drawHero(ctx, 0, 0, 1.28 * pulse, actor.side === 'ally' ? 1 : -1, t, { moving: false });
      else if (actor.kind === 'companion') drawCompanion(ctx, actor.sourceId, 0, 0, 1.32 * pulse, t);
      else drawEnemy(ctx, actor.sourceId, 0, 0, (actor.boss ? 1.45 : 1.24) * pulse, t, { boss: actor.boss });
      ctx.restore();
    }
  }

  drawBackground(t) {
    if (!this.canvas) return;
    const { ctx, width, height } = fitCanvas(this.canvas);
    const palettes = {
      fire: ['#321c25', '#8b3e33', '#e16a3b'], water: ['#0c2637', '#235c79', '#5ba8b5'],
      air: ['#163238', '#3d786e', '#9bc6a8'], earth: ['#2b2820', '#66563c', '#a98d57'],
      neutral: ['#191d2c', '#3e4157', '#737386']
    };
    const p = palettes[this.backgroundElement] || palettes.neutral;
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, p[0]); gradient.addColorStop(0.58, p[1]); gradient.addColorStop(1, '#11151c');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 26; i++) {
      const x = ((i * 137 + t * (8 + i % 5)) % (width + 120)) - 60;
      const y = height * 0.18 + ((i * 83) % Math.max(80, height * 0.5));
      const r = 2 + (i % 4);
      ctx.fillStyle = i % 3 === 0 ? p[2] : '#f0f3e9';
      ctx.beginPath(); ctx.arc(x, y + Math.sin(t + i) * 8, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // Sol en perspective.
    const floorY = height * 0.52;
    const floor = ctx.createLinearGradient(0, floorY, 0, height);
    floor.addColorStop(0, 'rgba(8,12,16,.12)'); floor.addColorStop(1, 'rgba(2,4,7,.72)');
    ctx.fillStyle = floor; ctx.fillRect(0, floorY, width, height - floorY);
    ctx.strokeStyle = 'rgba(255,255,255,.075)'; ctx.lineWidth = 1;
    for (let y = floorY; y < height; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    for (let x = -width; x < width * 2; x += 100) { ctx.beginPath(); ctx.moveTo(width / 2, floorY); ctx.lineTo(x, height); ctx.stroke(); }

    const vignette = ctx.createRadialGradient(width / 2, height / 2, 40, width / 2, height / 2, Math.max(width, height) * 0.7);
    vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,0,.5)');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, width, height);
  }

  renderAll() {
    this.renderActors();
    this.renderTimeline();
    this.renderActionBar();
  }

  renderActors() {
    for (const actor of this.actors) {
      const element = this.actorEls.get(actor.uid);
      if (!element) continue;
      const hpPct = clamp(actor.hp / actor.maxHp * 100, 0, 100);
      const manaPct = actor.maxMana ? clamp(actor.mana / actor.maxMana * 100, 0, 100) : 0;
      const hpBar = element.querySelector('.mini-bar.hp');
      hpBar.querySelector('i').style.width = `${hpPct}%`;
      hpBar.querySelector('span').textContent = `${Math.ceil(actor.hp)} / ${actor.maxHp}`;
      const manaBar = element.querySelector('.mini-bar.mana');
      if (manaBar) {
        manaBar.querySelector('i').style.width = `${manaPct}%`;
        manaBar.querySelector('span').textContent = `${Math.ceil(actor.mana)} / ${actor.maxMana}`;
      }
      element.classList.toggle('dead', !actor.alive);
      element.classList.toggle('active', this.current?.uid === actor.uid);
      element.classList.toggle('selected', this.selectedTarget === actor.uid);
      const statusRow = element.querySelector('.status-row');
      statusRow.innerHTML = actor.statuses.map(status => `<span class="status-chip status-${status.type}" title="${statusLabel(status.type)}">${this.statusIcon(status.type)} ${status.turns}</span>`).join('');
    }
  }

  statusIcon(type) {
    return { burn: '🔥', guard: '🛡️', barrier: '◇', slow: '❄️', haste: '🪽', weaken: '↓', stun: '💫' }[type] || '•';
  }

  renderTimeline() {
    if (!this.timelineEl) return;
    const upcoming = this.actors.filter(a => a.alive).sort((a, b) => a.nextAt - b.nextAt).slice(0, 7);
    this.timelineEl.innerHTML = upcoming.map((actor, index) => {
      const icon = actor.kind === 'hero' ? '🗡️' : actor.kind === 'companion' ? (ELEMENTS[actor.element]?.icon || '✦') : (actor.reward?.icon || ELEMENTS[actor.element]?.icon || '◆');
      return `<span class="timeline-unit ${actor.side} ${index === 0 ? 'next' : ''}" title="${actor.name}"><b>${icon}</b><small>${Math.max(0, Math.round((actor.nextAt - this.clock) * 10))}</small></span>`;
    }).join('');
  }

  renderActionBar() {
    if (!this.skillBarEl) return;
    if (!this.current || !this.current.alive || this.current.side !== 'ally' || !this.awaitingInput) {
      this.skillBarEl.innerHTML = '<div class="waiting-turn"><span></span><span></span><span></span></div>';
      this.currentActorEl.innerHTML = this.current ? `<span>${ELEMENTS[this.current.element]?.icon || '✦'}</span><div><small>Tour en cours</small><strong>${this.current.name}</strong></div>` : '';
      return;
    }
    const actor = this.current;
    this.currentActorEl.innerHTML = `<span>${actor.kind === 'hero' ? '🗡️' : ELEMENTS[actor.element].icon}</span><div><small>À toi de jouer</small><strong>${actor.name}</strong></div>`;
    const skills = actor.skills.map(id => SKILLS[id]).filter(Boolean);
    const buttons = skills.map((skill, index) => {
      const cd = actor.cooldowns[skill.id] || 0;
      const disabled = actor.mana < skill.mana || cd > 0;
      const shortcut = index < 9 ? index + 1 : '';
      return `<button class="skill-slot element-${skill.element}" type="button" data-skill="${skill.id}" ${disabled ? 'disabled' : ''} title="${skill.description || skill.name}">
        <span class="skill-icon">${skill.icon}</span>
        <span class="skill-name">${skill.name}</span>
        <small>${skill.mana ? `${skill.mana} PM` : 'Gratuit'}</small>
        ${cd ? `<i class="cooldown"><b>${cd}</b></i>` : ''}
        ${shortcut ? `<em>${shortcut}</em>` : ''}
      </button>`;
    }).join('');
    const potionCount = this.store.getItemCount('minor_potion');
    this.skillBarEl.innerHTML = `${buttons}<button class="skill-slot item-slot" type="button" data-item="minor_potion" ${potionCount <= 0 ? 'disabled' : ''} title="Utiliser une petite potion"><span class="skill-icon">🧪</span><span class="skill-name">Potion</span><small>x${potionCount}</small></button>`;
    this.skillBarEl.querySelectorAll('[data-skill]').forEach(button => button.addEventListener('click', () => this.chooseSkill(button.dataset.skill)));
    this.skillBarEl.querySelector('[data-item]')?.addEventListener('click', () => this.useCombatItem('minor_potion'));
  }

  selectTarget(uid) {
    if (!this.running) return;
    const actor = this.actors.find(a => a.uid === uid && a.alive);
    if (!actor) return;
    this.selectedTarget = uid;
    this.renderActors();
    this.callbacks.onSound?.('select');
  }

  chooseSkill(skillId) {
    if (!this.awaitingInput || !this.current || this.current.side !== 'ally') return;
    const skill = SKILLS[skillId];
    if (!skill) return;
    if ((this.current.cooldowns[skillId] || 0) > 0) return;
    if (this.current.mana < skill.mana) {
      this.showMessage('Mana insuffisant', 'bad');
      return;
    }
    const target = this.resolvePreferredTarget(this.current, skill);
    if (!target && !['allEnemies', 'allAllies', 'self'].includes(skill.target)) {
      this.showMessage('Sélectionne une cible valide', 'bad');
      return;
    }
    this.awaitingInput = false;
    this.renderActionBar();
    this.performSkill(this.current, skill, target);
  }

  resolvePreferredTarget(actor, skill) {
    const selected = this.actors.find(a => a.uid === this.selectedTarget && a.alive);
    if (skill.target === 'self') return actor;
    if (skill.target === 'enemy') {
      if (selected?.side !== actor.side) return selected;
      return this.actors.find(a => a.side !== actor.side && a.alive) || null;
    }
    if (skill.target === 'ally') {
      if (selected?.side === actor.side) return selected;
      return this.lowestHealth(actor.side);
    }
    return null;
  }

  lowestHealth(side) {
    return this.actors.filter(a => a.side === side && a.alive).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] || null;
  }

  toggleAuto() {
    this.auto = !this.auto;
    this.autoButton?.setAttribute('aria-pressed', String(this.auto));
    this.autoButton?.classList.toggle('enabled', this.auto);
    const icon = this.autoButton?.querySelector('.auto-icon');
    if (icon) icon.textContent = this.auto ? 'Ⅱ' : '▶';
    const label = this.autoButton?.querySelector('.auto-label');
    if (label) label.textContent = this.auto ? 'STOP' : 'AUTO';
    this.callbacks.onSound?.('select');
    if (this.auto && this.awaitingInput && this.current?.side === 'ally') {
      this.awaitingInput = false;
      this.renderActionBar();
      setTimeout(() => this.aiAct(this.current), 180);
    }
  }

  requestFlee() {
    if (!this.running) return;
    const fastestEnemy = Math.max(...this.actors.filter(a => a.side === 'enemy' && a.alive).map(a => a.speed), 1);
    const hero = this.actors.find(a => a.uid === 'hero');
    const chance = clamp(0.55 + (hero.speed - fastestEnemy) / 220, 0.2, 0.92);
    if (Math.random() < chance) {
      this.showMessage('Fuite réussie', 'good');
      this.persistVitals(false);
      this.stop();
      setTimeout(() => this.callbacks.onExit?.({ fled: true }), 500);
    } else {
      this.showMessage('La fuite échoue !', 'bad');
      this.awaitingInput = false;
      if (this.current?.side === 'ally') this.finishAction(this.current);
    }
  }

  async useCombatItem(itemId) {
    if (!this.awaitingInput || !this.current || this.current.side !== 'ally') return;
    const item = ITEMS[itemId];
    if (!item || item.action !== 'heal' || !this.store.removeItem(itemId, 1, true)) return;
    const target = this.lowestHealth('ally');
    const amount = Math.min(item.amount, target.maxHp - target.hp);
    target.hp += amount;
    this.awaitingInput = false;
    this.showSkillCallout(this.current, item.name);
    this.floatText(target, `+${amount}`, 'heal');
    this.callbacks.onSound?.('heal');
    this.renderAll();
    await wait(420);
    this.finishAction(this.current);
  }

  advance() {
    if (!this.running || this.awaitingInput) return;
    const living = this.actors.filter(a => a.alive);
    if (!living.length) return;
    const actor = living.sort((a, b) => a.nextAt - b.nextAt)[0];
    this.clock = Math.max(this.clock, actor.nextAt);
    this.current = actor;
    this.turn += 1;
    this.selectedTarget = actor.side === 'ally'
      ? this.actors.find(a => a.side === 'enemy' && a.alive)?.uid || null
      : this.actors.find(a => a.side === 'ally' && a.alive)?.uid || null;

    this.tickCooldowns(actor);
    const statusResult = this.processTurnStatuses(actor);
    this.renderAll();
    if (!actor.alive) {
      setTimeout(() => this.finishAction(actor), 250);
      return;
    }
    if (statusResult.skip) {
      this.showSkillCallout(actor, statusResult.label || 'Tour perdu');
      setTimeout(() => this.finishAction(actor), 500);
      return;
    }

    if (actor.side === 'enemy' || this.auto) {
      this.awaitingInput = false;
      setTimeout(() => this.aiAct(actor), actor.side === 'enemy' ? 480 : 280);
    } else {
      this.awaitingInput = true;
      this.renderActionBar();
      this.showMessage(`Tour de ${actor.name}`, 'neutral', 800);
    }
  }

  tickCooldowns(actor) {
    for (const id of Object.keys(actor.cooldowns)) {
      actor.cooldowns[id] = Math.max(0, actor.cooldowns[id] - 1);
      if (actor.cooldowns[id] <= 0) delete actor.cooldowns[id];
    }
  }

  processTurnStatuses(actor) {
    let skip = false;
    let label = '';
    for (const status of [...actor.statuses]) {
      if (status.type === 'burn') {
        const damage = Math.max(1, Math.round(actor.maxHp * status.value));
        this.applyRawDamage(actor, damage, { periodic: true, element: 'fire' });
      }
      if (status.type === 'stun') { skip = true; label = 'Étourdi !'; }
      status.turns -= 1;
    }
    actor.statuses = actor.statuses.filter(status => status.turns > 0);
    return { skip, label };
  }

  aiAct(actor) {
    if (!this.running || !actor.alive) return;
    const available = actor.skills.map(id => SKILLS[id]).filter(skill => skill && actor.mana >= skill.mana && !(actor.cooldowns[skill.id] > 0));
    let skill = null;
    const allies = this.actors.filter(a => a.side === actor.side && a.alive);
    const enemies = this.actors.filter(a => a.side !== actor.side && a.alive);
    const lowest = this.lowestHealth(actor.side);
    const healSkills = available.filter(s => s.heal);
    if (lowest && lowest.hp / lowest.maxHp < 0.46 && healSkills.length) skill = healSkills.sort((a, b) => b.power - a.power)[0];
    if (!skill && enemies.length >= 2) {
      const aoe = available.filter(s => s.target === 'allEnemies').sort((a, b) => b.power - a.power);
      if (aoe.length && Math.random() < 0.66) skill = aoe[0];
    }
    if (!skill) {
      const damaging = available.filter(s => !s.heal && s.power > 0).sort((a, b) => (b.power || 0) - (a.power || 0));
      skill = damaging.find(s => s.mana > 0 && Math.random() < 0.75) || damaging[damaging.length - 1] || available[0];
    }
    if (!skill) skill = SKILLS.basic_strike;
    let target = null;
    if (skill.target === 'self') target = actor;
    else if (skill.target === 'ally') target = lowest;
    else if (skill.target === 'enemy') {
      // L’IA privilégie une cible faible mais conserve un peu d’imprévisibilité.
      const sorted = enemies.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
      target = Math.random() < 0.72 ? sorted[0] : pick(sorted);
    }
    this.performSkill(actor, skill, target);
  }

  async performSkill(actor, skill, primaryTarget) {
    if (!this.running || !actor.alive) return;
    const token = this.actionToken;
    actor.mana = clamp(actor.mana - (skill.mana || 0), 0, actor.maxMana);
    if (skill.cooldown) actor.cooldowns[skill.id] = skill.cooldown + 1;
    this.showSkillCallout(actor, skill.name);
    this.animateActor(actor, primaryTarget, skill);
    this.callbacks.onSound?.(skill.heal ? 'healCast' : skill.element === 'neutral' ? 'hit' : skill.element);
    this.renderAll();
    await wait(310);
    if (!this.running || token !== this.actionToken) return;

    const targets = this.resolveTargets(actor, skill, primaryTarget);
    const hits = skill.hits || 1;
    for (let hit = 0; hit < hits; hit++) {
      for (const target of targets.filter(t => t.alive)) {
        if (skill.heal) this.applyHeal(actor, target, skill);
        else if (skill.power > 0) this.applyDamage(actor, target, skill, hit);
        else this.applyStatus(actor, target, skill);
      }
      if (hit < hits - 1) {
        this.renderAll();
        await wait(165);
      }
    }

    if (skill.splash && primaryTarget) {
      const nearby = this.actors.filter(a => a.side === primaryTarget.side && a.alive && a.uid !== primaryTarget.uid);
      for (const target of nearby) this.applyDamage(actor, target, { ...skill, power: skill.power * skill.splash, status: null }, 0, true);
    }
    if (skill.drain && primaryTarget) {
      const dealt = actor._lastDamage || 0;
      const heal = Math.max(1, Math.round(dealt * skill.drain));
      actor.hp = clamp(actor.hp + heal, 0, actor.maxHp);
      this.floatText(actor, `+${heal}`, 'heal');
    }
    if (skill.extraInitiative) actor.nextAt -= (1000 / effectiveSpeed(actor)) * skill.extraInitiative;

    this.renderAll();
    await wait(440);
    if (!this.running || token !== this.actionToken) return;
    const end = this.checkEnd();
    if (!end) this.finishAction(actor);
  }

  resolveTargets(actor, skill, primary) {
    if (skill.target === 'self') return [actor];
    if (skill.target === 'enemy') return primary ? [primary] : [];
    if (skill.target === 'ally') return primary ? [primary] : [];
    if (skill.target === 'allEnemies') return this.actors.filter(a => a.side !== actor.side && a.alive);
    if (skill.target === 'allAllies') return this.actors.filter(a => a.side === actor.side && a.alive);
    return [];
  }

  applyDamage(source, target, skill, hitIndex = 0, splash = false) {
    const stat = skill.element === 'neutral' ? source.attack : Math.max(source.attack, source.magic || 0);
    const affinity = source.affinities?.[skill.element] || 0;
    const elementFactor = elementMultiplier(skill.element, target.element);
    const variance = rand(0.91, 1.09);
    let raw = stat * (skill.power || 1) * (1 + affinity * 0.012) * elementFactor * variance;
    raw -= target.defense * (skill.hits ? 0.27 : 0.42);
    raw = Math.max(1, raw);
    const weaken = source.statuses.find(s => s.type === 'weaken');
    if (weaken) raw *= 1 - weaken.value;
    const guard = target.statuses.find(s => s.type === 'guard');
    const barrier = target.statuses.find(s => s.type === 'barrier');
    if (guard) raw *= 1 - guard.value;
    if (barrier) raw *= 1 - barrier.value;
    const crit = Math.random() < source.crit;
    if (crit) raw *= 1.58;
    const damage = Math.max(1, Math.round(raw));
    target.hp = clamp(target.hp - damage, 0, target.maxHp);
    target.alive = target.hp > 0;
    source._lastDamage = damage;
    this.floatText(target, `-${damage}`, crit ? 'critical' : elementFactor > 1 ? 'effective' : elementFactor < 1 ? 'resisted' : 'damage', splash ? 0.78 : 1);
    this.flashActor(target, 'hurt');
    if (elementFactor > 1 && !splash) this.showMessage('Super efficace !', 'good', 650);
    if (elementFactor < 1 && !splash) this.showMessage('Résistance élémentaire', 'neutral', 650);
    if (skill.status && target.alive) this.applyStatus(source, target, skill);
    this.callbacks.onSound?.(crit ? 'critical' : 'impact');
    if (navigator.vibrate && this.store.state.settings.vibration) navigator.vibrate(crit ? [25, 25, 45] : 24);
  }

  applyRawDamage(target, amount, options = {}) {
    target.hp = clamp(target.hp - amount, 0, target.maxHp);
    target.alive = target.hp > 0;
    this.floatText(target, `-${amount}`, options.periodic ? 'burn' : 'damage');
    this.flashActor(target, 'hurt');
  }

  applyHeal(source, target, skill) {
    const stat = Math.max(source.magic || source.attack, source.attack * 0.75);
    const affinity = source.affinities?.[skill.element] || 0;
    const amount = Math.max(1, Math.round(stat * skill.power * (1 + affinity * 0.01) * rand(0.95, 1.08)));
    const actual = Math.min(amount, target.maxHp - target.hp);
    target.hp = clamp(target.hp + amount, 0, target.maxHp);
    this.floatText(target, `+${actual}`, 'heal');
    this.flashActor(target, 'heal');
    if (skill.status) this.applyStatus(source, target, skill);
    this.callbacks.onSound?.('heal');
  }

  applyStatus(source, target, skill) {
    const data = skill.status;
    if (!data) return;
    if (data.chance && Math.random() > data.chance) return;
    const existing = target.statuses.find(status => status.type === data.type);
    if (existing) {
      existing.turns = Math.max(existing.turns, data.turns);
      existing.value = Math.max(existing.value || 0, data.value || 0);
    } else {
      target.statuses.push({ type: data.type, turns: data.turns, value: data.value || 0, source: source.uid });
    }
    this.floatText(target, statusLabel(data.type), `status-${data.type}`, 0.82);
  }

  finishAction(actor) {
    if (!this.running) return;
    actor.nextAt += 1000 / effectiveSpeed(actor);
    this.current = null;
    this.awaitingInput = false;
    this.renderAll();
    setTimeout(() => this.advance(), this.auto ? 210 : 330);
  }

  checkEnd() {
    const alliesAlive = this.actors.some(a => a.side === 'ally' && a.alive);
    const enemiesAlive = this.actors.some(a => a.side === 'enemy' && a.alive);
    if (alliesAlive && enemiesAlive) return false;
    if (!enemiesAlive) this.finishCombat(true);
    else this.finishCombat(false);
    return true;
  }

  async finishCombat(victory) {
    if (!this.running) return;
    this.running = false;
    this.awaitingInput = false;
    this.actionToken += 1;
    this.persistVitals(victory);
    this.root.classList.add(victory ? 'combat-victory' : 'combat-defeat');
    this.showMessage(victory ? 'VICTOIRE' : 'DÉFAITE', victory ? 'victory' : 'defeat', 1800);
    this.callbacks.onSound?.(victory ? 'victory' : 'defeat');
    await wait(1150);
    cancelAnimationFrame(this.animationFrame);

    if (victory) {
      const rewards = this.rollRewards();
      const enemySummaries = this.actors.filter(a => a.side === 'enemy').map(a => ({ id: a.sourceId, level: a.level, name: a.name }));
      this.store.recordBattle(rewards, enemySummaries);
      this.callbacks.onResult?.({ victory: true, rewards, enemies: enemySummaries, encounter: this.encounter, node: this.node, duration: performance.now() - this.startedAt });
    } else {
      // Retour à Clairval avec une récupération partielle, sans perte punitive d’équipement.
      const stats = this.store.getPlayerStats();
      this.store.state.player.hp = Math.max(1, Math.round(stats.maxHp * 0.35));
      this.store.state.player.mana = Math.round(stats.maxMana * 0.25);
      this.store.state.player.position = { x: 690, y: 1100 };
      this.store.touch('defeat');
      this.callbacks.onResult?.({ victory: false, rewards: null, encounter: this.encounter, node: this.node, duration: performance.now() - this.startedAt });
    }
  }

  persistVitals(victory) {
    const hero = this.actors.find(a => a.uid === 'hero');
    if (hero) {
      this.store.state.player.hp = Math.max(victory ? 1 : 0, Math.round(hero.hp));
      this.store.state.player.mana = Math.round(hero.mana);
    }
    for (const actor of this.actors.filter(a => a.kind === 'companion')) {
      const companion = this.store.state.companions[actor.sourceId];
      if (companion) {
        companion.hp = Math.max(victory ? 1 : 0, Math.round(actor.hp));
        companion.mana = Math.round(actor.mana);
      }
    }
    this.store.dirty = true;
  }

  rollRewards() {
    let xp = 0, jobXp = 0, gold = 0;
    const itemMap = new Map();
    for (const actor of this.actors.filter(a => a.side === 'enemy')) {
      const def = actor.reward;
      const levelScale = 0.82 + actor.level * 0.08;
      xp += Math.round(def.xp * levelScale);
      jobXp += Math.round(def.jobXp * levelScale);
      gold += randInt(def.gold[0], def.gold[1]);
      for (const drop of def.drops || []) {
        if (Math.random() < drop.chance) itemMap.set(drop.id, (itemMap.get(drop.id) || 0) + 1);
      }
    }
    const items = [...itemMap.entries()].map(([id, qty]) => ({ id, qty }));
    return { xp, jobXp, companionXp: Math.max(1, Math.round(xp * 0.82)), gold, items };
  }

  animateActor(actor, target, skill) {
    const element = this.actorEls.get(actor.uid);
    if (!element) return;
    element.classList.remove('casting', 'lunging');
    void element.offsetWidth;
    element.classList.add(skill.heal || skill.power === 0 ? 'casting' : 'lunging');
    setTimeout(() => element.classList.remove('casting', 'lunging'), 520);
  }

  flashActor(actor, className) {
    const element = this.actorEls.get(actor.uid);
    if (!element) return;
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
    setTimeout(() => element.classList.remove(className), 420);
  }

  showSkillCallout(actor, text) {
    const element = this.actorEls.get(actor.uid);
    if (!element) return;
    const callout = element.querySelector('.skill-callout');
    callout.textContent = text;
    callout.classList.remove('show');
    void callout.offsetWidth;
    callout.classList.add('show');
    setTimeout(() => callout.classList.remove('show'), 1050);
  }

  floatText(actor, text, type = 'damage', scale = 1) {
    const element = this.actorEls.get(actor.uid);
    if (!element) return;
    const layer = element.querySelector('.floating-layer');
    const float = document.createElement('span');
    float.className = `floating-number ${type}`;
    float.textContent = text;
    float.style.setProperty('--drift', `${rand(-18, 18)}px`);
    float.style.setProperty('--scale', scale);
    layer.appendChild(float);
    setTimeout(() => float.remove(), 1250);
  }

  showMessage(text, type = 'neutral', duration = 900) {
    if (!this.messageEl) return;
    this.messageEl.textContent = text;
    this.messageEl.className = `combat-message show ${type}`;
    clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => this.messageEl?.classList.remove('show'), duration);
  }
}
