/* Palmi — адаптивная механика (интеллектуальная механика №2).
 * Вход: история игрока по каждому слову (попытки, успехи, подсказки, уверенность ИИ, ошибки).
 * Обработка: «сила» слова 0..1, поиск слабых слов, выбор подсказок и состава заданий.
 * Выход: список заданий уровня (≥30% — повторение слабых слов, если они есть) и уровень подсказок.
 */
(function (root) {
  'use strict';
  const C = root.Palmi && root.Palmi.Content ? root.Palmi.Content : (typeof require !== 'undefined' ? require('./content.js') : null);

  const PASS = 0.7;

  function wordStat(profile, id) {
    profile.words = profile.words || {};
    if (!profile.words[id]) profile.words[id] = { attempts: 0, correct: 0, hints: 0, confSum: 0, confN: 0, strength: 0, lastSeen: null, fails: 0 };
    return profile.words[id];
  }

  function strength(profile, id) { return profile.words && profile.words[id] ? profile.words[id].strength : 0; }

  // Слабые слова: уже встречались, но сила < 0.6. Самые слабые — первыми.
  function weakWords(profile, exclude = []) {
    return Object.entries(profile.words || {})
      .filter(([id, s]) => s.attempts > 0 && s.strength < 0.6 && !exclude.includes(id))
      .sort((a, b) => a[1].strength - b[1].strength)
      .map(([id]) => id);
  }

  function learnedWords(profile) {
    return Object.entries(profile.words || {}).filter(([, s]) => s.correct > 0).map(([id]) => id);
  }

  // Адаптивные подсказки: слабое слово получает подсказку даже на средней сложности, сильное — теряет её
  function hintPolicy(diff, profile, word, mode) {
    if (mode === 'challenge' || mode === 'speed') return 'none';
    const s = strength(profile, word);
    if (s < 0.4) return 'auto';
    if (s >= 0.8) return 'button';
    return diff.autoHint ? 'auto' : 'button';
  }

  function shuffle(arr, rnd) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  function distractors(word, pool, n, rnd) {
    return shuffle(pool.filter((w) => w !== word), rnd).slice(0, n);
  }

  function generateLevel(level, island, profile, opts = {}) {
    const rnd = opts.random || Math.random;
    const diff = C.DIFFICULTY[island.difficulty];
    const mode = level.mode || 'normal';
    const allWords = Object.keys(C.WORDS);
    const known = new Set([...learnedWords(profile), ...level.words, ...(level.review || [])]);
    const tasks = [];
    const mk = (type, word, extra = {}) => ({ type, word, hint: hintPolicy(diff, profile, word, mode), ...extra });

    // 1. Новые слова: сначала знакомство, потом проверка по памяти
    level.words.forEach((w) => {
      tasks.push(mk('learn', w));
    });
    level.words.forEach((w) => {
      tasks.push(mk(rnd() < 0.5 ? 'show' : 'translate', w));
    });

    // 2. Повторение слов уровня
    const review = shuffle(level.review || [], rnd);
    const perf = mode === 'speed' ? 'speed' : null;
    review.slice(0, mode === 'normal' ? 2 : 5).forEach((w, i) => {
      tasks.push(mk(perf || (i % 2 ? 'translate' : 'show'), w));
    });

    // 3. Слова на понимание без камеры: жест → английское слово, английское → русское
    const quizPool = [...level.words, ...review];
    if (quizPool.length && mode !== 'speed') {
      const q = quizPool[Math.floor(rnd() * quizPool.length)];
      tasks.push(mk('quiz', q, { options: shuffle([q, ...distractors(q, allWords, 3, rnd)], rnd) }));
      const m = quizPool[Math.floor(rnd() * quizPool.length)];
      tasks.push(mk('meaning', m, { options: shuffle([m, ...distractors(m, allWords, 3, rnd)], rnd) }));
    }

    // 4. Фразы и диалоги с жителями
    (level.phrases || []).forEach((seq) => tasks.push(mk('phrase', seq[0], { sequence: seq })));
    if (level.dialogs) {
      const lines = shuffle(C.DIALOGS[level.dialogs].filter((d) => known.has(d.answer)), rnd).slice(0, mode === 'challenge' ? 2 : 1);
      lines.forEach((d) => tasks.push(mk('dialog', d.answer, { line: d })));
    }

    // 4б. Обязательные предложения: собрать из слов, потом показать жестами
    const required = (level.sentences || []).map((key) => {
      const sn = C.SENTENCES[key];
      const pool = Object.keys(C.WORDS).filter((w) => !sn.words.includes(w) && known.has(w));
      const extra = shuffle(pool.length >= 2 ? pool : Object.keys(C.WORDS).filter((w) => !sn.words.includes(w)), rnd).slice(0, 2);
      return mk('sentence', sn.words[0], { sentence: { key, ...sn }, tiles: shuffle([...sn.words, ...extra], rnd), required: true });
    });

    // 5. Адаптация: слабые слова игрока (не меньше 30% заданий, если такие слова есть)
    const weak = weakWords(profile, []);
    let adaptiveCount = 0;
    if (weak.length) {
      const need = Math.max(1, Math.ceil(0.3 * (tasks.length + 2)));
      weak.slice(0, need).forEach((w) => {
        tasks.push(mk(mode === 'speed' ? 'speed' : 'show', w, { adaptive: true, hint: mode === 'normal' ? 'auto' : hintPolicy(diff, profile, w, mode) }));
        adaptiveCount++;
      });
    }

    // Порядок: знакомства — в начале, остальное перемешано, но не больше 10 заданий
    const learnTasks = tasks.filter((t) => t.type === 'learn');
    const rest = shuffle(tasks.filter((t) => t.type !== 'learn'), rnd);
    const ordered = [];
    learnTasks.forEach((t) => ordered.push(t));
    rest.forEach((t) => ordered.push(t));
    // обязательные предложения не обрезаются: остальное укорачивается, чтобы всего было ≤ 10
    const final = ordered.slice(0, Math.max(learnTasks.length, 10 - required.length));
    required.forEach((t, i) => final.splice(Math.min(final.length, learnTasks.length + 2 + i * 3), 0, t));
    return {
      levelId: level.id, islandId: island.id, mode, difficulty: island.difficulty,
      threshold: diff.threshold, timeLimit: diff.timeLimit, hold: diff.hold, speedBonus: diff.speedBonus || 0,
      tasks: final, adaptiveCount: final.filter((t) => t.adaptive).length, weakBefore: weak,
    };
  }

  // Тренировка «работы над ошибками»: только указанные слова, всегда с подсказкой
  function generatePractice(words, profile) {
    const tasks = [];
    words.forEach((w) => tasks.push({ type: 'learn', word: w, hint: 'auto', practice: true }));
    words.forEach((w) => tasks.push({ type: 'show', word: w, hint: 'button', practice: true }));
    return { levelId: 'practice', islandId: null, mode: 'practice', difficulty: 'beginner', threshold: C.DIFFICULTY.beginner.threshold, timeLimit: 25, hold: 0.6, speedBonus: 0, tasks, adaptiveCount: 0, weakBefore: weakWords(profile) };
  }

  // Учёт результата задания на камеру
  function recordAttempt(profile, word, r) {
    const s = wordStat(profile, word);
    s.attempts++;
    s.lastSeen = r.at || Date.now();
    if (r.conf != null) { s.confSum += r.conf; s.confN++; }
    if (r.hint) s.hints++;
    if (r.success) {
      s.correct++;
      const gain = r.hint ? 0.25 : 0.45;
      s.strength = Math.min(1, s.strength + gain * (1 - s.strength) + (r.hint ? 0.05 : 0.1));
    } else {
      s.fails++;
      s.strength = s.strength * 0.5;
    }
    return s;
  }

  function levelResult(results) {
    const graded = results.filter((r) => r.graded !== false);
    const passed = graded.filter((r) => r.success).length;
    const acc = graded.length ? passed / graded.length : 0;
    const hints = graded.filter((r) => r.hint).length;
    let stars = 0;
    if (acc >= PASS) stars = 1;
    if (acc >= 0.85) stars = 2;
    if (acc === 1 && hints === 0) stars = 3;
    // обязательное задание (предложение) не выполнено → уровень не засчитан при любой точности
    const requiredFailed = graded.filter((r) => r.required && !r.success).map((r) => r.word);
    if (requiredFailed.length) stars = 0;
    return { accuracy: acc, passed, total: graded.length, hints, stars, success: acc >= PASS && !requiredFailed.length, requiredFailed };
  }

  function xpFor(r, task, speedBonusSec) {
    if (!r.success) return 0;
    let xp = r.hint ? 5 : 10;
    if (task.type === 'phrase') xp += 5;
    if (task.type === 'sentence') xp += 10;
    if (task.type === 'dialog') xp += 3;
    if (speedBonusSec && r.time != null && r.time <= speedBonusSec) xp += 3;
    return xp;
  }

  const api = { PASS, generateLevel, generatePractice, recordAttempt, levelResult, xpFor, weakWords, learnedWords, hintPolicy, wordStat };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Palmi = root.Palmi || {};
  root.Palmi.Adaptive = api;
})(typeof window !== 'undefined' ? window : globalThis);
