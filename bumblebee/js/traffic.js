import { CFG } from './config.js';

const CARS = ['sedan', 'sedan-sports', 'suv', 'hatchback-sports', 'taxi', 'van', 'truck', 'delivery', 'police', 'ambulance'].map((n) => 'cars/' + n);
const PEOPLE = 'abcdefgh'.split('').map((c) => 'people/character-' + c);
export const TRAFFIC_MODELS = [...CARS, ...PEOPLE];

// Машины по дорогам и пешеходы по тротуарам; каждый едет по своей линии сетки и заворачивает с края на край.
export function createTraffic(scene, assets, rnd) {
  const B = BABYLON;
  const G = CFG.city, P = G.pitch;
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const xLines = [], zLines = [];
  for (let i = 0; i <= G.cols; i++) { const x = G.x0 + i * P; if (x !== 0) xLines.push(x); } // Советская пешеходная
  for (let j = 0; j <= G.rows; j++) zLines.push(G.z0 + j * P);
  const zMin = G.z0 - 20, zMax = G.z0 + G.rows * P + 20, xMin = G.x0 - 20, xMax = G.x0 + G.cols * P + 20;

  const movers = [];
  const add = (model, kind, speed, lane, lines) => {
    const alongZ = rnd() < 0.5, dir = rnd() < 0.5 ? 1 : -1;
    const line = alongZ ? pick(lines.x) : pick(lines.z);
    const { root, animations } = assets.spawn(model, {});
    animations.find((a) => a.name === 'walk')?.start(true);
    movers.push({ root, kind, alongZ, dir, line, lane: lane * (rnd() < 0.5 ? 1 : -1), speed, t: alongZ ? zMin + rnd() * (zMax - zMin) : xMin + rnd() * (xMax - xMin) });
  };
  for (let i = 0; i < CFG.traffic.cars; i++) add(pick(CARS), 'car', 7 + rnd() * 5, 2.6, { x: xLines, z: zLines });
  for (let i = 0; i < CFG.traffic.people; i++) add(pick(PEOPLE), 'person', 1 + rnd() * 0.6, 4.1, { x: [...xLines, 0, 0, 0], z: zLines });

  const place = (m) => {
    // Машины держатся правой стороны по ходу, пешеходы — любого тротуара.
    const lane = m.kind === 'car' ? Math.abs(m.lane) * m.dir : m.lane;
    if (m.alongZ) { m.root.position.set(m.line + lane, 0, m.t); m.root.rotation.y = m.dir > 0 ? 0 : Math.PI; }
    else { m.root.position.set(m.t, 0, m.line - lane); m.root.rotation.y = m.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
  };
  movers.forEach(place);

  return {
    cars: movers.filter((m) => m.kind === 'car'),
    update(dt) {
      for (const m of movers) {
        m.t += m.dir * m.speed * dt;
        const [lo, hi] = m.alongZ ? [zMin, zMax] : [xMin, xMax];
        if (m.t > hi) m.t = lo; else if (m.t < lo) m.t = hi;
        place(m);
      }
    },
  };
}
