// Звук на Web Audio без файлов: жужжание зависит от скорости, короткие сигналы на события.
export function createAudio(profile) {
  let ctx = null, buzz = null, gain = null;
  const muted = () => !!profile.muted;

  // Звук можно включить только после касания или клавиши — браузер так требует.
  function init() {
    if (ctx) { ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    gain = ctx.createGain(); gain.gain.value = 0;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 700;
    buzz = ctx.createOscillator(); buzz.type = 'sawtooth'; buzz.frequency.value = 170;
    const wobble = ctx.createOscillator(); wobble.frequency.value = 27; // дрожание крыльев
    const wobbleGain = ctx.createGain(); wobbleGain.gain.value = 12;
    wobble.connect(wobbleGain).connect(buzz.frequency);
    buzz.connect(filter).connect(gain).connect(ctx.destination);
    buzz.start(); wobble.start();
  }

  function tone(freq, type, dur, vol = 0.12, slide = 0) {
    if (!ctx || muted()) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur);
  }

  return {
    init,
    // flying — в воздухе, speed — м/с, boost — ускорение.
    update({ flying, speed, boost }) {
      if (!ctx) return;
      const t = ctx.currentTime;
      const vol = muted() || !flying ? 0 : 0.05 + Math.abs(speed) / 22 * 0.06;
      gain.gain.setTargetAtTime(vol, t, 0.08);
      buzz.frequency.setTargetAtTime(160 + Math.abs(speed) * 3 + (boost ? 40 : 0), t, 0.1);
    },
    eat: () => { tone(660, 'sine', 0.12, 0.15, 990); },
    drink: () => { tone(420, 'sine', 0.08, 0.06, 520); },
    hit: () => { tone(140, 'square', 0.18, 0.12, 60); },
    quest: () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 'triangle', 0.25, 0.14), i * 110)); },
    found: () => { [784, 1047].forEach((f, i) => setTimeout(() => tone(f, 'triangle', 0.2, 0.12), i * 100)); },
    toggle() { profile.muted = !profile.muted; profile.save(); return profile.muted; },
    get muted() { return muted(); },
  };
}
