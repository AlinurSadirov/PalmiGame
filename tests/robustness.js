// Проверка устойчивости классификатора на синтетических руках с шумом, поворотом и зеркалом
const G = require('../js/core/gestures.js');
let seed = 42; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const noise = Number(process.argv[2] || 0.04), N = 100;
let ok = 0, total = 0; const conf = {};
for (const id of G.GESTURE_IDS) {
  conf[id] = {};
  for (let i = 0; i < N; i++) {
    const lm = G.synthHand(id, { noise, rotate: (rnd() - 0.5) * 60, mirror: rnd() < 0.5, scale: 100 + rnd() * 150, random: rnd });
    const r = G.classify(lm);
    conf[id][r.best] = (conf[id][r.best] || 0) + 1;
    if (r.best === id) ok++; total++;
  }
}
console.log('noise', noise, 'accuracy', (ok / total * 100).toFixed(1) + '%');
for (const id of G.GESTURE_IDS) { const e = Object.entries(conf[id]).filter(([k]) => k !== id); if (e.length) console.log(id, '->', e.map(([k, v]) => k + ':' + v).join(' ')); }
