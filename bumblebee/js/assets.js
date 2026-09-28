import { CFG } from './config.js';

// Загружает glb-модели из assets/models и раздаёт их копии; имя модели — «папка/файл».
export async function loadAssets(scene, names, onProgress = () => {}) {
  const B = BABYLON;
  const containers = new Map();
  let done = 0;
  await Promise.all(names.map(async (name) => {
    const [folder, file] = name.split('/');
    const container = await B.LoadAssetContainerAsync(`assets/models/${folder}/${file}.glb`, scene);
    containers.set(name, container);
    onProgress(++done / names.length);
  }));

  return {
    // Ставит копию модели в сцену; масштаб по умолчанию — из CFG.models по папке.
    spawn(name, { position, rotationY = 0, scale } = {}) {
      const container = containers.get(name);
      if (!container) throw new Error('Модель не загружена: ' + name);
      const entries = container.instantiateModelsToScene((n) => n, false);
      // Свой узел-обёртка: у корня glTF уже есть зеркальный масштаб, его не трогаем.
      const root = new B.TransformNode(name, scene);
      for (const node of entries.rootNodes) node.parent = root;
      root.scaling.setAll(scale ?? CFG.models[name.split('/')[0]] ?? 1);
      root.rotation.y = rotationY;
      if (position) root.position.copyFrom(position);
      return { root, animations: entries.animationGroups };
    },
    // Габариты копии в мировых координатах.
    bounds(root) {
      root.computeWorldMatrix(true);
      const { min, max } = root.getHierarchyBoundingVectors(true);
      return { min, max };
    },
  };
}
