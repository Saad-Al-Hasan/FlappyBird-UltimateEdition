/* storage.js — localStorage persistence */

const STORAGE_KEY = "flappyUltimate_v1";

const DEFAULT_DATA = {
  coins: 0,
  selectedBird: "sparrow",
  selectedTheme: "day",
  unlockedBirds: ["sparrow"],
  unlockedThemes: ["day"],
  unlockedAchievements: [],
  stats: {
    highScore: 0,
    totalGames: 0,
    totalScore: 0,
    totalPlayTimeMs: 0,
    totalCoinsCollected: 0
  }
};

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

const Storage = {
  data: null,

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        this.data = deepClone(DEFAULT_DATA);
        this.save();
      } else {
        const parsed = JSON.parse(raw);
        // merge with defaults so new fields don't break old saves
        this.data = Object.assign({}, deepClone(DEFAULT_DATA), parsed);
        this.data.stats = Object.assign({}, deepClone(DEFAULT_DATA.stats), parsed.stats || {});
      }
    } catch (e) {
      console.warn("Save corrupted, resetting.", e);
      this.data = deepClone(DEFAULT_DATA);
      this.save();
    }
    return this.data;
  },

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn("Could not save progress.", e);
    }
  },

  reset() {
    this.data = deepClone(DEFAULT_DATA);
    this.save();
  },

  addCoins(n) {
    this.data.coins += n;
    this.save();
  },

  spendCoins(n) {
    if (this.data.coins < n) return false;
    this.data.coins -= n;
    this.save();
    return true;
  },

  unlockBird(id) {
    if (!this.data.unlockedBirds.includes(id)) {
      this.data.unlockedBirds.push(id);
      this.save();
    }
  },

  unlockTheme(id) {
    if (!this.data.unlockedThemes.includes(id)) {
      this.data.unlockedThemes.push(id);
      this.save();
    }
  },

  unlockAchievement(id) {
    if (!this.data.unlockedAchievements.includes(id)) {
      this.data.unlockedAchievements.push(id);
      this.save();
      return true;
    }
    return false;
  },

  recordGame({ score, coinsCollected, playTimeMs }) {
    const s = this.data.stats;
    s.totalGames += 1;
    s.totalScore += score;
    s.totalPlayTimeMs += playTimeMs;
    s.totalCoinsCollected += coinsCollected;
    if (score > s.highScore) s.highScore = score;
    this.save();
  }
};