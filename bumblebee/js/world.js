import { CFG } from './config.js';

// Небо, туман и свет; сам город строит city.js.
export function createEnvironment(scene) {
  const B = BABYLON;
  scene.clearColor = B.Color4.FromHexString('#8fd3ffff');
  scene.fogMode = B.Scene.FOGMODE_LINEAR;
  scene.fogColor = B.Color3.FromHexString('#8fd3ff');
  scene.fogStart = CFG.world.fogStart;
  scene.fogEnd = CFG.world.fogEnd;

  const hemi = new B.HemisphericLight('sky', new B.Vector3(0.2, 1, 0.1), scene);
  hemi.intensity = 0.9;
  hemi.groundColor = B.Color3.FromHexString('#5f8f3f');
  const sun = new B.DirectionalLight('sun', new B.Vector3(-0.5, -1, 0.3), scene);
  sun.intensity = 0.6;
}
