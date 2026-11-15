/* Palmi — калибровка под руку игрока: классификатор k ближайших соседей (kNN).
 * Обучающие данные — примеры жестов, которые игрок записал сам (векторы признаков из gestures.js).
 * predict(vector) → вероятность каждого жеста по голосам k соседей (вес = 1 / расстояние).
 */
(function (root) {
  'use strict';

  function createKnn(samples, k) {
    k = k || 5;
    let data = Array.isArray(samples) ? samples.slice() : []; // [{label, v:[...]}]

    const d2 = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) { const t = a[i] - b[i]; s += t * t; } return Math.sqrt(s); };
    const counts = () => data.reduce((m, s) => { m[s.label] = (m[s.label] || 0) + 1; return m; }, {});

    return {
      add(label, v) { data.push({ label, v: v.slice() }); },
      clear(label) { data = label ? data.filter((s) => s.label !== label) : []; },
      count(label) { return counts()[label] || 0; },
      counts,
      has(label) { return (counts()[label] || 0) >= 3; },
      // готов, если откалиброваны хотя бы 2 жеста (иначе соседям не из чего выбирать)
      ready() { return Object.values(counts()).filter((n) => n >= 3).length >= 2; },
      predict(v) {
        const ranked = data.map((s) => ({ label: s.label, d: d2(v, s.v) })).sort((a, b) => a.d - b.d).slice(0, k);
        const votes = {}; let total = 0;
        ranked.forEach((r) => { const w = 1 / (r.d + 0.05); votes[r.label] = (votes[r.label] || 0) + w; total += w; });
        // далёкие соседи = рука не похожа ни на один записанный пример → уверенность снижается
        const nearest = ranked.length ? ranked[0].d : 9;
        const closeness = Math.max(0, Math.min(1, 1.4 - nearest));
        Object.keys(votes).forEach((l) => { votes[l] = (votes[l] / total) * closeness; });
        return votes;
      },
      toJSON() { return data; },
    };
  }

  const api = { createKnn };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Palmi = root.Palmi || {};
  root.Palmi.Knn = api;
})(typeof window !== 'undefined' ? window : globalThis);
