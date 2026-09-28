import { CFG } from './config.js';
import { box, mat } from './prims.js';

// Модели для комнат.
export const ROOM_MODELS = [
  ...['table', 'chair', 'bedDouble', 'bedSingle', 'sideTable', 'lampRoundTable', 'rugRound', 'loungeChair',
    'kitchenFridge', 'kitchenStove', 'kitchenSink', 'kitchenCabinet', 'desk', 'chairDesk', 'bookcaseOpen', 'pottedPlant'].map((n) => 'furniture/' + n),
  ...['bread', 'apple', 'honey', 'cup-tea', 'glass', 'cookie', 'banana', 'cake', 'donut', 'croissant', 'pizza', 'soda-glass', 'watermelon', 'grapes', 'pear'].map((n) => 'food/' + n),
  'people/character-a', 'people/character-c', 'people/character-e', 'people/character-f', 'people/character-g',
];

// Комната увеличена в K раз вместе с мебелью, чтобы шмель казался маленьким; вход через стену −z.
const K = CFG.interior.scale;
const W = 12 * K, D = 9 * K, H = 3.4 * K;
const F = 25; // сколько еды даёт блюдо

// Раскладка: мебель (m, x, z, rot), еда (on — на какой мебели), человек.
const ROOMS = {
  kitchen: {
    name: 'Кухня', wall: '#f6e7c1', floor: '#c9a06a',
    furniture: [
      { id: 'table', m: 'furniture/table', x: 0, z: 1 }, { m: 'furniture/chair', x: -1.3, z: 1, rot: Math.PI / 2 }, { m: 'furniture/chair', x: 1.3, z: 1, rot: -Math.PI / 2 },
      { m: 'furniture/kitchenFridge', x: -5.2, z: 3.8 }, { m: 'furniture/kitchenStove', x: -3.7, z: 3.8 }, { m: 'furniture/kitchenSink', x: -2.3, z: 3.8 },
      { m: 'furniture/kitchenCabinet', x: -0.9, z: 3.8 }, { m: 'furniture/pottedPlant', x: 5.2, z: 3.8 },
    ],
    food: [{ m: 'food/bread', on: 'table', dx: -0.5 }, { m: 'food/apple', on: 'table', dx: 0.3, dz: 0.3 }, { m: 'food/honey', on: 'table', dx: 0.5, dz: -0.3 }, { m: 'food/cup-tea', on: 'table', dx: -0.1, dz: -0.35, water: true }],
    person: { m: 'people/character-c', x: 3.5, z: 2.5, rot: Math.PI },
  },
  bedroom: {
    name: 'Спальня', wall: '#e3d9f2', floor: '#b08968',
    furniture: [
      { id: 'bed', m: 'furniture/bedDouble', x: -3.5, z: 2.5, rest: true }, { id: 'side', m: 'furniture/sideTable', x: -1.2, z: 3.8 },
      { m: 'furniture/rugRound', x: 1.5, z: 0.5 }, { m: 'furniture/loungeChair', x: 4.2, z: 3, rot: Math.PI + 0.6 }, { id: 'pot', m: 'furniture/pottedPlant', x: 5.2, z: -3.5 },
    ],
    food: [{ m: 'furniture/lampRoundTable', on: 'side', deco: true }, { m: 'food/glass', on: 'side', dx: 0.35, water: true }, { m: 'food/pear', on: 'side', dx: -0.3 }],
    person: { m: 'people/character-e', x: 2, z: -1, rot: Math.PI * 0.75 },
  },
  kids: {
    name: 'Детская', wall: '#d9f0ff', floor: '#e0c79a',
    furniture: [
      { id: 'bed', m: 'furniture/bedSingle', x: -4.2, z: 2.8, rest: true }, { id: 'desk', m: 'furniture/desk', x: 4, z: 3.6 }, { m: 'furniture/chairDesk', x: 4, z: 2.4, rot: Math.PI },
      { m: 'furniture/bookcaseOpen', x: 0, z: 4.1 }, { m: 'furniture/rugRound', x: 0, z: 0 },
    ],
    food: [{ m: 'food/cookie', on: 'desk', dx: -0.4, value: 15 }, { m: 'food/banana', on: 'desk', dx: 0.4, value: 15 }, { m: 'food/glass', on: 'desk', dx: 0, dz: 0.3, water: true }],
    person: { m: 'people/character-a', x: -1, z: -1.5, rot: Math.PI * 0.6, scale: 0.14 },
  },
  cafe: {
    name: 'Кафе', wall: '#f3d9c4', floor: '#8c6a4f',
    furniture: [
      { id: 't1', m: 'furniture/table', x: -3.5, z: 1 }, { id: 't2', m: 'furniture/table', x: 0, z: 1 }, { id: 't3', m: 'furniture/table', x: 3.5, z: 1 },
      { m: 'furniture/chair', x: -3.5, z: -0.3 }, { m: 'furniture/chair', x: 0, z: -0.3 }, { m: 'furniture/chair', x: 3.5, z: -0.3 },
      { id: 'bar', m: 'furniture/desk', x: 0, z: 3.9 }, { m: 'furniture/pottedPlant', x: -5.3, z: 3.8 }, { m: 'furniture/pottedPlant', x: 5.3, z: 3.8 },
    ],
    food: [{ m: 'food/cake', on: 't1' }, { m: 'food/donut', on: 't2', dx: -0.3 }, { m: 'food/croissant', on: 't2', dx: 0.35 }, { m: 'food/pizza', on: 't3' },
      { m: 'food/cup-tea', on: 'bar', dx: -0.6, water: true }, { m: 'food/soda-glass', on: 'bar', dx: 0.6, water: true }],
    person: { m: 'people/character-f', x: 1.5, z: 3.2, rot: Math.PI },
  },
  shop: {
    name: 'Магазин', wall: '#e8f2dc', floor: '#9aa0a6',
    furniture: [
      { id: 's1', m: 'furniture/bookcaseOpen', x: -4, z: 4.1 }, { id: 's2', m: 'furniture/bookcaseOpen', x: -1, z: 4.1 }, { id: 's3', m: 'furniture/bookcaseOpen', x: 2, z: 4.1 },
      { id: 'counter', m: 'furniture/desk', x: 4.6, z: 0, rot: Math.PI / 2 },
    ],
    food: [{ m: 'food/apple', on: 's1', dx: -0.3 }, { m: 'food/bread', on: 's1', dx: 0.3 }, { m: 'food/watermelon', on: 's2' }, { m: 'food/grapes', on: 's3', dx: -0.3 }, { m: 'food/banana', on: 's3', dx: 0.3 },
      { m: 'food/soda-glass', on: 'counter', water: true }],
    person: { m: 'people/character-g', x: 5.4, z: 0, rot: -Math.PI / 2 },
  },
};

