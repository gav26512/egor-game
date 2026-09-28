import { CFG } from './config.js';
import { mat } from './prims.js';

// Птицы над городом, удары о машины и стены, люди в комнатах, которые отмахиваются.
export function createDanger(scene, bee, needs, hud, rnd, audio) {
  const B = BABYLON;
  const D = CFG.danger;
  let hurtCooldown = 0;

  const hurt = (amount, text) => {
    if (hurtCooldown > 0) return;
    hurtCooldown = 1.5;
    needs.energy -= amount; needs.clamp();
    hud.flash(text, 1.2);
    audio?.hit();
  };

  // Птица: тёмное тело, две машущие плоскости-крыла; кружит у дома, а заметив шмеля — гонится.
  const birds = [];
  const birdMat = mat(scene, '#4a3f36');
  const wingMat = mat(scene, '#5b4e43');
  for (let i = 0; i < D.birds; i++) {
    const root = new B.TransformNode('bird', scene);
    const body = B.MeshBuilder.CreateSphere('birdBody', { diameter: 0.5, segments: 8 }, scene);
    body.scaling.set(0.8, 0.7, 1.4); body.material = birdMat; body.parent = root;
    const beak = B.MeshBuilder.CreateCylinder('beak', { diameterTop: 0, diameterBottom: 0.12, height: 0.25, tessellation: 6 }, scene);
    beak.rotation.x = Math.PI / 2; beak.position.z = 0.42; beak.material = mat(scene, '#e0a030'); beak.parent = root;
    const wings = [-1, 1].map((side) => {
      const w = B.MeshBuilder.CreatePlane('birdWing', { width: 0.9, height: 0.4 }, scene);
      w.material = wingMat; w.rotation.x = Math.PI / 2; w.position.x = side * 0.55; w.parent = root; w.material.backFaceCulling = false;
      return { mesh: w, side };
    });
    const home = new B.Vector3(-200 + rnd() * 450, 18 + rnd() * 20, 80 + rnd() * 700);
    birds.push({ root, wings, home, angle: rnd() * Math.PI * 2, state: 'circle', cooldown: 0, t: rnd() * 10 });
  }

  const tmp = new B.Vector3();
  function updateBirds(dt, outside) {
    const pos = bee.root.position;
    for (const b of birds) {
      b.t += dt;
      b.cooldown = Math.max(0, b.cooldown - dt);
      const dist = outside ? B.Vector3.Distance(b.root.position, pos) : Infinity;
      const canChase = outside && !bee.landed && pos.y > 2.5 && b.cooldown === 0;
      if (b.state === 'circle' && canChase && dist < D.birdNotice) b.state = 'chase';
      if (b.state === 'chase' && (!canChase || dist > D.birdGiveUp)) b.state = 'circle';
      let target;
      if (b.state === 'chase') target = pos;
      else { b.angle += dt * 0.5; target = tmp.set(b.home.x + Math.cos(b.angle) * 25, b.home.y + Math.sin(b.t) * 2, b.home.z + Math.sin(b.angle) * 25); }
      const dir = target.subtract(b.root.position);
      const len = dir.length();
      if (len > 0.01) {
        const speed = b.state === 'chase' ? D.birdSpeed : 6;
        b.root.position.addInPlace(dir.scale(Math.min(1, speed * dt / len)));
        b.root.rotation.y = Math.atan2(dir.x, dir.z);
      }
      if (b.state === 'chase' && dist < 1.1) {
        hurt(D.birdHit, 'Ай! Птица клюнула!');
        b.state = 'circle'; b.cooldown = 6;
      }
      const flap = Math.sin(b.t * 9) * 0.7;
      for (const w of b.wings) w.mesh.rotation.z = w.side * flap;
    }
  }

  return {
    // outside — шмель на улице; cars — список машин; person — человек в комнате.
    update(dt, { outside, cars, trains, person, roomFloor }) {
      hurtCooldown = Math.max(0, hurtCooldown - dt);
      updateBirds(dt, outside);
      const pos = bee.root.position;
      if (bee.bumped) hurt(D.wallHit, 'Ой! Стена!');
      if (outside && trains && trains.hits(pos)) { hurt(D.trainHit, 'Ой! Поезд!'); bee.vy = 5; }
      if (outside && cars && pos.y < 2.4) {
        for (const c of cars) {
          const p = c.root.position;
          if (Math.abs(pos.x - p.x) < 2.2 && Math.abs(pos.z - p.z) < 2.6) { hurt(D.carHit, 'Ой! Машина!'); bee.vy = 4; break; }
        }
      }
      if (!outside && person) {
        // Человек замечает шмеля рядом и отмахивается; поворачивается к нему.
        const p = person.position;
        const d = Math.hypot(pos.x - p.x, pos.z - p.z);
        if (d < D.personNotice) {
          person.rotation.y = Math.atan2(pos.x - p.x, pos.z - p.z);
          person.rotation.z = Math.sin(performance.now() / 90) * 0.12; // машет всем телом, как рассерженный
          if (d < D.personReach && pos.y < roomFloor + 3.5) {
            hurt(D.personHit, 'Ай! Человек отмахнулся!');
            bee.vy = 3; bee.speed = -6;
          }
        } else person.rotation.z *= 0.9;
      }
    },
  };
}
