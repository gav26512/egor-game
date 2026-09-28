import { CFG } from './config.js';
import { createControls } from './controls.js';
import { createBee } from './bee.js';
import { createEnvironment } from './world.js';
import { createCity, CITY_MODELS } from './city.js';
import { createInterior, ROOM_MODELS } from './interior.js';
import { createTraffic, TRAFFIC_MODELS } from './traffic.js';
import { createRailways, createTrains } from './trains.js';
import { createDanger } from './danger.js';
import { createBaibaks } from './baibaks.js';
import { loadProfile } from './profile.js';
import { createQuests } from './quests.js';
import { createShop, SKINS } from './shop.js';
import { createAudio } from './audio.js';
import { loadAssets } from './assets.js';
import { Needs } from './needs.js';
import { createHud } from './hud.js';

const $ = (id) => document.getElementById(id);
// Свой генератор случайных чисел, чтобы машины и птицы каждый раз стояли одинаково.
function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const canvas = $('game');

if (typeof BABYLON === 'undefined') {
  $('start').classList.add('hidden');
  $('error').classList.remove('hidden');
  throw new Error('Babylon.js не загрузился');
}

const B = BABYLON;
const engine = new B.Engine(canvas, true, { adaptToDeviceRatio: true });
const scene = new B.Scene(engine);

const loadingText = $('loading-text');
createEnvironment(scene);
const assets = await loadAssets(scene, [...new Set([...CITY_MODELS, ...ROOM_MODELS, ...TRAFFIC_MODELS])], (p) => {
  loadingText.textContent = `Загружаю город… ${Math.round(p * 100)}%`;
}).catch((err) => {
  $('loading').classList.add('hidden');
  $('error').classList.remove('hidden');
  throw err;
});
const city = createCity(scene, assets);
const interior = createInterior(scene, assets);
let world = city; // где сейчас шмель: улица или комната
let doorCooldown = 0;
const bee = createBee(scene);
const controls = createControls();
const needs = new Needs();
const hud = createHud();
const rnd = mulberry(7);
const profile = loadProfile();
const audio = createAudio(profile);
const traffic = createTraffic(scene, assets, rnd);
const trains = createTrains(scene, createRailways(scene, rnd), rnd);
const danger = createDanger(scene, bee, needs, hud, rnd, audio);
const baibaks = createBaibaks(scene, city, bee, hud, rnd, () => { addPollen(5); audio.found(); quests.check(); });
const quests = createQuests(profile, city, baibaks, hud, audio);
const shop = createShop(profile, bee, hud);
bee.setSkin(SKINS.find((s) => s.id === profile.skin) || SKINS[0]);
hud.setPollen(profile.pollen);

function addPollen(n) { profile.pollen += n; profile.save(); hud.setPollen(profile.pollen); }

