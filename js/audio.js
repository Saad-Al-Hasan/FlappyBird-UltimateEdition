/* audio.js — all sound synthesized with WebAudio (no asset files) */

const AudioFX = {
  bgMusic: null,
  currentTheme: null,
  ctx: null,
  musicEnabled: true,
  sfxEnabled: true,
  musicTimer: null,
  musicStep: 0,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
  },

  resume() {
    this.init();
    if (this.ctx.state === "suspended") this.ctx.resume();
  },

  tone(freq, duration, type = "sine", startGain = 0.2, glideTo = null) {
    if (!this.sfxEnabled) return;
    this.resume();
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (glideTo) {
      osc.frequency.exponentialRampToValueAtTime(glideTo, ctx.currentTime + duration);
    }
    gain.gain.setValueAtTime(startGain, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  },

  jump() {
    this.tone(520, 0.12, "square", 0.15, 760);
  },

  score() {
    this.tone(880, 0.09, "sine", 0.18);
    setTimeout(() => this.tone(1180, 0.12, "sine", 0.15), 60);
  },

  coin() {
    this.tone(1400, 0.08, "square", 0.12);
    setTimeout(() => this.tone(1800, 0.09, "square", 0.1), 40);
  },

  collision() {
    if (!this.sfxEnabled) return;
    this.resume();
    const ctx = this.ctx;
    const bufferSize = ctx.sampleRate * 0.3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
    noise.connect(gain).connect(ctx.destination);
    noise.start();
    this.tone(120, 0.3, "sawtooth", 0.2);
  },

  powerup() {
    this.tone(400, 0.15, "triangle", 0.15, 1000);
  },

  achievement() {
    this.tone(660, 0.1, "sine", 0.18);
    setTimeout(() => this.tone(880, 0.1, "sine", 0.18), 100);
    setTimeout(() => this.tone(1320, 0.2, "sine", 0.18), 200);
  },

  click() {
    this.tone(300, 0.05, "square", 0.08);
  },

  // Simple looping arpeggio as ambient background music
  startMusic(theme = "day") {

    if (!this.musicEnabled)
      return;

    // stop previous music
    if (this.bgMusic) {
      this.bgMusic.pause();
      this.bgMusic = null;
    }

    this.currentTheme = theme;

    this.bgMusic = new Audio(
      `assets/music/${theme}.mp3`
    );

    this.bgMusic.loop = true;
    this.bgMusic.volume = 0.35;

    this.bgMusic.play().catch(() => { });
  },

stopMusic() {

    if (this.bgMusic) {

        this.bgMusic.pause();
        this.bgMusic.currentTime = 0;
        this.bgMusic = null;
    }
},

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    if (!this.musicEnabled) this.stopMusic();
    else this.startMusic();
    return this.musicEnabled;
  },

  toggleSfx() {
    this.sfxEnabled = !this.sfxEnabled;
    return this.sfxEnabled;
  }
};