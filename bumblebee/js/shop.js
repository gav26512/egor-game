// Расцветки шмеля за пыльцу: полосы, хвостик и цена.
export const SKINS = [
  { id: 'classic', name: 'Шмель', price: 0, a: '#ffc933', b: '#2b2118', tail: '#f4f1e6' },
  { id: 'red', name: 'Красный', price: 50, a: '#ff5a3c', b: '#2b2118', tail: '#ffe1d6' },
  { id: 'blue', name: 'Синий', price: 50, a: '#4fa3ff', b: '#1d2b4f', tail: '#dff0ff' },
  { id: 'green', name: 'Зелёный', price: 60, a: '#6fdc4a', b: '#1f3a1a', tail: '#e6ffdc' },
  { id: 'purple', name: 'Фиолетовый', price: 60, a: '#b56cff', b: '#2b1a4f', tail: '#f0e0ff' },
  { id: 'pink', name: 'Розовый', price: 80, a: '#ff7ab8', b: '#4f1a35', tail: '#ffe3f1' },
  { id: 'white', name: 'Белый', price: 80, a: '#f7f7f7', b: '#555', tail: '#ffffff' },
  { id: 'gold', name: 'Золотой', price: 120, a: '#ffd23f', b: '#8a5a00', tail: '#fff3b0', shiny: true },
  { id: 'rainbow', name: 'Радужный', price: 300, a: '#ff4d4d', b: '#2b2118', tail: '#ffffff', rainbow: true },
];

export function createShop(profile, bee, hud) {
  const el = document.getElementById('shop-items');
  const coins = document.getElementById('shop-pollen');

  function render() {
    coins.textContent = profile.pollen;
    el.innerHTML = '';
    for (const s of SKINS) {
      const owned = profile.skins.includes(s.id), active = profile.skin === s.id;
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'skin' + (active ? ' active' : '');
      item.innerHTML = `<i style="background:${s.rainbow ? 'linear-gradient(90deg,#ff4d4d,#ffd23f,#6fdc4a,#4fa3ff,#b56cff)' : `repeating-linear-gradient(90deg,${s.a} 0 8px,${s.b} 8px 14px)`}"></i><b>${s.name}</b><small>${active ? 'выбран' : owned ? 'есть' : s.price + ' 🌼'}</small>`;
      item.addEventListener('click', () => {
        if (!owned) {
          if (profile.pollen < s.price) { hud.flash('Не хватает пыльцы', 1.5); return; }
          profile.pollen -= s.price;
          profile.skins.push(s.id);
        }
        profile.skin = s.id;
        profile.save();
        bee.setSkin(s);
        hud.setPollen(profile.pollen);
        render();
      });
      el.appendChild(item);
    }
  }
  return { render };
}
