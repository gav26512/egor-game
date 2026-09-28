import { CFG } from './config.js';

// Шмель из простых фигур: полосатое тело, голова, четыре крыла, лапки и усики.
export function createBee(scene) {
  const B = BABYLON;
  const root = new B.TransformNode('bee', scene);
  const body = new B.TransformNode('beeBody', scene);
  body.parent = root;
  body.scaling.setAll(CFG.bee.scale);

  const black = new B.StandardMaterial('beeBlack', scene);
  black.diffuseColor = B.Color3.FromHexString('#2b2118');
  black.specularColor = B.Color3.Black();
  const wingMat = new B.StandardMaterial('beeWing', scene);
  wingMat.diffuseColor = B.Color3.FromHexString('#dff2ff');
  wingMat.emissiveColor = B.Color3.FromHexString('#557799');
  wingMat.alpha = 0.4;
  wingMat.backFaceCulling = false;

  // Тело: сфера, вытянутая вдоль Z, полоски нарисованы на текстуре.
  const bodyMat = new B.StandardMaterial('beeBodyMat', scene);
  bodyMat.diffuseTexture = stripes(scene);
  bodyMat.specularColor = new B.Color3(0.15, 0.15, 0.15);
  let rainbow = false;
  const torso = B.MeshBuilder.CreateSphere('beeTorso', { diameter: 1, segments: 24 }, scene);
  torso.material = bodyMat;
  torso.rotation.x = Math.PI / 2; // полюса сферы смотрят вдоль тела
  torso.scaling.set(0.62, 0.56, 0.95);
  torso.parent = body;

  // Голова с глазами и усиками; перед шмеля — плюс Z, как летит камера.
  const head = B.MeshBuilder.CreateSphere('beeHead', { diameter: 0.36 }, scene);
  head.material = black;
  head.position.z = 0.52;
  head.parent = body;
  const eyeMat = new B.StandardMaterial('beeEyeMat', scene);
  eyeMat.diffuseColor = B.Color3.White();
  eyeMat.emissiveColor = new B.Color3(0.3, 0.3, 0.3);
  for (const x of [-0.11, 0.11]) {
    const eye = B.MeshBuilder.CreateSphere('beeEye', { diameter: 0.11 }, scene);
    eye.material = eyeMat;
    eye.position.set(x, 0.08, 0.66);
    eye.parent = body;
    const pupil = B.MeshBuilder.CreateSphere('beePupil', { diameter: 0.05 }, scene);
    pupil.material = black;
    pupil.position.set(x, 0.08, 0.71);
    pupil.parent = body;
    const antenna = B.MeshBuilder.CreateCylinder('beeAntenna', { diameter: 0.025, height: 0.35 }, scene);
    antenna.material = black;
    antenna.position.set(x * 0.8, 0.28, 0.7);
    antenna.rotation.x = -0.9;
    antenna.rotation.z = -x * 2.5;
    antenna.parent = body;
  }

  // Шесть лапок, поджатых под телом; на посадке они выпрямляются.
  const legs = [];
  for (const z of [-0.2, 0.05, 0.3]) for (const side of [-1, 1]) {
    const leg = B.MeshBuilder.CreateCylinder('beeLeg', { diameter: 0.03, height: 0.32 }, scene);
    leg.material = black;
    leg.position.set(side * 0.22, -0.18, z);
    leg.rotation.z = side * 0.9;
    leg.parent = body;
    legs.push({ mesh: leg, side });
  }

  // Четыре крыла на шарнирах: передние больше задних.
  const wings = [];
  for (const side of [-1, 1]) for (const [z, len, wid] of [[0.08, 0.95, 0.42], [-0.16, 0.7, 0.3]]) {
    const pivot = new B.TransformNode('wingPivot', scene);
    pivot.position.set(side * 0.1, 0.24, z);
    pivot.parent = body;
    const wing = B.MeshBuilder.CreateDisc('wing', { radius: len / 2, tessellation: 24 }, scene);
    wing.material = wingMat;
    wing.rotation.x = Math.PI / 2;
    wing.scaling.set(1, 1, wid / (len / 2));
    wing.position.x = side * (len / 2 + 0.02);
    wing.rotation.y = side * 0.25; // крылья слегка назад
    wing.parent = pivot;
    wings.push({ pivot, side });
  }

  const state = {
    root, yaw: 0, speed: 0, vy: 0, landed: false, bumped: false, time: 0,
    velocity: new B.Vector3(0, 0, 0),
  };

  // Расцветка из магазина: перерисовываем полоски.
  state.setSkin = (skin) => {
    bodyMat.diffuseTexture?.dispose();
    bodyMat.diffuseTexture = stripes(scene, skin);
    bodyMat.specularColor = skin.shiny ? new B.Color3(0.7, 0.7, 0.5) : new B.Color3(0.15, 0.15, 0.15);
    rainbow = !!skin.rainbow;
    bodyMat.diffuseColor = B.Color3.White();
  };

  state.reset = (pos) => {
    root.position.copyFrom(pos);
    root.rotation.set(0, 0, 0);
    body.rotation.set(0, 0, 0);
    state.yaw = 0; state.speed = 0; state.vy = 0; state.landed = false;
  };

  // input — из controls.read(); world — city: collide, bounds, overWater.
  state.update = (dt, input, world) => {
    const c = CFG.bee;
    state.time += dt;
    state.bumped = false;
    const moving = input.forward !== 0 || input.climb !== 0 || input.turn !== 0;
    if (state.landed && moving) { state.landed = false; state.vy = 2; }

    if (!state.landed) {
      state.yaw += input.turn * c.turn * dt;
      const target = input.forward * (input.boost ? c.boost : c.speed) * (input.tired ? 0.6 : 1);
      state.speed += (target - state.speed) * Math.min(1, c.accel * dt);
      const idle = input.forward === 0 && input.climb === 0;
      const wantVy = input.climb !== 0 ? input.climb * c.climb : (idle ? -c.sink : 0);
      state.vy += (wantVy - state.vy) * Math.min(1, c.accel * 1.5 * dt);
    } else {
      state.speed = 0; state.vy = 0;
    }

    const forward = new B.Vector3(Math.sin(state.yaw), 0, Math.cos(state.yaw));
    state.velocity.copyFrom(forward.scale(state.speed));
    state.velocity.y = state.vy;
    const pos = root.position;
    pos.addInPlace(state.velocity.scale(dt));

    // Границы мира, земля, вода, дома.
    const b = world.bounds;
    pos.x = Math.min(b.maxX, Math.max(b.minX, pos.x));
    pos.z = Math.min(b.maxZ, Math.max(b.minZ, pos.z));
    pos.y = Math.min(b.maxY, pos.y);
    let landed = false;
    if (world.overWater(pos.x, pos.z)) {
      if (pos.y < c.radius + 0.4) { pos.y = c.radius + 0.4; state.vy = Math.max(0, state.vy); }
    } else if (pos.y <= c.radius) { pos.y = c.radius; landed = true; }
    const hit = world.collide(pos, c.radius);
    if (hit.landed) landed = true;
    if (hit.wall) {
      if (Math.abs(state.speed) > 6) state.bumped = true;
      state.speed = 0;
    }
    if (landed && state.vy <= 0) { state.landed = true; state.vy = 0; }

    // Наклоны: нос вниз при разгоне, крен в повороте; на посадке шмель ровный.
    root.rotation.y = state.yaw;
    const pitch = state.landed ? 0 : -state.speed / c.boost * 0.35 - state.vy * 0.04;
    const roll = state.landed ? 0 : -input.turn * 0.4;
    body.rotation.x += (pitch - body.rotation.x) * Math.min(1, 8 * dt);
    body.rotation.z += (roll - body.rotation.z) * Math.min(1, 8 * dt);

    // Крылья: в полёте машут, на посадке сложены; лапки наоборот.
    if (rainbow) bodyMat.diffuseColor = B.Color3.FromHSV((state.time * 90) % 360, 0.6, 1);
    const flap = state.landed ? 0 : Math.sin(state.time * c.wingHz * Math.PI * 2) * 0.75;
    for (const w of wings) w.pivot.rotation.z = w.side * ((state.landed ? 0.05 : 0.35) + flap);
    for (const l of legs) {
      const want = state.landed ? l.side * 0.35 : l.side * 0.9;
      l.mesh.rotation.z += (want - l.mesh.rotation.z) * Math.min(1, 6 * dt);
    }
  };

  return state;
}

// Текстура тела: светлый кончик, тёмные и яркие полосы, лёгкий «мех» точками.
function stripes(scene, skin = { a: '#ffc933', b: '#2b2118', tail: '#f4f1e6' }) {
  const tex = new BABYLON.DynamicTexture('beeStripes', { width: 128, height: 256 }, scene, true);
  const ctx = tex.getContext();
  const bands = skin.rainbow
    ? [['#ffffff', 0.14], ['#ff4d4d', 0.17], ['#ffd23f', 0.17], ['#6fdc4a', 0.17], ['#4fa3ff', 0.17], ['#b56cff', 0.18]]
    : [[skin.tail, 0.14], [skin.b, 0.22], [skin.a, 0.2], [skin.b, 0.2], [skin.a, 0.24]];
  let y = 0;
  for (const [color, h] of bands) { ctx.fillStyle = color; ctx.fillRect(0, y * 256, 128, h * 256 + 1); y += h; }
  for (let i = 0; i < 900; i++) {
    const px = Math.random() * 128, py = Math.random() * 256;
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.18)';
    ctx.fillRect(px, py, 1.5, 1.5);
  }
  tex.update();
  return tex;
}
