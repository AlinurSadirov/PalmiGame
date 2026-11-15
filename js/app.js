/* Palmi — приложение: навигация, меню, карта, результаты, Premium, статистика, словарь, настройки. */
(function (root) {
  'use strict';
  const P = root.Palmi;
  const { Content: C, Store: S, Art, Sound, Adaptive: A } = P;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Number(n).toLocaleString('ru-RU').replace(/ /g, ' ');
  const tenge = (n) => fmt(n) + ' ₸';
  const stage = () => document.getElementById('stage');

  let cleanup = null;
  const actions = {};

  const App = {
    esc, tenge, fmt, actions, screen: null, params: {},
    go(name, params = {}) {
      if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
      App.screen = name; App.params = params;
      const fn = SCREENS[name] || P.Lesson.SCREENS[name];
      const res = fn(params) || {};
      stage().innerHTML = `<div class="screen ${name}">${res.html || ''}</div>${root.PALMI_ARTIFACT ? '<div class="badge-demo">Демо-версия без камеры · Palmi</div>' : ''}`;
      if (res.mount) cleanup = res.mount(stage().firstElementChild) || null;
      S.save();
    },
    onCleanup(fn) { cleanup = fn; },
    toast(text, kind) {
      stage().querySelectorAll('.toast').forEach((x) => x.remove());
      const t = document.createElement('div');
      t.className = 'toast' + (kind ? ' ' + kind : '');
      t.textContent = text;
      stage().appendChild(t);
      setTimeout(() => t.remove(), 2600);
    },
    topbar() {
      const p = S.current();
      const stars = Object.values(p.levels).reduce((s, l) => s + (l.stars || 0), 0);
      const maxStars = C.ISLANDS.reduce((s, i) => s + i.levels.length * 3, 0);
      return `<div class="topbar">
        <button class="brand" data-act="go" data-to="start">${Art.logo(40)} Palmi</button>
        <span class="who">${esc(p.name)}${p.plus ? ' · <span class="chip sun">Plus</span>' : ''}</span>
        <div class="spacer"></div>
        <span class="stat" title="Дней подряд">${Art.ICON.flame} ${S.streakAlive(p)} дн.</span>
        <span class="stat" title="Звёзды">${Art.ICON.star(true)} ${stars} / ${maxStars}</span>
        <span class="stat"><span class="xp-badge">XP</span> ${fmt(p.xp)}</span>
        <button class="icon-btn" data-act="go" data-to="dictionary" aria-label="Словарь" title="Словарь">${Art.ICON.book}</button>
        <button class="icon-btn" data-act="go" data-to="stats" aria-label="Статистика" title="Статистика и рекорды">${Art.ICON.chart}</button>
        <button class="btn sun sm" data-act="premium" data-src="topbar">${p.plus ? 'Plus активен' : 'Palmi Plus'}</button>
        <button class="icon-btn" data-act="go" data-to="settings" aria-label="Настройки">${Art.ICON.gear}</button>
      </div>`;
    },
  };

  // ---------- Открытие уровней ----------
  function levelPassed(p, id) { return p.levels[id] && p.levels[id].stars > 0; }
  function islandOpen(p, idx) {
    const isl = C.ISLANDS[idx];
    if (isl.premium && !p.plus) return { open: false, reason: 'plus' };
    if (idx === 0) return { open: true };
    const prev = C.ISLANDS[idx - 1];
    const done = prev.levels.filter((l) => levelPassed(p, l.id)).length;
    return done >= 2 || root.PALMI_UNLOCK_ALL ? { open: true } : { open: false, reason: 'prev', need: prev.short };
  }
  function levelOpen(p, iIdx, lIdx) {
    if (!islandOpen(p, iIdx).open) return false;
    return lIdx === 0 || levelPassed(p, C.ISLANDS[iIdx].levels[lIdx - 1].id) || !!root.PALMI_UNLOCK_ALL;
  }
  function nextLevel(p) {
    for (let i = 0; i < C.ISLANDS.length; i++) {
      for (let j = 0; j < C.ISLANDS[i].levels.length; j++) {
        if (levelOpen(p, i, j) && !levelPassed(p, C.ISLANDS[i].levels[j].id)) return { i, j };
      }
    }
    return null;
  }
  App.levelOpen = levelOpen; App.islandOpen = islandOpen;

  // ---------- Экраны ----------
  const SCREENS = {};

  SCREENS.start = () => {
    const st = S.state;
    const profiles = Object.values(st.profiles);
    return {
      html: `
      <svg class="sea" viewBox="0 0 1280 250" width="1280" height="250" aria-hidden="true">
        <path d="M0 40 Q 160 10 320 40 T 640 40 T 960 40 T 1280 40 V 250 H 0 Z" fill="#1FB5A8"/>
        <path d="M0 90 Q 160 65 320 90 T 640 90 T 960 90 T 1280 90 V 250 H 0 Z" fill="#17A397"/>
        <ellipse cx="300" cy="180" rx="300" ry="70" fill="#F6E7C8"/>
      </svg>
      <svg style="position:absolute;left:0;top:0" width="1280" height="300" aria-hidden="true"><circle cx="1150" cy="90" r="50" fill="#FFD24D"/></svg>
      <div class="bob" style="position:absolute;left:110px;top:250px">${Art.palmi('action', 360)}</div>
      <div class="title">
        <div class="logo-row">${Art.logo(64)}<h1>Palmi</h1></div>
        <div class="slogan">Learn English with your hands</div>
        <p style="margin:0;font-size:21px;line-height:1.45;font-weight:600;max-width:560px">Путешествуй с выдрёнком Palmi по Архипелагу Ладоней: учи жесты американского языка жестов (ASL), английские слова и их перевод на русский.</p>
        <div class="card" style="display:flex;flex-direction:column;gap:12px;margin-top:6px">
          <span style="font-size:17px;font-weight:900">${profiles.length ? 'Кто играет?' : 'Как тебя зовут?'}</span>
          ${profiles.length ? `<div class="profiles">${profiles.map((p) => `<button class="profile-btn ${p.id === st.currentId ? 'on' : ''}" data-act="pick-profile" data-id="${p.id}">${esc(p.name)} · ${fmt(p.xp)} XP</button>`).join('')}</div>` : ''}
          <div class="name-row"><input id="new-name" type="text" maxlength="24" placeholder="Новый игрок: имя" aria-label="Имя нового игрока"><button class="btn teal sm" data-act="new-profile">Создать</button></div>
          <div style="display:flex;gap:12px">
            <button class="btn lg" data-act="play" ${st.currentId ? '' : 'disabled'}>${st.currentId ? 'Начать приключение' : 'Сначала создай игрока'}</button>
          </div>
        </div>
        <span class="muted" style="font-size:15px">${Art.ICON.camera} Нужна веб-камера. Видео обрабатывается только на этом компьютере и никуда не отправляется.</span>
      </div>`,
      mount(el) {
        const inp = el.querySelector('#new-name');
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') actions['new-profile'](); });
        if (!profiles.length) setTimeout(() => inp.focus(), 50);
      },
    };
  };

  actions['pick-profile'] = (d) => { S.select(d.id); App.go('start'); };
  actions['new-profile'] = () => {
    const v = document.getElementById('new-name').value.trim();
    if (!v) { App.toast('Введи имя'); return; }
    S.newProfile(v); Sound.click(); App.go('start');
  };
  actions.play = () => {
    const p = S.current(); if (!p) return;
    p.sessions = (p.sessions || 0) + 1;
    Sound.click(); App.go('map');
  };
  actions.go = (d) => { Sound.click(); App.go(d.to, d.id ? { id: d.id } : {}); };

  SCREENS.map = (params) => {
    const p = S.current();
    const nx = nextLevel(p);
    const sel = params.island != null ? Number(params.island) : nx ? nx.i : 0;
    const POS = [[60, 470], [250, 300], [440, 140], [620, 430], [660, 60]];
    const isles = C.ISLANDS.map((isl, i) => {
      const op = islandOpen(p, i);
      const stars = isl.levels.reduce((s, l) => s + ((p.levels[l.id] || {}).stars || 0), 0);
      const sub = isl.premium && !p.plus ? 'Palmi Plus' : op.open ? `${stars} / ${isl.levels.length * 3} звёзд` : `Пройди 2 уровня: ${op.need}`;
      return `<button class="isle ${i === sel ? 'sel' : ''} ${op.open ? '' : 'locked'}" style="left:${POS[i][0]}px;top:${POS[i][1]}px" data-act="pick-island" data-i="${i}">
        ${Art.island(isl.id, !op.open)}<span class="name">${i + 1}. ${esc(isl.name)}</span><span class="sub">${esc(sub)}</span></button>`;
    }).join('');
    const isl = C.ISLANDS[sel];
    const op = islandOpen(p, sel);
    const levels = isl.levels.map((l, j) => {
      const open = levelOpen(p, sel, j);
      const st = (p.levels[l.id] || {}).stars || 0;
      const words = [...l.words, ...(l.review || [])].slice(0, 4).map((w) => C.WORDS[w].en).join(', ');
      return `<button class="level-row ${open ? '' : 'locked'}" data-act="${open ? 'start-level' : isl.premium && !p.plus ? 'premium' : 'noop'}" data-i="${sel}" data-j="${j}" data-src="lock">
        <span class="n">${j + 1}</span><span style="display:flex;flex-direction:column"><span>${esc(l.name)}${l.mode === 'challenge' ? ' · испытание' : l.mode === 'speed' ? ' · на скорость' : ''}</span><span class="muted" style="font-size:13px">${esc(words)}${l.words.length ? ' · новые: ' + l.words.length : ''}</span></span>
        <span class="stars">${[1, 2, 3].map((k) => Art.ICON.star(k <= st, 18)).join('')}</span></button>`;
    }).join('');
    const mist = uniqueMistakes(p).length;
    const todayXp = p.xpByDay[S.today()] || 0;
    return {
      html: `${App.topbar()}
      <svg class="ocean" viewBox="0 0 900 648" aria-hidden="true">
        <path d="M30 120 q 12 -8 24 0 q 12 -8 24 0 M520 60 q 12 -8 24 0 q 12 -8 24 0 M760 600 q 12 -8 24 0 q 12 -8 24 0 M60 340 q 12 -8 24 0 q 12 -8 24 0" stroke="#9FE3DA" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M175 470 C 240 420, 300 380, 365 300 S 500 220, 555 160 M555 160 C 640 250, 700 330, 735 430 M735 430 C 780 300, 790 200, 775 120" stroke="#fff" stroke-width="5" stroke-dasharray="2 14" stroke-linecap="round" fill="none"/>
      </svg>
      ${isles}
      <div class="bob" style="position:absolute;left:24px;top:250px">${Art.palmi('idle', 130)}</div>
      <div class="side">
        <div class="card" style="display:flex;flex-direction:column;gap:10px">
          <span class="chip" style="align-self:flex-start">${C.DIFFICULTY[isl.difficulty].label}${isl.premium ? ' · Plus' : ''}</span>
          <h2 style="font-size:26px">${esc(isl.name)}</h2>
          ${op.open ? `<div class="levels">${levels}</div>` : isl.premium && !p.plus
            ? `<p class="muted" style="margin:0">Этот остров входит в Palmi Plus: продвинутые диалоги и задания на скорость.</p><button class="btn sun" data-act="premium" data-src="lock">Открыть с Palmi Plus</button>`
            : `<p class="muted" style="margin:0">Откроется, когда пройдёшь 2 уровня острова «${esc(op.need)}».</p>`}
        </div>
        <button class="card" style="display:flex;align-items:center;gap:12px;border:0;text-align:left;cursor:pointer" data-act="go" data-to="mistakes">
          ${Art.lumo(mist ? 'near' : 'ok', 56)}
          <span style="display:flex;flex-direction:column"><span style="font-size:18px;font-weight:900">Работа над ошибками</span>
          <span class="muted" style="font-size:15px">${mist ? `${mist} ${plural(mist, 'жест ждёт', 'жеста ждут', 'жестов ждут')} разбора` : 'Ошибок нет — отлично!'}</span></span>
        </button>
        <div class="card" style="display:flex;flex-direction:column;gap:8px">
          <span style="font-size:18px;font-weight:900">Цель дня: 50 XP</span>
          <div class="progress" style="flex:none;height:14px"><div style="width:${Math.min(100, todayXp * 2)}%"></div></div>
          <span class="muted" style="font-size:15px">${todayXp} из 50 XP сегодня</span>
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn ghost sm" style="flex:1" data-act="go" data-to="calibration">${Art.ICON.hand} Калибровка</button>
          <button class="btn ghost sm" style="flex:1" data-act="go" data-to="aitest">${Art.ICON.flask} Тест ИИ</button>
        </div>
      </div>`,
    };
  };
  actions['pick-island'] = (d) => { Sound.click(); App.go('map', { island: d.i }); };
  actions.noop = () => App.toast('Сначала пройди предыдущий уровень');
  actions['start-level'] = (d) => {
    const isl = C.ISLANDS[Number(d.i)], lvl = isl.levels[Number(d.j)];
    const plan = A.generateLevel(lvl, isl, S.current());
    Sound.click(); App.go('lesson', { plan, level: lvl, island: isl, i: Number(d.i), j: Number(d.j) });
  };

  function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? few : many;
  }
  App.plural = plural;

  function uniqueMistakes(p) {
    const seen = new Set();
    return p.mistakes.slice().reverse().filter((m) => (seen.has(m.word) ? false : seen.add(m.word)));
  }
  App.uniqueMistakes = uniqueMistakes;

  // ---------- Результаты уровня ----------
  SCREENS.results = (r) => {
    const p = S.current();
    const words = [...new Set(r.plan.tasks.map((t) => (t.sequence ? t.sequence : [t.word])).flat())];
    const fails = r.results.filter((x) => !x.success).map((x) => x.word);
    const nx = nextLevel(p);
    return {
      html: `
      <svg style="position:absolute;left:0;bottom:0" width="1280" height="140" aria-hidden="true"><path d="M0 40 Q 160 15 320 40 T 640 40 T 960 40 T 1280 40 V 140 H 0 Z" fill="#1FB5A8"/></svg>
      <div style="position:absolute;left:60px;top:50px;width:520px;display:flex;flex-direction:column;align-items:center;gap:8px">
        <div style="display:flex;align-items:flex-end;gap:8px">${Art.ICON.star(r.res.stars >= 1, 86)}<span style="margin-bottom:20px">${Art.ICON.star(r.res.stars >= 2, 110)}</span>${Art.ICON.star(r.res.stars >= 3, 86)}</div>
        <h1 style="font-size:50px">${r.practice ? 'Тренировка завершена!' : 'Уровень пройден!'}</h1>
        <p class="muted" style="margin:0;font-size:20px">${esc(r.title)}</p>
        <div class="bob">${Art.palmi('victory', 250)}</div>
      </div>
      <div style="position:absolute;left:640px;top:50px;width:590px;display:flex;flex-direction:column;gap:14px">
        <div class="grid4">
          <div class="tile"><span class="k">Точность</span><span class="v">${Math.round(r.res.accuracy * 100)}%</span></div>
          <div class="tile"><span class="k">Опыт</span><span class="v">+${r.xp} XP</span></div>
          <div class="tile"><span class="k">Время</span><span class="v">${Math.floor(r.time / 60)}:${String(Math.round(r.time % 60)).padStart(2, '0')}</span></div>
          <div class="tile"><span class="k">Стрик</span><span class="v">${S.streakAlive(p)} дн.</span></div>
        </div>
        <div class="card" style="display:flex;flex-direction:column;gap:8px">
          <span style="font-size:18px;font-weight:900">Слова уровня</span>
          <div class="grid2" style="gap:6px 18px;font-size:18px">${words.map((w) => `<span><b>${C.WORDS[w].en}</b> — ${esc(C.WORDS[w].ru)}</span>`).join('')}</div>
          ${fails.length ? `<span style="color:#B5482E;font-weight:800">${fails.length} ${plural(fails.length, 'ошибка', 'ошибки', 'ошибок')} → в «Работу над ошибками»: ${[...new Set(fails)].map((w) => C.WORDS[w].en).join(', ')}</span>` : ''}
          ${r.plan.adaptiveCount ? `<span class="muted" style="font-size:15px">ИИ добавил ${r.plan.adaptiveCount} ${plural(r.plan.adaptiveCount, 'задание', 'задания', 'заданий')} на повторение твоих слабых слов</span>` : ''}
        </div>
        ${r.newAch.map((id) => { const a = C.ACHIEVEMENTS.find((x) => x.id === id); return `<div class="card" style="display:flex;align-items:center;gap:14px;background:var(--sun)">${Art.ICON.medal}<span style="display:flex;flex-direction:column"><span style="font-size:18px;font-weight:900">Новое достижение: «${esc(a.name)}»</span><span style="font-size:15px;font-weight:700">${esc(a.desc)}</span></span></div>`; }).join('')}
        <div style="display:flex;gap:14px;margin-top:4px">
          <button class="btn lg" style="flex:2" data-act="go" data-to="map">${nx ? 'Дальше по карте' : 'На карту'}</button>
          ${fails.length ? '<button class="btn ghost" style="flex:1" data-act="go" data-to="mistakes">Разобрать ошибки</button>' : `<button class="btn ghost" style="flex:1" data-act="replay">Повторить</button>`}
        </div>
      </div>`,
      mount() { Sound.level(); },
    };
  };
  actions.replay = () => {
    const r = App.params;
    if (r.level) actions['start-level']({ i: r.i, j: r.j });
    else App.go('map');
  };

  // ---------- Palmi Plus ----------
  actions.premium = (d) => {
    const p = S.current();
    p.metrics.premiumViews++;
    if (d && d.src === 'lock') p.metrics.lockClicks++;
    Sound.click(); App.go('premium', { from: App.screen });
  };
  SCREENS.premium = () => {
    const p = S.current();
    const row = (k, free, plus) => `<tr><td>${k}</td><td style="text-align:center">${free}</td><td style="text-align:center;background:#FFF8DD;font-weight:900">${plus}</td></tr>`;
    return {
      html: `<div style="position:absolute;inset:0;background:var(--ink)"></div>
      <svg style="position:absolute;left:0;bottom:0" width="1280" height="90" aria-hidden="true"><path d="M0 30 Q 160 5 320 30 T 640 30 T 960 30 T 1280 30 V 90 H 0 Z" fill="#17A397"/></svg>
      <div style="position:absolute;left:50px;top:56px;width:400px;display:flex;flex-direction:column;gap:14px;color:#fff">
        <span class="chip sun" style="align-self:flex-start;color:var(--ink)">PALMI PLUS</span>
        <h1 style="font-size:46px;line-height:1.1">Открой весь архипелаг</h1>
        <p style="margin:0;font-size:19px;line-height:1.45;font-weight:600;color:#DCE6F2">Новые острова, безлимитный разбор ошибок от Lumo и подробная статистика по каждому жесту.</p>
        <div style="display:flex;align-items:flex-end">${Art.palmi('victory', 200)}${Art.lumo('ok', 100)}</div>
      </div>
      <div class="card" style="position:absolute;left:490px;top:56px;width:740px;padding:26px 30px;display:flex;flex-direction:column;gap:14px">
        <table class="t"><thead><tr><th>Что входит</th><th style="text-align:center">Бесплатно</th><th style="text-align:center;background:var(--sun)">Plus</th></tr></thead><tbody>
          ${row('Острова', '1–3', 'Все 5')}${row('Распознавание жестов и калибровка', 'Да', 'Да')}
          ${row('Подробный AI-разбор ошибок', C.PREMIUM.freeDetailedPerDay + ' в день', 'Без лимита')}
          ${row('Статистика по каждому жесту', 'XP и стрик', 'Полная')}${row('Задания на скорость', '—', 'Да')}
        </tbody></table>
        <div class="grid2">
          <div class="tile" style="border:2px solid #9FB0C3"><span class="k">${C.PREMIUM.monthly.label}</span><span class="v">${tenge(C.PREMIUM.monthly.price)}</span></div>
          <div class="tile" style="border:3px solid var(--teal);background:var(--teal-l)"><span class="k" style="color:var(--teal-d)">${C.PREMIUM.yearly.label} · ${C.PREMIUM.yearly.note}</span><span class="v">${tenge(C.PREMIUM.yearly.price)}</span></div>
        </div>
        ${p.plus
          ? `<div class="chip" style="align-self:center;font-size:18px">Palmi Plus активен с ${new Date(p.plusSince).toLocaleDateString('ru-RU')}</div>
             <div style="display:flex;gap:14px"><button class="btn" style="flex:2" data-act="back-from-premium">Продолжить</button><button class="btn ghost" style="flex:1" data-act="plus-off">Отключить (демо)</button></div>`
          : `<div style="display:flex;gap:14px"><button class="btn lg" style="flex:2" data-act="plus-on">${C.PREMIUM.trialDays} дней бесплатно (демо)</button><button class="btn ghost" style="flex:1" data-act="back-from-premium">Не сейчас</button></div>`}
        <span class="muted" style="font-size:14px;text-align:center">Демо-режим прототипа: реальная оплата не проводится, статус Plus включается локально.</span>
      </div>`,
    };
  };
  actions['plus-on'] = () => { const p = S.current(); p.plus = true; p.plusSince = Date.now(); p.metrics.trialClicks++; Sound.unlock(); App.toast('Palmi Plus включён — острова 4–5 открыты'); App.go('premium'); };
  actions['plus-off'] = () => { const p = S.current(); p.plus = false; App.go('premium'); };
  actions['back-from-premium'] = () => App.go(App.params.from && App.params.from !== 'premium' && SCREENS[App.params.from] ? App.params.from : 'map');

  // ---------- Статистика и рекорды ----------
  SCREENS.stats = () => {
    const p = S.current();
    const learned = Object.values(p.words).filter((w) => w.correct > 0).length;
    const passed = Object.values(p.levels).filter((l) => l.stars > 0).length;
    const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; return { k, label: d.toLocaleDateString('ru-RU', { weekday: 'short' }), v: p.xpByDay[k] || 0 }; });
    const maxV = Math.max(50, ...days.map((d) => d.v));
    const chart = `<svg viewBox="0 0 520 190" width="520" height="190" role="img" aria-label="Опыт за 7 дней">${days.map((d, i) => {
      const h = (d.v / maxV) * 130, x = 20 + i * 70;
      return `<rect x="${x}" y="${150 - h}" width="44" height="${Math.max(h, 2)}" rx="8" fill="${i === 6 ? '#FF7A59' : '#1FB5A8'}"/><text x="${x + 22}" y="${142 - h}" text-anchor="middle" font-size="14" font-weight="800" fill="#1D3557">${d.v || ''}</text><text x="${x + 22}" y="176" text-anchor="middle" font-size="14" font-weight="700" fill="#4A5A70">${d.label}</text>`;
    }).join('')}</svg>`;
    const wordRows = Object.keys(C.WORDS).map((id) => {
      const w = p.words[id];
      if (!w || !w.attempts) return `<tr><td><b>${C.WORDS[id].en}</b> <span class="muted">${esc(C.WORDS[id].ru)}</span></td><td colspan="4" class="muted">ещё не встречалось</td></tr>`;
      const acc = Math.round((w.correct / w.attempts) * 100), conf = w.confN ? Math.round((w.confSum / w.confN) * 100) : 0;
      return `<tr><td><b>${C.WORDS[id].en}</b> <span class="muted">${esc(C.WORDS[id].ru)}</span></td><td>${w.attempts}</td><td>${acc}%</td><td>${conf}%</td><td><div class="meter"><div style="width:${Math.round(w.strength * 100)}%"></div></div></td></tr>`;
    }).join('');
    const board = Object.values(S.state.profiles).map((q) => ({ name: q.name, xp: q.xp, stars: Object.values(q.levels).reduce((s, l) => s + (l.stars || 0), 0), words: Object.values(q.words).filter((w) => w.correct > 0).length, me: q.id === p.id }))
      .sort((a, b) => b.xp - a.xp);
    const best = [];
    C.ISLANDS.forEach((isl) => isl.levels.forEach((l) => { const r = p.levels[l.id]; if (r && r.stars) best.push({ name: `${isl.short}: ${l.name}`, acc: r.bestAcc, time: r.bestTime, stars: r.stars, plays: r.plays }); }));
    return {
      html: `${App.topbar()}<div class="page" style="display:flex;flex-direction:column;gap:18px">
        <div style="display:flex;align-items:center;gap:12px"><button class="icon-btn" data-act="go" data-to="map" aria-label="Назад">${Art.ICON.back}</button><h1 style="font-size:34px">Статистика и рекорды</h1></div>
        <div class="grid4">
          <div class="tile"><span class="k">Опыт</span><span class="v">${fmt(p.xp)} XP</span></div>
          <div class="tile"><span class="k">Серия дней</span><span class="v">${S.streakAlive(p)}</span></div>
          <div class="tile"><span class="k">Выучено слов</span><span class="v">${learned} / ${Object.keys(C.WORDS).length}</span></div>
          <div class="tile"><span class="k">Пройдено уровней</span><span class="v">${passed}</span></div>
        </div>
        <div class="grid2">
          <div class="card"><h3 style="font-size:20px;margin-bottom:6px">Опыт за 7 дней</h3>${chart}</div>
          <div class="card"><h3 style="font-size:20px;margin-bottom:8px">Таблица рекордов (игроки на этом компьютере)</h3>
            <table class="t"><thead><tr><th>#</th><th>Игрок</th><th>XP</th><th>Звёзды</th><th>Слова</th></tr></thead><tbody>
            ${board.map((b, i) => `<tr style="${b.me ? 'background:#FFF8DD' : ''}"><td>${i + 1}</td><td>${esc(b.name)}${b.me ? ' (ты)' : ''}</td><td>${fmt(b.xp)}</td><td>${b.stars}</td><td>${b.words}</td></tr>`).join('')}</tbody></table></div>
        </div>
        <div class="card"><h3 style="font-size:20px;margin-bottom:8px">Лучшие результаты уровней</h3>
          ${best.length ? `<table class="t"><thead><tr><th>Уровень</th><th>Звёзды</th><th>Лучшая точность</th><th>Лучшее время</th><th>Попыток</th></tr></thead><tbody>${best.map((b) => `<tr><td>${esc(b.name)}</td><td>${'★'.repeat(b.stars)}</td><td>${Math.round(b.acc * 100)}%</td><td>${Math.floor(b.time / 60)}:${String(Math.round(b.time % 60)).padStart(2, '0')}</td><td>${b.plays}</td></tr>`).join('')}</tbody></table>` : '<p class="muted" style="margin:0">Пройди первый уровень — здесь появятся рекорды.</p>'}
        </div>
        <div class="card" style="position:relative"><h3 style="font-size:20px;margin-bottom:8px">Точность по каждому жесту ${p.plus ? '' : '<span class="chip sun">Plus</span>'}</h3>
          <div class="${p.plus ? '' : 'blur'}"><table class="t"><thead><tr><th>Слово</th><th>Попыток</th><th>Верно</th><th>Ср. уверенность ИИ</th><th>Сила слова (адаптация)</th></tr></thead><tbody>${wordRows}</tbody></table></div>
          ${p.plus ? '' : '<div class="lock-note" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-30%)" data-act="premium" data-src="stats">Полная статистика по жестам — в Palmi Plus. Нажми, чтобы посмотреть.</div>'}
        </div>
        <div class="card"><h3 style="font-size:20px;margin-bottom:10px">Достижения · ${Object.keys(p.achievements).length} из ${C.ACHIEVEMENTS.length}</h3>
          <div class="grid3">${C.ACHIEVEMENTS.map((a) => `<div class="ach ${p.achievements[a.id] ? 'on' : ''}"><span class="ic">${Art.ICON.medal}</span><span style="display:flex;flex-direction:column"><b>${esc(a.name)}</b><span class="muted" style="font-size:14px">${esc(a.desc)}</span></span></div>`).join('')}</div>
        </div>
        <div class="card"><h3 style="font-size:20px;margin-bottom:6px">Метрики монетизации (для отчёта)</h3>
          <p class="muted" style="margin:0">Открытий экрана Plus: <b>${p.metrics.premiumViews}</b> · из них по замку: <b>${p.metrics.lockClicks}</b> · упёрлись в лимит разбора: <b>${p.metrics.limitHits}</b> · нажали «пробный период»: <b>${p.metrics.trialClicks}</b></p>
        </div>
      </div>`,
    };
  };

  // ---------- Словарь ----------
  SCREENS.dictionary = () => ({
    html: `${App.topbar()}<div class="page">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px"><button class="icon-btn" data-act="go" data-to="map" aria-label="Назад">${Art.ICON.back}</button><h1 style="font-size:34px">Словарь жестов</h1><span class="muted">${Object.keys(C.WORDS).length} слов · нажми на карточку</span></div>
      <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:12px">
        ${Object.keys(C.WORDS).map((id) => `<button class="word-card" data-act="word" data-id="${id}">${Art.referenceHand(id, { w: 140, h: 150, pad: 14 })}<b style="font-size:18px">${C.WORDS[id].en}</b><span class="muted" style="font-size:15px">${esc(C.WORDS[id].ru)}</span></button>`).join('')}
      </div></div>`,
  });
  actions.word = (d) => {
    const w = C.WORDS[d.id];
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `<div class="modal" style="width:820px;display:flex;gap:26px;align-items:center">
      ${Art.referenceHand(d.id, { w: 300, h: 320 })}
      <div style="display:flex;flex-direction:column;gap:12px;flex:1">
        <span style="font-size:56px;font-weight:900;line-height:1">${w.en}</span><span style="font-size:26px;font-weight:700;color:var(--ink-2)">${esc(w.ru)}</span>
        <div class="hintbox">${esc(w.hint)}</div>
        <p class="muted" style="margin:0;font-size:14px">Рисунок показывает форму кисти в ключевой момент жеста. Движение описано в подсказке.</p>
        <div style="display:flex;gap:12px"><button class="btn" data-act="practice-word" data-id="${d.id}">Потренировать</button><button class="btn ghost" data-act="close-overlay">Закрыть</button></div>
      </div></div>`;
    stage().appendChild(ov);
  };
  actions['close-overlay'] = (d, el) => { const o = el.closest('.overlay'); if (o) o.remove(); };
  actions['practice-word'] = (d) => {
    const plan = A.generatePractice([d.id], S.current());
    App.go('lesson', { plan, practice: true, title: 'Тренировка: ' + C.WORDS[d.id].en });
  };

  // ---------- Настройки ----------
  SCREENS.settings = () => {
    const st = S.state.settings, p = S.current();
    return {
      html: `${App.topbar()}<div class="page"><div style="display:flex;align-items:center;gap:12px;margin-bottom:16px"><button class="icon-btn" data-act="go" data-to="map" aria-label="Назад">${Art.ICON.back}</button><h1 style="font-size:34px">Настройки</h1></div>
      <div class="grid2">
        <div class="card" style="display:flex;flex-direction:column;gap:16px">
          <label class="field">Камера<select id="set-cam"><option value="">По умолчанию</option></select></label>
          <label class="toggle">Зеркалить изображение камеры<input type="checkbox" id="set-mirror" ${st.mirror ? 'checked' : ''}></label>
          <label class="toggle">Показывать скелет руки на камере<input type="checkbox" id="set-skel" ${st.showSkeleton ? 'checked' : ''}></label>
          <label class="toggle">Демо-режим без камеры (рука-симулятор)<input type="checkbox" id="set-demo" ${st.demo || root.PALMI_ARTIFACT ? 'checked' : ''} ${root.PALMI_ARTIFACT ? 'disabled' : ''}></label>
          <label class="toggle">Использовать мою калибровку (kNN)<input type="checkbox" id="set-knn" ${st.useKnn ? 'checked' : ''}></label>
        </div>
        <div class="card" style="display:flex;flex-direction:column;gap:16px">
          <label class="field">Громкость звуков: <span id="vol-v">${Math.round(st.volume * 100)}%</span><input type="range" id="set-vol" min="0" max="100" value="${Math.round(st.volume * 100)}"></label>
          <label class="toggle">Показывать русский перевод сразу (Beginner/Intermediate)<input type="checkbox" id="set-ru" ${st.showRu ? 'checked' : ''}></label>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn ghost sm" data-act="reset-profile">Сбросить прогресс «${esc(p.name)}»</button>
            <button class="btn ghost sm" data-act="delete-profile">Удалить игрока</button>
          </div>
          <div class="hintbox" style="font-size:15px">Видео с камеры обрабатывается только на этом компьютере и никуда не отправляется. Сохраняются только числа: прогресс, статистика и точки калибровки.</div>
          ${S.memoryOnly ? '<div class="lock-note">Сохранение недоступно в этом окне: прогресс пропадёт после закрытия.</div>' : ''}
        </div>
      </div></div>`,
      mount(el) {
        const sel = el.querySelector('#set-cam');
        P.Vision.listCameras().then((cams) => {
          cams.forEach((c) => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.label; if (c.id === st.cameraId) o.selected = true; sel.appendChild(o); });
        });
        sel.onchange = () => { st.cameraId = sel.value; S.save(); };
        const bind = (id, key) => { const i = el.querySelector(id); i.onchange = () => { st[key] = i.checked; S.save(); }; };
        bind('#set-mirror', 'mirror'); bind('#set-skel', 'showSkeleton'); bind('#set-demo', 'demo'); bind('#set-knn', 'useKnn'); bind('#set-ru', 'showRu');
        const vol = el.querySelector('#set-vol');
        vol.oninput = () => { st.volume = vol.value / 100; el.querySelector('#vol-v').textContent = vol.value + '%'; };
        vol.onchange = () => { S.save(); Sound.click(); };
      },
    };
  };
  actions['reset-profile'] = (d, el) => {
    if (el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.textContent = 'Нажми ещё раз — прогресс удалится'; return; }
    S.resetProfile(S.current()); App.toast('Прогресс сброшен'); App.go('map');
  };
  actions['delete-profile'] = (d, el) => {
    if (el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.textContent = 'Нажми ещё раз — игрок удалится'; return; }
    S.deleteProfile(S.state.currentId); App.go('start');
  };

  // ---------- Запуск ----------
  function fitStage() {
    const k = Math.min(root.innerWidth / 1280, root.innerHeight / 720);
    stage().style.transform = `scale(${k})`;
  }

  function boot() {
    S.load();
    if (root.PALMI_ARTIFACT) S.state.settings.demo = true;
    fitStage();
    root.addEventListener('resize', fitStage);
    stage().addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el || el.disabled) return;
      const fn = actions[el.dataset.act];
      if (fn) { e.preventDefault(); fn(el.dataset, el); }
    });
    root.addEventListener('keydown', (e) => { if (P.Lesson && P.Lesson.onKey) P.Lesson.onKey(e); });
    App.go('start');
  }

  P.App = App;
  P.SCREENS = SCREENS;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
