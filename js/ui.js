/* ui.js — screen navigation, menus, shop, stats, achievements */

const UI = {
  currentScreen: "start",
  selectedDifficulty: "medium",

  el(id) { return document.getElementById(id); },

  showScreen(name) {
    document.querySelectorAll(".screen").forEach(s => s.classList.add("hidden"));
    const target = this.el("screen-" + name);
    if (target) target.classList.remove("hidden");
    this.currentScreen = name;
    if (name === "birds") this.renderBirdGrid();
    if (name === "themes") this.renderThemeGrid();
    if (name === "shop") this.renderShop();
    if (name === "stats") this.renderStats();
    if (name === "achievements") this.renderAchievements();
    if (name === "start") this.el("walletCoins").textContent = Storage.data.coins;
  },

  bindNav() {
    document.querySelectorAll("[data-nav]").forEach(btn => {
      btn.addEventListener("click", () => {
        AudioFX.click();
        this.showScreen(btn.dataset.nav);
      });
    });

    document.querySelectorAll("#difficultyGrid .option-card").forEach(card => {
      card.addEventListener("click", () => {
        AudioFX.click();
        this.selectedDifficulty = card.dataset.difficulty;
        document.querySelectorAll("#difficultyGrid .option-card").forEach(c => c.classList.remove("selected"));
        card.classList.add("selected");
      });
    });
    // preselect medium
    const medCard = document.querySelector('#difficultyGrid .option-card[data-difficulty="medium"]');
    if (medCard) medCard.classList.add("selected");
  },

  renderBirdGrid() {
    const grid = this.el("birdGrid");
    grid.innerHTML = "";
    Object.entries(BIRDS).forEach(([id, bird]) => {
      const unlocked = Storage.data.unlockedBirds.includes(id);
      const selected = Storage.data.selectedBird === id;
      const card = document.createElement("button");
      card.className = "option-card bird-card" + (selected ? " selected" : "") + (!unlocked ? " locked" : "");
      card.innerHTML = `
        <div class="bird-swatch" style="background:${bird.body}"></div>
        <span class="option-title">${bird.name}</span>
        <span class="option-desc">${bird.desc}</span>
        ${unlocked ? "" : `<span class="lock-tag">🔒 ${bird.cost}c</span>`}
      `;
      card.addEventListener("click", () => {
        if (!unlocked) { AudioFX.click(); this.showScreen("shop"); return; }
        AudioFX.click();
        Storage.data.selectedBird = id;
        Storage.save();
        this.renderBirdGrid();
      });
      grid.appendChild(card);
    });
  },

  renderThemeGrid() {
    const grid = this.el("themeGrid");
    grid.innerHTML = "";
    Object.entries(THEMES).forEach(([id, theme]) => {
      const unlocked = Storage.data.unlockedThemes.includes(id);
      const selected = Storage.data.selectedTheme === id;
      const card = document.createElement("button");
      card.className = "option-card theme-card" + (selected ? " selected" : "") + (!unlocked ? " locked" : "");
      card.innerHTML = `
        <div class="theme-swatch" style="background:linear-gradient(${theme.skyTop}, ${theme.skyBottom})"></div>
        <span class="option-title">${theme.name}</span>
        ${unlocked ? "" : `<span class="lock-tag">🔒 ${theme.cost}c</span>`}
      `;
      card.addEventListener("click", () => {
        if (!unlocked) { AudioFX.click(); this.showScreen("shop"); return; }
        AudioFX.click();
        Storage.data.selectedTheme = id;
        Storage.save();
        document.body.className = "theme-" + id;
        this.renderThemeGrid();
      });
      grid.appendChild(card);
    });
  },

  renderShop() {
    this.el("shopWallet").textContent = Storage.data.coins;

    const birdGrid = this.el("shopBirdGrid");
    birdGrid.innerHTML = "";
    Object.entries(BIRDS).forEach(([id, bird]) => {
      const unlocked = Storage.data.unlockedBirds.includes(id);
      const card = document.createElement("div");
      card.className = "option-card shop-card";
      card.innerHTML = `
        <div class="bird-swatch" style="background:${bird.body}"></div>
        <span class="option-title">${bird.name}</span>
        <span class="option-desc">${bird.desc}</span>
        ${unlocked
          ? `<span class="owned-tag">✓ Owned</span>`
          : `<button class="btn btn--buy" ${Storage.data.coins < bird.cost ? "disabled" : ""}>Buy — ${bird.cost}c</button>`}
      `;
      if (!unlocked) {
        card.querySelector(".btn--buy").addEventListener("click", () => {
          if (Storage.spendCoins(bird.cost)) {
            Storage.unlockBird(id);
            AudioFX.achievement();
            this.showToast(`Unlocked ${bird.name}! 🐦`);
            this.renderShop();
            this.checkAchievements({ score: 0 });
          }
        });
      }
      birdGrid.appendChild(card);
    });

    const themeGrid = this.el("shopThemeGrid");
    themeGrid.innerHTML = "";
    Object.entries(THEMES).forEach(([id, theme]) => {
      const unlocked = Storage.data.unlockedThemes.includes(id);
      const card = document.createElement("div");
      card.className = "option-card shop-card";
      card.innerHTML = `
        <div class="theme-swatch" style="background:linear-gradient(${theme.skyTop}, ${theme.skyBottom})"></div>
        <span class="option-title">${theme.name}</span>
        ${unlocked
          ? `<span class="owned-tag">✓ Owned</span>`
          : `<button class="btn btn--buy" ${Storage.data.coins < theme.cost ? "disabled" : ""}>Buy — ${theme.cost}c</button>`}
      `;
      if (!unlocked) {
        card.querySelector(".btn--buy").addEventListener("click", () => {
          if (Storage.spendCoins(theme.cost)) {
            Storage.unlockTheme(id);
            AudioFX.achievement();
            this.showToast(`Unlocked ${theme.name} theme! 🎨`);
            this.renderShop();
            this.checkAchievements({ score: 0 });
          }
        });
      }
      themeGrid.appendChild(card);
    });
  },

  renderStats() {
    const s = Storage.data.stats;
    const avg = s.totalGames > 0 ? (s.totalScore / s.totalGames).toFixed(1) : "0.0";
    const minutes = Math.floor(s.totalPlayTimeMs / 60000);
    const seconds = Math.floor((s.totalPlayTimeMs % 60000) / 1000);
    const rows = [
      ["Highest Score", s.highScore],
      ["Total Games Played", s.totalGames],
      ["Average Score", avg],
      ["Total Coins Collected", s.totalCoinsCollected],
      ["Total Play Time", `${minutes}m ${seconds}s`]
    ];
    this.el("statsList").innerHTML = rows.map(([label, val]) =>
      `<div class="stat-row"><span>${label}</span><strong>${val}</strong></div>`
    ).join("");
  },

  renderAchievements() {
    const list = this.el("achvList");
    list.innerHTML = "";
    ACHIEVEMENTS.forEach(a => {
      const unlocked = Storage.data.unlockedAchievements.includes(a.id);
      const item = document.createElement("div");
      item.className = "achv-item" + (unlocked ? " unlocked" : "");
      item.innerHTML = `
        <div class="achv-icon">${unlocked ? "🏆" : "🔒"}</div>
        <div class="achv-text">
          <div class="achv-name">${a.name}</div>
          <div class="achv-desc">${a.desc}</div>
        </div>
      `;
      list.appendChild(item);
    });
  },

  checkAchievements(runResult) {
    const newly = [];
    ACHIEVEMENTS.forEach(a => {
      if (Storage.data.unlockedAchievements.includes(a.id)) return;
      if (a.check(runResult, Storage.data.stats, Storage.data)) {
        Storage.unlockAchievement(a.id);
        newly.push(a);
      }
    });
    return newly;
  },

  showToast(message) {
    const toast = this.el("toast");
    toast.textContent = message;
    toast.classList.remove("hidden");
    toast.classList.add("show");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.classList.add("hidden"), 300);
    }, 2400);
  },

  updateHud(game) {
    this.el("hudScore").textContent = game.score;
    this.el("hudCoinCount").textContent = game.coinsCollected;
  },

  renderActivePowerups(list) {
    const wrap = this.el("activePowerups");
    wrap.innerHTML = list.map(p => {
      const cfg = POWERUPS[p.type];
      const secs =
        p.remaining !== null
          ? Math.max(
            0,
            Math.ceil(p.remaining / 1000)
          )
          : "";
      return `<span class="pu-chip" style="border-color:${cfg.color}">${cfg.icon}${secs ? " " + secs + "s" : ""}</span>`;
    }).join("");
  }
};