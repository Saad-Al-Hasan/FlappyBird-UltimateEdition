/* game.js — core Flappy Bird engine (canvas based) */

const BIRDS = {
  sparrow: { name: "Sparrow", cost: 0, body: "#C97B3D", belly: "#F2C078", desc: "Balanced & reliable", gravityMult: 1.0, jumpMult: 1.0 },
  parrot: { name: "Parrot", cost: 50, body: "#27AE60", belly: "#F1C40F", desc: "Slightly floatier", gravityMult: 0.80, jumpMult: 1.05 },
  eagle: { name: "Eagle", cost: 100, body: "#6D6875", belly: "#E8E4E1", desc: "Big & glides longer", gravityMult: 0.70, jumpMult: 0.93 },
  dragon: { name: "Dragon", cost: 150, body: "#C0392B", belly: "#F39C12", desc: "Fast & fiery, tricky", gravityMult: 1.0, jumpMult: 1.18 }
};

const THEMES = {
  day: {
    name: "Day", cost: 0,
    skyTop: "#7EC8E3", skyBottom: "#CDEFF0",
    pipe: "#2E9E4F", pipeDark: "#1E7A3A",
    ground: "#DEB887", groundDark: "#C19A5B",
    ambient: "clouds"
  },
  night: {
    name: "Night", cost: 50,
    skyTop: "#0B1026", skyBottom: "#2B2E63",
    pipe: "#6C3EA0", pipeDark: "#4A2A73",
    ground: "#1a1a2e", groundDark: "#111122",
    ambient: "stars"
  },
  space: {
    name: "Space", cost: 100,
    skyTop: "#000000", skyBottom: "#170B33",
    pipe: "#7C8798", pipeDark: "#4E5766",
    ground: "#1c1c24", groundDark: "#0f0f14",
    ambient: "starfield"
  },
  underwater: {
    name: "Underwater", cost: 150,
    skyTop: "#005C73", skyBottom: "#0A8A96",
    pipe: "#0E7C5A", pipeDark: "#0A5A41",
    ground: "#3e2723", groundDark: "#291815",
    ambient: "bubbles"
  }
};

const POWERUPS = {
  shield: { icon: "🛡", color: "#3498DB", duration: 7000 },   // instant-use (absorbs 1 hit)
  slow: { icon: "🐌", color: "#9B59B6", duration: 5000 },
  double: { icon: "×2", color: "#F1C40F", duration: 8000 },
  magnet: { icon: "🧲", color: "#d6f6ff", duration: 7000 }
};

const ACHIEVEMENTS = [
  { id: "score10", name: "Getting Started", desc: "Score 10 in a single run", check: r => r.score >= 10 },
  { id: "score50", name: "High Flyer", desc: "Score 50 in a single run", check: r => r.score >= 50 },
  { id: "score100", name: "Legendary Pilot", desc: "Score 100 in a single run", check: r => r.score >= 100 },
  { id: "coins50", name: "Coin Collector", desc: "Collect 50 coins total", check: (r, s) => s.totalCoinsCollected >= 50 },
  { id: "games10", name: "Dedicated", desc: "Play 10 games", check: (r, s) => s.totalGames >= 10 },
  { id: "allbirds", name: "Aviary Complete", desc: "Unlock every bird", check: (r, s, d) => d.unlockedBirds.length >= Object.keys(BIRDS).length },
  { id: "allthemes", name: "World Traveler", desc: "Unlock every theme", check: (r, s, d) => d.unlockedThemes.length >= Object.keys(THEMES).length }
];

