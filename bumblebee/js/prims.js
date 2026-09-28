// Простые фигуры для достопримечательностей и подписи; y везде — низ фигуры.
const mats = new Map();

export function mat(scene, hex, opts = {}) {
  const key = hex + JSON.stringify(opts);
  if (mats.has(key)) return mats.get(key);
  const m = new BABYLON.StandardMaterial('m' + hex, scene);
  m.diffuseColor = BABYLON.Color3.FromHexString(hex);
  m.specularColor = opts.shiny ? new BABYLON.Color3(0.6, 0.6, 0.6) : BABYLON.Color3.Black();
  if (opts.alpha !== undefined) m.alpha = opts.alpha;
  if (opts.emissive) m.emissiveColor = BABYLON.Color3.FromHexString(opts.emissive);
  mats.set(key, m);
  return m;
}

export function box(scene, x, y, z, w, h, d, hex, opts) {
  const m = BABYLON.MeshBuilder.CreateBox('box', { width: w, height: h, depth: d }, scene);
  m.position.set(x, y + h / 2, z);
  m.material = mat(scene, hex, opts);
  return m;
}

export function cyl(scene, x, y, z, r, h, hex, opts = {}) {
  const m = BABYLON.MeshBuilder.CreateCylinder('cyl', { diameter: r * 2, height: h, tessellation: opts.sides ?? 24 }, scene);
  m.position.set(x, y + h / 2, z);
  m.material = mat(scene, hex, opts);
  return m;
}

export function cone(scene, x, y, z, r, h, hex, opts = {}) {
  const m = BABYLON.MeshBuilder.CreateCylinder('cone', { diameterTop: 0, diameterBottom: r * 2, height: h, tessellation: opts.sides ?? 24 }, scene);
  m.position.set(x, y + h / 2, z);
  m.material = mat(scene, hex, opts);
  return m;
}

// Сфера задаётся центром, а не низом: купола и головы удобнее ставить так.
export function sphere(scene, x, cy, z, r, hex, opts = {}) {
  const m = BABYLON.MeshBuilder.CreateSphere('sph', { diameter: r * 2, segments: 16 }, scene);
  m.position.set(x, cy, z);
  if (opts.squash) m.scaling.y = opts.squash;
  m.material = mat(scene, hex, opts);
  return m;
}

// Подпись над местом: табличка всегда повёрнута к камере.
// opts.flat — не поворачивать к камере (надпись на стене), opts.rotationY — куда смотрит стена.
export function label(scene, text, x, y, z, width = 24, opts = {}) {
  const tex = new BABYLON.DynamicTexture('lbl', { width: 1024, height: 192 }, scene, false);
  tex.hasAlpha = true;
  const ctx = tex.getContext();
  const font = (px) => `bold ${px}px -apple-system, Segoe UI, Roboto, Arial, sans-serif`;
  ctx.font = font(96);
  // Длинный текст ужимаем, чтобы он поместился в текстуру.
  const fit = Math.min(1, 940 / ctx.measureText(text).width);
  ctx.font = font(Math.floor(96 * fit));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 14;
  ctx.strokeStyle = 'rgba(40,25,0,0.85)';
  if (!opts.noStroke) ctx.strokeText(text, 512, 96);
  ctx.fillStyle = opts.color || '#fff';
  ctx.fillText(text, 512, 96);
  tex.update();
  const m = new BABYLON.StandardMaterial('lblMat', scene);
  m.diffuseTexture = tex;
  m.emissiveColor = BABYLON.Color3.White();
  m.disableLighting = true;
  m.backFaceCulling = false;
  const plane = BABYLON.MeshBuilder.CreatePlane('label', { width, height: width * 192 / 1024 }, scene);
  plane.position.set(x, y, z);
  plane.material = m;
  if (opts.flat) plane.rotation.y = opts.rotationY || 0; else plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
  plane.isPickable = false;
  return plane;
}

// Фотография на стене: плоскость с картинкой, прозрачные места (небо) не рисуются.
export function photo(scene, url, x, y, z, width, height, rotationY = 0) {
  const m = new BABYLON.StandardMaterial('photo', scene);
  const tex = new BABYLON.Texture(url, scene);
  tex.hasAlpha = true;
  m.diffuseTexture = tex;
  m.useAlphaFromDiffuseTexture = true;
  m.specularColor = BABYLON.Color3.Black();
  m.emissiveColor = new BABYLON.Color3(0.35, 0.35, 0.35); // чтобы фасад не темнел в тени
  m.backFaceCulling = false;
  const plane = BABYLON.MeshBuilder.CreatePlane('photo', { width, height }, scene);
  plane.position.set(x, y + height / 2, z);
  plane.rotation.y = rotationY;
  plane.material = m;
  return plane;
}