export const ROOM_TYPES = Object.keys(ROOMS);

// Одна переиспользуемая комната высоко над городом: город туда не долетает и не виден.
export function createInterior(scene, assets) {
  const B = BABYLON;
  const O = new B.Vector3(0, CFG.interior.height, 0);
  let nodes = [], sources = [], solids = [], current = null;
  const r = CFG.bee.radius;

  const clear = () => { for (const n of nodes) n.dispose(); nodes = []; sources = []; solids = []; };
  const solidOf = (bounds) => ({ min: { x: bounds.min.x, y: bounds.min.y, z: bounds.min.z }, max: { x: bounds.max.x, y: bounds.max.y, z: bounds.max.z } });

  function build(type, title) {
    clear();
    const R = ROOMS[type];
    current = { type, name: title || R.name };
    const wallM = mat(scene, R.wall);
    const put = (m) => { nodes.push(m); return m; };
    put(box(scene, O.x, O.y - 0.2, O.z, W, 0.2, D, R.floor));
    put(box(scene, O.x, O.y + H, O.z, W, 0.2, D, '#ffffff'));
    for (const [x, z, w, d] of [[-W / 2, 0, 0.2, D], [W / 2, 0, 0.2, D], [0, D / 2, W, 0.2], [0, -D / 2, W, 0.2]]) {
      put(box(scene, O.x + x, O.y, O.z + z, w, H, d, R.wall)).material = wallM;
    }
    // Окно, через которое влетели: светлый прямоугольник на входной стене.
    put(box(scene, O.x, O.y + 1.2, O.z - D / 2 + 0.12, 2.4, 2.2, 0.05, '#bfe9ff', { emissive: '#9fd8ff', alpha: 0.9 }));
    put(box(scene, O.x, O.y + H - 0.4, O.z, 0.7, 0.4, 0.7, '#fff6d0', { emissive: '#ffe9a0' })); // лампа

    const byId = {};
    const scaleOf = (m) => (CFG.models[m.split('/')[0]] ?? 1) * K;
    for (const f of R.furniture) {
      const { root } = assets.spawn(f.m, { position: new B.Vector3(O.x + f.x * K, O.y, O.z + f.z * K), rotationY: f.rot || 0, scale: scaleOf(f.m) });
      nodes.push(root);
      const bounds = assets.bounds(root);
      solids.push(solidOf(bounds));
      if (f.id) byId[f.id] = bounds;
      if (f.rest) sources.push({ kind: 'rest', x: O.x + f.x * K, z: O.z + f.z * K, y: bounds.max.y, r: 1.6 * K, until: 0 });
    }
    for (const it of R.food) {
      const b = byId[it.on];
      const x = (b.min.x + b.max.x) / 2 + (it.dx || 0) * K, z = (b.min.z + b.max.z) / 2 + (it.dz || 0) * K;
      const { root } = assets.spawn(it.m, { position: new B.Vector3(x, b.max.y, z), scale: scaleOf(it.m) });
      nodes.push(root);
      if (it.deco) continue;
      sources.push(it.water
        ? { kind: 'water', x, z, y: b.max.y, r: 0.9 * K, until: 0 }
        : { kind: 'food', x, z, y: b.max.y, r: 0.7 * K, value: it.value || F, cooldown: Infinity, until: 0, root, once: true, model: it.m.split('/')[1] });
    }
    if (R.person) {
      const p = R.person;
      const { root, animations } = assets.spawn(p.m, { position: new B.Vector3(O.x + p.x * K, O.y, O.z + p.z * K), rotationY: p.rot || 0, scale: (p.scale || CFG.interior.peopleScale) * K });
      nodes.push(root);
      animations.find((a) => a.name === 'idle')?.start(true);
      current.person = root;
    }
    current.exit = new B.Vector3(O.x, O.y + 1.2, O.z - D / 2 + 0.3);
    current.entry = new B.Vector3(O.x, O.y + 1.5, O.z - D / 2 + 2.5);
    return current;
  }

  // Мир комнаты с тем же интерфейсом, что и город.
  const world = {
    get current() { return current; },
    build,
    bounds: { minX: O.x - W / 2 + 0.3, maxX: O.x + W / 2 - 0.3, minZ: O.z - D / 2 + 0.3, maxZ: O.z + D / 2 - 0.3, minY: O.y, maxY: O.y + H - 0.4 },
    overWater: () => false,
    height(x, z) {
      let y = O.y;
      for (const s of solids) if (x >= s.min.x && x <= s.max.x && z >= s.min.z && z <= s.max.z) y = Math.max(y, s.max.y);
      return y;
    },
    collide(pos, rad) {
      let landed = false, wall = false;
      const b = world.bounds;
      if (pos.x < b.minX) { pos.x = b.minX; wall = true; } if (pos.x > b.maxX) { pos.x = b.maxX; wall = true; }
      if (pos.z < b.minZ) { pos.z = b.minZ; wall = true; } if (pos.z > b.maxZ) { pos.z = b.maxZ; wall = true; }
      if (pos.y > b.maxY) pos.y = b.maxY;
      if (pos.y < b.minY + rad) { pos.y = b.minY + rad; landed = true; }
      for (const s of solids) {
        if (pos.x <= s.min.x - rad || pos.x >= s.max.x + rad || pos.z <= s.min.z - rad || pos.z >= s.max.z + rad) continue;
        if (pos.y <= s.min.y - rad || pos.y >= s.max.y + rad) continue;
        const dxl = pos.x - (s.min.x - rad), dxr = (s.max.x + rad) - pos.x, dzl = pos.z - (s.min.z - rad), dzr = (s.max.z + rad) - pos.z, dyt = (s.max.y + rad) - pos.y;
        const m = Math.min(dxl, dxr, dzl, dzr, dyt);
        if (m === dyt) { pos.y = s.max.y + rad; landed = true; }
        else if (m === dxl) pos.x = s.min.x - rad; else if (m === dxr) pos.x = s.max.x + rad; else if (m === dzl) pos.z = s.min.z - rad; else pos.z = s.max.z + rad;
      }
      return { landed, wall };
    },
    inside(p) {
      for (const s of solids) if (p.x > s.min.x && p.x < s.max.x && p.z > s.min.z && p.z < s.max.z && p.y > s.min.y && p.y < s.max.y) return true;
      return false;
    },
    placeAt: () => current && { name: current.name },
    sourceAt(pos, time) {
      for (const s of sources) {
        if (s.until > time || Math.abs(pos.y - s.y) > 1.5) continue;
        if (Math.hypot(pos.x - s.x, pos.z - s.z) <= s.r) return s;
      }
      return null;
    },
    // Съеденное блюдо исчезает.
    update() { for (const s of sources) if (s.once && s.until === Infinity && s.root) { s.root.dispose(); s.root = null; } },
    nearExit: (pos) => current && B.Vector3.Distance(pos, current.exit) < 1.6,
  };
  return world;
}
