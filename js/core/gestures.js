/* Palmi — ядро распознавания жестов.
 * Вход: 21 ключевая точка кисти (MediaPipe Hands), в пикселях: {x, y, z}.
 * Обработка: признаки формы кисти (сгиб пальцев, положение большого пальца, разведение),
 *            сравнение с шаблонами 13 слов ASL, нечёткая оценка уверенности.
 * Выход: уверенность для каждого жеста + разбор ошибок для целевого жеста.
 * Файл работает и в браузере (window.Palmi.Gestures), и в Node (module.exports) — для автотестов.
 */
(function (root) {
  'use strict';

  // ---------- Векторная математика ----------
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) });
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: (a.z || 0) + (b.z || 0) });
  const mul = (a, k) => ({ x: a.x * k, y: a.y * k, z: (a.z || 0) * k });
  const dot = (a, b) => a.x * b.x + a.y * b.y + (a.z || 0) * (b.z || 0);
  const len = (a) => Math.sqrt(dot(a, a));
  const dist = (a, b) => len(sub(a, b));
  const angle = (a, b) => {
    const d = dot(a, b) / ((len(a) * len(b)) || 1e-9);
    return Math.acos(Math.max(-1, Math.min(1, d)));
  };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const DEG = 180 / Math.PI;

  // Индексы точек MediaPipe Hands
  const FINGERS = {
    thumb: [1, 2, 3, 4],
    index: [5, 6, 7, 8],
    middle: [9, 10, 11, 12],
    ring: [13, 14, 15, 16],
    pinky: [17, 18, 19, 20],
  };
  const FOUR = ['index', 'middle', 'ring', 'pinky'];
  const FINGER_RU = {
    thumb: 'большой палец', index: 'указательный палец', middle: 'средний палец',
    ring: 'безымянный палец', pinky: 'мизинец',
  };
  const FINGER_RU_GEN = { // родительный падеж: «кончика указательного»
    index: 'указательного', middle: 'среднего', ring: 'безымянного', pinky: 'мизинца',
  };

  // Отношение «кончик–запястье / основание–запястье» у прямого пальца
  const EXT_RATIO = { index: 1.95, middle: 2.0, ring: 1.97, pinky: 1.85 };

  // ---------- Признаки ----------
  // Все расстояния делятся на размер ладони (запястье → основание среднего пальца),
  // поэтому признаки не зависят от расстояния до камеры, поворота и того, какая рука.
  function features(lm) {
    const wrist = lm[0];
    const palm = dist(wrist, lm[9]) || 1;
    const f = {};
    FOUR.forEach((name) => {
      const [m, p, d, t] = FINGERS[name].map((i) => lm[i]);
      // 1) по углам в суставах (точно, но чувствительно к шуму)
      const bend = angle(sub(m, wrist), sub(p, m)) + angle(sub(p, m), sub(d, p)) + angle(sub(d, p), sub(t, d));
      const byAngle = clamp(bend / (Math.PI * 1.25), 0, 1.3);
      // 2) по расстоянию кончика от запястья (грубее, но устойчиво к шуму)
      const ratio = dist(t, wrist) / (dist(m, wrist) || 1);
      const byDist = clamp((EXT_RATIO[name] - ratio) / (EXT_RATIO[name] - 0.85), 0, 1.3);
      f['curl.' + name] = 0.5 * byAngle + 0.5 * byDist;
      f['touch.' + name] = dist(lm[4], t) / palm;
    });
    // средний сгиб в основаниях (MCP) и средних суставах (PIP) четырёх пальцев, градусы
    let mcpSum = 0, pipSum = 0;
    FOUR.forEach((name) => {
      const [m, p, d] = FINGERS[name].map((i) => lm[i]);
      mcpSum += angle(sub(m, wrist), sub(p, m)); pipSum += angle(sub(p, m), sub(d, p));
    });
    f['bend.mcp'] = (mcpSum / 4) * DEG;
    f['bend.pip'] = (pipSum / 4) * DEG;
    f['thumb.out'] = dist(lm[4], lm[17]) / palm;          // далеко от основания мизинца = отведён
    f['thumb.overMiddle'] = dist(lm[4], lm[10]) / palm;   // близко к среднему суставу среднего = кулак S
    const prox = (name) => sub(lm[FINGERS[name][1]], lm[FINGERS[name][0]]);
    f['spread.im'] = angle(prox('index'), prox('middle')) * DEG;
    // разведение по кончикам относительно расстояния между основаниями пальцев (устойчивее углов)
    f['gap.im'] = dist(lm[8], lm[12]) / (dist(lm[5], lm[9]) || 1);
    f['gap.mr'] = dist(lm[12], lm[16]) / (dist(lm[9], lm[13]) || 1);
    f['gap.rp'] = dist(lm[16], lm[20]) / (dist(lm[13], lm[17]) || 1);
    return f;
  }

  // Вектор признаков для kNN (масштабы выровнены примерно к 0..1)
  const VECTOR_KEYS = ['curl.index', 'curl.middle', 'curl.ring', 'curl.pinky', 'thumb.out', 'thumb.overMiddle',
    'touch.index', 'touch.middle', 'touch.ring', 'touch.pinky', 'gap.im', 'gap.mr', 'gap.rp', 'bend.mcp', 'bend.pip'];
  function vector(f) {
    return VECTOR_KEYS.map((k) => (k.startsWith('bend') ? f[k] / 120 : k.startsWith('gap') ? Math.min(f[k], 4) / 3 : k.startsWith('touch') || k.startsWith('thumb') ? f[k] / 1.5 : f[k]));
  }

  // ---------- Шаблоны жестов ----------
  // Каждое условие — диапазон [min, max] с мягким краем margin. Вес w — насколько важно условие.
  const EXT = [0, 0.3], CURL = [0.62, 1.3], HALF = [0.22, 0.72];
  const c = (f, range, w = 1, margin) => ({ f, min: range[0], max: range[1], w, margin });
  const allFour = (range, w) => FOUR.map((n) => c('curl.' + n, range, w));

  // Слово → форма кисти в ключевой момент жеста ASL
  const TEMPLATES = {
    // B: ладонь прямая, пальцы вместе, большой прижат
    HELLO: [...allFour(EXT, 1.2), c('gap.im', [0, 1.35], 0.8, 0.5), c('gap.mr', [0, 1.35], 0.8, 0.5), c('thumb.out', [0, 0.8], 1, 0.3)],
    // BYE: пальцы вместе сгибаются в основаниях («машем» кистью), средние суставы прямые
    GOODBYE: [c('bend.mcp', [50, 120], 1.4, 20), c('bend.pip', [0, 38], 1.2, 15), c('gap.im', [0, 1.5], 0.6, 0.5), c('touch.index', [0.45, 9], 1, 0.25), c('touch.middle', [0.45, 9], 0.6, 0.25)],
    // YOU: указательный палец направлен на собеседника
    HOW_ARE_YOU: [c('curl.index', EXT, 1.3), c('curl.middle', CURL), c('curl.ring', CURL), c('curl.pinky', CURL), c('thumb.out', [0, 0.85], 0.8, 0.3)],
    // FINE: раскрытая ладонь «5», большой палец касается груди
    I_AM_FINE: [...allFour(EXT, 1.2), c('gap.im', [1.6, 9], 0.8, 0.5), c('gap.rp', [1.5, 9], 0.6, 0.5), c('thumb.out', [0.95, 9], 1, 0.3)],
    // GOOD LUCK: кулак, большой палец вверх
    GOOD_LUCK: [...allFour(CURL, 1), c('thumb.overMiddle', [0.48, 9], 1.3, 0.25), c('thumb.out', [0.8, 9], 0.8, 0.3)],
    // SEE: буква V от глаз вперёд
    SEE_YOU: [c('curl.index', EXT, 1.2), c('curl.middle', EXT, 1.2), c('curl.ring', CURL), c('curl.pinky', CURL), c('gap.im', [1.7, 9], 1, 0.5), c('thumb.out', [0, 0.85], 0.8, 0.3)],
    YES: [...allFour(CURL, 1), c('thumb.overMiddle', [0, 0.42], 1.3, 0.25)],
    NO: [c('curl.ring', CURL), c('curl.pinky', CURL), c('touch.index', [0, 0.38], 1.3, 0.3), c('touch.middle', [0, 0.45], 1.1, 0.3), c('curl.index', [0, 0.7], 0.6)],
    I_LOVE_YOU: [c('curl.index', EXT, 1.2), c('curl.middle', CURL), c('curl.ring', CURL), c('curl.pinky', EXT, 1.2), c('thumb.out', [0.95, 9], 1, 0.3)],
    PHONE: [c('curl.index', CURL, 1.2), c('curl.middle', CURL), c('curl.ring', CURL), c('curl.pinky', EXT, 1.2), c('thumb.out', [0.95, 9], 1, 0.3)],
    EAT: [...allFour(HALF, 0.8), c('touch.index', [0, 0.38], 1.2, 0.3), c('touch.middle', [0, 0.42], 1.1, 0.3), c('touch.ring', [0, 0.55], 0.6, 0.3)],
    DRINK: [...allFour(HALF, 0.9), c('touch.index', [0.42, 1.1], 1.3, 0.25), c('gap.im', [0, 1.6], 0.4, 0.5), c('bend.pip', [25, 90], 0.8, 15)],
    WATER: [c('curl.index', EXT), c('curl.middle', EXT), c('curl.ring', EXT), c('curl.pinky', CURL, 1.2), c('touch.pinky', [0, 0.45], 1.2, 0.3)],
  };
  const GESTURE_IDS = Object.keys(TEMPLATES);

  function condScore(cond, v) {
    const margin = cond.margin != null ? cond.margin : 0.25;
    if (v >= cond.min && v <= cond.max) return 1;
    const d = v < cond.min ? cond.min - v : v - cond.max;
    return clamp(1 - d / margin, 0, 1);
  }

  // Взвешенное геометрическое среднее: один «не тот» палец сильно снижает уверенность
  function templateScore(id, f) {
    const conds = TEMPLATES[id];
    let sumW = 0, sumLog = 0;
    conds.forEach((cond) => {
      const s = condScore(cond, f[cond.f]);
      sumW += cond.w;
      sumLog += cond.w * Math.log(Math.max(s, 0.03));
    });
    return Math.exp(sumLog / sumW);
  }

  function scoreAll(f) {
    const out = {};
    GESTURE_IDS.forEach((id) => { out[id] = templateScore(id, f); });
    return out;
  }

  // ---------- Разбор ошибок (вторая интеллектуальная механика) ----------
  function message(cond, v) {
    const [kind, part] = cond.f.split('.');
    const tooHigh = v > cond.max;
    if (kind === 'curl') {
      const nm = FINGER_RU[part];
      const cap = nm.charAt(0).toUpperCase() + nm.slice(1);
      if (cond.min >= 0.6) return `Согни ${nm} к ладони`;
      if (cond.max <= 0.35) return `${cap} согнут — выпрями его`;
      return tooHigh ? `${cap} согнут слишком сильно — чуть раскрой` : `Слегка согни ${nm}`;
    }
    if (kind === 'touch') {
      if (tooHigh) return `Коснись большим пальцем кончика ${FINGER_RU_GEN[part]}`;
      return 'Оставь зазор между большим и указательным — как буква C';
    }
    if (kind === 'spread' || kind === 'gap') {
      const pair = { im: 'указательный и средний', mr: 'средний и безымянный', rp: 'безымянный и мизинец' }[part];
      return tooHigh ? `Сомкни ${pair} пальцы вместе` : `Разведи ${pair} пальцы в стороны`;
    }
    if (cond.f === 'bend.mcp') return tooHigh ? 'Согни пальцы в основании меньше' : 'Согни пальцы в основании ладони, как будто машешь «пока»';
    if (cond.f === 'bend.pip') return tooHigh ? 'Не сгибай пальцы в средних суставах — держи их прямыми' : 'Слегка закругли пальцы в средних суставах';
    if (cond.f === 'thumb.out') return tooHigh ? 'Прижми большой палец к ладони' : 'Отведи большой палец в сторону';
    if (cond.f === 'thumb.overMiddle') return tooHigh ? 'Положи большой палец поперёк согнутых пальцев' : 'Подними большой палец вверх, вдоль указательного';
    return 'Сверь форму кисти с эталоном';
  }

  function diagnose(id, f, limit = 3) {
    return TEMPLATES[id]
      .map((cond) => ({ cond, s: condScore(cond, f[cond.f]), v: f[cond.f] }))
      .filter((x) => x.s < 0.85)
      .sort((a, b) => b.cond.w * (1 - b.s) - a.cond.w * (1 - a.s))
      .slice(0, limit)
      .map((x) => ({ feature: x.cond.f, finger: x.cond.f.split('.')[1], severity: 1 - x.s, text: message(x.cond, x.v) }));
  }

  // ---------- Классификатор ----------
  // knn — необязательная модель калибровки (см. knn.js). Если у жеста ≥3 примеров игрока,
  // итоговая уверенность = 0.5 × правила + 0.5 × kNN.
  function classify(lm, opts = {}) {
    const f = features(lm);
    const rule = scoreAll(f);
    let scores = rule;
    let knnProbs = null;
    if (opts.knn && opts.knn.ready()) {
      knnProbs = opts.knn.predict(vector(f));
      scores = {};
      GESTURE_IDS.forEach((id) => {
        scores[id] = opts.knn.has(id) ? 0.5 * rule[id] + 0.5 * (knnProbs[id] || 0) : rule[id];
      });
    }
    let best = null, bestScore = -1, second = 0;
    GESTURE_IDS.forEach((id) => {
      if (scores[id] > bestScore) { second = bestScore; bestScore = scores[id]; best = id; }
      else if (scores[id] > second) second = scores[id];
    });
    return { features: f, rule, knn: knnProbs, scores, best, bestScore, margin: bestScore - Math.max(second, 0) };
  }

  // Засчитывается ли целевой жест: уверенность выше порога, он лучший и с отрывом от второго ≥ 5%
  function accepts(result, target, threshold) {
    const s = result.scores[target];
    return s >= threshold && result.best === target && result.margin >= 0.05;
  }

  // ---------- Синтетическая рука (эталон для рисунка, демо-режим и автотесты) ----------
  const MCP = { index: [-0.32, -0.95], middle: [-0.08, -1.0], ring: [0.15, -0.95], pinky: [0.36, -0.83] };
  const SEG = { index: [0.45, 0.27, 0.22], middle: [0.5, 0.3, 0.23], ring: [0.46, 0.28, 0.22], pinky: [0.36, 0.22, 0.2] };
  const SPREAD_K = { index: -1.1, middle: -0.1, ring: 0.8, pinky: 1.7 };
  const BASE_ANG = { index: -6, middle: -1, ring: 4, pinky: 10 };

  function rotFinger(name, curl, spreadDeg, mcpFlex) {
    const a = (BASE_ANG[name] + SPREAD_K[name] * spreadDeg) / DEG;
    const base = { x: MCP[name][0], y: MCP[name][1], z: 0 };
    const pts = [base];
    // сгиб в суставах: MCP, PIP, DIP (градусы)
    const flex = mcpFlex != null ? mcpFlex : [curl * 80, curl * 100, curl * 70];
    let cum = 0, p = base;
    SEG[name].forEach((L, i) => {
      cum += flex[i] / DEG;
      const dir = { x: Math.sin(a) * Math.cos(cum), y: -Math.cos(a) * Math.cos(cum), z: -Math.sin(cum) };
      p = add(p, mul(dir, L));
      pts.push(p);
    });
    return pts; // [mcp, pip, dip, tip]
  }

  // Поза: curl для 4 пальцев, spread, положение кончика большого пальца
  const POSES = {
    HELLO: { curl: [0, 0, 0, 0], spread: -4, thumb: 'tuck' },
    GOODBYE: { flex: { index: [85, 6, 4], middle: [85, 6, 4], ring: [82, 6, 4], pinky: [80, 6, 4] }, spread: -3, thumb: 'tuck' },
    HOW_ARE_YOU: { curl: [0, 1, 1, 1], spread: 4, thumb: 'overCurled' },
    I_AM_FINE: { curl: [0, 0, 0, 0], spread: 14, thumb: 'out' },
    GOOD_LUCK: { curl: [1, 1, 1, 1], spread: 2, thumb: 'up' },
    SEE_YOU: { curl: [0, 0, 1, 1], spread: 16, thumb: 'overCurled' },
    YES: { curl: [1, 1, 1, 1], spread: 2, thumb: 'S' },
    NO: { flex: { index: [62, 18, 8], middle: [60, 20, 8] }, curl: [null, null, 1, 1], spread: 2, thumb: 'pinchIM' },
    I_LOVE_YOU: { curl: [0, 1, 1, 0], spread: 8, thumb: 'out' },
    PHONE: { curl: [1, 1, 1, 0], spread: 8, thumb: 'out' },
    EAT: { flex: { index: [70, 22, 10], middle: [68, 24, 10], ring: [66, 26, 12], pinky: [64, 28, 12] }, spread: 0, thumb: 'pinchAll' },
    DRINK: { flex: { index: [35, 45, 30], middle: [35, 45, 30], ring: [35, 45, 30], pinky: [35, 45, 30] }, spread: -2, thumb: 'C' },
    WATER: { curl: [0, 0, 0, 1], spread: 12, thumb: 'touchPinky' },
  };

  function synthHand(id, opts = {}) {
    const pose = POSES[id];
    const lm = new Array(21);
    lm[0] = { x: 0, y: 0, z: 0 };
    const tips = {};
    FOUR.forEach((name, i) => {
      const flex = pose.flex && pose.flex[name];
      const curl = pose.curl ? pose.curl[i] : null;
      const pts = rotFinger(name, curl == null ? 0 : curl, pose.spread, flex);
      FINGERS[name].forEach((idx, k) => { lm[idx] = pts[k]; });
      tips[name] = pts[3];
    });
    const cmc = { x: -0.28, y: -0.22, z: -0.02 };
    const mid = (a, b) => mul(add(a, b), 0.5);
    let tip;
    switch (pose.thumb) {
      case 'tuck': tip = { x: 0.06, y: -0.58, z: -0.14 }; break;
      case 'out': tip = { x: -0.88, y: -0.72, z: -0.05 }; break;
      case 'overCurled': tip = { x: 0.02, y: -0.78, z: -0.55 }; break;
      case 'S': tip = { x: -0.05, y: -0.86, z: -0.6 }; break;
      case 'up': tip = { x: -0.52, y: -1.12, z: -0.18 }; break;
      case 'touchPinky': tip = add(tips.pinky, { x: -0.06, y: 0.03, z: -0.05 }); break;
      case 'pinchIM': tip = add(mid(tips.index, tips.middle), { x: -0.05, y: 0.06, z: -0.06 }); break;
      case 'pinchAll': tip = add(mid(tips.index, tips.middle), { x: -0.02, y: 0.08, z: -0.07 }); break;
      case 'C': tip = add(tips.index, { x: -0.12, y: 0.55, z: -0.12 }); break;
      default: tip = { x: -0.6, y: -0.6, z: 0 };
    }
    // суставы большого пальца по дуге от CMC к кончику
    const bow = { x: -0.12, y: 0.05, z: -0.05 };
    lm[1] = cmc;
    lm[2] = add(add(cmc, mul(sub(tip, cmc), 0.38)), bow);
    lm[3] = add(add(cmc, mul(sub(tip, cmc), 0.7)), mul(bow, 0.6));
    lm[4] = tip;

    // поворот, масштаб, шум — чтобы проверить устойчивость признаков
    const rot = (opts.rotate || 0) / DEG, scale = opts.scale || 160, noise = opts.noise || 0;
    const rnd = opts.random || Math.random;
    const cx = opts.cx != null ? opts.cx : 320, cy = opts.cy != null ? opts.cy : 400;
    const mirror = opts.mirror ? -1 : 1;
    return lm.map((p) => {
      const x = p.x * mirror, y = p.y;
      const rx = x * Math.cos(rot) - y * Math.sin(rot);
      const ry = x * Math.sin(rot) + y * Math.cos(rot);
      const n = () => (rnd() - 0.5) * 2 * noise;
      return { x: cx + (rx + n()) * scale, y: cy + (ry + n()) * scale, z: (p.z + n()) * scale };
    });
  }

  const api = { features, vector, VECTOR_KEYS, TEMPLATES, GESTURE_IDS, scoreAll, classify, accepts, diagnose, synthHand, POSES, FINGER_RU, FINGERS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Palmi = root.Palmi || {};
  root.Palmi.Gestures = api;
})(typeof window !== 'undefined' ? window : globalThis);
