// Клавиатура и сенсорное управление: джойстик слева, кнопки высоты и ускорения справа.
const KEYS = {
  forward: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  up: ['Space', 'KeyE'], down: ['KeyC', 'KeyQ'],
  boost: ['ShiftLeft', 'ShiftRight'],
};
const DEAD = 0.15; // слабое отклонение джойстика считаем нулём, чтобы шмель мог зависать

export function createControls() {
  const $ = (id) => document.getElementById(id);
  const down = new Set();
  const held = (name) => KEYS[name].some((code) => down.has(code));
  addEventListener('keydown', (e) => { if (e.code === 'Space') e.preventDefault(); down.add(e.code); });
  addEventListener('keyup', (e) => down.delete(e.code));
  addEventListener('blur', () => down.clear());

  // Джойстик: палец тянет ручку, отклонение — вперёд/назад и поворот.
  const touch = { forward: 0, turn: 0, climb: 0, boost: false };
  const stick = $('stick'), knob = $('knob');
  let pid = null, origin = null;
  const move = (e) => {
    if (e.pointerId !== pid) return;
    let dx = (e.clientX - origin.x) / 45, dy = (e.clientY - origin.y) / 45;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    touch.turn = dx; touch.forward = -dy;
    knob.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`;
  };
  const end = (e) => { if (e.pointerId !== pid) return; pid = null; touch.turn = 0; touch.forward = 0; knob.style.transform = ''; };
  // Захват указателя нужен, чтобы палец мог уйти за круг; без него тоже работает.
  const capture = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch { /* не настоящий палец */ } };
  stick.addEventListener('pointerdown', (e) => {
    pid = e.pointerId;
    const r = stick.getBoundingClientRect();
    origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    capture(stick, e);
    move(e);
  });
  stick.addEventListener('pointermove', move);
  stick.addEventListener('pointerup', end);
  stick.addEventListener('pointercancel', end);

  const hold = (id, on, off) => {
    const b = $(id);
    b.addEventListener('pointerdown', (e) => { capture(b, e); on(); });
    for (const ev of ['pointerup', 'pointercancel']) b.addEventListener(ev, off);
  };
  hold('btn-up', () => { touch.climb = 1; }, () => { if (touch.climb === 1) touch.climb = 0; });
  hold('btn-down', () => { touch.climb = -1; }, () => { if (touch.climb === -1) touch.climb = 0; });
  hold('btn-boost', () => { touch.boost = true; }, () => { touch.boost = false; });

  // Сенсорные кнопки показываем на устройствах с пальцем или после первого касания.
  const showTouch = () => $('touch').classList.remove('hidden');
  if (matchMedia('(pointer: coarse)').matches) showTouch();
  addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') showTouch(); }, { once: true });

  const snap = (v) => (Math.abs(v) < DEAD ? 0 : v);
  return {
    // Значения от -1 до 1; boost — да/нет.
    read() {
      const kbForward = (held('forward') ? 1 : 0) - (held('back') ? 1 : 0);
      const kbTurn = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
      const kbClimb = (held('up') ? 1 : 0) - (held('down') ? 1 : 0);
      return {
        forward: kbForward || snap(touch.forward),
        turn: kbTurn || snap(touch.turn),
        climb: kbClimb || touch.climb,
        boost: held('boost') || touch.boost,
      };
    },
  };
}
