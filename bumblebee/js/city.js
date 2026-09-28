import { CFG } from './config.js';
import { buildLandmarks } from './landmarks.js';
import { ROOM_TYPES } from './interior.js';
import { box } from './prims.js';

// Модели, которые нужны городу.
export const CITY_MODELS = [
  ...'abcdefghijklmn'.split('').map((c) => 'buildings/building-' + c),
  'buildings/building-skyscraper-a', 'buildings/building-skyscraper-b', 'buildings/building-skyscraper-c',
  ...'abcdefgh'.split('').map((c) => 'houses/building-type-' + c),
  'roads/road-straight', 'roads/road-crossroad', 'roads/light-square',
  'nature/tree_default', 'nature/tree_oak', 'nature/tree_detailed', 'nature/tree_pineTallA', 'nature/plant_bush',
  'nature/flower_redA', 'nature/flower_yellowA', 'nature/flower_purpleA',
];

// Детерминированный генератор случайных чисел: город каждый раз одинаковый.
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Оренбург в игровых метрах: Советская — ось z (x = 0), Урал — на юге, сетка кварталов 50 м.
export function createCity(scene, assets) {
  const B = BABYLON;
  const G = CFG.city;
  const rnd = mulberry32(20260921);
  const solids = [];
  const places = [];
  const sources = []; // еда и вода: {kind, x, z, r, value, cooldown, until, root}
  const windows = []; // окна-входы: {x, y, z, nx, nz, type, name}
  const reserved = new Set();

  const city = {
    scene, assets, rnd, solids, places, hive: null,
    reserve: (i, j) => reserved.add(i + ',' + j),
    solid: (x, y, z, w, h, d) => solids.push({ min: { x: x - w / 2, y, z: z - d / 2 }, max: { x: x + w / 2, y: y + h, z: z + d / 2 } }),
    place: (name, x, z, r) => places.push({ name, x, z, r }),
    spawn(name, x, z, rotationY = 0, y = 0) {
      const spawned = assets.spawn(name, { position: new B.Vector3(x, y, z), rotationY });
      // Каждый цветок — нектар для шмеля.
      if (name.startsWith('nature/flower')) sources.push({ kind: 'food', x, z, y, r: 1.8, value: CFG.needs.nectar, cooldown: CFG.needs.flowerCooldown, until: 0, root: spawned.root, scale: spawned.root.scaling.y });
      return spawned;
    },
    // Фонтан (water) или улей (rest): круг радиуса r.
    source: (kind, x, z, r, y = 0) => sources.push({ kind, x, z, y, r, value: 0, cooldown: 0, until: 0 }),
    // Модель, на которую можно сесть и о которую можно удариться; window — сторона окна-входа [nx, nz].
    solidSpawn(name, x, z, rotationY = 0, window = null) {
      const { root } = city.spawn(name, x, z, rotationY);
      const bounds = assets.bounds(root);
      solids.push({ min: { x: bounds.min.x, y: 0, z: bounds.min.z }, max: { x: bounds.max.x, y: bounds.max.y, z: bounds.max.z } });
      if (window) city.window(bounds, window[0], window[1], window[2], window[3]);
      return { root, bounds };
    },
    // Светящееся окно на фасаде со стороны нормали (nx, nz); в него можно влететь.
    window(bounds, nx, nz, type, name) {
      const cx = (bounds.min.x + bounds.max.x) / 2, cz = (bounds.min.z + bounds.max.z) / 2;
      const y = Math.min(4.6, Math.max(2, bounds.max.y - 2));
      const x = nx ? (nx > 0 ? bounds.max.x : bounds.min.x) + nx * 0.08 : cx;
      const z = nz ? (nz > 0 ? bounds.max.z : bounds.min.z) + nz * 0.08 : cz;
      windows.push({ x, y, z, nx, nz, type: type || ROOM_TYPES[Math.floor(rnd() * ROOM_TYPES.length)], name });
    },
  };

  const T = G.tile, P = G.pitch;
  const x0 = G.x0, z0 = G.z0, x1 = x0 + G.cols * P, z1 = z0 + G.rows * P;
  const blockCenter = (i, j) => ({ x: x0 + i * P + P / 2, z: z0 + j * P + P / 2 });

  // Земля, река, тротуары кварталов.
  const ground = B.MeshBuilder.CreateGround('ground', { width: 2400, height: 2600 }, scene);
  ground.position.set(100, 0, 450);
  ground.material = groundMat(scene, '#8fbf6a');
  const river = B.MeshBuilder.CreateGround('river', { width: 2400, height: G.riverWidth }, scene);
  river.position.set(100, 0.05, G.riverZ);
  river.material = groundMat(scene, '#3f8fd6');
  const winMesh = B.MeshBuilder.CreatePlane('window', { width: CFG.interior.window.w, height: CFG.interior.window.h }, scene);
  const winMat = new B.StandardMaterial('windowMat', scene);
  winMat.diffuseColor = B.Color3.FromHexString('#ffd77a');
  winMat.emissiveColor = B.Color3.FromHexString('#ffb84d');
  winMat.backFaceCulling = false;
  winMesh.material = winMat;
  winMesh.position.y = -10;
  const pad = B.MeshBuilder.CreateBox('pad', { width: P - T, height: 0.3, depth: P - T }, scene);
  pad.material = groundMat(scene, '#c9c4bb');
  pad.position.y = -1; // оригинал прячем, показываем копии

  // Достопримечательности бронируют свои кварталы, поэтому идут первыми.
  buildLandmarks(city);

  // Дороги: плитки Kenney вдоль линий сетки, на пересечениях — перекрёстки.
  for (let i = 0; i <= G.cols; i++) {
    const x = x0 + i * P;
    if (x === 0) continue; // Советская — пешеходная, её кладём отдельно
    for (let z = z0; z <= z1; z += T) {
      const cross = (z - z0) % P === 0;
      city.spawn(cross ? 'roads/road-crossroad' : 'roads/road-straight', x, z);
    }
  }
  for (let j = 0; j <= G.rows; j++) {
    const z = z0 + j * P;
    for (let x = x0; x <= x1; x += T) if ((x - x0) % P !== 0) city.spawn('roads/road-straight', x, z, Math.PI / 2);
  }
  // Советская — пешеходная: сплошная мостовая от набережной до Дома Советов, деревья и клумбы по краям.
  box(scene, 0, 0, (z1 + 10) / 2, T, 0.12, z1 - 10, '#d9cfbf');
  box(scene, 0, 0.12, (z1 + 10) / 2, 1.2, 0.02, z1 - 10, '#c9bda9'); // светлая полоса-узор посередине
  for (let z = z0 + 10; z < z1; z += 20) for (const x of [-4, 4]) {
    city.spawn('nature/tree_default', x, z);
    if ((z - z0 - 10) % 40 === 0) city.spawn(x < 0 ? 'nature/flower_yellowA' : 'nature/flower_redA', x, z + 8);
  }

  // Кварталы: тротуар-подложка и четыре участка с домами или парком.
  const commercial = (i, j) => Math.abs(blockCenter(i, j).x) <= 100 && j < 12;
  for (let i = 0; i < G.cols; i++) for (let j = 0; j < G.rows; j++) {
    const c = blockCenter(i, j);
    if (reserved.has(i + ',' + j)) continue;
    const p = pad.createInstance('pad' + i + '_' + j);
    p.position.set(c.x, 0.15, c.z);
    const park = rnd() < 0.12;
    if (park) { p.dispose(); makePark(city, c.x, c.z); continue; }
    for (const dx of [-10, 10]) for (const dz of [-10, 10]) {
      const x = c.x + dx, z = c.z + dz;
      if (rnd() < 0.1) { city.spawn('nature/tree_oak', x, z); continue; }
      let name;
      if (commercial(i, j)) name = rnd() < 0.08 ? 'buildings/building-skyscraper-' + 'abc'[Math.floor(rnd() * 3)] : 'buildings/building-' + 'abcdefghijklmn'[Math.floor(rnd() * 14)];
      else name = rnd() < 0.3 ? 'buildings/building-' + 'abcdefghijklmn'[Math.floor(rnd() * 14)] : 'houses/building-type-' + 'abcdefgh'[Math.floor(rnd() * 8)];
      // Дом смотрит на ближайшую улицу, окно-вход — на боковую.
      const rot = Math.abs(dx) > 0 ? (dx > 0 ? -Math.PI / 2 : Math.PI / 2) : 0;
      city.solidSpawn(name, x, z, dz < 0 && Math.abs(dz) >= Math.abs(dx) ? Math.PI : rot, [Math.sign(dx), 0]);
    }
  }
  // Фонари на перекрёстках вдоль Советской.
  for (let j = 0; j <= G.rows; j++) for (const x of [-6.5, 6.5]) city.spawn('roads/light-square', x, z0 + j * P + 6.5, x > 0 ? Math.PI : 0);

  // Окна — копии одной плоскости, повёрнутые по нормали фасада.
  for (const w of windows) {
    const inst = winMesh.createInstance('win');
    inst.position.set(w.x, w.y, w.z);
    inst.rotation.y = w.nx ? (w.nx > 0 ? Math.PI / 2 : -Math.PI / 2) : (w.nz > 0 ? 0 : Math.PI);
  }

  // Степь вокруг: редкие деревья, чтобы горизонт не был пустым.
  for (let i = 0; i < 120; i++) {
    const x = -700 + rnd() * 1600, z = -500 + rnd() * 1700;
    if (x > x0 - 40 && x < x1 + 40 && z > z0 - 40 && z < z1 + 40) continue;
    if (Math.abs(z - G.riverZ) < G.riverWidth / 2 + 10) continue;
    city.spawn(rnd() < 0.5 ? 'nature/tree_pineTallA' : 'nature/plant_bush', x, z);
  }

  return {
    places,
    sources,
    windows,
    hive: city.hive,
    bounds: { minX: -750, maxX: 900, minZ: -520, maxZ: 1200, maxY: 160 },
    // Высота поверхности под точкой: земля, крыша или мост.
    height(x, z) {
      let y = 0;
      for (const s of solids) {
        if (x >= s.min.x && x <= s.max.x && z >= s.min.z && z <= s.max.z) y = Math.max(y, s.max.y);
      }
      return y;
    },
    // Река под точкой?
    overWater(x, z) {
      return Math.abs(z - G.riverZ) < G.riverWidth / 2 && !(Math.abs(x) < 4.5 && z > -70 && z < 10);
    },
    // Выталкивает точку радиуса r из домов; говорит, села ли она сверху и ударилась ли о стену.
    collide(pos, r) {
      let landed = false, wall = false;
      for (const s of solids) {
        if (pos.x <= s.min.x - r || pos.x >= s.max.x + r || pos.z <= s.min.z - r || pos.z >= s.max.z + r) continue;
        if (pos.y <= s.min.y - r || pos.y >= s.max.y + r) continue;
        const dxl = pos.x - (s.min.x - r), dxr = (s.max.x + r) - pos.x;
        const dzl = pos.z - (s.min.z - r), dzr = (s.max.z + r) - pos.z;
        const dyt = (s.max.y + r) - pos.y, dyb = pos.y - (s.min.y - r);
        const m = Math.min(dxl, dxr, dzl, dzr, dyt, dyb);
        if (m === dyt) { pos.y = s.max.y + r; landed = true; }
        else if (m === dyb) pos.y = s.min.y - r;
        else {
          wall = true;
          if (m === dxl) pos.x = s.min.x - r; else if (m === dxr) pos.x = s.max.x + r;
          else if (m === dzl) pos.z = s.min.z - r; else pos.z = s.max.z + r;
        }
      }
      return { landed, wall };
    },
    // Точка внутри дома? Нужно камере, чтобы не заглядывать сквозь стены.
    inside(p) {
      for (const s of solids) {
        if (p.x > s.min.x && p.x < s.max.x && p.z > s.min.z && p.z < s.max.z && p.y > s.min.y && p.y < s.max.y) return true;
      }
      return false;
    },
    // Окно-вход рядом с точкой.
    windowAt(pos) {
      for (const w of windows) {
        if (Math.abs(pos.y - w.y) > 1.3) continue;
        if (Math.abs(pos.x - w.x) < 1.3 && Math.abs(pos.z - w.z) < 1.3) return w;
      }
      return null;
    },
    // Ближайшее место с подписью, если шмель внутри его радиуса.
    placeAt(x, z) {
      let best = null, bestD = Infinity;
      for (const p of places) {
        const d = Math.hypot(x - p.x, z - p.z);
        if (d < p.r && d < bestD) { best = p; bestD = d; }
      }
      return best;
    },
    // Активный источник рядом с точкой: цветок с нектаром, фонтан, улей.
    sourceAt(pos, time) {
      for (const s of sources) {
        if (s.until > time) continue;
        if (Math.abs(pos.y - s.y) > 3) continue;
        if (Math.hypot(pos.x - s.x, pos.z - s.z) <= s.r) return s;
      }
      return null;
    },
    // Цветок без нектара поникает, потом распрямляется.
    update(dt, time) {
      for (const s of sources) {
        if (!s.root) continue;
        const want = s.until > time ? s.scale * 0.5 : s.scale;
        if (s.root.scaling.y !== want) s.root.scaling.y += (want - s.root.scaling.y) * Math.min(1, 4 * dt);
      }
    },
  };
}

function groundMat(scene, hex) {
  const m = new BABYLON.StandardMaterial('g' + hex, scene);
  m.diffuseColor = BABYLON.Color3.FromHexString(hex);
  m.specularColor = BABYLON.Color3.Black();
  return m;
}

// Парк на месте квартала: деревья, кусты и клумба с цветами.
function makePark(city, cx, cz) {
  for (let k = 0; k < 6; k++) {
    const a = city.rnd() * Math.PI * 2, r = 6 + city.rnd() * 12;
    city.spawn(city.rnd() < 0.5 ? 'nature/tree_default' : 'nature/tree_oak', cx + Math.cos(a) * r, cz + Math.sin(a) * r);
  }
  for (let k = 0; k < 4; k++) city.spawn('nature/plant_bush', cx + (city.rnd() - 0.5) * 30, cz + (city.rnd() - 0.5) * 30);
  for (let k = 0; k < 9; k++) {
    city.spawn(['nature/flower_redA', 'nature/flower_yellowA', 'nature/flower_purpleA'][k % 3], cx - 4 + (k % 3) * 4, cz - 4 + Math.floor(k / 3) * 4);
  }
}
