import { ROOM_TYPES } from './interior.js';
import { BRONZE } from './baibaks.js';

// Задания: что нужно сделать, как считать прогресс и сколько пыльцы за выполнение.
const ROOM_FOOD = ['bread', 'apple', 'honey', 'pear', 'cookie', 'banana', 'cake', 'donut', 'croissant', 'pizza', 'watermelon', 'grapes'];
const ROOM_NAMES = { kitchen: 'кухня', bedroom: 'спальня', kids: 'детская', cafe: 'кафе', shop: 'магазин' };

export function createQuests(profile, city, baibaks, hud, audio) {
  const sights = city.places.map((p) => p.name).filter((n) => n !== 'Зауральная роща');
  const list = [
    { id: 'places', title: 'Облететь все достопримечательности', reward: 30, progress: () => [profile.visited.filter((v) => sights.includes(v)).length, sights.length] },
    { id: 'river', title: 'Перелететь Урал из Европы в Азию', reward: 10, progress: () => [profile.visited.includes('Зауральная роща') ? 1 : 0, 1] },
    { id: 'egor', title: 'Залететь в комнату Егора', reward: 15, progress: () => [profile.rooms.includes('Комната Егора') ? 1 : 0, 1] },
    { id: 'rooms', title: 'Побывать во всех типах комнат', reward: 20, progress: () => [ROOM_TYPES.filter((t) => profile.rooms.includes(t)).length, ROOM_TYPES.length], hint: () => ROOM_TYPES.filter((t) => !profile.rooms.includes(t)).map((t) => ROOM_NAMES[t]).join(', ') },
    { id: 'food', title: 'Попробовать все блюда в домах', reward: 25, progress: () => [ROOM_FOOD.filter((f) => profile.eaten.includes(f)).length, ROOM_FOOD.length] },
    { id: 'baibaks', title: 'Найти всех бронзовых байбаков', reward: 40, progress: () => [baibaks.found.size, BRONZE.length] },
    { id: 'tower', title: 'Сесть на башню с курантами', reward: 10, progress: () => [profile.tower ? 1 : 0, 1] },
  ];

  const remember = (arr, v) => { if (v && !arr.includes(v)) { arr.push(v); profile.save(); check(); } };

  // Выполненное задание отмечаем один раз и даём пыльцу.
  function check() {
    for (const q of list) {
      if (profile.done.includes(q.id)) continue;
      const [a, b] = q.progress();
      if (a >= b) {
        profile.done.push(q.id);
        profile.pollen += q.reward;
        profile.save();
        hud.flash(`Задание выполнено! +${q.reward} 🌼`, 3);
        audio?.quest();
        hud.setPollen(profile.pollen);
      }
    }
  }

  return {
    list,
    visit: (name) => remember(profile.visited, name),
    room: (type, name) => { remember(profile.rooms, type); remember(profile.rooms, name); },
    eat: (model) => remember(profile.eaten, model),
    tower: () => { if (!profile.tower) { profile.tower = true; profile.save(); check(); } },
    check,
    // Строки для экрана заданий.
    render(el) {
      el.innerHTML = '';
      for (const q of list) {
        const [a, b] = q.progress();
        const done = profile.done.includes(q.id);
        const row = document.createElement('div');
        row.className = 'quest' + (done ? ' done' : '');
        const hint = !done && q.hint ? `<small>Осталось: ${q.hint()}</small>` : '';
        row.innerHTML = `<span>${done ? '✅' : '⬜'}</span><div><b>${q.title}</b><small>${a}/${b} · награда ${q.reward} 🌼</small>${hint}</div>`;
        el.appendChild(row);
      }
    },
  };
}