// Меню: имя, задания, магазин.
const show = (id, on) => $(id).classList.toggle('hidden', !on);
$('player-name').textContent = profile.name || 'Игрок';
$('edit-name').addEventListener('click', (e) => { e.stopPropagation(); $('name-input').value = profile.name; show('profile', true); $('name-input').focus(); });
$('name-save').addEventListener('click', () => {
  profile.name = $('name-input').value.trim().slice(0, 16);
  profile.save();
  $('player-name').textContent = profile.name || 'Игрок';
  show('profile', false);
  if (state === 'menu') show('start', true);
});
$('name-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('name-save').click(); });
const openQuests = (e) => { e?.stopPropagation(); quests.render($('quest-list')); show('quests', true); };
$('quests-open').addEventListener('click', openQuests);
$('btn-quests').addEventListener('click', openQuests);
$('quests-close').addEventListener('click', () => show('quests', false));
$('shop-open').addEventListener('click', (e) => { e.stopPropagation(); shop.render(); show('shop', true); });
$('shop-close').addEventListener('click', () => show('shop', false));
for (const id of ['profile', 'quests', 'shop']) $(id).addEventListener('pointerdown', (e) => e.stopPropagation());
let gameTime = 0;
$('loading').classList.add('hidden');
$('start').classList.remove('hidden');

const camera = new B.FreeCamera('cam', new B.Vector3(0, 5, -10), scene);
camera.minZ = 0.05;
camera.maxZ = CFG.world.viewDistance;
camera.fov = 1.1;

let state = 'menu';
const start = city.hive;
bee.reset(start.clone());

// Влёт в окно: строим комнату и переносим шмеля внутрь; выход — обратно к тому же окну.
let lastWindow = null;
function enterWindow(w) {
  lastWindow = w;
  const room = interior.build(w.type, w.name);
  world = interior;
  quests.room(w.type, w.name);
  bee.reset(room.entry.clone());
  snapCamera();
  doorCooldown = 1;
  hud.flash(room.name, 1.5);
}
function leaveWindow() {
  const w = lastWindow;
  world = city;
  bee.reset(new B.Vector3(w.x + w.nx * 2, w.y, w.z + w.nz * 2));
  bee.yaw = Math.atan2(w.nx, w.nz);
  snapCamera();
  doorCooldown = 1;
}

function sourceAt(kind) {
  const src = world.sourceAt(bee.root.position, gameTime);
  return src && src.kind === kind ? src : null;
}

// Еда и вода рядом: цветок даёт нектар разом, фонтан и река — пока шмель у воды.
function feed(dt) {
  const pos = bee.root.position;
  const n = CFG.needs;
  const flower = sourceAt('food');
  if (flower && needs.food < 99) {
    needs.eat(flower.value);
    flower.until = gameTime + flower.cooldown;
    if (flower.once) { hud.flash('Ням!'); quests.eat(flower.model); }
    else { hud.flash('Ням! Нектар +1 🌼'); addPollen(1); }
    audio.eat();
  }
  const nearWater = sourceAt('water') || (world.overWater(pos.x, pos.z) && pos.y < 1.6);
  if (nearWater && needs.water < 100) { needs.drink(n.sipPerSec * dt); hud.setHint('Пью воду…'); if (Math.random() < dt * 2) audio.drink(); }
  else if (bee.landed) hud.setHint(sourceAt('rest') ? 'Отдыхаю в удобном месте, силы растут вдвое быстрее' : 'Отдыхаю…');
  else hud.setHint('');
}

// После телепорта камера сразу встаёт за шмелём, а не догоняет его.
function snapCamera() {
  const c = CFG.camera;
  camera.position.copyFrom(bee.root.position.add(new B.Vector3(-Math.sin(bee.yaw) * c.back, c.up, -Math.cos(bee.yaw) * c.back)));
}
snapCamera();

function play() {
  state = 'play';
  $('start').classList.add('hidden');
  hud.show(true);
  audio.init();
  canvas.focus();
}

// Пауза: кнопка ⏸ или Escape; из паузы можно вернуться в меню, шмель остаётся где был.
function pause() {
  if (state !== 'play') return;
  state = 'pause';
  show('pause', true);
}
function resume() {
  if (state !== 'pause') return;
  show('pause', false);
  state = 'play';
  canvas.focus();
}
$('btn-pause').addEventListener('click', pause);
$('resume-btn').addEventListener('click', resume);
$('menu-btn').addEventListener('click', () => {
  show('pause', false);
  hud.show(false);
  state = 'menu';
  show('start', true);
});
$('pause').addEventListener('pointerdown', (e) => e.stopPropagation());
addEventListener('keydown', (e) => {
  if (e.code !== 'Escape' || e.repeat) return;
  if (state === 'play') pause(); else if (state === 'pause') resume();
});
const muteBtn = $('btn-mute');
const drawMute = () => { muteBtn.textContent = audio.muted ? '🔇' : '🔊'; };
muteBtn.addEventListener('click', () => { audio.toggle(); drawMute(); });
drawMute();

// Шкала на нуле: экран сна, потом шмель просыпается в улье с полными шкалами.
const WHY = { food: 'Он проголодался.', water: 'Он захотел пить.', energy: 'Он очень устал.' };
function sleep(why) {
  state = 'sleep';
  $('sleep-why').textContent = WHY[why];
  $('sleep').classList.remove('hidden');
  setTimeout(() => {
    needs.reset();
    bee.reset(start.clone());
    snapCamera();
    $('sleep').classList.add('hidden');
    hud.flash('С добрым утром!', 2);
    state = 'play';
  }, CFG.needs.sleepSeconds * 1000);
}
$('start').addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; play(); });
addEventListener('keydown', (e) => {
  if (state !== 'menu' || e.repeat || e.target.tagName === 'INPUT') return;
  if (!['profile', 'quests', 'shop'].some((id) => !$(id).classList.contains('hidden'))) play();
});
// Первый запуск: сначала спрашиваем имя, меню показываем после.
if (!profile.name) { show('start', false); show('profile', true); $('name-input').focus(); }

