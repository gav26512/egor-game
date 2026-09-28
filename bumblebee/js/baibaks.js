import { mat, box, cyl, label } from './prims.js';

// Бронзовые байбаки-талисманы: маленькие фигурки в центре, собираются в коллекцию.
export const BRONZE = [
  { id: 'artist', name: 'Байбак-художник', x: -40, z: 283 },
  { id: 'banker', name: 'Байбак-банкир', x: 64, z: 576 },
  { id: 'runner', name: 'Байбак-бегун', x: -20, z: 12 },
  { id: 'jeweler', name: 'Байбак-ювелир', x: -6, z: 380 },
  { id: 'cosmonaut', name: 'Байбак-космонавт', x: 221, z: 196 },
  { id: 'sarmat', name: 'Байбак-сармат', x: 4, z: 221 },
  { id: 'cossack', name: 'Байбак-казак', x: 20, z: 41 },
  { id: 'shawl', name: 'Байбак в платочке', x: 70, z: 590 },
  { id: 'student', name: 'Байбак-студентка', x: 6, z: 300 },
  { id: 'couple', name: 'Влюблённые байбаки', x: 3, z: -30, y: 4.5 },
];
const KEY = 'bumblebee.baibaks';

export function createBaibaks(scene, city, bee, hud, rnd, onFound = () => {}) {
  const B = BABYLON;
  const bronze = mat(scene, '#7a5a2e', { shiny: true });
  const fur = mat(scene, '#b8804a');
  const dark = mat(scene, '#3a2a1a');

  // Сурок столбиком: тело, голова, ушки, лапки на груди, хвостик.
  function marmot(material, scale = 1) {
    const root = new B.TransformNode('marmot', scene);
    const part = (name, opts, x, y, z, sx = 1, sy = 1, sz = 1) => {
      const m = B.MeshBuilder.CreateSphere(name, { segments: 8, ...opts }, scene);
      m.position.set(x, y, z); m.scaling.set(sx, sy, sz); m.material = material; m.parent = root; return m;
    };
    part('body', { diameter: 0.5 }, 0, 0.35, 0, 1, 1.5, 0.9);
    part('head', { diameter: 0.34 }, 0, 0.82, 0.06);
    part('ear', { diameter: 0.1 }, -0.12, 0.97, 0); part('ear', { diameter: 0.1 }, 0.12, 0.97, 0);
    part('paw', { diameter: 0.1 }, -0.1, 0.55, 0.22); part('paw', { diameter: 0.1 }, 0.1, 0.55, 0.22);
    part('tail', { diameter: 0.14 }, 0, 0.12, -0.24, 1, 1, 1.6);
    const nose = part('nose', { diameter: 0.07 }, 0, 0.78, 0.23); nose.material = dark;
    root.scaling.setAll(scale);
    return root;
  }

  let found = new Set();
  try { found = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { /* нет доступа к хранилищу */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify([...found])); } catch { /* ничего */ } };

  const figures = [];
  for (const b of BRONZE) {
    const y = b.y || 0;
    box(scene, b.x, y, b.z, 0.7, 0.3, 0.7, '#6f6a62');
    const root = marmot(bronze, 0.6);
    root.position.set(b.x, y + 0.3, b.z);
    figures.push({ ...b, root, y: y + 0.6 });
  }

  // Живые байбаки в Зауральной роще: стоят у норок, при шмеле ныряют, потом выглядывают.
  const live = [];
  for (let i = 0; i < 12; i++) {
    const x = 90 + rnd() * 130, z = -230 + rnd() * 150;
    const hole = cyl(scene, x, 0.02, z, 0.45, 0.04, '#3b2a1a');
    cyl(scene, x, 0, z, 0.9, 0.12, '#8a6a45');
    const root = marmot(fur, 0.8);
    root.position.set(x, 0, z);
    live.push({ root, x, z, up: 1, timer: 0 });
  }
  label(scene, 'Здесь живут байбаки', 150, 12, -180, 30);

  const count = () => `${found.size}/${BRONZE.length}`;
  hud.setBaibaks(count());

  return {
    found,
    update(dt, outside) {
      if (!outside) return;
      const pos = bee.root.position;
      for (const f of figures) {
        if (found.has(f.id)) continue;
        if (Math.abs(pos.y - f.y) < 1.4 && Math.hypot(pos.x - f.x, pos.z - f.z) < 1.3) {
          found.add(f.id); save();
          hud.flash(`${f.name}! ${count()}`, 2.5);
          hud.setBaibaks(count());
          onFound(f);
        }
      }
      for (const m of live) {
        const d = Math.hypot(pos.x - m.x, pos.z - m.z);
        const want = d < 10 ? 0 : (d > 14 ? 1 : m.up);
        m.up += (want - m.up) * Math.min(1, (want < m.up ? 10 : 3) * dt);
        m.root.position.y = -0.9 * (1 - m.up);
        m.root.rotation.y = d < 30 ? Math.atan2(pos.x - m.x, pos.z - m.z) : m.root.rotation.y;
      }
    },
  };
}
