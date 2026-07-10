export class AudioEngine {
  constructor(store) {
    this.store = store;
    this.context = null;
    this.master = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.mode = 'world';
  }

  ensure() {
    if (!this.context) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      this.context = new Ctx();
      this.master = this.context.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') this.context.resume();
    return true;
  }

  tone(frequency, duration = 0.1, options = {}) {
    if (!this.store.state?.settings.sound || !this.ensure()) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = options.type || 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);
    if (options.slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, options.slide), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(options.volume || 0.12, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  noise(duration = 0.08, volume = 0.08) {
    if (!this.store.state?.settings.sound || !this.ensure()) return;
    const length = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(this.master);
    source.start();
  }

  play(name) {
    if (!this.store.state?.settings.sound) return;
    const patterns = {
      select: () => this.tone(640, 0.055, { volume: 0.07, type: 'triangle' }),
      open: () => { this.tone(390, 0.08, { volume: 0.07 }); setTimeout(() => this.tone(590, 0.09, { volume: 0.07 }), 55); },
      close: () => this.tone(340, 0.075, { slide: 220, volume: 0.07 }),
      hit: () => this.tone(180, 0.08, { slide: 90, type: 'square', volume: 0.055 }),
      impact: () => { this.noise(0.09, 0.06); this.tone(105, 0.11, { slide: 65, volume: 0.08 }); },
      critical: () => { this.noise(0.13, 0.09); this.tone(420, 0.18, { slide: 120, type: 'sawtooth', volume: 0.08 }); },
      fire: () => { this.noise(0.16, 0.055); this.tone(210, 0.18, { slide: 520, type: 'sawtooth', volume: 0.055 }); },
      water: () => { this.tone(520, 0.16, { slide: 230, type: 'sine', volume: 0.08 }); setTimeout(() => this.tone(680, 0.12, { slide: 420, volume: 0.05 }), 80); },
      air: () => { this.noise(0.2, 0.035); this.tone(820, 0.19, { slide: 360, type: 'triangle', volume: 0.055 }); },
      earth: () => { this.tone(92, 0.22, { slide: 55, type: 'square', volume: 0.07 }); this.noise(0.12, 0.04); },
      healCast: () => { this.tone(440, 0.16, { slide: 760, volume: 0.06 }); },
      heal: () => { [523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, 0.16, { volume: 0.055 }), i * 70)); },
      battleStart: () => { [147, 196, 247].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, { type: 'sawtooth', volume: 0.055 }), i * 90)); },
      victory: () => { [392, 494, 587, 784].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, { volume: 0.08, type: 'triangle' }), i * 120)); },
      defeat: () => { [330, 262, 196, 147].forEach((f, i) => setTimeout(() => this.tone(f, 0.32, { volume: 0.065, type: 'sine' }), i * 145)); },
      summon: () => { [330, 440, 554, 659, 880].forEach((f, i) => setTimeout(() => this.tone(f, 0.35, { volume: 0.065, type: 'triangle' }), i * 115)); },
      level: () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.26, { volume: 0.07 }), i * 90)); },
      coin: () => { this.tone(900, 0.08, { volume: 0.055 }); setTimeout(() => this.tone(1200, 0.11, { volume: 0.05 }), 55); }
    };
    (patterns[name] || patterns.select)();
  }

  setMode(mode) {
    this.mode = mode;
    this.stopMusic();
    if (this.store.state?.settings.music) this.startMusic();
  }

  startMusic() {
    if (!this.store.state?.settings.music || !this.ensure() || this.musicTimer) return;
    const world = [196, 247, 294, 330, 294, 247, 220, 247];
    const battle = [147, 147, 196, 220, 147, 247, 220, 196];
    this.musicTimer = setInterval(() => {
      if (!this.store.state?.settings.music) return;
      const notes = this.mode === 'battle' ? battle : world;
      const note = notes[this.musicStep % notes.length];
      this.tone(note, this.mode === 'battle' ? 0.22 : 0.45, { volume: 0.018, type: this.mode === 'battle' ? 'sawtooth' : 'sine' });
      if (this.musicStep % 2 === 0) this.tone(note / 2, 0.55, { volume: 0.012, type: 'triangle' });
      this.musicStep += 1;
    }, this.mode === 'battle' ? 310 : 620);
  }

  stopMusic() { clearInterval(this.musicTimer); this.musicTimer = null; }
  syncSettings() { if (this.store.state.settings.music) this.startMusic(); else this.stopMusic(); }
}