// Камера висит за шмелём и плавно догоняет его.
function followCamera(dt) {
  const c = CFG.camera;
  const back = new B.Vector3(-Math.sin(bee.yaw) * c.back, c.up, -Math.cos(bee.yaw) * c.back);
  const target = bee.root.position.add(new B.Vector3(0, 0.15, 0));
  let wanted = bee.root.position.add(back);
  const wb = world.bounds;
  wanted.x = Math.min(wb.maxX, Math.max(wb.minX, wanted.x));
  wanted.z = Math.min(wb.maxZ, Math.max(wb.minZ, wanted.z));
  if (wb.maxY) wanted.y = Math.min(wb.maxY, wanted.y);
  // Камера не прячется под землю и не залезает в дома: подтягиваем её к шмелю.
  for (let i = 0; i < 6 && (world.inside(wanted) || wanted.y < world.height(wanted.x, wanted.z) + 0.25); i++) {
    wanted = B.Vector3.Lerp(target, wanted, 0.7);
  }
  const k = 1 - Math.exp(-c.lag * dt);
  camera.position = B.Vector3.Lerp(camera.position, wanted, k);
  camera.setTarget(target);
}

engine.runRenderLoop(() => {
  const dt = Math.min(engine.getDeltaTime() / 1000, 0.05);
  // В меню шмель висит на месте и машет крыльями.
  const input = state === 'play' ? controls.read() : { forward: 0, turn: 0, climb: 0, boost: false };
  input.tired = needs.tired;
  // На паузе и в меню мир стоит, только крылья шмеля двигаются.
  if (state !== 'pause') bee.update(dt, input, world);
  audio.update({ flying: !bee.landed && state === 'play', speed: bee.speed, boost: input.boost });
  if (state === 'play') {
    gameTime += dt;
    doorCooldown = Math.max(0, doorCooldown - dt);
    if (doorCooldown === 0) {
      if (world === city) { const w = city.windowAt(bee.root.position); if (w) enterWindow(w); }
      else if (interior.nearExit(bee.root.position)) leaveWindow();
    }
    feed(dt);
    needs.update(dt, { flying: !bee.landed, boost: input.boost && input.forward > 0, resting: bee.landed, atHive: bee.landed && !!sourceAt('rest') });
    const outside = world === city;
    traffic.update(dt);
    trains.update(dt);
    danger.update(dt, { outside, cars: traffic.cars, trains, person: outside ? null : interior.current?.person, roomFloor: CFG.interior.height });
    baibaks.update(dt, outside);
    hud.setNeeds(needs);
    if (needs.empty) sleep(needs.empty);
  }
  world.update(dt, gameTime);
  const here = world.placeAt(bee.root.position.x, bee.root.position.z);
  hud.setPlace(here ? here.name : '');
  if (here && world === city && state === 'play') {
    quests.visit(here.name);
    if (bee.landed && here.name === 'Башня с курантами' && bee.root.position.y > 33) quests.tower();
  }
  hud.update();
  if (state === 'menu') bee.root.position.y = start.y;
  followCamera(dt);
  scene.render();
});

addEventListener('resize', () => engine.resize());

// Для проверки руками: открой страницу с #debug и меняй game.needs в консоли.
if (location.hash === '#debug') window.game = { bee, needs, city, interior, traffic, trains, baibaks, profile, quests, shop, audio, scene, pause, resume, enterWindow, leaveWindow, where: () => world === city ? 'city' : 'room' };
