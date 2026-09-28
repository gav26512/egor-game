import { CFG } from './config.js';
import { mat, box, cyl } from './prims.js';

// Железная дорога: насыпь, шпалы, рельсы, мост через Урал и поезда из локомотива и вагонов.
// Линия — прямая: axis 'x' (вдоль x при z = at) или 'z' (вдоль z при x = at), от from до to.
export function createRailways(scene, rnd) {
  const B = BABYLON;
  const R = CFG.rail;
  // У каждого пути своё направление: по ближнему на восток, по дальнему на запад, по западному — от вокзала к Уралу.
  const lines = [
    { axis: 'x', at: R.northZ, from: R.westX - 20, to: 900, trains: 2, dir: 1 },            // вдоль северного края, мимо вокзала
    { axis: 'x', at: R.northZ + R.gap, from: R.westX - 20, to: 900, trains: 2, dir: -1 },
    { axis: 'z', at: R.westX, from: -480, to: R.northZ + R.gap + 20, trains: 1, dir: -1 }, // на запад от города, через Урал
  ];
  const y = 0.3; // верх насыпи
  const sleeper = box(scene, 0, -20, 0, 2.6, 0.12, 0.5, '#6b4a2e');
  const gravel = mat(scene, '#8f8a80'), steel = mat(scene, '#5a5f66', { shiny: true });

  for (const L of lines) {
    const len = L.to - L.from, mid = (L.from + L.to) / 2;
    // Коробка, вытянутая вдоль линии: w — поперёк, h — высота, yBottom — низ, offset — сдвиг поперёк.
    const along = (w, h, yBottom, hex, offset = 0) => {
      const m = box(scene, 0, 0, 0, L.axis === 'x' ? len : w, h, L.axis === 'x' ? w : len, hex);
      m.position.set(L.axis === 'x' ? mid : L.at + offset, yBottom + h / 2, L.axis === 'x' ? L.at + offset : mid);
      return m;
    };
    along(5, 0.3, 0, '#8f8a80').material = gravel; // насыпь
    for (const side of [-1, 1]) along(0.16, 0.14, y, '#5a5f66', side * 0.9).material = steel; // рельсы
    for (let t = L.from; t <= L.to; t += 2.2) {
      const s = sleeper.createInstance('sleeper');
      s.position.set(L.axis === 'x' ? t : L.at, y + 0.02, L.axis === 'x' ? L.at : t);
      if (L.axis === 'z') s.rotation.y = Math.PI / 2;
    }
  }
  // Мост западной линии через Урал: опоры в воде и фермы по бокам.
  const rz = CFG.city.riverZ, rw = CFG.city.riverWidth;
  for (let z = rz - rw / 2; z <= rz + rw / 2; z += 15) cyl(scene, R.westX, -1, z, 1.2, 1.4, '#7a7570');
  for (const dx of [-2.8, 2.8]) {
    box(scene, R.westX + dx, y, rz, 0.3, 3, rw + 16, '#3b3f45');
    for (let z = rz - rw / 2 - 6; z <= rz + rw / 2 + 6; z += 6) box(scene, R.westX + dx, y, z, 0.25, 3, 0.25, '#3b3f45');
  }
  return { lines, y };
}

// Поезда: локомотив и вагоны едут по линии и появляются с другого конца.
export function createTrains(scene, railways, rnd) {
  const B = BABYLON;
  const trains = [];
  const mk = (w, h, d, hex, opts) => box(scene, 0, 0, 0, w, h, d, hex, opts);
  const car = (kind) => {
    const root = new B.TransformNode('car', scene);
    const add = (m, x, yy, z) => { m.parent = root; m.position.set(x, yy, z); return m; };
    if (kind === 'loco') {
      add(mk(3, 3.2, 16, '#c8342d'), 0, 2.2, 0);
      add(mk(3.1, 1.2, 4, '#f2e8d8'), 0, 3.4, 5); // кабина со стеклом
      add(mk(1, 0.8, 1, '#333'), 0, 4.2, -3); // выхлоп
      add(mk(0.6, 0.5, 0.2, '#ffe680', { emissive: '#ffd23f' }), 0, 2.6, 8.05); // фара
    } else if (kind === 'tank') {
      const t = cyl(scene, 0, 0, 0, 1.5, 14, '#7a8a6a'); t.rotation.x = Math.PI / 2; add(t, 0, 2.3, 0);
    } else {
      add(mk(3, 3, 14, kind === 'pass' ? '#2f7a4a' : '#8a5a3a'), 0, 2.1, 0);
      if (kind === 'pass') add(mk(3.05, 0.8, 12, '#dfe9f2'), 0, 2.6, 0); // полоса окон
    }
    for (const z of [-5, 5]) add(mk(2.4, 0.9, 3, '#222'), 0, 0.45, z); // тележки
    return root;
  };

  for (const L of railways.lines) {
    for (let i = 0; i < L.trains; i++) {
      const kinds = ['loco', ...Array.from({ length: 3 + Math.floor(rnd() * 3) }, () => ['pass', 'pass', 'tank', 'box'][Math.floor(rnd() * 4)])];
      const cars = kinds.map(car);
      // Составы на одном пути идут в одну сторону с одной скоростью и равными промежутками, чтобы не догонять друг друга.
      const t = L.from + (L.to - L.from) * (i + 0.5) / L.trains;
      trains.push({ line: L, dir: L.dir, speed: CFG.rail.speed, t, cars, len: kinds.length * 16 });
    }
  }

  const place = (tr) => {
    tr.cars.forEach((c, i) => {
      const t = tr.t - tr.dir * i * 16;
      if (tr.line.axis === 'x') { c.position.set(t, railways.y, tr.line.at); c.rotation.y = tr.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      else { c.position.set(tr.line.at, railways.y, t); c.rotation.y = tr.dir > 0 ? 0 : Math.PI; }
    });
  };
  trains.forEach(place);

  return {
    trains,
    update(dt) {
      for (const tr of trains) {
        tr.t += tr.dir * tr.speed * dt;
        const { from, to } = tr.line;
        if (tr.dir > 0 && tr.t - tr.len > to) tr.t = from;
        if (tr.dir < 0 && tr.t + tr.len < from) tr.t = to;
        place(tr);
      }
    },
    // Шмель попал под поезд?
    hits(pos) {
      if (pos.y > 4.6) return false;
      for (const tr of trains) for (const c of tr.cars) {
        const p = c.position;
        const dx = Math.abs(pos.x - p.x), dz = Math.abs(pos.z - p.z);
        if (tr.line.axis === 'x' ? (dx < 8.2 && dz < 1.8) : (dz < 8.2 && dx < 1.8)) return true;
      }
      return false;
    },
  };
}