const DIFFICULTIES = {
  easy: { gap: 250, speed: 2.2, spawnEvery: 120, gravity: 0.34 },
  medium: { gap: 220, speed: 2.6, spawnEvery: 110, gravity: 0.40 },
  hard: { gap: 200, speed: 3.0, spawnEvery: 100, gravity: 0.46 }
};

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.W = 0; this.H = 0;
    this.resize();
    window.addEventListener("resize", () => this.resize());

    this.state = "ready"; // ready | playing | paused | gameover
    this.onScoreChange = null;
    this.onCoinChange = null;
    this.onGameOver = null;
    this.onPowerupChange = null;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = this.canvas.clientWidth;
    this.H = this.canvas.clientHeight;
    this.canvas.width = this.W * dpr;
    this.canvas.height = this.H * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  configure(birdId, themeId, difficultyId) {
    this.birdId = birdId;
    this.bird = BIRDS[birdId];
    this.themeId = themeId;
    this.theme = THEMES[themeId];
    this.diffId = difficultyId;
    this.diff = DIFFICULTIES[difficultyId];
  }

  reset() {
    this.birdX = this.W * 0.28;
    this.birdY = this.H * 0.45;
    this.birdV = 0;
    this.birdR = 16;
    this.rotation = 0;

    this.pipes = [];
    this.coins = [];
    this.powerupItems = [];
    this.particles = [];

    this.frame = 0;
    this.score = 0;
    this.coinsCollected = 0;
    this.startTime = Date.now();

    this.activeEffects = {}; // {shield: bool, slow: expiresAt, double: expiresAt, magnet: expiresAt}
    this.speedMult = 1;

    this.groundOffset = 0;
    this.ambientSeed = this.initAmbient();

    this.state = "ready";
  }

  initAmbient() {
    const items = [];
    const type = this.theme.ambient;
    const count = type === "starfield" ? 180 : type === "stars" ? 75 : type === "bubbles" ? 50 : 12;
    for (let i = 0; i < count; i++) {
      items.push({
        x: Math.random() * this.W,
        y: Math.random() * this.H * 0.75,
        s: type === "starfield" ? Math.random() * 3 + 0.5 : Math.random() * (type === "clouds" ? 40 : 2.4) + (type === "clouds" ? 30 : 0.6),
        speed: Math.random() * 0.4 + 0.1,
        phase: Math.random() * Math.PI * 2
      });
    }
    return items;
  }

  flap() {
    if (this.state === "ready") this.start();
    if (this.state !== "playing") return;
    this.birdV = -9.2 * this.bird.jumpMult;
    AudioFX.jump();
  }

  start() {
    this.state = "playing";
    this.startTime = Date.now();
  }

  pause() {
    if (this.state === "playing") this.state = "paused";
  }

  resumeGame() {
    if (this.state === "paused") this.state = "playing";
  }

  spawnPipe() {
    const margin = 60;
    const gap = this.diff.gap;
    const gapY = margin + Math.random() * (this.H - margin * 2 - gap - 90);
    const pipe = { x: this.W + 40, gapY, gap, w: 62, passed: false, id: Math.random() };
    this.pipes.push(pipe);

    // maybe spawn a coin in the gap
    if (Math.random() < 0.65) {
      this.coins.push({
        x: pipe.x + pipe.w / 2,
        y: gapY + gap / 2 + (Math.random() * 30 - 15),
        r: 9,
        collected: false,
        bob: Math.random() * Math.PI * 2
      });
    }
    // occasionally spawn a powerup
    if (Math.random() < 0.50) {
      const keys = Object.keys(POWERUPS);
      const type = keys[Math.floor(Math.random() * keys.length)];
      this.powerupItems.push({
        x: pipe.x + pipe.w / 2,
        y: gapY + gap / 2 + (Math.random() * 24 - 12),
        r: 13,
        type,
        collected: false,
        bob: Math.random() * Math.PI * 2
      });
    }
  }

  activatePowerup(type) {
    AudioFX.powerup();

    const now = Date.now();

    this.activeEffects[type] =
      now + POWERUPS[type].duration;

    if (this.onPowerupChange)
      this.onPowerupChange(
        this.getActiveEffectsList()
      );
  }

  getActiveEffectsList() {
    const now = Date.now();
    const list = [];
    if (
      this.activeEffects.shield &&
      this.activeEffects.shield > now
    ) {
      list.push({
        type: "shield",
        remaining:
          this.activeEffects.shield - now
      });
    }
    ["slow", "double", "magnet"].forEach(k => {
      if (this.activeEffects[k] && this.activeEffects[k] > now) {
        list.push({ type: k, remaining: this.activeEffects[k] - now });
      }
    });
    return list;
  }

  update() {
    if (this.state !== "playing") return;
    this.frame++;
    const now = Date.now();

    // expire timed effects
    ["shield", "slow", "double", "magnet"].forEach(k => {
      if (
        this.activeEffects[k] &&
        this.activeEffects[k] <= now
      ) {
        delete this.activeEffects[k];
      }
    });
    // update powerup HUD every frame
    if (this.onPowerupChange) {
      this.onPowerupChange(
        this.getActiveEffectsList()
      );
    }

    this.speedMult = this.activeEffects.slow ? 0.5 : 1;

    // physics
    const gravity = this.diff.gravity * this.bird.gravityMult;
    this.birdV += gravity;
    this.birdY += this.birdV;
    this.rotation = Math.max(-0.5, Math.min(1.1, this.birdV / 14));

    // ground / ceiling collision
    const groundY = this.H - 60;

    if (this.birdY + this.birdR > groundY) {

      // shield active -> bounce upward
      if (
        this.activeEffects.shield &&
        this.activeEffects.shield > Date.now()
      ) {
        this.birdY = groundY - this.birdR;
        this.birdV = -11;      // bounce effect
      }
      else {
        this.birdY = groundY - this.birdR;
        this.hitSomething();
      }
    }

    if (this.birdY - this.birdR < 0) {
      this.birdY = this.birdR;
      this.birdV = 0;
    }

    // spawn pipes
    if (this.frame % this.diff.spawnEvery === 0) this.spawnPipe();

    // move pipes (speed increases every 10 score)
    const baseSpeed = this.diff.speed;
    const bonusSpeed = Math.min(Math.floor(this.score / 10) * 0.2, 1.2);
    const speed = (baseSpeed + bonusSpeed) * this.speedMult;

    this.pipes.forEach(p => (p.x -= speed));
    this.pipes = this.pipes.filter(p => p.x > -100);

    // move coins / powerups (with pipes)
    this.coins.forEach(c => (c.x -= speed));
    this.coins = this.coins.filter(c => c.x > -50 && !c.collected);
    this.powerupItems.forEach(p => (p.x -= speed));
    this.powerupItems = this.powerupItems.filter(p => p.x > -50 && !p.collected);

    // magnet effect: pull nearby coins toward bird
    if (this.activeEffects.magnet) {
      const range = 160;
      this.coins.forEach(c => {
        const dx = this.birdX - c.x, dy = this.birdY - c.y;
        const dist = Math.hypot(dx, dy);
        if (dist < range) {
          c.x += dx * 0.18;
          c.y += dy * 0.18;
        }
      });
    }

    // collisions with pipes
    for (const p of this.pipes) {
      const bx = this.birdX, by = this.birdY, r = this.birdR * 0.75;
      const inX = bx + r > p.x && bx - r < p.x + p.w;
      if (inX) {
        const inGapTop = by - r > p.gapY;
        const inGapBottom = by + r < p.gapY + p.gap;
        if (!(inGapTop && inGapBottom)) {

          // shield active -> pass through
          if (
            this.activeEffects.shield &&
            this.activeEffects.shield > Date.now()
          ) {
            continue;
          }

          this.hitSomething();
        }
      }
      if (!p.passed && p.x + p.w < this.birdX) {
        p.passed = true;
        this.addScore(1);
      }
    }

    // coin collection
    this.coins.forEach(c => {
      if (c.collected) return;
      const dist = Math.hypot(this.birdX - c.x, this.birdY - c.y);
      if (dist < this.birdR + c.r) {
        c.collected = true;
        this.coinsCollected++;
        AudioFX.coin();
        if (this.onCoinChange) this.onCoinChange(this.coinsCollected);
      }
    });

    // powerup collection
    this.powerupItems.forEach(p => {
      if (p.collected) return;
      const dist = Math.hypot(this.birdX - p.x, this.birdY - p.y);
      if (dist < this.birdR + p.r) {
        p.collected = true;
        this.activatePowerup(p.type);
      }
    });

    this.groundOffset = (this.groundOffset - speed) % 40;
  }

  addScore(n) {
    const mult = this.activeEffects.double ? 2 : 1;
    this.score += n * mult;
    AudioFX.score();
    if (this.onScoreChange) this.onScoreChange(this.score);
  }

  hitSomething() {
    if (this.state !== "playing") return;
    if (
      this.activeEffects.shield &&
      this.activeEffects.shield > now
    ) {
      list.push({
        type: "shield",
        remaining:
          this.activeEffects.shield - now
      });
    }
    this.state = "gameover";
    AudioFX.collision();
    const playTimeMs = Date.now() - this.startTime;
    if (this.onGameOver) this.onGameOver({ score: this.score, coinsCollected: this.coinsCollected, playTimeMs });
  }

  // -- RENDER --
  render() {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    const t = this.theme;

    // sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, t.skyTop);
    grad.addColorStop(1, t.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    this.renderAmbient();

    // pipes
    this.pipes.forEach(p => this.renderPipe(p));

    // coins
    this.coins.forEach(c => {
      c.bob += 0.08;
      const y = c.y + Math.sin(c.bob) * 3;
      ctx.save();
      ctx.translate(c.x, y);
      ctx.fillStyle = "#F1C40F";
      ctx.strokeStyle = "#B8860B";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, c.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#B8860B";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("$", 0, 1);
      ctx.restore();
    });

    // powerups
    this.powerupItems.forEach(p => {
      p.bob += 0.06;
      const y = p.y + Math.sin(p.bob) * 4;
      const cfg = POWERUPS[p.type];
      ctx.save();
      ctx.translate(p.x, y);
      const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, p.r + 8);
      glow.addColorStop(0, cfg.color + "cc");
      glow.addColorStop(1, cfg.color + "00");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, p.r + 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = cfg.color;
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(cfg.icon, 0, 1);
      ctx.restore();
    });

    // ground
    ctx.fillStyle = t.ground;
    ctx.fillRect(0, H - 60, W, 60);
    ctx.fillStyle = t.groundDark;
    for (let x = this.groundOffset; x < W + 40; x += 40) {
      ctx.fillRect(x, H - 60, 20, 8);
    }

    // bird
    this.renderBird();

    // shield glow
    if (this.activeEffects.shield) {
      ctx.save();
      ctx.strokeStyle = "#3498DB";
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.7 + Math.sin(this.frame * 0.2) * 0.2;
      ctx.beginPath();
      ctx.arc(this.birdX, this.birdY, this.birdR + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  renderAmbient() {
    const ctx = this.ctx;
    const t = this.theme;

    if (t.ambient === "stars") {

      ctx.save();

      ctx.fillStyle =
        "rgba(255,255,210,0.9)";

      ctx.beginPath();

      ctx.arc(
        this.W - 90,
        90,
        35,
        0,
        Math.PI * 2
      );

      ctx.fill();

      // crescent cutout
      ctx.fillStyle =
        this.theme.skyTop;

      ctx.beginPath();

      ctx.arc(
        this.W - 75,
        85,
        30,
        0,
        Math.PI * 2
      );

      ctx.fill();

      ctx.restore();
    }

    this.ambientSeed.forEach(item => {

      item.phase += 0.01;

      // --- DAY THEME ---
      if (t.ambient === "clouds") {

        item.x -= item.speed;

        if (item.x < -150)
          item.x = this.W + 150;

        ctx.save();

        ctx.globalAlpha = 0.8;
        ctx.fillStyle = "#FFFFFF";

        // main cloud body
        ctx.beginPath();

        ctx.arc(
          item.x - item.s * 0.3,
          item.y,
          item.s * 0.35,
          0,
          Math.PI * 2
        );

        ctx.arc(
          item.x,
          item.y - item.s * 0.15,
          item.s * 0.45,
          0,
          Math.PI * 2
        );

        ctx.arc(
          item.x + item.s * 0.35,
          item.y,
          item.s * 0.35,
          0,
          Math.PI * 2
        );

        ctx.fill();

        ctx.restore();
      }

      // ---NIGHT THEME ---
      else if (t.ambient === "stars") {

        const tw =
          0.3 + Math.sin(item.phase) * 0.7;

        ctx.save();

        ctx.globalAlpha = tw;
        ctx.fillStyle = "#FFFFFF";

        ctx.beginPath();
        ctx.arc(
          item.x,
          item.y,
          item.s,
          0,
          Math.PI * 2
        );
        ctx.fill();

        // glow
        ctx.globalAlpha = tw * 0.15;

        ctx.beginPath();
        ctx.arc(
          item.x,
          item.y,
          item.s * 4,
          0,
          Math.PI * 2
        );
        ctx.fill();

        ctx.restore();


        // shooting star
        if (
          item.phase > 6.25 &&
          item.s > 1.8
        ) {

          ctx.save();

          // tail
          ctx.strokeStyle =
            "rgba(255,255,255,0.4)";
          ctx.lineWidth = 2;

          ctx.beginPath();

          ctx.moveTo(
            item.x + 30,
            item.y - 10
          );

          ctx.lineTo(
            item.x,
            item.y
          );

          ctx.stroke();

          // head glow
          ctx.fillStyle =
            "rgba(255,255,255,0.9)";

          ctx.beginPath();

          ctx.arc(
            item.x,
            item.y,
            2.5,
            0,
            Math.PI * 2
          );

          ctx.fill();

          // outer glow
          ctx.globalAlpha = 0.2;

          ctx.beginPath();

          ctx.arc(
            item.x,
            item.y,
            8,
            0,
            Math.PI * 2
          );

          ctx.fill();

          ctx.restore();
        }
      }

      // --- SPACE THEME ---
      else if (t.ambient === "starfield") {

        const tw =
          0.4 + Math.sin(item.phase) * 0.6;

        item.x -= item.speed * 0.3;

        if (item.x < -5)
          item.x = this.W + 5;

        ctx.save();

        const colors = [
          "#FFFFFF",
          "#B0E0FF",
          "#FFE4B5",
          "#FFD700",
          "#DDA0DD"
        ];

        ctx.fillStyle =
          colors[
          Math.floor(
            (item.phase * 100)
            %
            colors.length
          )
          ];

        ctx.globalAlpha = tw;

        // star
        ctx.beginPath();
        ctx.arc(
          item.x,
          item.y,
          item.s,
          0,
          Math.PI * 2
        );
        ctx.fill();

        // glow
        ctx.globalAlpha =
          tw * 0.2;

        ctx.beginPath();
        ctx.arc(
          item.x,
          item.y,
          item.s * 4,
          0,
          Math.PI * 2
        );
        ctx.fill();

        ctx.restore();

        // cross star
        if (item.s > 2) {

          ctx.save();

          ctx.strokeStyle =
            "rgba(255,255,255,0.4)";

          ctx.lineWidth = 1;

          ctx.beginPath();

          ctx.moveTo(
            item.x - item.s * 3,
            item.y
          );

          ctx.lineTo(
            item.x + item.s * 3,
            item.y
          );

          ctx.moveTo(
            item.x,
            item.y - item.s * 3
          );

          ctx.lineTo(
            item.x,
            item.y + item.s * 3
          );

          ctx.stroke();

          ctx.restore();
        }

        // nebula
        ctx.save();

        const nebula =
          ctx.createRadialGradient(
            this.W * 0.7,
            this.H * 0.25,
            0,
            this.W * 0.7,
            this.H * 0.25,
            250
          );

        nebula.addColorStop(
          0,
          "rgba(180,100,255,0.12)"
        );

        nebula.addColorStop(
          1,
          "rgba(180,100,255,0)"
        );

        ctx.fillStyle =
          nebula;

        ctx.fillRect(
          0,
          0,
          this.W,
          this.H
        );

        ctx.restore();
      }

      // --- UNDERWATER THEME ---
      else if (t.ambient === "bubbles") {

        item.y -= item.speed;

        if (item.y < -20)
          item.y = this.H + 20;

        // bubble
        ctx.save();

        ctx.strokeStyle =
          "rgba(255,255,255,0.5)";

        ctx.lineWidth = 1.5;

        ctx.beginPath();

        ctx.arc(
          item.x,
          item.y,
          item.s,
          0,
          Math.PI * 2
        );

        ctx.stroke();

        ctx.restore();

        // fish
        if (item.s > 8) {

          ctx.save();

          ctx.fillStyle =
            "rgba(255,180,50,0.6)";

          ctx.beginPath();

          ctx.ellipse(
            item.x,
            item.y + 30,
            10,
            5,
            0,
            0,
            Math.PI * 2
          );

          ctx.fill();

          ctx.beginPath();

          ctx.moveTo(
            item.x - 10,
            item.y + 30
          );

          ctx.lineTo(
            item.x - 18,
            item.y + 24
          );

          ctx.lineTo(
            item.x - 18,
            item.y + 36
          );

          ctx.closePath();

          ctx.fill();

          ctx.restore();
        }
      }
    });
  }

  renderPipe(p) {
    const ctx = this.ctx;
    const t = this.theme;
    const capH = 26;
    // top pipe
    ctx.fillStyle = t.pipe;
    ctx.fillRect(p.x, 0, p.w, p.gapY);
    ctx.fillStyle = t.pipeDark;
    ctx.fillRect(p.x - 4, p.gapY - capH, p.w + 8, capH);
    // bottom pipe
    const bottomY = p.gapY + p.gap;
    ctx.fillStyle = t.pipe;
    ctx.fillRect(p.x, bottomY, p.w, this.H - bottomY - 60);
    ctx.fillStyle = t.pipeDark;
    ctx.fillRect(p.x - 4, bottomY, p.w + 8, capH);
  }

  renderBird() {
    const ctx = this.ctx;
    const b = this.bird;

    ctx.save();
    ctx.translate(this.birdX, this.birdY);
    ctx.rotate(this.rotation);

    const wingFlap = Math.sin(this.frame * 0.35) * 6;

    // Dragon fire trail
    if (this.birdId === "dragon" && this.state === "playing") {

      const fire = 18 + Math.sin(this.frame * 0.6) * 5;

      ctx.save();

      ctx.fillStyle = "#E74C3C";
      ctx.beginPath();
      ctx.moveTo(-this.birdR, 0);
      ctx.lineTo(-this.birdR - fire, -8);
      ctx.lineTo(-this.birdR - fire - 8, 0);
      ctx.lineTo(-this.birdR - fire, 8);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#F39C12";
      ctx.beginPath();
      ctx.moveTo(-this.birdR, 0);
      ctx.lineTo(-this.birdR - fire * 0.7, -5);
      ctx.lineTo(-this.birdR - fire * 0.7 - 5, 0);
      ctx.lineTo(-this.birdR - fire * 0.7, 5);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#F1C40F";
      ctx.beginPath();
      ctx.moveTo(-this.birdR, 0);
      ctx.lineTo(-this.birdR - fire * 0.4, -2);
      ctx.lineTo(-this.birdR - fire * 0.4 - 3, 0);
      ctx.lineTo(-this.birdR - fire * 0.4, 2);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }


    // --------- SPARROW
    if (this.birdId === "sparrow") {

      // body
      ctx.fillStyle = b.body;
      ctx.beginPath();
      ctx.ellipse(0, 0, this.birdR, this.birdR * 0.78, 0, 0, Math.PI * 2);
      ctx.fill();

      // belly
      ctx.fillStyle = b.belly;
      ctx.beginPath();
      ctx.ellipse(2, 4, this.birdR * 0.62, this.birdR * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();

      // wing
      ctx.fillStyle = b.belly;
      ctx.beginPath();
      ctx.ellipse(
        -2,
        2 + wingFlap * 0.3,
        this.birdR * 0.5,
        this.birdR * 0.3,
        -0.3,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }


    // ---------PARROT
    else if (this.birdId === "parrot") {

      // long body
      ctx.fillStyle = b.body;
      ctx.beginPath();
      ctx.ellipse(
        0,
        0,
        this.birdR * 1.15,
        this.birdR * 0.90,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // belly
      ctx.fillStyle = b.belly;
      ctx.beginPath();
      ctx.ellipse(
        4,
        3,
        this.birdR * 0.75,
        this.birdR * 0.35,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // wing
      ctx.fillStyle = "#1E8449";
      ctx.beginPath();
      ctx.ellipse(
        -2,
        2 + wingFlap * 0.3,
        this.birdR * 0.65,
        this.birdR * 0.35,
        -0.4,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // tail
      ctx.fillStyle = "#145A32";
      ctx.beginPath();
      ctx.moveTo(-this.birdR * 1.3, 0);
      ctx.lineTo(-this.birdR * 2.0, -5);
      ctx.lineTo(-this.birdR * 2.0, 5);
      ctx.closePath();
      ctx.fill();
    }


    // -----------EAGLE
    else if (this.birdId === "eagle") {

      // thick body
      ctx.fillStyle = "#4B3621";
      ctx.beginPath();
      ctx.ellipse(
        0,
        0,
        this.birdR * 1.2,
        this.birdR * 0.95,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // chest
      ctx.fillStyle = "#D7CCC8";
      ctx.beginPath();
      ctx.ellipse(
        3,
        4,
        this.birdR * 0.6,
        this.birdR * 0.45,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // wing
      ctx.fillStyle = "#222";
      ctx.beginPath();
      ctx.ellipse(
        -3,
        2 + wingFlap * 0.2,
        this.birdR * 0.75,
        this.birdR * 0.35,
        -0.4,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // crest
      ctx.fillStyle = "#222";
      ctx.beginPath();
      ctx.moveTo(-4, -10);
      ctx.lineTo(0, -18);
      ctx.lineTo(4, -10);
      ctx.closePath();
      ctx.fill();
    }


    // ---------------DRAGON
    else if (this.birdId === "dragon") {

      // body
      ctx.fillStyle = "#C0392B";
      ctx.beginPath();
      ctx.ellipse(
        0,
        0,
        this.birdR * 1.20,
        this.birdR * 0.90,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // wing
      ctx.fillStyle = "#922B21";
      ctx.beginPath();
      ctx.moveTo(-3, 0);
      ctx.lineTo(-12, -8);
      ctx.lineTo(-7, 6);
      ctx.closePath();
      ctx.fill();

      // horns
      ctx.fillStyle = "#F39C12";
      ctx.beginPath();
      ctx.moveTo(-6, -8);
      ctx.lineTo(-2, -18);
      ctx.lineTo(2, -8);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(4, -8);
      ctx.lineTo(8, -18);
      ctx.lineTo(12, -8);
      ctx.closePath();
      ctx.fill();

      // tail
      ctx.fillStyle = "#8E2B23";
      ctx.beginPath();
      ctx.moveTo(-this.birdR * 1.2, 0);
      ctx.lineTo(-this.birdR * 1.8, -5);
      ctx.lineTo(-this.birdR * 1.8, 5);
      ctx.closePath();
      ctx.fill();
    }

    // eye
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(this.birdR * 0.4, -this.birdR * 0.25, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.arc(this.birdR * 0.5, -this.birdR * 0.25, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // beak
    ctx.fillStyle = "#F39C12";
    ctx.beginPath();
    ctx.moveTo(this.birdR * 0.85, 0);
    ctx.lineTo(this.birdR * 1.45, -2);
    ctx.lineTo(this.birdR * 0.85, 6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}