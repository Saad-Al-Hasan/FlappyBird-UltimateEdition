/* main.js */

(function () {
  Storage.load();

  const canvas = document.getElementById("gameCanvas");
  const game = new Game(canvas);
  canvas.classList.add("hidden");

  document.body.className = "theme-" + Storage.data.selectedTheme;

  UI.bindNav();
  UI.showScreen("start");

  // --- wire game callbacks ---
  game.onScoreChange = (score) => UI.updateHud(game);
  game.onCoinChange = (coins) => UI.updateHud(game);
  game.onPowerupChange = (list) => UI.renderActivePowerups(list);

  game.onGameOver = (result) => {
    AudioFX.stopMusic();
    Storage.addCoins(result.coinsCollected);
    Storage.recordGame(result);

    const newAchievements = UI.checkAchievements(result);

    setTimeout(() => {
      canvas.classList.add("hidden");
      document.getElementById("hud").classList.add("hidden");
      document.getElementById("goScore").textContent = result.score;
      document.getElementById("goBest").textContent = Storage.data.stats.highScore;
      document.getElementById("goCoins").textContent = result.coinsCollected;

      const achvWrap = document.getElementById("goAchvUnlocked");
      achvWrap.innerHTML = newAchievements.length
        ? `<div class="new-achv-label">New Achievements!</div>` +
        newAchievements.map(a => `<div class="new-achv">🏆 ${a.name}</div>`).join("")
        : "";

      if (newAchievements.length) AudioFX.achievement();

      UI.showScreen("gameover");
    }, 500);
  };

  // --- start game flow ---
  document.getElementById("startGameBtn").addEventListener("click", () => {
    AudioFX.click();
    beginRun();
  });

  function beginRun() {
    game.configure(Storage.data.selectedBird, Storage.data.selectedTheme, UI.selectedDifficulty);
    document.body.className = "theme-" + Storage.data.selectedTheme;
    game.reset();
    UI.showScreen("play-active"); // no such screen, just hide all
    document.querySelectorAll(".screen").forEach(s => s.classList.add("hidden"));
    canvas.classList.remove("hidden");
    document.getElementById("hud").classList.remove("hidden");
    UI.updateHud(game);
    UI.renderActivePowerups([]);
    AudioFX.startMusic(
      Storage.data.selectedTheme
    );
    loop();
  }

  document.getElementById("retryBtn").addEventListener("click", () => {
    AudioFX.click();
    beginRun();
  });
  document.getElementById("menuBtn").addEventListener("click", () => {
    AudioFX.click();
    UI.showScreen("start");
  });

  // -- pause flow --
  document.getElementById("pauseBtn").addEventListener("click", () => {
    if (game.state !== "playing") return;
    AudioFX.click();
    game.pause();
    document.querySelectorAll(".screen").forEach(s => s.classList.add("hidden"));
    document.getElementById("screen-pause").classList.remove("hidden");
  });
  document.getElementById("resumeBtn").addEventListener("click", () => {
    AudioFX.click();
    game.resumeGame();
    document.getElementById("screen-pause").classList.add("hidden");
  });
  document.getElementById("quitBtn").addEventListener("click", () => {
    AudioFX.click();
    AudioFX.stopMusic();
    canvas.classList.add("hidden");
    document.getElementById("hud").classList.add("hidden");
    UI.showScreen("start");
  });

  // -- input --
  function handleFlap(e) {
    if (e.type === "keydown") {
      if (e.code === "KeyP") {
        if (game.state === "playing") document.getElementById("pauseBtn").click();
        else if (game.state === "paused") document.getElementById("resumeBtn").click();
        return;
      }
      if (e.code !== "Space") return;
      e.preventDefault();
    }
    if (canvas.classList.contains("hidden")) return;
    if (game.state === "paused" || game.state === "gameover") return;
    game.flap();
  }
  window.addEventListener("keydown", handleFlap);
  canvas.addEventListener("mousedown", handleFlap);
  canvas.addEventListener("touchstart", (e) => { e.preventDefault(); handleFlap(e); }, { passive: false });

  // -- main loop --
  function loop() {
    if (canvas.classList.contains("hidden")) return; // stop loop when leaving game
    game.update();
    game.render();
    if (game.state !== "gameover") {
      requestAnimationFrame(loop);
    }
  }
})();