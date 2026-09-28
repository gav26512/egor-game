// Профиль игрока на этом телефоне: имя, пыльца, расцветка, прогресс заданий.
const KEY = 'bumblebee.profile';

export function loadProfile() {
  const p = { name: '', pollen: 0, skin: 'classic', skins: ['classic'], visited: [], eaten: [], rooms: [], done: [], tower: false };
  try { Object.assign(p, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* хранилище недоступно */ }
  p.save = () => { try { localStorage.setItem(KEY, JSON.stringify({ ...p, save: undefined })); } catch { /* ничего */ } };
  return p;
}
