// Полоски шкал, название места и короткие подсказки.
export function createHud() {
  const $ = (id) => document.getElementById(id);
  const bars = { food: $('bar-food'), water: $('bar-water'), energy: $('bar-energy') };
  const place = $('place'), hint = $('hint'), flash = $('flash');
  let flashUntil = 0, hintText = '';

  return {
    show(on) { $('hud').classList.toggle('hidden', !on); },
    setNeeds(n) {
      for (const k of Object.keys(bars)) {
        bars[k].style.width = n[k] + '%';
        bars[k].parentElement.classList.toggle('low', n[k] < 25);
      }
    },
    setPlace(name) { place.textContent = name || ''; },
    setBaibaks(text) { $('baibaks').textContent = text; },
    setPollen(n) { $('pollen').textContent = n; },
    // Подсказка держится, пока её обновляют каждый кадр.
    setHint(text) { hintText = text || ''; },
    // Короткое сообщение на секунду-две: «Ням!», «Ой!».
    flash(text, seconds = 1.5) { flash.textContent = text; flashUntil = performance.now() + seconds * 1000; },
    update() {
      hint.textContent = hintText;
      flash.classList.toggle('hidden', performance.now() > flashUntil);
    },
  };
}
