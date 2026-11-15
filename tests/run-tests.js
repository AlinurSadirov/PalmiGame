// Автотесты логики Palmi: node tests/run-tests.js
// Проверяют классификатор на синтетических руках, kNN-калибровку и адаптивную генерацию уровней.
const assert = require('assert');
const G = require('../js/core/gestures.js');
const K = require('../js/core/knn.js');
const C = require('../js/core/content.js');
const A = require('../js/core/adaptive.js');

let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓', name); }
  catch (e) { failed++; console.log('  ✗', name, '\n     ', e.message); }
}

console.log('Классификатор жестов');
test('каждый эталонный жест распознаётся как он сам', () => {
  G.GESTURE_IDS.forEach((id) => assert.strictEqual(G.classify(G.synthHand(id)).best, id, id));
});
test('признаки не зависят от поворота, масштаба и зеркала', () => {
  G.GESTURE_IDS.forEach((id) => {
    const r = G.classify(G.synthHand(id, { rotate: 35, scale: 90, mirror: true }));
    assert.strictEqual(r.best, id, id);
  });
});
test('точность ≥ 95% при умеренном шуме (0.05)', () => {
  let ok = 0, n = 0;
  G.GESTURE_IDS.forEach((id) => {
    for (let i = 0; i < 40; i++) {
      const r = G.classify(G.synthHand(id, { noise: 0.05, rotate: (rnd() - 0.5) * 50, mirror: rnd() < 0.5, random: rnd }));
      if (r.best === id) ok++; n++;
    }
  });
  assert.ok(ok / n >= 0.95, `точность ${(ok / n * 100).toFixed(1)}%`);
});
test('accepts() требует порог и первое место', () => {
  const r = G.classify(G.synthHand('I_AM_FINE'));
  assert.ok(G.accepts(r, 'I_AM_FINE', 0.85));
  assert.ok(!G.accepts(r, 'HELLO', 0.7));
});
test('разбор ошибок называет согнутый указательный палец', () => {
  const wrong = G.synthHand('PHONE'); // у PHONE указательный согнут, у I LOVE YOU — прямой
  const diag = G.diagnose('I_LOVE_YOU', G.features(wrong));
  assert.ok(diag.length > 0);
  assert.ok(diag[0].text.includes('Указательный палец согнут'), diag[0].text);
});
test('разбор ошибок пуст для правильного жеста', () => {
  assert.strictEqual(G.diagnose('SEE_YOU', G.features(G.synthHand('SEE_YOU'))).length, 0);
});

console.log('Калибровка kNN');
test('kNN не готов без примеров и готов после 3 примеров на 2 жеста', () => {
  const knn = K.createKnn();
  assert.ok(!knn.ready());
  ['YES', 'GOOD_LUCK'].forEach((id) => { for (let i = 0; i < 3; i++) knn.add(id, G.vector(G.features(G.synthHand(id, { noise: 0.02, random: rnd })))); });
  assert.ok(knn.ready());
});
test('kNN разводит похожие YES и GOOD LUCK', () => {
  const knn = K.createKnn();
  ['YES', 'GOOD_LUCK'].forEach((id) => { for (let i = 0; i < 5; i++) knn.add(id, G.vector(G.features(G.synthHand(id, { noise: 0.03, random: rnd })))); });
  const p = knn.predict(G.vector(G.features(G.synthHand('GOOD_LUCK', { noise: 0.03, random: rnd }))));
  assert.ok((p.GOOD_LUCK || 0) > (p.YES || 0));
});

console.log('Адаптивные уровни');
const island = C.ISLANDS[0];
test('уровень содержит знакомство с новыми словами в начале', () => {
  const lv = A.generateLevel(island.levels[0], island, { words: {} }, { random: rnd });
  assert.strictEqual(lv.tasks[0].type, 'learn');
  assert.ok(lv.tasks.length >= 5 && lv.tasks.length <= 10, String(lv.tasks.length));
});
test('слабые слова добавляются как адаптивное повторение (≥30%)', () => {
  const profile = { words: {} };
  A.recordAttempt(profile, 'I_AM_FINE', { success: false, conf: 0.3 });
  A.recordAttempt(profile, 'GOOD_LUCK', { success: false, conf: 0.2 });
  const lv = A.generateLevel(island.levels[1], island, profile, { random: rnd });
  assert.ok(lv.adaptiveCount >= 1);
  assert.ok(lv.tasks.some((t) => t.adaptive && t.word === 'GOOD_LUCK'));
});
test('сильному слову не показывается автоподсказка', () => {
  const profile = { words: {} };
  for (let i = 0; i < 4; i++) A.recordAttempt(profile, 'HELLO', { success: true, conf: 0.95 });
  assert.strictEqual(A.hintPolicy(C.DIFFICULTY.beginner, profile, 'HELLO', 'normal'), 'button');
  assert.strictEqual(A.hintPolicy(C.DIFFICULTY.intermediate, { words: {} }, 'HELLO', 'normal'), 'auto');
});
test('звёзды и порог 70%', () => {
  const mk = (s, h) => ({ success: s, hint: h });
  assert.deepStrictEqual(A.levelResult([mk(1), mk(1), mk(1)]).stars, 3);
  assert.strictEqual(A.levelResult([mk(1), mk(1), mk(0)]).success, false);
  assert.strictEqual(A.levelResult([mk(1), mk(1), mk(1, 1), mk(0)]).stars, 1);
});

test('в Бухте Разговоров есть обязательное предложение', () => {
  const isl = C.ISLANDS[1];
  isl.levels.forEach((lv) => {
    const plan = A.generateLevel(lv, isl, { words: {} }, { random: rnd });
    assert.ok(plan.tasks.some((t) => t.type === 'sentence' && t.required), lv.id);
  });
});
test('провал обязательного задания = уровень не засчитан', () => {
  const r = A.levelResult([{ success: true }, { success: true }, { success: true }, { success: true }, { success: false, required: true, word: 'HELLO' }]);
  assert.strictEqual(r.success, false);
  assert.strictEqual(r.stars, 0);
});

console.log(`\nИтого: ${passed} пройдено, ${failed} не пройдено`);
process.exit(failed ? 1 : 0);
