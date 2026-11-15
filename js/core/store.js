/* Palmi — сохранение: профили игроков, прогресс, достижения, настройки, метрики монетизации.
 * Хранится локально (localStorage). Видео с камеры не сохраняется никогда — только числа.
 */
(function (root) {
  'use strict';
  const KEY = 'palmi.v1';
  const C = root.Palmi.Content;

  const pad = (n) => String(n).padStart(2, '0');
  const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => dateKey(new Date());
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dateKey(d); };

  const defaults = () => ({
    version: 1,
    profiles: {},
    currentId: null,
    settings: { volume: 0.7, showSkeleton: true, showRu: true, mirror: true, cameraId: '', demo: false, useKnn: true },
  });

  let state = defaults();
  let memoryOnly = false;

  function load() {
    try {
      const raw = root.localStorage.getItem(KEY);
      if (raw) state = Object.assign(defaults(), JSON.parse(raw));
      state.settings = Object.assign(defaults().settings, state.settings);
    } catch (e) { memoryOnly = true; }
    // миграция: убираем слова, которых больше нет в игре (например, старые ONE…TEN)
    const known = (id) => !!C.WORDS[id];
    Object.values(state.profiles).forEach((p) => {
      Object.keys(p.words || {}).forEach((id) => { if (!known(id)) delete p.words[id]; });
      p.mistakes = (p.mistakes || []).filter((m) => known(m.word));
      p.calibration = (p.calibration || []).filter((c) => known(c.label));
    });
    return state;
  }

  function save() {
    try { root.localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { memoryOnly = true; }
  }

  function newProfile(name) {
    const id = 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    state.profiles[id] = {
      id, name: name.trim().slice(0, 24) || 'Игрок', createdAt: Date.now(),
      xp: 0, xpByDay: {}, streak: { count: 0, last: null },
      plus: false, plusSince: null,
      words: {}, levels: {}, achievements: {}, mistakes: [], fixed: 0,
      detailed: { date: null, used: 0 },
      metrics: { premiumViews: 0, lockClicks: 0, trialClicks: 0, limitHits: 0 },
      calibration: [], aiTests: [], sessions: 0, playSeconds: 0,
    };
    state.currentId = id;
    save();
    return state.profiles[id];
  }

  const current = () => state.profiles[state.currentId] || null;

  function addXp(p, n) {
    if (!n) return;
    p.xp += n;
    const t = today();
    p.xpByDay[t] = (p.xpByDay[t] || 0) + n;
  }

  // Стрик растёт, если хотя бы один уровень пройден за календарный день
  function touchStreak(p) {
    const t = today();
    if (p.streak.last === t) return p.streak.count;
    p.streak.count = p.streak.last === yesterday() ? p.streak.count + 1 : 1;
    p.streak.last = t;
    return p.streak.count;
  }

  function streakAlive(p) {
    return p.streak.last === today() || p.streak.last === yesterday() ? p.streak.count : 0;
  }

  function unlock(p, id) {
    if (p.achievements[id]) return false;
    p.achievements[id] = Date.now();
    return true;
  }

  // Проверка достижений после уровня; возвращает список новых
  function checkAchievements(p) {
    const got = [];
    const learned = Object.values(p.words).filter((w) => w.correct > 0).length;
    const tryU = (id, cond) => { if (cond && unlock(p, id)) got.push(id); };
    tryU('first-word', learned >= 1);
    tryU('first-level', Object.values(p.levels).some((l) => l.stars > 0));
    tryU('perfect', Object.values(p.levels).some((l) => l.stars === 3));
    tryU('streak-3', p.streak.count >= 3);
    tryU('streak-7', p.streak.count >= 7);
    tryU('fix-5', p.fixed >= 5);
    tryU('sentences-3', (p.sentencesDone || 0) >= 3);
    tryU('words-7', learned >= 7);
    tryU('words-all', learned >= Object.keys(C.WORDS).length);
    C.ISLANDS.forEach((isl) => tryU('island-' + isl.id, isl.levels.every((l) => p.levels[l.id] && p.levels[l.id].stars > 0) && C.ACHIEVEMENTS.some((a) => a.id === 'island-' + isl.id)));
    const calibratedWords = new Set(p.calibration.map((s) => s.label));
    tryU('calibrated', [...calibratedWords].filter((w) => p.calibration.filter((s) => s.label === w).length >= 3).length >= 5);
    return got.filter((id) => C.ACHIEVEMENTS.some((a) => a.id === id));
  }

  // Подробный AI-разбор: бесплатно 1 раз в день, с Palmi Plus — без ограничений
  function detailedAvailable(p) {
    if (p.plus) return true;
    if (p.detailed.date !== today()) return true;
    return p.detailed.used < C.PREMIUM.freeDetailedPerDay;
  }
  function useDetailed(p) {
    if (p.plus) return;
    if (p.detailed.date !== today()) { p.detailed.date = today(); p.detailed.used = 0; }
    p.detailed.used++;
  }

  function resetProfile(p) {
    const fresh = { xp: 0, xpByDay: {}, streak: { count: 0, last: null }, words: {}, levels: {}, achievements: {}, mistakes: [], fixed: 0, calibration: [], aiTests: [] };
    Object.assign(p, fresh);
    save();
  }

  function deleteProfile(id) {
    delete state.profiles[id];
    if (state.currentId === id) state.currentId = Object.keys(state.profiles)[0] || null;
    save();
  }

  root.Palmi.Store = {
    load, save, newProfile, current, addXp, touchStreak, streakAlive, checkAchievements,
    detailedAvailable, useDetailed, resetProfile, deleteProfile, today,
    get state() { return state; }, get memoryOnly() { return memoryOnly; },
    select(id) { state.currentId = id; save(); },
  };
})(window);
