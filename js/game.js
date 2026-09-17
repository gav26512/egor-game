// Стрекоза — раннер для Егора. Один файл, без сборки и зависимостей.
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const ui = {
    score: $('score'), best: $('best'), mute: $('mute'),
    start: $('start'), over: $('over'), pause: $('pause'),
    finalScore: $('final-score'), finalBest: $('final-best'), record: $('record'),
  };

  // Логические пиксели и секунды; сложность настраивается здесь.
  const CFG = {
    speedStart: 280, speedGain: 6, speedMax: 640,
    gravity: 2300, jumpVel: -880,
    jumpCut: -400,              // потолок скорости вверх после отпускания: короткий тап — низкий прыжок
    hoverHeight: 52,            // высота полёта над травой в покое
    gapMin: 1.0, gapMax: 1.8,   // пауза между препятствиями в секундах пути
    doublesAfter: 25, doubleChance: 0.2,
    scorePerPx: 1 / 25,
    restartDelay: 500,
  };
  const OBSTACLES = [
    { type: 'reed', w: 26, hMin: 90, hMax: 115, weight: 3 },
    { type: 'bush', w: 60, hMin: 60, hMax: 80, weight: 2 },
    { type: 'stone', w: 46, hMin: 50, hMax: 62, weight: 2 },
  ];
  const BEST_KEY = 'egor-game.best';
  const MUTE_KEY = 'egor-game.mute';

  let W = 0, H = 0, groundY = 0;
  let state = 'ready';                 // ready | playing | paused | over
  let hero, obstacles, clouds;
  let speed, distance, score, time, nextSpawn;
  let best = 0, muted = false;
  let clock = 0, lastTs = null, overAt = 0, flash = 0;

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const restY = () => groundY - CFG.hoverHeight;

  // ---------- хранилище ----------
  function load(key, def) {
    try { const v = localStorage.getItem(key); return v === null ? def : v; } catch (e) { return def; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, String(val)); } catch (e) { /* приватный режим */ }
  }

  // ---------- звук: три бипа на Web Audio, без файлов ----------
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
      crash: () => tone(220, 0.4, 'sawtooth', 0.09, 50),
      record: () => [660, 880, 1100].forEach((f, i) => setTimeout(() => tone(f, 0.15, 'triangle', 0.09), i * 110)),
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
  function reset() {
    hero = { x: Math.round(W * 0.22), y: restY(), vy: 0, onGround: true, w: 44, h: 16 }; // хитбокс — только тело
    obstacles = [];
    speed = CFG.speedStart;
    distance = 0; score = 0; time = 0; flash = 0;
    nextSpawn = CFG.gapMax * speed;
    if (!clouds) clouds = Array.from({ length: 5 }, (_, i) => makeCloud(i * W / 5 + rand(0, 80)));
  }

  function makeCloud(x) {
    const s = rand(0.7, 1.4);
    return { x, y: rand(30, H * 0.3), s, w: 90 * s, par: 0.1 + 0.1 * s };
  }

  function startGame() {
    reset();
    state = 'playing';
    lastTs = null;
    showOverlay(null);
    updateHud();
  }
  function pause() { state = 'paused'; showOverlay(ui.pause); }
  function resume() { state = 'playing'; lastTs = null; showOverlay(null); }

  function gameOver() {
    state = 'over';
    overAt = performance.now();
    flash = 1;
    const isRecord = score > best;
    if (isRecord) { best = score; save(BEST_KEY, best); }
    if (navigator.vibrate) navigator.vibrate(isRecord ? [60, 40, 60] : 80);
    sfx.crash();
    if (isRecord) setTimeout(sfx.record, 350);
    ui.finalScore.textContent = score;
    ui.finalBest.textContent = best;
    ui.record.classList.toggle('hidden', !isRecord);
    showOverlay(ui.over);
    updateHud();
  }

  function showOverlay(el) {
    for (const o of [ui.start, ui.over, ui.pause]) o.classList.toggle('hidden', o !== el);
  }
  function updateHud() {
    ui.score.textContent = score;
    ui.best.textContent = 'Рекорд ' + best;
  }

  // ---------- игровая логика ----------
  function spawnObstacle() {
    const total = OBSTACLES.reduce((s, o) => s + o.weight, 0);
    let r = Math.random() * total, kind = OBSTACLES[0];
    for (const o of OBSTACLES) { r -= o.weight; if (r <= 0) { kind = o; break; } }
    const x = W + 40;
    obstacles.push({ type: kind.type, x, w: kind.w, h: Math.round(rand(kind.hMin, kind.hMax)) });
    let extra = 0;
    if (kind.type === 'reed' && time > CFG.doublesAfter && Math.random() < CFG.doubleChance) {
      extra = kind.w + 34;
      obstacles.push({ type: 'reed', x: x + extra, w: kind.w, h: Math.round(rand(kind.hMin, kind.hMax)) });
    }
    const k = Math.min(1, time / 60); // к первой минуте паузы между препятствиями чуть короче
    nextSpawn = distance + extra + speed * rand(CFG.gapMin - 0.15 * k, CFG.gapMax - 0.4 * k);
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

  function update(dt) {
    time += dt;
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
    while (obstacles.length && obstacles[0].x + obstacles[0].w < -20) obstacles.shift();
    if (distance >= nextSpawn) spawnObstacle();

    for (const c of clouds) {
      c.x -= dx * c.par;
      if (c.x + c.w < 0) { c.x = W + rand(20, 160); c.y = rand(30, H * 0.3); }
    }

    // Столкновение: хитбокс тела меньше рисунка, у препятствия срезаны 4px по краям.
    const hx = hero.x - hero.w / 2, hb = hero.y + hero.h / 2;
    for (const o of obstacles) {
      if (hx < o.x + o.w - 4 && hx + hero.w > o.x + 4 && hb > groundY - o.h + 4) { gameOver(); return; }
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
    else if (state === 'over' && performance.now() - overAt > CFG.restartDelay) startGame();
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
  ui.mute.addEventListener('pointerdown', (e) => e.stopPropagation());
  ui.mute.addEventListener('click', () => {
    muted = !muted;
    save(MUTE_KEY, muted ? 1 : 0);
    ui.mute.textContent = muted ? '🔇' : '🔊';
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

    for (const o of obstacles) drawObstacle(o);
    drawHero();

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,60,60,${flash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
      flash = Math.max(0, flash - 0.04);
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

  function drawHero() {
    const over = state === 'over';
    const tilt = over ? 0.55 : clamp(hero.vy / 2500, -0.28, 0.28);
    const bob = over || !hero.onGround ? 0 : Math.sin(clock * 6) * 3;
    ctx.save();
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
    ctx.globalAlpha = alpha;
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
  muted = load(MUTE_KEY, '0') === '1';
  ui.mute.textContent = muted ? '🔇' : '🔊';
  resize();
  reset();
  updateHud();
  showOverlay(ui.start);
  requestAnimationFrame(frame);
})();
