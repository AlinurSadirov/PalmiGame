/* Palmi — звуки, синтезированные Web Audio (без файлов). Громкость — из настроек. */
(function (root) {
  'use strict';
  let ctx = null;
  const vol = () => (root.Palmi.Store ? root.Palmi.Store.state.settings.volume : 0.7);

  function ensure() {
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, start, dur, type = 'sine', gain = 0.2) {
    const c = ensure(); if (!c || vol() <= 0) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    const t0 = c.currentTime + start;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain * vol(), t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  const S = {
    click() { tone(660, 0, 0.08, 'triangle', 0.12); },
    success() { tone(660, 0, 0.14, 'triangle'); tone(880, 0.1, 0.14, 'triangle'); tone(1320, 0.2, 0.25, 'sine', 0.15); },
    fail() { tone(330, 0, 0.18, 'sine', 0.15); tone(262, 0.14, 0.28, 'sine', 0.12); },
    tick() { tone(1200, 0, 0.04, 'square', 0.04); },
    level() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.3, 'triangle', 0.18)); tone(1568, 0.5, 0.5, 'sine', 0.12); },
    retry() { tone(440, 0, 0.12, 'triangle', 0.14); tone(494, 0.12, 0.18, 'triangle', 0.14); },
    unlock() { tone(784, 0, 0.12, 'sine'); tone(1175, 0.1, 0.3, 'sine', 0.16); },
  };
  root.Palmi.Sound = S;
})(window);
