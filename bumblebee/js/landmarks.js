import { mat, box, cyl, cone, sphere, label, photo } from './prims.js';

// Достопримечательности из деталей (ступень 1 плана); позиции — игровые метры, см. план.
// city: { scene, assets, reserve(i, j), solid(x, y, z, w, h, d), place(name, x, z, r), spawn(...) }
export function buildLandmarks(city) {
  const { scene, assets } = city;
  const CREAM = '#f3e6c8', WHITE = '#f7f4ee', BRONZE = '#6b4f2a', GOLD = '#e0b032', TEAL = '#3fb1a8', RED = '#a8402e', GRAY = '#8a8f96';

  // Набережная (Беловка): гранитная полоса вдоль Урала.
  box(scene, 0, 0, 27, 320, 0.6, 46, '#b9b3a8');
  for (let x = -150; x <= 150; x += 15) city.spawn('nature/tree_default', x, 12, 0, 0.6);

  // Памятник Чкалову: постамент и бронзовый лётчик.
  city.solid(-12, 0, 32, 4, 5, 4); box(scene, -12, 0.6, 32, 4, 5, 4, GRAY);
  cyl(scene, -12, 5.6, 32, 0.9, 4.2, BRONZE); sphere(scene, -12, 10.4, 32, 0.7, BRONZE);
  city.place('Памятник Чкалову', -12, 32, 14);

  // Елизаветинские ворота: две белые колонны и перекладина.
  for (const x of [12, 19]) { box(scene, x, 0.6, 44, 1.6, 6, 1.6, WHITE); city.solid(x, 0, 44, 1.6, 6.6, 1.6); }
  box(scene, 15.5, 6.6, 44, 9, 1.2, 2, WHITE); box(scene, 15.5, 7.8, 44, 3, 1.6, 2, GOLD);
  city.place('Елизаветинские ворота', 15.5, 44, 12);

  // Музей истории Оренбурга: красный «замок» с часовой башней.
  city.solid(50, 0, 38, 16, 10, 12); box(scene, 50, 0.6, 38, 16, 10, 12, RED);
  city.solid(44, 0, 33, 5, 18, 5); box(scene, 44, 0.6, 33, 5, 18, 5, RED); cone(scene, 44, 18.6, 33, 3.6, 5, '#4a3b32', { sides: 4 });
  cyl(scene, 44, 14, 30.4, 1.6, 0.3, WHITE).rotation.x = Math.PI / 2;
  label(scene, 'Музей истории', 50, 26, 38);
  city.place('Музей истории Оренбурга', 50, 38, 20);

  // Смотровая башня над набережной.
  city.solid(190, 0, 40, 4, 22, 4); cyl(scene, 190, 0.6, 40, 2, 20, GRAY); cyl(scene, 190, 20.6, 40, 4, 1.2, WHITE);
  label(scene, 'Смотровая башня', 190, 27, 40);
  city.place('Смотровая башня', 190, 40, 14);

  // Мост «Европа–Азия»: белый настил над рекой, арка и стелы с подписями.
  city.solid(0, 0, -30, 8, 4.5, 80); box(scene, 0, 0, -30, 8, 4.5, 80, WHITE);
  const arch = BABYLON.MeshBuilder.CreateTorus('arch', { diameter: 30, thickness: 0.8, tessellation: 32 }, scene);
  arch.position.set(0, 4.5, -30); arch.rotation.x = Math.PI / 2; arch.rotation.y = Math.PI / 2;
  arch.material = mat(scene, WHITE);
  for (let z = -60; z <= 0; z += 20) for (const x of [-4.8, 4.8]) box(scene, x, 4.5, z, 0.4, 1.4, 0.4, WHITE);
  for (const [z, name] of [[6, 'Европа'], [-66, 'Азия']]) {
    for (const x of [-5.5, 5.5]) { box(scene, x, 0, z, 2, 9, 2, WHITE); city.solid(x, 0, z, 2, 9, 2); }
    label(scene, name, 0, 12, z, 18);
  }
  city.place('Мост Европа–Азия', 0, -30, 45);

  // Канатная дорога через Урал: две опоры, трос и кабинки.
  for (const z of [10, -62]) { cyl(scene, 25, 0.6, z, 0.9, 20, GRAY); city.solid(25, 0, z, 2, 21, 2); }
  box(scene, 25, 19.8, -26, 0.15, 0.15, 72, '#333');
  for (const z of [-8, -44]) { box(scene, 25, 16.5, z, 2.2, 2.6, 2.4, '#ffffff', { alpha: 0.7 }); box(scene, 25, 19.1, z, 0.2, 0.8, 0.2, '#333'); }
  city.place('Канатная дорога', 25, -26, 16);

  // Сарматский олень на Советской: постамент и золотой олень.
  city.solid(0, 0, 225, 3, 3, 3); box(scene, 0, 0.6, 225, 3, 3, 3, GRAY);
  box(scene, 0, 4.4, 225, 1.2, 1.4, 2.6, GOLD, { shiny: true }); cyl(scene, 0, 5.4, 226.6, 0.35, 1.6, GOLD, { shiny: true });
  sphere(scene, 0, 7.2, 226.8, 0.5, GOLD, { shiny: true });
  for (const x of [-0.35, 0.35]) cone(scene, x, 7.5, 226.6, 0.25, 1.6, GOLD, { shiny: true });
  for (const [dx, dz] of [[-0.4, -1], [0.4, -1], [-0.4, 1], [0.4, 1]]) cyl(scene, dx, 3.6, 225 + dz, 0.15, 0.9, GOLD, { shiny: true });
  city.place('Сарматский олень', 0, 225, 12);

  // Самолёт Гагарина на постаменте.
  city.solid(225, 0, 200, 4, 6, 4); box(scene, 225, 0.6, 200, 4, 6, 4, GRAY);
  cyl(scene, 225, 8, 200, 0.8, 9, '#c9ced4', { shiny: true }).rotation.x = Math.PI / 2 + 0.25;
  box(scene, 225, 7.8, 200, 9, 0.25, 1.8, '#c9ced4', { shiny: true });
  box(scene, 225, 9, 195.5, 0.2, 2, 1.4, '#c9ced4', { shiny: true });
  label(scene, 'Самолёт Гагарина', 225, 16, 200);
  city.place('Самолёт Гагарина', 225, 200, 16);

  // Музей ИЗО — обычный дом с подписью; здесь потом встанет первый бронзовый байбак.
  city.solidSpawn('buildings/building-b', -40, 290, Math.PI / 2, [0, -1, 'shop', 'Сувенирная лавка музея']);
  label(scene, 'Музей ИЗО', -40, 18, 290);
  city.place('Музей изобразительных искусств', -40, 290, 16);

  // Драмтеатр им. Горького: кремовое здание с колоннами и фронтоном.
  city.reserve(5, 5); // квартал 0..50 × 300..350
  city.solid(25, 0, 328, 26, 11, 16); box(scene, 25, 0, 328, 26, 11, 16, CREAM);
  city.window({ min: { x: 12, y: 0, z: 320 }, max: { x: 38, y: 11, z: 336 } }, 0, -1, 'cafe', 'Театральный буфет');
  for (let i = 0; i < 6; i++) cyl(scene, 25 - 10 + i * 4, 0, 318.5, 0.6, 10, WHITE);
  box(scene, 25, 10, 318.5, 26, 1, 3, CREAM);
  const ped = cyl(scene, 25, 0, 328, 4, 26, CREAM, { sides: 3 }); ped.rotation.z = Math.PI / 2; ped.rotation.y = Math.PI / 2; ped.position.y = 12.2;
  label(scene, 'Драмтеатр', 25, 20, 328);
  city.place('Драмтеатр им. Горького', 25, 328, 22);

  // Башня с курантами: угловая башня кирпичного дома на Советской, собрана по фотографиям.
  city.reserve(4, 8); // квартал -50..0 × 450..500 — площадь
  box(scene, -25, 0, 475, 40, 0.3, 40, '#c9c4bb');
  const BRICK = '#a8452f', TRIM = '#f4efe6', GREEN = '#3f9d3a', CLOCK = '#5b3a1e', SHUTTER = '#7a1e1e';
  // Трёхэтажный дом: кирпич, белые пояса между этажами и белые окна.
  city.solid(-22, 0, 464, 20, 11.5, 22); box(scene, -22, 0.3, 464, 20, 11.5, 22, BRICK);
  for (const y of [4, 7.8, 11.5]) box(scene, -22, y + 0.3, 464, 20.3, 0.5, 22.3, TRIM);
  for (const f of [1.2, 5, 8.8]) for (let k = 0; k < 5; k++) {
    box(scene, -11.9, f + 0.3, 455 + k * 4.4, 0.15, 2.2, 1.4, TRIM); // окна на Советскую
    box(scene, -32.1, f + 0.3, 455 + k * 4.4, 0.15, 2.2, 1.4, TRIM);
  }
  for (let k = 0; k < 4; k++) box(scene, -27 + k * 4.4, 1.5, 452.9, 1.4, 2.2, 0.15, TRIM);
  // Ствол башни на углу дома: кирпич с белыми углами.
  const tx = -13.5, tz = 456;
  city.solid(tx, 0, tz, 6.5, 30, 6.5); box(scene, tx, 0.3, tz, 6.5, 30, 6.5, BRICK);
  for (const [dx, dz] of [[-3.1, -3.1], [3.1, -3.1], [-3.1, 3.1], [3.1, 3.1]]) box(scene, tx + dx, 0.3, tz + dz, 0.5, 30, 0.5, TRIM);
  box(scene, tx, 14.3, tz, 6.9, 0.4, 6.9, TRIM); // пояс под часами
  // Часы на четыре стороны: тёмный квадрат, золотой круг, стрелки и золотые точки.
  for (const [nx, nz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const cx = tx + nx * 3.3, cz = tz + nz * 3.3, ry = nx ? Math.PI / 2 : 0;
    const panel = box(scene, cx, 16.5, cz, 3.6, 3.6, 0.2, CLOCK); panel.rotation.y = ry;
    const ring = BABYLON.MeshBuilder.CreateTorus('clockRing', { diameter: 2.4, thickness: 0.18, tessellation: 24 }, scene);
    ring.position.set(cx + nx * 0.12, 18.3, cz + nz * 0.12); ring.material = mat(scene, GOLD, { shiny: true });
    if (nx) ring.rotation.z = Math.PI / 2; else ring.rotation.x = Math.PI / 2; // кольцо ставим вертикально к своей грани
    const hand = box(scene, cx + nx * 0.15, 18.3, cz + nz * 0.15, 0.14, 1.1, 0.1, GOLD, { shiny: true }); hand.rotation.y = ry; hand.position.y = 18.75;
    const hand2 = box(scene, cx + nx * 0.15, 18.3, cz + nz * 0.15, 0.7, 0.14, 0.1, GOLD, { shiny: true }); hand2.rotation.y = ry; hand2.position.y = 18.3;
    for (const [a, b] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5], [0, -1.75], [0, 1.75], [-1.75, 0], [1.75, 0]]) {
      sphere(scene, cx + nx * 0.15 + (nx ? 0 : a), 18.3 + b, cz + nz * 0.15 + (nx ? a : 0), 0.14, GOLD, { shiny: true });
    }
    // Окошки со ставнями под часами, где выходят фигурки.
    const sh = box(scene, cx, 11.8, cz, 1.6, 2, 0.25, SHUTTER); sh.rotation.y = ry;
  }
  // Ярус колоколов: белые колонны по углам, колокола внутри, зелёный карниз.
  city.solid(tx, 30, tz, 5, 4.5, 5);
  box(scene, tx, 30.3, tz, 3.2, 4.5, 3.2, BRICK);
  for (const [dx, dz] of [[-2.9, -2.9], [2.9, -2.9], [-2.9, 2.9], [2.9, 2.9]]) box(scene, tx + dx, 30.3, tz + dz, 0.6, 4.5, 0.6, TRIM);
  for (const [dx, dz] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) { cone(scene, tx + dx, 32.3, tz + dz, 0.5, 0.9, '#6b6b60'); }
  box(scene, tx, 34.8, tz, 7.2, 0.5, 7.2, GREEN);
  // Верхний ярус, зелёный шатёр, шар, шпиль и флюгер.
  city.solid(tx, 35.3, tz, 4.5, 4, 4.5);
  box(scene, tx, 35.3, tz, 4.5, 4, 4.5, BRICK);
  for (const [dx, dz] of [[-2.1, -2.1], [2.1, -2.1], [-2.1, 2.1], [2.1, 2.1]]) box(scene, tx + dx, 35.3, tz + dz, 0.4, 4, 0.4, TRIM);
  cone(scene, tx, 39.3, tz, 3.6, 5, GREEN, { sides: 4 }).rotation.y = Math.PI / 4;
  sphere(scene, tx, 44.6, tz, 0.35, '#c9ced4', { shiny: true });
  cyl(scene, tx, 44.6, tz, 0.06, 3.5, '#333');
  box(scene, tx, 47.6, tz, 1.2, 0.3, 0.1, GOLD, { shiny: true });
  city.window({ min: { x: -32, y: 0, z: 453 }, max: { x: -12, y: 11.5, z: 475 } }, 1, 0, 'shop', 'Магазин под курантами');
  label(scene, 'Башня с курантами', tx, 51, tz, 30);
  city.place('Башня с курантами', tx, tz, 22);

  // Пушкин и Даль: два бронзовых собеседника на постаменте на той же площади.
  city.solid(-30, 0, 485, 4, 2, 3); box(scene, -30, 0.3, 485, 4, 2, 3, GRAY);
  for (const dx of [-1, 1]) { cyl(scene, -30 + dx, 2.3, 485, 0.5, 2.6, BRONZE); sphere(scene, -30 + dx, 5.3, 485, 0.45, BRONZE); }
  for (const [dx, dz] of [[-16, -16], [-16, 16], [16, 16]]) city.spawn('nature/tree_oak', -25 + dx, 475 + dz);
  for (let i = 0; i < 8; i++) city.spawn(['nature/flower_redA', 'nature/flower_yellowA'][i % 2], -25 + (i % 4) * 3 - 4.5, 490 + Math.floor(i / 4) * 3);
  city.place('Пушкин и Даль', -30, 485, 10);

  // Дом Советов: объём из коробок, фасад — фотография с Викисклада (см. CREDITS), сзади двор между крыльями.
  city.reserve(3, 10);
  const STONE = '#e3d6b4', GRANITE = '#4a4744', ROOF = '#8f8a82';
  const bx = -66, bz = 575, front = bx + 10; // фасад смотрит на восток, на сквер
  box(scene, -75, 0, bz, 50, 0.3, 50, '#b9b3a8'); // мощёный квартал
  // Высоты коробок — по силуэту на фотографии, чтобы не торчать над крышей.
  city.solid(bx, 0, bz, 20, 9.2, 46); box(scene, bx, 0.3, bz, 20, 9.2, 46, STONE);
  box(scene, bx - 0.4, 9.5, bz, 19, 0.3, 45.6, ROOF);
  for (const dz of [-19, 19]) { city.solid(-86, 0, bz + dz, 20, 9.2, 8); box(scene, -86, 0.3, bz + dz, 20, 9.2, 8, STONE); box(scene, -86, 9.5, bz + dz, 19.6, 0.3, 7.6, ROOF); } // крылья вокруг двора
  for (const dz of [-20.5, 20.5]) { city.solid(bx, 0, bz + dz, 20, 14.2, 5); box(scene, bx, 0.3, bz + dz, 20, 14.2, 5, STONE); } // концевые павильоны выше
  city.solid(bx, 0, bz, 20, 9.7, 18); box(scene, bx, 0.3, bz, 20, 9.7, 18, STONE); // центральная часть
  city.solid(bx, 0, bz, 20, 10.2, 7); box(scene, bx, 0.3, bz, 20, 10.2, 7, STONE); // фронтон
  box(scene, front + 0.05, 0.3, bz, 0.2, 4.2, 46, GRANITE); // цоколь
  // Фотография фасада: 46 м в ширину, высота по пропорции снимка; торчащие части закрываем ей же.
  photo(scene, 'assets/photos/dom-sovetov.webp', front + 0.12, 0.3, bz, 46, 46 * 677 / 2048, -Math.PI / 2);
  for (const [dz, c] of [[-2.5, '#ffffff'], [2.5, '#d22b2b']]) { cyl(scene, bx, 10.5, bz + dz, 0.08, 4, '#555'); box(scene, bx + 0.6, 13.5, bz + dz, 1.4, 0.9, 0.05, c); }
  for (const dz of [-14, -10, 10, 14]) { cyl(scene, front + 3.5, 0.3, bz + dz, 0.25, 1.5, '#5a3a22'); cone(scene, front + 3.5, 1.6, bz + dz, 1.8, 8, '#3f6a5a', { sides: 8 }); }
  city.window({ min: { x: bx - 10, y: 0, z: bz - 23 }, max: { x: front, y: 10, z: bz + 23 } }, 1, 0, 'cafe', 'Буфет Дома Советов');
  label(scene, 'Дом Советов', bx, 24, bz, 30);
  city.place('Дом Советов', -76, bz, 36);
  // Памятник Ленину на углу сквера напротив Дома Советов и высотка через улицу.
  city.solid(-42, 0, 556, 3, 6, 3); box(scene, -42, 0.3, 556, 3, 6, 3, GRANITE);
  cyl(scene, -42, 6.3, 556, 0.8, 4, BRONZE); sphere(scene, -42, 10.9, 556, 0.6, BRONZE);
  city.place('Памятник Ленину', -42, 556, 8);
  city.reserve(3, 11);
  box(scene, -75, 0, 625, 50, 0.3, 50, '#b9b3a8');
  city.solidSpawn('buildings/building-skyscraper-b', -75, 625, -Math.PI / 2, [1, 0, 'bedroom', 'Гостиница']);

  // Сквер у Дома Советов по фото: круглый фонтан из розового гранита с золотыми ярусами, кольцо мостовой, деревья, улей.
  city.reserve(4, 10);
  const fx = -25, fz = 575;
  cyl(scene, fx, 0, fz, 12, 0.15, '#c9c4bb'); // мощёное кольцо
  for (const [w, d] of [[4, 50], [50, 4]]) box(scene, fx, 0, fz, w, 0.16, d, '#c9c4bb'); // дорожки крестом
  for (const a of [Math.PI / 4, -Math.PI / 4]) box(scene, fx, 0, fz, 3, 0.16, 64, '#c9c4bb').rotation.y = a; // и по диагоналям, как на снимке сверху
  cyl(scene, fx, 0.15, fz, 7, 0.9, '#c98a7a'); cyl(scene, fx, 0.15, fz, 6.2, 1.0, '#3f8fd6', { alpha: 0.85 });
  for (const [r, y] of [[3.2, 1.15], [2.4, 1.95], [1.5, 2.75]]) {
    cyl(scene, fx, y, fz, r, 0.8, '#b86f5f');
    const rim = BABYLON.MeshBuilder.CreateTorus('rim', { diameter: r * 2, thickness: 0.35, tessellation: 24 }, scene);
    rim.position.set(fx, y + 0.8, fz); rim.material = mat(scene, GOLD, { shiny: true });
  }
  sphere(scene, fx, 3.9, fz, 0.7, GOLD, { shiny: true, squash: 0.7 });
  cyl(scene, fx, 3.9, fz, 0.18, 7, '#bfe4ff', { alpha: 0.6 }); // струя
  city.solid(fx, 0, fz, 14, 1.2, 14);
  city.source('water', fx, fz, 8, 1.2);
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    if (i % 4 === 0) continue; // дорожки
    city.spawn(['nature/flower_redA', 'nature/flower_yellowA', 'nature/flower_purpleA'][i % 3], fx + Math.cos(a) * 9.5, fz + Math.sin(a) * 9.5);
  }
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2 + 0.26;
    if (Math.abs(Math.cos(a)) > 0.93 || Math.abs(Math.sin(a)) > 0.93) continue;
    city.spawn(i % 2 ? 'nature/tree_oak' : 'nature/tree_default', fx + Math.cos(a) * 19, fz + Math.sin(a) * 19);
  }
  for (const [dx, dz] of [[-15, -15], [15, -15], [-15, 15], [15, 15]]) box(scene, fx + dx, 0.2, fz + dz, 1.8, 0.5, 0.6, '#6b4a2e'); // скамейки
  cyl(scene, -10, 0, 590, 0.7, 2.4, '#7a5a3a'); // пень
  sphere(scene, -10, 3.6, 590, 1.6, '#d9a441', { squash: 0.8 }); sphere(scene, -10, 3.2, 590 - 1.4, 0.35, '#2b2118');
  city.solid(-10, 0, 590, 3.2, 4.6, 3.2);
  city.source('rest', -10, 590, 4, 4.6);
  city.hive = new BABYLON.Vector3(-10, 7, 582); // старт перед ульем, улей впереди
  label(scene, 'Улей', -10, 7.5, 590, 10);
  city.place('Сквер у Дома Советов', fx, fz, 26);

  // Никольский собор: белый храм с золотыми куполами и колокольней.
  city.reserve(10, 6);
  city.solid(275, 0, 378, 20, 12, 26); box(scene, 275, 0, 378, 20, 12, 26, WHITE);
  cyl(scene, 275, 12, 378, 4, 5, WHITE); sphere(scene, 275, 20, 378, 4.2, GOLD, { shiny: true }); cone(scene, 275, 24, 378, 0.3, 3, GOLD);
  for (const [dx, dz] of [[-7, -9], [7, -9], [-7, 9], [7, 9]]) { cyl(scene, 275 + dx, 12, 378 + dz, 1.8, 3, WHITE); sphere(scene, 275 + dx, 16.5, 378 + dz, 2, GOLD, { shiny: true }); }
  city.solid(275, 0, 360, 6, 24, 6); box(scene, 275, 0, 360, 6, 24, 6, WHITE); sphere(scene, 275, 26, 360, 3, GOLD, { shiny: true });
  label(scene, 'Никольский собор', 275, 34, 378, 30);
  city.place('Никольский собор', 275, 375, 30);

  // Караван-Сарай: белый корпус, мечеть с бирюзовым куполом и минарет.
  city.reserve(3, 13);
  city.solid(-75, 0, 748, 34, 8, 14); box(scene, -75, 0, 748, 34, 8, 14, '#f3efe6');
  city.solid(-75, 0, 728, 12, 10, 12); cyl(scene, -75, 0, 728, 6.5, 10, '#f3efe6', { sides: 8 }); sphere(scene, -75, 11, 728, 6.2, TEAL, { squash: 0.8 });
  city.solid(-90, 0, 728, 3, 30, 3); cyl(scene, -90, 0, 728, 1.5, 28, '#f3efe6'); cone(scene, -90, 28, 728, 2, 5, TEAL);
  label(scene, 'Караван-Сарай', -75, 34, 740, 30);
  city.place('Караван-Сарай', -78, 740, 30);

  // Вокзал: объём из коробок, фасад — фотография с Викисклада (см. CREDITS); фасад на юг, площадь с памятником Рычкову.
  const YEL = '#e9b93f', WH = '#f7f4ee';
  const vx = -300, vz = 835, vf = vz - 7; // vf — лицевая грань
  // Коробки ниже крыш на фото: где на снимке небо, видно небо игры.
  city.solid(vx, 0, vz, 60, 7.2, 14); box(scene, vx, 0.3, vz, 60, 7.2, 14, YEL);
  city.solid(vx, 0, vz, 16, 9.4, 14); box(scene, vx, 0.3, vz, 16, 9.4, 14, YEL); // центральная часть выше
  box(scene, vx, 7.5, vz + 0.5, 59.6, 0.3, 12.6, '#3f7f5f'); box(scene, vx, 9.7, vz + 0.5, 15.6, 0.3, 12.6, '#3f7f5f'); // зелёные крыши позади фасада
  box(scene, vx, 0.3, vf - 0.1, 60, 1.6, 0.2, '#6b6560'); // цоколь
  photo(scene, 'assets/photos/vokzal.webp', vx, 1.6, vf - 0.15, 62, 62 * 329 / 2048, 0);
  box(scene, vx, 0, vz + 9, 70, 0.6, 5, '#b9b3a8'); // перрон
  // Привокзальная площадь: круг, памятник Рычкову на розовом постаменте, ядра на цепях.
  box(scene, vx, 0, vz - 26, 96, 0.3, 36, '#a9a6a0');
  cyl(scene, vx, 0.3, vz - 26, 13, 0.25, '#c9c4bb');
  city.solid(vx, 0, vz - 26, 3, 5.5, 3); box(scene, vx, 0.55, vz - 26, 3, 5, 3, '#b8746a');
  cyl(scene, vx, 5.55, vz - 26, 0.7, 3.6, BRONZE); sphere(scene, vx, 9.6, vz - 26, 0.5, BRONZE);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; sphere(scene, vx + Math.cos(a) * 9, 0.85, vz - 26 + Math.sin(a) * 9, 0.45, '#222'); }
  city.place('Памятник Рычкову', vx, vz - 26, 10);
  city.window({ min: { x: vx - 30, y: 0, z: vf }, max: { x: vx + 30, y: 8, z: vz + 7 } }, 0, -1, 'cafe', 'Буфет вокзала');
  label(scene, 'Вокзал', vx, 16, vz);
  city.place('Вокзал', vx, vz - 5, 45);

  // Национальная деревня: домики разных народов вокруг площади, восточнее города.
  const cx = 420, cz = 300;
  cyl(scene, cx, 0, cz, 4, 0.8, GRAY); cyl(scene, cx, 0.8, cz, 3.4, 0.2, '#3f8fd6', { alpha: 0.85 });
  city.source('water', cx, cz, 5, 0.8);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, x = cx + Math.cos(a) * 32, z = cz + Math.sin(a) * 32;
    city.solidSpawn('houses/building-type-' + 'abcdefgh'[i], x, z, -a - Math.PI / 2, [Math.abs(Math.cos(a)) > 0.5 ? -Math.sign(Math.cos(a)) : 0, Math.abs(Math.cos(a)) > 0.5 ? 0 : -Math.sign(Math.sin(a)), 'kitchen', 'Подворье']);
  }
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; city.spawn('nature/tree_detailed', cx + Math.cos(a) * 50, cz + Math.sin(a) * 50); }
  label(scene, 'Национальная деревня', cx, 22, cz, 40);
  city.place('Национальная деревня', cx, cz, 60);

  // Дом Егора: девятиэтажка севернее города, первый подъезд отмечен табличкой.
  const eg = city.solidSpawn('buildings/building-skyscraper-a', 200, 930, 0, [0, -1, 'kids', 'Комната Егора']);
  box(scene, 200, 0, 930 - 8, 30, 0.1, 20, '#a8a8a8'); // двор
  for (const dx of [-14, 14]) city.spawn('nature/tree_default', 200 + dx, 918);
  label(scene, 'Дом Егора', 200, eg.bounds.max.y + 5, 930, 26);
  label(scene, '1 подъезд', 196, 4, eg.bounds.min.z - 1, 8);
  city.place('Дом Егора', 200, 925, 30);

  // Зауральная роща за рекой: деревья на азиатском берегу, потом здесь поселятся байбаки.
  for (let i = 0; i < 70; i++) {
    const a = city.rnd() * Math.PI * 2, r = Math.sqrt(city.rnd()) * 110;
    city.spawn(['nature/tree_default', 'nature/tree_oak', 'nature/tree_pineTallA', 'nature/tree_detailed'][i % 4], 150 + Math.cos(a) * r, -150 + Math.sin(a) * r * 0.6);
  }
  label(scene, 'Зауральная роща', 150, 18, -150, 36);
  city.place('Зауральная роща', 150, -150, 110);
}
