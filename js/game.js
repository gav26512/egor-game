// Стрекоза — раннер для Егора. Один файл, без сборки и зависимостей.
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const ui = {
    score: $('score'), best: $('best'), lives: $('lives'), coins: $('coin-count'), mute: $('mute'),
    level: $('level'), progress: $('progress-fill'),
    start: $('start'), over: $('over'), pause: $('pause'), done: $('done'),
    startLevel: $('start-level'), resetLevel: $('reset-level'),
    finalScore: $('final-score'), finalBest: $('final-best'), overLevel: $('over-level'),
    finalCoins: $('final-coins'), totalCoins: $('total-coins'), record: $('record'),
    doneTitle: $('done-title'), doneText: $('done-text'), doneBtn: $('done-btn'),
  };

  // Логические пиксели и секунды; общая сложность настраивается здесь, по уровням — в levelCfg.
  const CFG = {
    speedGain: 6, speedMax: 640,
    gravity: 2300, jumpVel: -880,
    jumpCut: -400,              // потолок скорости вверх после отпускания: короткий тап — низкий прыжок
    hoverHeight: 52,            // высота полёта над травой в покое
    levels: 10,
    lives: 3, livesMax: 5,
    hurtTime: 1.5,              // неуязвимость после удара, с
    goldCoins: 5, heartCoins: 10,
    scorePerPx: 1 / 25,
    restartDelay: 500,
  };
  // С каждым уровнем быстрее, теснее и больше чёрных облачков.
  function levelCfg(n) {
    const k = (n - 1) / (CFG.levels - 1);
    return {
      slots: 12 + 2 * n,                    // сколько препятствий и призов до финиша
      speedStart: 270 + 15 * (n - 1),
      gapMin: 1.0 - 0.4 * k,                // пауза между слотами в секундах пути
      gapMax: 1.8 - 0.8 * k,
      doubleChance: n >= 3 ? 0.25 : 0,      // два рогоза подряд
      weights: [
        { kind: 'ground', weight: 11 },
        { kind: 'combo', weight: n },       // препятствие с чёрным облачком над ним
        { kind: 'dark', weight: 2 + Math.floor(n / 2) },
        { kind: 'gold', weight: 5 },
        { kind: 'heart', weight: 2 },
      ],
    };
  }
  const GROUND = [
    { type: 'reed', w: 26, hMin: 90, hMax: 115, weight: 3 },
    { type: 'bush', w: 60, hMin: 60, hMax: 80, weight: 2 },
    { type: 'stone', w: 46, hMin: 50, hMax: 62, weight: 2 },
  ];
  const BEST_KEY = 'egor-game.best';
  const COINS_KEY = 'egor-game.coins';
  const LEVEL_KEY = 'egor-game.level';
  const MUTE_KEY = 'egor-game.mute';

  let W = 0, H = 0, groundY = 0;
  let state = 'ready';                 // ready | playing | paused | over | done
  let hero, obstacles, pickups, pops, clouds, finish;
  let level = 1, lvl, slotsLeft;
  let speed, distance, score, nextSpawn, lives, coins, banked, hurt;
  let best = 0, totalCoins = 0, muted = false;
  let clock = 0, lastTs = null, overAt = 0, flash = 0;

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const restY = () => groundY - CFG.hoverHeight;
  const hits = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const heroBox = () => ({ x: hero.x - hero.w / 2, y: hero.y - hero.h / 2, w: hero.w, h: hero.h });
  // Воздушные объекты хранят dy — высоту над точкой покоя; качание — только в рисовании.
  const airY = (e) => restY() - e.dy;
  const pickupBox = (p) => ({ x: p.x, y: airY(p) - p.h / 2, w: p.w, h: p.h });
  const obstacleBox = (o) => (o.dy !== undefined
    ? { x: o.x + 4, y: airY(o) - o.h / 2 + 4, w: o.w - 8, h: o.h - 8 }
    : { x: o.x + 4, y: groundY - o.h + 4, w: o.w - 8, h: o.h });

  function pick(list) {
    let r = Math.random() * list.reduce((s, o) => s + o.weight, 0);
    for (const o of list) { r -= o.weight; if (r <= 0) return o; }
    return list[list.length - 1];
  }

  // ---------- хранилище ----------
  function load(key, def) {
    try { const v = localStorage.getItem(key); return v === null ? def : v; } catch (e) { return def; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, String(val)); } catch (e) { /* приватный режим */ }
  }

  // ---------- звук: короткие бипы на Web Audio, без файлов ----------
  const sfx = (() => {
    let ac = null;
    function unlock() {
      if (!ac) {
        try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
      }
      if (ac.state === 'suspended') ac.resume();
    }
    function tone(freq, dur, type, vol, slideTo) {
      if (!ac || muted) return;
      const t = ac.currentTime;
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(ac.destination);
      o.start(t);
      o.stop(t + dur);
    }
    return {
      unlock,
      jump: () => tone(520, 0.12, 'square', 0.05, 900),
      coin: () => tone(1200, 0.09, 'square', 0.05, 1800),
      heart: () => { tone(700, 0.1, 'triangle', 0.08); setTimeout(() => tone(1050, 0.18, 'triangle', 0.08), 100); },
      hit: () => tone(160, 0.25, 'square', 0.08, 80),
      crash: () => tone(220, 0.4, 'sawtooth', 0.09, 50),
      fanfare: () => [660, 880, 1100].forEach((f, i) => setTimeout(() => tone(f, 0.15, 'triangle', 0.09), i * 110)),
    };
  })();

  // ---------- размер ----------
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    groundY = Math.round(H * 0.72);
    if (hero) {
      hero.x = Math.round(W * 0.22);
      if (hero.onGround) hero.y = restY();
    }
  }

  // ---------- состояния ----------
  // Новый забег: очки, монеты и жизни с нуля, уровень — текущий.
  function reset() {
    score = 0; coins = 0; banked = 0; lives = CFG.lives; distance = 0;
    startLevel();
  }
  function startLevel() {
    lvl = levelCfg(level);
    hero = { x: Math.round(W * 0.22), y: restY(), vy: 0, onGround: true, w: 44, h: 16 }; // хитбокс — только тело
    obstacles = []; pickups = []; pops = []; finish = null;
    speed = lvl.speedStart;
    slotsLeft = lvl.slots;
    hurt = 0; flash = 0;
    nextSpawn = distance + lvl.gapMax * speed;
    if (!clouds) clouds = Array.from({ length: 5 }, (_, i) => makeCloud(i * W / 5 + rand(0, 80)));
  }

  function makeCloud(x) {
    const s = rand(0.7, 1.4);
    return { x, y: rand(30, H * 0.3), s, w: 90 * s, par: 0.1 + 0.1 * s };
  }

  function play() {
    state = 'playing';
    lastTs = null;
    showOverlay(null);
    updateHud();
  }
  function startGame() { reset(); play(); }
  function pause() { state = 'paused'; showOverlay(ui.pause); }
  function resume() { state = 'playing'; lastTs = null; showOverlay(null); }

  function nextLevel() {
    if (level >= CFG.levels) { level = 1; save(LEVEL_KEY, level); startGame(); return; }
    level++;
    save(LEVEL_KEY, level);
    startLevel();
    play();
  }

  // Монеты уходят в копилку после каждого уровня и при проигрыше, без двойного счёта.
  function bank() {
    totalCoins += coins - banked;
    banked = coins;
    save(COINS_KEY, totalCoins);
  }
  function finishRun() {
    bank();
    const isRecord = score > best;
    if (isRecord) { best = score; save(BEST_KEY, best); }
    return isRecord;
  }

  function levelComplete() {
    state = 'done';
    overAt = performance.now();
    if (level >= CFG.levels) {
      finishRun();
      ui.doneTitle.textContent = 'Победа!';
      ui.doneText.textContent = `Все ${CFG.levels} уровней пройдены! Очки: ${score}`;
      ui.doneBtn.textContent = 'Сначала';
    } else {
      bank();
      ui.doneTitle.textContent = `Уровень ${level} пройден!`;
      ui.doneText.textContent = `Монеты: ${coins}`;
      ui.doneBtn.textContent = 'Дальше';
    }
    if (navigator.vibrate) navigator.vibrate([40, 40, 40]);
    sfx.fanfare();
    showOverlay(ui.done);
  }

  function gameOver() {
    state = 'over';
    overAt = performance.now();
    flash = 1;
    const isRecord = finishRun();
    if (navigator.vibrate) navigator.vibrate(isRecord ? [60, 40, 60] : 80);
    sfx.crash();
    if (isRecord) setTimeout(sfx.fanfare, 350);
    ui.finalScore.textContent = score;
    ui.finalBest.textContent = best;
    ui.finalCoins.textContent = coins;
    ui.totalCoins.textContent = totalCoins;
    ui.overLevel.textContent = 'Уровень ' + level;
    ui.record.classList.toggle('hidden', !isRecord);
    showOverlay(ui.over);
    updateHud();
  }

  function showOverlay(el) {
    for (const o of [ui.start, ui.over, ui.pause, ui.done]) o.classList.toggle('hidden', o !== el);
  }
  function updateHud() {
    ui.score.textContent = score;
    ui.best.textContent = 'Рекорд ' + best;
    ui.lives.innerHTML = '♥'.repeat(lives) + '<span class="lost">' + '♥'.repeat(CFG.livesMax - lives) + '</span>';
    ui.coins.textContent = coins;
    ui.level.textContent = 'Уровень ' + level;
    updateProgress();
  }
  function updateProgress() {
    ui.progress.style.width = Math.round((lvl.slots - slotsLeft) / lvl.slots * 100) + '%';
  }
  function updateStartLabel() {
    ui.startLevel.textContent = 'Уровень ' + level;
    ui.resetLevel.classList.toggle('hidden', level <= 1);
  }

  // ---------- игровая логика ----------
  // force — для проверки: 'gold', 'heart', 'dark', 'combo' или имя наземного препятствия.
  function spawnSlot(force) {
    const x = W + 40;
    let extra = 0;
    const slot = force ? (['gold', 'heart', 'dark', 'combo'].includes(force) ? force : 'ground') : pick(lvl.weights).kind;
    if (slot === 'gold') {
      pickups.push({ type: 'gold', x, w: 60, h: 34, dy: rand(0, 130), phase: rand(0, 6.28) });
    } else if (slot === 'heart') {
      pickups.push({ type: 'heart', x, w: 30, h: 28, dy: rand(90, 140), phase: rand(0, 6.28) });
    } else if (slot === 'dark') { // висит выше стрекозы: под ним нельзя прыгать
      obstacles.push(makeDark(x, rand(85, 130)));
    } else {
      const kind = (force && GROUND.find((g) => g.type === force)) || pick(GROUND);
      const o = makeObstacle(kind, x);
      obstacles.push(o);
      if (slot === 'combo') { // облачко над препятствием: пройти можно только коротким прыжком
        obstacles.push(makeDark(x + o.w / 2 - 30, Math.max(145, o.h + 60)));
      } else if (kind.type === 'reed' && Math.random() < lvl.doubleChance) {
        extra = kind.w + 34;
        obstacles.push(makeObstacle(kind, x + extra));
      }
    }
    slotsLeft--;
    updateProgress();
    nextSpawn = distance + extra + speed * (slotsLeft > 0 ? rand(lvl.gapMin, lvl.gapMax) : 1.6);
  }
  function makeObstacle(kind, x) {
    return { type: kind.type, x, w: kind.w, h: Math.round(rand(kind.hMin, kind.hMax)) };
  }
  function makeDark(x, dy) {
    return { type: 'dark', x, w: 60, h: 34, dy, phase: rand(0, 6.28) };
  }

  function jump() {
    if (!hero.onGround) return;
    hero.onGround = false;
    hero.vy = CFG.jumpVel;
    sfx.jump();
  }
  function release() {
    sfx.unlock(); // на тачскринах жест засчитывается по отпусканию, без этого звук молчит
    if (state === 'playing' && !hero.onGround && hero.vy < CFG.jumpCut) hero.vy = CFG.jumpCut;
  }

  function pop(x, y, text, color) { pops.push({ x, y, text, color, t: 0 }); }

  function collect(p) {
    const cx = p.x + p.w / 2, top = airY(p) - p.h / 2;
    if (p.type === 'gold') {
      coins += CFG.goldCoins;
      pop(cx, top, '+' + CFG.goldCoins, '#ffd94d');
      sfx.coin();
    } else if (lives < CFG.livesMax) {
      lives++;
      pop(cx, top, '+♥', '#ff4d6d');
      sfx.heart();
    } else { // жизни полные — сердечко превращается в монетки
      coins += CFG.heartCoins;
      pop(cx, top, '+' + CFG.heartCoins, '#ffd94d');
      sfx.coin();
    }
    updateHud();
  }

  function loseLife() {
    lives--;
    updateHud();
    if (lives <= 0) { gameOver(); return; }
    hurt = CFG.hurtTime;
    flash = 0.6;
    if (navigator.vibrate) navigator.vibrate(60);
    sfx.hit();
  }

  function update(dt) {
    if (hurt > 0) hurt -= dt;
    speed = Math.min(CFG.speedMax, speed + CFG.speedGain * dt);
    const dx = speed * dt;
    distance += dx;
    const s = Math.floor(distance * CFG.scorePerPx);
    if (s !== score) { score = s; ui.score.textContent = score; }

    if (!hero.onGround) {
      hero.vy += CFG.gravity * dt;
      hero.y += hero.vy * dt;
      if (hero.y >= restY()) { hero.y = restY(); hero.vy = 0; hero.onGround = true; }
    }

    for (const o of obstacles) o.x -= dx;
    for (const p of pickups) p.x -= dx;
    while (obstacles.length && obstacles[0].x + obstacles[0].w < -20) obstacles.shift();
    while (pickups.length && pickups[0].x + pickups[0].w < -20) pickups.shift();
    if (distance >= nextSpawn) {
      if (slotsLeft > 0) spawnSlot();
      else if (!finish) { finish = { x: W + 40 }; nextSpawn = Infinity; }
    }
    if (finish) {
      finish.x -= dx;
      if (finish.x < hero.x - 10) { levelComplete(); return; }
    }

    for (const c of clouds) {
      c.x -= dx * c.par;
      if (c.x + c.w < 0) { c.x = W + rand(20, 160); c.y = rand(30, H * 0.3); }
    }
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i];
      p.t += dt;
      p.y -= 50 * dt;
      if (p.t > 0.9) pops.splice(i, 1);
    }

    const hb = heroBox();
    for (let i = pickups.length - 1; i >= 0; i--) {
      if (hits(hb, pickupBox(pickups[i]))) collect(pickups.splice(i, 1)[0]);
    }
    // У препятствий срезаны 4px по краям; после удара полторы секунды неуязвимости.
    if (hurt <= 0) {
      for (const o of obstacles) {
        if (hits(hb, obstacleBox(o))) { loseLife(); break; }
      }
    }
  }

  // ---------- ввод ----------
  function press(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.cancelable) e.preventDefault();
    sfx.unlock();
    if (state === 'ready') startGame();
    else if (state === 'playing') jump();
    else if (state === 'paused') resume();
    else if (performance.now() - overAt > CFG.restartDelay) {
      if (state === 'over') startGame();
      else if (state === 'done') nextLevel();
    }
  }

  window.addEventListener('pointerdown', press);
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  window.addEventListener('keydown', (e) => {
    if ((e.code === 'Space' || e.code === 'ArrowUp') && !e.repeat) press(e);
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') release();
  });
  for (const b of [ui.mute, ui.resetLevel]) b.addEventListener('pointerdown', (e) => e.stopPropagation());
  ui.mute.addEventListener('click', () => {
    muted = !muted;
    save(MUTE_KEY, muted ? 1 : 0);
    ui.mute.textContent = muted ? '🔇' : '🔊';
  });
  ui.resetLevel.addEventListener('click', () => {
    level = 1;
    save(LEVEL_KEY, level);
    reset();
    updateHud();
    updateStartLabel();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'playing') pause();
  });
  for (const ev of ['touchmove', 'gesturestart', 'contextmenu']) {
    document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  }
  window.addEventListener('resize', resize);

  // ---------- рисование ----------
  function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  function line(x0, y0, x1, y1) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
  function curve(x0, y0, cx, cy, x1, y1) {
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x1, y1); ctx.stroke();
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.fill();
  }
  function cloud(x, y, s) {
    ctx.beginPath();
    ctx.arc(x + 20 * s, y, 16 * s, 0, Math.PI * 2);
    ctx.arc(x + 42 * s, y - 10 * s, 22 * s, 0, Math.PI * 2);
    ctx.arc(x + 66 * s, y, 17 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  // Облачко-персонаж по центру; тень рисуется тем же контуром со сдвигом вниз.
  function puff(cx, cy, s) {
    ctx.beginPath();
    ctx.arc(cx - 22 * s, cy + 2 * s, 14 * s, 0, Math.PI * 2);
    ctx.arc(cx, cy - 8 * s, 20 * s, 0, Math.PI * 2);
    ctx.arc(cx + 22 * s, cy + 2 * s, 15 * s, 0, Math.PI * 2);
    ctx.arc(cx, cy + 6 * s, 16 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  function face(cx, cy, angry) {
    const ink = angry ? '#fff' : '#333';
    ctx.fillStyle = ink;
    circle(cx - 8, cy - 3, 2.6);
    circle(cx + 8, cy - 3, 2.6);
    if (angry) {
      ctx.fillStyle = '#111';
      circle(cx - 7.5, cy - 2.5, 1.3);
      circle(cx + 8.5, cy - 2.5, 1.3);
    }
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (angry) {
      ctx.arc(cx, cy + 10, 5, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.stroke();
      line(cx - 13, cy - 11, cx - 5, cy - 7);
      line(cx + 13, cy - 11, cx + 5, cy - 7);
    } else {
      ctx.arc(cx, cy + 3, 5, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  }
  function heart(x, y, s) {
    ctx.fillStyle = '#ff4d6d';
    ctx.beginPath();
    ctx.arc(x - s / 4, y - s / 8, s / 4, Math.PI, 0);
    ctx.arc(x + s / 4, y - s / 8, s / 4, Math.PI, 0);
    ctx.lineTo(x, y + s / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    circle(x - s / 4 - 1, y - s / 4, s / 10);
  }

  function render() {
    const sky = ctx.createLinearGradient(0, 0, 0, groundY);
    sky.addColorStop(0, '#5fb8ff');
    sky.addColorStop(1, '#c9ecff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, groundY + 1);

    ctx.fillStyle = '#ffd94d';
    circle(W - 120, 84, 34);

    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    for (const c of clouds) cloud(c.x, c.y, c.s);

    // Холмы идут с параллаксом 0.3, трава и цветы — со скоростью мира.
    ctx.fillStyle = '#8fd48f';
    const hp = 260, ho = -(distance * 0.3 % hp);
    for (let x = ho - hp; x < W + hp; x += hp) {
      ctx.beginPath();
      ctx.ellipse(x + hp / 2, groundY + 6, 170, 56, 0, Math.PI, 0);
      ctx.fill();
    }

    ctx.fillStyle = '#4aa54a';
    ctx.fillRect(0, groundY, W, H - groundY);
    ctx.fillStyle = '#6cc36c';
    ctx.fillRect(0, groundY, W, 6);

    ctx.strokeStyle = '#2f7d2f';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    const tp = 44, to = -(distance % tp);
    for (let x = to; x < W + tp; x += tp) {
      line(x, groundY + 4, x - 4, groundY - 8);
      line(x + 3, groundY + 4, x + 6, groundY - 7);
    }
    const fp = 150, fo = -(distance % fp);
    for (let x = fo; x < W + fp; x += fp) {
      ctx.fillStyle = '#fff';
      circle(x + 40, groundY + 28, 4);
      ctx.fillStyle = '#ffd94d';
      circle(x + 40, groundY + 28, 1.8);
    }

    if (finish) drawFinish(finish.x);
    for (const o of obstacles) drawObstacle(o);
    for (const p of pickups) drawPickup(p);
    drawHero();
    drawPops();

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,60,60,${flash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
      flash = Math.max(0, flash - 0.04);
    }
  }

  // Финиш: шест с клетчатым флагом.
  function drawFinish(x) {
    const top = groundY - 140;
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 4;
    ctx.lineCap = 'butt';
    line(x, groundY, x, top);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 6; c++) {
        ctx.fillStyle = (r + c) % 2 ? '#222' : '#fff';
        ctx.fillRect(x + 2 + c * 9, top + r * 9, 9, 9);
      }
    }
  }

  function drawObstacle(o) {
    const cx = o.x + o.w / 2, top = groundY - o.h;
    if (o.type === 'reed') {
      ctx.strokeStyle = '#3e8a3a';
      ctx.lineCap = 'round';
      ctx.lineWidth = 4;
      line(cx, groundY, cx, top + 14);
      ctx.lineWidth = 3;
      curve(cx, groundY - 10, cx - 18, groundY - 40, cx - 6, groundY - o.h * 0.55);
      curve(cx, groundY - 20, cx + 16, groundY - 50, cx + 4, groundY - o.h * 0.6);
      ctx.fillStyle = '#7a4a2a';
      roundRect(cx - 6, top, 12, 30, 6);
      ctx.lineWidth = 2;
      line(cx, top, cx, top - 8);
    } else if (o.type === 'bush') {
      ctx.fillStyle = '#2f8f3a';
      circle(cx, groundY - o.h * 0.35, o.h * 0.4);
      circle(cx - o.w * 0.28, groundY - o.h * 0.25, o.h * 0.33);
      circle(cx + o.w * 0.28, groundY - o.h * 0.25, o.h * 0.33);
      circle(cx, top + o.h * 0.3, o.h * 0.3);
      ctx.fillStyle = '#4fb85a';
      circle(cx - o.h * 0.1, top + o.h * 0.35, o.h * 0.14);
      ctx.fillStyle = '#e8443a';
      circle(cx + o.w * 0.2, groundY - o.h * 0.5, 3);
      circle(cx - o.w * 0.15, groundY - o.h * 0.7, 3);
    } else if (o.type === 'dark') {
      const cy = airY(o) + Math.sin(clock * 3 + o.phase) * 4;
      ctx.fillStyle = '#1c1c1c';
      puff(cx, cy + 3, 0.8);
      ctx.fillStyle = '#3d3d3d';
      puff(cx, cy, 0.8);
      face(cx, cy, true);
    } else {
      ctx.fillStyle = '#8d8d8d';
      ctx.beginPath();
      ctx.ellipse(cx, groundY - o.h / 2 + 4, o.w / 2, o.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#b0b0b0';
      ctx.beginPath();
      ctx.ellipse(cx - o.w * 0.15, groundY - o.h * 0.65, o.w * 0.22, o.h * 0.16, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPickup(p) {
    const cx = p.x + p.w / 2;
    if (p.type === 'gold') {
      const cy = airY(p) + Math.sin(clock * 3 + p.phase) * 4;
      ctx.fillStyle = '#d9a400';
      puff(cx, cy + 3, 0.8);
      ctx.fillStyle = '#ffd23f';
      puff(cx, cy, 0.8);
      face(cx, cy, false);
    } else {
      heart(cx, airY(p) + Math.sin(clock * 4 + p.phase) * 5, p.w);
    }
  }

  function drawPops() {
    if (!pops.length) return;
    ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,40,80,0.6)';
    for (const p of pops) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / 0.9);
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawHero() {
    const over = state === 'over';
    const tilt = over ? 0.55 : clamp(hero.vy / 2500, -0.28, 0.28);
    const bob = over || !hero.onGround ? 0 : Math.sin(clock * 6) * 3;
    ctx.save();
    if (hurt > 0 && Math.floor(clock * 10) % 2 === 1) ctx.globalAlpha = 0.35; // мигание после удара
    ctx.translate(hero.x, hero.y + bob);
    ctx.rotate(tilt);
    const flap = over ? 0.6 : Math.sin(clock * 42);
    wings(flap, -1, 0.9);
    wings(flap, 1, 0.55);
    // хвост с полосками
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#2bb3a8';
    ctx.lineWidth = 7;
    line(-4, 0, -40, 3);
    ctx.strokeStyle = '#1c7f78';
    ctx.lineWidth = 2;
    for (const tx of [-14, -22, -30]) line(tx, -3.5, tx, 3.5);
    // грудь, голова, глаз, улыбка
    ctx.fillStyle = '#2fa88f';
    ctx.beginPath();
    ctx.ellipse(2, 0, 9, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#33b8ad';
    circle(12, -1, 7);
    ctx.fillStyle = '#123d5c';
    circle(14.5, -2.5, 3.6);
    ctx.fillStyle = '#fff';
    circle(15.8, -3.8, 1.3);
    ctx.strokeStyle = '#0f5a52';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(14, 2.2, 2.4, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.restore();
  }

  // Пара крыльев: dir -1 — ближняя (вверх), 1 — дальняя (вниз); s — фаза взмаха от -1 до 1.
  function wings(s, dir, alpha) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(2, dir * 4);
    ctx.fillStyle = 'rgba(236,248,255,0.85)';
    ctx.strokeStyle = 'rgba(70,140,210,0.9)';
    ctx.lineWidth = 1.2;
    wing(45 + 28 * s, 34, 6, dir);
    wing(72 + 22 * s, 30, 5.5, dir);
    ctx.restore();
  }
  // Крыло — эллипс длиной len, растущий из точки крепления под углом deg от вертикали назад.
  function wing(deg, len, half, dir) {
    const phi = deg * Math.PI / 180, r = len / 2;
    ctx.save();
    ctx.translate(-Math.sin(phi) * r, dir * Math.cos(phi) * r);
    ctx.rotate(dir * phi);
    ctx.beginPath();
    ctx.ellipse(0, 0, half, r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // ---------- цикл ----------
  function frame(ts) {
    if (lastTs === null) lastTs = ts;
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    if (state !== 'paused') clock += dt;
    if (state === 'playing') update(dt);
    render();
    requestAnimationFrame(frame);
  }

  // ---------- запуск ----------
  best = Number(load(BEST_KEY, 0)) || 0;
  totalCoins = Number(load(COINS_KEY, 0)) || 0;
  level = clamp(Number(load(LEVEL_KEY, 1)) || 1, 1, CFG.levels);
  muted = load(MUTE_KEY, '0') === '1';
  ui.mute.textContent = muted ? '🔇' : '🔊';
  resize();
  reset();
  updateHud();
  updateStartLabel();
  showOverlay(ui.start);
  requestAnimationFrame(frame);

  // Для проверки: ?debug в адресе даёт window.__debug со спавном и состоянием.
  if (location.search.includes('debug')) {
    window.__debug = {
      // После ручного спавна случайные отключаются; dy — высота воздушного объекта над точкой покоя.
      spawn: (kind, dy) => {
        spawnSlot(kind);
        const e = kind === 'dark' ? obstacles[obstacles.length - 1] : pickups[pickups.length - 1];
        if (dy !== undefined && e && e.dy !== undefined) e.dy = dy;
        nextSpawn = Infinity;
      },
      endLevel: () => { slotsLeft = 0; nextSpawn = distance; },
      setLevel: (n) => { level = n; reset(); updateHud(); updateStartLabel(); },
      get: () => ({
        state, level, slotsLeft, lives, coins, score, hurt, restY: restY(), finish: finish && { ...finish },
        hero: { ...hero }, obstacles: obstacles.map((o) => ({ ...o })), pickups: pickups.map((p) => ({ ...p })),
      }),
    };
  }
})();
