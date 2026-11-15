/* Palmi — экраны с камерой: урок, работа над ошибками, калибровка, тест ИИ. */
(function (root) {
  'use strict';
  const P = root.Palmi;
  const { Content: C, Store: S, Art, Sound, Adaptive: A, Gestures: G, Vision: V } = P;
  const W = (id) => C.WORDS[id];
  const esc = (s) => P.App.esc(s);

  // ---------- Модель калибровки текущего игрока ----------
  function knnFor(p) {
    if (!S.state.settings.useKnn || !p.calibration || !p.calibration.length) return null;
    const k = P.Knn.createKnn(p.calibration);
    return k.ready() ? k : null;
  }

  // ---------- Панель камеры (общая для всех экранов с камерой) ----------
  function camHTML() {
    const mirror = S.state.settings.mirror ? 'mirror' : '';
    return `<div class="cam" id="cam">
      <video id="cam-video" class="${mirror}" playsinline muted></video>
      <canvas id="cam-canvas" class="${mirror}" width="724" height="544"></canvas>
      <div class="status" id="cam-status"><span class="dot warn"></span>Включаю камеру…</div>
      <div class="demo-pick" id="demo-pick" style="display:none"></div>
      <div class="hold" id="hold"></div>
      <div class="bar" id="cam-bar">
        <span id="lumo-slot">${Art.lumo('off', 76)}</span>
        <div style="flex:1;display:flex;flex-direction:column;gap:8px">
          <span id="cam-line" style="font-size:20px;font-weight:900">Покажи руку в кадре</span>
          <div class="conf"><div id="conf-fill" style="width:0%"></div><div class="th" id="conf-th" style="left:70%"></div></div>
          <span id="cam-tip" style="font-size:15px;font-weight:700;color:#C9D6E3">Держи жест, пока полоска выше белой отметки</span>
        </div>
      </div>
    </div>`;
  }

  function startCam(el, onFrame) {
    const video = el.querySelector('#cam-video'), canvas = el.querySelector('#cam-canvas');
    const ctx = canvas.getContext('2d');
    const status = el.querySelector('#cam-status'), pick = el.querySelector('#demo-pick');
    const p = S.current();
    let knn = knnFor(p), knnKey = (p.calibration || []).length + ':' + S.state.settings.useKnn;
    let raf = 0, alive = true, last = performance.now();

    const setStatus = (cls, text) => { status.innerHTML = `<span class="dot ${cls}"></span>${esc(text)}`; };
    const forceDemo = S.state.settings.demo || root.PALMI_ARTIFACT;
    const started = forceDemo ? Promise.resolve(V.startDemo()) : V.startCamera(video, S.state.settings.cameraId);
    started.then((r) => {
      if (!alive) return;
      if (r.mode === 'demo') {
        video.style.display = 'none';
        setStatus('warn', (r.error ? r.error + ' · ' : '') + 'Демо: рука-симулятор');
        pick.style.display = 'flex';
        pick.innerHTML = '<span style="color:#fff;font-weight:800;font-size:13px;padding:5px 4px">Покажи жест:</span>' + G.GESTURE_IDS.map((id) => `<button data-demo="${id}">${W(id).en}</button>`).join('') + '<button data-demo="">Убрать руку</button>';
        pick.onclick = (e) => {
          const b = e.target.closest('button[data-demo]'); if (!b) return;
          V.setDemoGesture(b.dataset.demo || null);
          pick.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b && !!b.dataset.demo));
        };
      } else setStatus('', 'Камера включена');
    });

    const toCanvas = (lm, mode) => {
      if (mode === 'demo') return lm.map((q) => ({ x: q.x * (724 / 640), y: q.y * (544 / 480) }));
      const vs = V.videoSize, k = Math.max(724 / vs.w, 544 / vs.h);
      const ox = (724 - vs.w * k) / 2, oy = (544 - vs.h * k) / 2;
      return lm.map((q) => ({ x: ox + q.x * k, y: oy + q.y * k }));
    };
    const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];

    function tick(now) {
      if (!alive) return;
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const fr = V.frame();
      ctx.clearRect(0, 0, 724, 544);
      let res = null;
      const key = (p.calibration || []).length + ':' + S.state.settings.useKnn;
      if (key !== knnKey) { knn = knnFor(p); knnKey = key; } // калибровка изменилась — пересобираем модель
      if (fr.lm) {
        res = G.classify(fr.lm, { knn });
        if (S.state.settings.showSkeleton || fr.mode === 'demo') {
          const pts = toCanvas(fr.lm, fr.mode);
          ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.strokeStyle = '#7FE3D8';
          BONES.forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(pts[a].x, pts[a].y); ctx.lineTo(pts[b].x, pts[b].y); ctx.stroke(); });
          ctx.fillStyle = '#fff';
          pts.forEach((q) => { ctx.beginPath(); ctx.arc(q.x, q.y, 5, 0, 7); ctx.fill(); });
        }
        if (fr.mode === 'camera') setStatus('', 'Камера включена · рука найдена');
      } else if (fr.mode === 'camera') setStatus('warn', 'Подними руку в рамку кадра');
      onFrame(res, dt, fr);
    }
    raf = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(raf); V.stop(); };
  }

  // Индикатор: Lumo + полоса уверенности
  function showConf(el, conf, th, line, tip, hasHand) {
    const tone = !hasHand ? 'off' : conf >= th ? 'ok' : conf >= th - 0.15 ? 'near' : 'miss';
    const slot = el.querySelector('#lumo-slot');
    if (slot.dataset.tone !== tone) { slot.dataset.tone = tone; slot.innerHTML = Art.lumo(tone, 76); }
    const fill = el.querySelector('#conf-fill');
    fill.style.width = Math.round(conf * 100) + '%';
    fill.style.background = tone === 'ok' ? '#4CD98F' : tone === 'near' ? '#FFD24D' : '#FF7A59';
    el.querySelector('#conf-th').style.left = Math.round(th * 100) + '%';
    el.querySelector('#cam-line').textContent = line;
    el.querySelector('#cam-tip').textContent = tip;
  }
  function holdRing(el, frac) {
    const r = 26, c = 2 * Math.PI * r;
    el.querySelector('#hold').innerHTML = frac > 0 ? `<svg width="64" height="64" viewBox="0 0 64 64" aria-label="Удержание жеста"><circle cx="32" cy="32" r="${r}" stroke="rgba(255,255,255,.3)" stroke-width="7" fill="none"/><circle cx="32" cy="32" r="${r}" stroke="#4CD98F" stroke-width="7" fill="none" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - frac)}" transform="rotate(-90 32 32)" stroke-linecap="round"/></svg>` : '';
  }

  // =====================================================================
  //  УРОК
  // =====================================================================
  const SCREENS = {};
  const CAMERA_TYPES = ['learn', 'show', 'translate', 'phrase', 'dialog', 'speed', 'sentence'];
  const TYPE_LABEL = { learn: 'УЗНАЙ ЖЕСТ', show: 'ПОКАЖИ СЛОВО', translate: 'ПЕРЕВЕДИ ЖЕСТОМ', quiz: 'ЧТО ЗА ЖЕСТ?', meaning: 'ПЕРЕВОД СЛОВА', phrase: 'ФРАЗА', dialog: 'ОТВЕТЬ ЖИТЕЛЮ', speed: 'НА СКОРОСТЬ', sentence: 'СОБЕРИ ПРЕДЛОЖЕНИЕ' };
  // Стабилизация распознавания: подготовка, окно голосования, неподвижность руки
  const STAB = { prep: 1.2, stepPrep: 0.6, win: 12, winNeed: 0.75, winMin: 8, still: 0.035, settle: 0.3 };
  let L = null; // состояние текущего урока

  SCREENS.lesson = (params) => {
    L = { ...params, idx: 0, results: [], xp: 0, t0: performance.now(), paused: false, ts: null, stopCam: null };
    return {
      html: `<div class="lesson-top">
          <button class="icon-btn" data-act="pause" aria-label="Пауза">${Art.ICON.pause}</button>
          <div class="progress"><div id="prog" style="width:0%"></div></div>
          <span style="font-size:20px;font-weight:900" id="count"></span>
          <span class="chip ink" id="xp">+0 XP</span>
        </div>
        ${camHTML()}
        <div class="big-panel" id="big" style="display:none"></div>
        <div class="task" id="task"></div>`,
      mount(el) {
        L.el = el;
        L.stopCam = startCam(el, onFrame);
        renderTask();
        return () => { if (L && L.stopCam) L.stopCam(); L = null; };
      },
    };
  };

  function curTask() { return L.plan.tasks[L.idx]; }
  function seqOf(t) { return t.type === 'phrase' ? t.sequence : t.type === 'sentence' ? t.sentence.words : null; }
  function target(t, ts) { const q = seqOf(t); return q ? q[Math.min(ts.k, q.length - 1)] : t.word; }
  function diff() { return C.DIFFICULTY[L.plan.difficulty]; }

  function renderTask() {
    const el = L.el, t = curTask();
    const total = L.plan.tasks.length;
    el.querySelector('#prog').style.width = Math.round((L.idx / total) * 100) + '%';
    el.querySelector('#count').textContent = `${L.idx + 1} / ${total}`;
    el.querySelector('#xp').textContent = `+${L.xp} XP`;
    L.ts = { start: performance.now(), elapsed: 0, hold: 0, k: 0, best: { conf: 0, lm: null }, hintUsed: false, hintShown: false, done: false, prep: STAB.prep, win: [], prevLm: null, motion: 0, handFor: 0, phase: t.type === 'sentence' ? 'build' : 'sign', built: [], buildErrors: 0 };
    const cam = CAMERA_TYPES.includes(t.type) && t.type !== 'sentence';
    el.querySelector('#cam').style.display = cam ? '' : 'none';
    const big = el.querySelector('#big');
    big.style.display = cam ? 'none' : 'flex';
    const w = W(t.word);
    const showRu = diff().showRu && S.state.settings.showRu;
    let body = '';
    const typeChip = `<span class="type ${t.adaptive || t.required ? 'adaptive' : ''}">${TYPE_LABEL[t.type]}${t.required ? ' · ОБЯЗАТЕЛЬНО' : ''}${t.adaptive ? ' · ПОВТОРЕНИЕ ОТ ИИ' : ''}${t.practice ? ' · ТРЕНИРОВКА' : ''}</span>`;
    const hintBtn = t.hint === 'none' || t.type === 'learn' ? '' : `<button class="btn ghost sm" data-act="hint" style="flex:1">Подсказка</button>`;
    const camButtons = `<div style="flex:1"></div><div class="timer"><div id="timer" style="width:100%"></div></div>
      <div style="display:flex;gap:10px">${hintBtn}<button class="btn ghost sm" data-act="skip" style="flex:1">Пропустить</button></div>`;
    const hintBox = (id, visible) => `<div class="hintbox" id="hintbox" style="${visible ? '' : 'display:none'}">${Art.referenceHand(id, { w: 120, h: 130, pad: 10 })}<span id="hinttext">${esc(W(id).hint)}</span></div>`;

    if (t.type === 'learn') {
      body = `${typeChip}<div style="display:flex;align-items:center;gap:10px"><span style="flex:none">${Art.palmi('action', 130)}</span><div style="display:flex;flex-direction:column;gap:4px"><span class="word">${w.en}</span><span class="ru">${esc(w.ru)}</span></div></div>${hintBox(t.word, true)}${camButtons}`;
    } else if (t.type === 'show' || t.type === 'speed') {
      body = `${typeChip}<div style="display:flex;align-items:center;gap:10px"><span style="flex:none">${Art.palmi('idle', 120)}</span><div style="display:flex;flex-direction:column;gap:4px"><span class="word">${w.en}</span><span class="ru" id="ru-reveal">${t.type === 'speed' ? `Быстрее ${L.plan.speedBonus || 6} с — бонус XP` : 'Покажи жест по памяти'}</span></div></div>${hintBox(t.word, false)}${camButtons}`;
    } else if (t.type === 'translate') {
      body = `${typeChip}<div style="display:flex;align-items:center;gap:10px"><span style="flex:none">${Art.palmi('idle', 120)}</span><div style="display:flex;flex-direction:column;gap:4px"><span class="word" style="font-size:42px">${esc(w.ru)}</span><span class="ru" id="ru-reveal">Как это на языке жестов? Английское слово появится после ответа</span></div></div>${hintBox(t.word, false)}${camButtons}`;
    } else if (t.type === 'phrase') {
      body = `${typeChip}<span class="word" style="font-size:36px">${t.sequence.map((s) => W(s).en).join(' · ')}</span><span class="ru">${t.sequence.map((s) => W(s).ru).join(', ')}</span>
        <div class="seq" id="seq">${t.sequence.map((s, i) => `<span class="${i === 0 ? 'cur' : ''}">${i + 1}. ${W(s).en}</span>`).join('')}</div>
        <span class="muted" style="font-size:15px">Покажи жесты по очереди: после каждого верного загорится следующий</span>${hintBox(t.sequence[0], false)}${camButtons}`;
    } else if (t.type === 'dialog') {
      const d = t.line;
      body = `${typeChip}<div style="display:flex;align-items:flex-start;gap:10px"><span style="flex:none">${Art.npc(d.npc, 110)}</span><div style="display:flex;flex-direction:column;gap:6px;flex:1"><span style="font-size:15px;font-weight:800;color:var(--ink-2)">${Art.NPC_NAMES[d.npc]}</span><div class="bubble">${esc(d.en)}</div>
        <span class="ru" id="dlg-ru" style="font-size:18px;${showRu ? '' : 'display:none'}">${esc(d.ru)}</span>${showRu ? '' : '<button class="btn ghost sm" data-act="dlg-ru" style="align-self:flex-start">Перевод</button>'}</div></div>
        <span class="muted" style="font-size:16px">Ответь жестом — одним словом</span>${hintBox(t.word, false)}${camButtons}`;
    } else if (t.type === 'sentence') {
      const sn = t.sentence;
      big.innerHTML = `<span class="muted" style="font-size:18px">Собери по-английски</span>
        <span style="font-size:40px;font-weight:900;text-align:center;max-width:620px;line-height:1.15">${esc(sn.ru)}</span>
        <div id="slots" style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:10px">${sn.words.map(() => '<span style="min-width:140px;height:58px;border-radius:16px;border:3px dashed #9FB0C3"></span>').join('')}</div>
        <div style="margin-top:14px">${Art.npc(L.island && L.island.npc === 'tori' ? 'tori' : 'pip', 120)}</div>`;
      body = `${typeChip}<span style="font-size:24px;font-weight:900">Нажимай слова по порядку</span>
        <span class="muted" style="font-size:16px">Потом покажешь всё предложение жестами. Это обязательное задание: без него уровень не засчитается.</span>
        <div class="options" id="tiles">${t.tiles.map((w) => `<button class="opt" data-act="tile" data-v="${w}" style="font-size:20px">${W(w).en}</button>`).join('')}</div>
        <div style="flex:1"></div><button class="btn ghost sm" data-act="skip">Пропустить</button>`;
    } else if (t.type === 'quiz') {
      big.innerHTML = `<span class="muted" style="font-size:18px">Palmi показывает жест</span>${Art.referenceHand(t.word, { w: 380, h: 400 })}`;
      body = `${typeChip}<div style="display:flex;align-items:center;gap:10px"><span style="flex:none">${Art.palmi('action', 120)}</span><span style="font-size:26px;font-weight:900">Какое это английское слово?</span></div>
        <div class="options">${t.options.map((o) => `<button class="opt" data-act="answer" data-v="${o}">${W(o).en}</button>`).join('')}</div>`;
    } else if (t.type === 'meaning') {
      big.innerHTML = `<span class="muted" style="font-size:18px">Английское слово</span><span style="font-size:96px;font-weight:900">${w.en}</span>${Art.referenceHand(t.word, { w: 200, h: 210 })}`;
      body = `${typeChip}<div style="display:flex;align-items:center;gap:10px"><span style="flex:none">${Art.palmi('idle', 120)}</span><span style="font-size:26px;font-weight:900">Что это слово значит по-русски?</span></div>
        <div class="options">${t.options.map((o) => `<button class="opt" data-act="answer" data-v="${o}" style="font-size:19px">${esc(W(o).ru)}</button>`).join('')}</div>`;
    }
    el.querySelector('#task').innerHTML = body;
    if (cam) {
      el.querySelector('#conf-th').style.left = Math.round(L.plan.threshold * 100) + '%';
      holdRing(el, 0);
    }
  }

  function timeLimit(t) {
    if (t.type === 'speed') return (L.plan.speedBonus || 6) * 1.8;
    const base = L.plan.timeLimit;
    const q = seqOf(t);
    return q ? base * q.length * 0.8 : t.type === 'learn' ? base + 6 : base;
  }

  function showHint(counts) {
    const ts = L.ts, t = curTask();
    const box = L.el.querySelector('#hintbox');
    if (!box || ts.hintShown) return;
    box.style.display = '';
    ts.hintShown = true;
    if (counts && t.type !== 'learn') ts.hintUsed = true;
  }

  function onFrame(res, dt, fr) {
    if (!L || L.paused || !L.ts || L.ts.done) return;
    const t = curTask();
    if (!CAMERA_TYPES.includes(t.type)) return;
    const ts = L.ts, el = L.el, th = L.plan.threshold;
    if (ts.phase === 'build') return;
    const tgt = target(t, ts);
    const q = seqOf(t);
    // 1) подготовка: первые 1,2 с (и 0,6 с между словами фразы) кадры не засчитываются
    if (ts.prep > 0) {
      ts.prep -= dt; ts.win = []; ts.hold = 0; holdRing(el, 0);
      showConf(el, 0, th, ts.k > 0 && q ? `Следующее слово: ${W(tgt).en}` : 'Приготовься…', 'Подними руку в рамку и покажи жест', !!res);
      return;
    }
    ts.elapsed += dt;
    const conf = res ? res.scores[tgt] : 0;
    if (res && conf > ts.best.conf) ts.best = { conf, lm: fr && fr.lm, features: res.features, k: ts.k };
    if (t.hint === 'auto' && ts.elapsed > 5 && !ts.hintShown) showHint(true);
    // 2) неподвижность: среднее смещение точек между кадрами в долях ладони
    if (res && fr && fr.lm) {
      const lm = fr.lm, palm = Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y) || 1;
      if (ts.prevLm) {
        let m = 0; for (let i = 0; i < 21; i++) m += Math.hypot(lm[i].x - ts.prevLm[i].x, lm[i].y - ts.prevLm[i].y);
        ts.motion = ts.motion * 0.6 + (m / 21 / palm) * 0.4;
      }
      ts.prevLm = lm.map((p) => ({ x: p.x, y: p.y }));
      ts.handFor += dt;
    } else { ts.prevLm = null; ts.handFor = 0; }
    const still = ts.motion < STAB.still;
    const settled = ts.handFor >= STAB.settle;
    // 3) окно голосования: жест верный в ≥75% из последних 12 кадров
    const ok = !!res && G.accepts(res, tgt, th);
    ts.win.push(ok && still && settled); if (ts.win.length > STAB.win) ts.win.shift();
    const frac = ts.win.filter(Boolean).length / Math.max(ts.win.length, 1);
    const good = ok && still && settled && ts.win.length >= STAB.winMin && frac >= STAB.winNeed;
    ts.hold = good ? ts.hold + dt : ok ? ts.hold : Math.max(0, ts.hold - dt * 3);
    const need = L.plan.hold;
    holdRing(el, Math.min(1, ts.hold / need));
    let line = 'Покажи руку в кадре', tip = 'Держи жест, пока полоска выше белой отметки';
    if (res) {
      line = ok ? `Верно! ${W(tgt).en} · держи…` : `Распознано: ${W(res.best).en} · ${W(tgt).en} ${Math.round(conf * 100)}%`;
      if (!ok) { const dg = G.diagnose(tgt, res.features, 1); tip = dg.length ? 'Lumo: ' + dg[0].text : 'Почти! Форма похожа на другой жест — сверь с эталоном'; }
      else if (!still) tip = 'Держи руку неподвижно';
      else tip = 'Отлично, не убирай руку';
    }
    showConf(el, conf, th, line, tip, !!res);
    const tl = timeLimit(t);
    const tim = el.querySelector('#timer'); if (tim) tim.style.width = Math.max(0, 100 - (ts.elapsed / tl) * 100) + '%';
    if (ts.hold >= need) {
      if (q && ts.k < q.length - 1) {
        ts.k++; ts.hold = 0; ts.win = []; ts.prep = STAB.stepPrep; ts.best = { conf: 0, lm: null };
        Sound.tick(); Sound.click();
        el.querySelectorAll('#seq span').forEach((sp, i) => { sp.className = i < ts.k ? 'done' : i === ts.k ? 'cur' : ''; });
        const hb = el.querySelector('#hintbox');
        if (hb) hb.innerHTML = `${Art.referenceHand(q[ts.k], { w: 120, h: 130, pad: 10 })}<span>${esc(W(q[ts.k]).hint)}</span>`;
        return;
      }
      finishTask(true);
    } else if (ts.elapsed >= tl) finishTask(false, 'time');
  }

  // Предложение: слова собраны → переходим к показу жестами
  function startSign() {
    const t = curTask(), ts = L.ts, el = L.el, sn = t.sentence;
    ts.phase = 'sign'; ts.k = 0; ts.elapsed = 0; ts.prep = STAB.prep; ts.win = []; ts.hold = 0;
    el.querySelector('#big').style.display = 'none';
    el.querySelector('#cam').style.display = '';
    el.querySelector('#conf-th').style.left = Math.round(L.plan.threshold * 100) + '%';
    el.querySelector('#task').innerHTML = `<span class="type adaptive">ПОКАЖИ ПРЕДЛОЖЕНИЕ · ОБЯЗАТЕЛЬНО</span>
      <span class="word" style="font-size:34px">${sn.words.map((w) => W(w).en).join(', ')}</span><span class="ru">${esc(sn.ru)}</span>
      <div class="seq" id="seq">${sn.words.map((w, i) => `<span class="${i === 0 ? 'cur' : ''}">${i + 1}. ${W(w).en}</span>`).join('')}</div>
      <div class="hintbox" id="hintbox" style="${t.hint === 'none' ? 'display:none' : 'display:none'}">${Art.referenceHand(sn.words[0], { w: 120, h: 130, pad: 10 })}<span>${esc(W(sn.words[0]).hint)}</span></div>
      <div style="flex:1"></div><div class="timer"><div id="timer" style="width:100%"></div></div>
      <div style="display:flex;gap:10px"><button class="btn ghost sm" data-act="hint" style="flex:1">Подсказка</button><button class="btn ghost sm" data-act="skip" style="flex:1">Пропустить</button></div>`;
  }

  function finishTask(success, reason) {
    const t = curTask(), ts = L.ts, p = S.current();
    if (ts.done) return;
    ts.done = true;
    const tgt = target(t, ts);
    const r = { word: tgt, type: t.type, success, hint: ts.hintUsed, conf: ts.best.conf, time: ts.elapsed, adaptive: !!t.adaptive, required: !!t.required };
    const signed = CAMERA_TYPES.includes(t.type) && ts.phase === 'sign';
    if (t.type === 'sentence' && success) p.sentencesDone = (p.sentencesDone || 0) + 1;
    if (signed) {
      A.recordAttempt(p, tgt, r);
      const q = seqOf(t);
      if (q && success) q.forEach((w) => w !== tgt && A.recordAttempt(p, w, { success: true, hint: ts.hintUsed }));
      if (!success) {
        const diag = ts.best.features ? G.diagnose(tgt, ts.best.features, 3) : [];
        p.mistakes.push({ word: tgt, at: Date.now(), conf: ts.best.conf, lm: ts.best.lm, diag, reason: reason || 'skip' });
        if (p.mistakes.length > 30) p.mistakes.splice(0, p.mistakes.length - 30);
      }
    }
    const xp = A.xpFor(r, t, L.plan.mode === 'speed' || t.type === 'speed' ? L.plan.speedBonus : 0);
    L.xp += xp;
    S.addXp(p, xp);
    L.results.push(r);
    S.save();
    feedback(r, xp, t);
  }

  function feedback(r, xp, t) {
    const el = L.el;
    const w = W(r.word);
    const ov = document.createElement('div');
    ov.className = 'feedback';
    if (r.success) {
      Sound.success();
      const extra = t.type === 'sentence' ? `<span style="font-size:24px;font-weight:800">${t.sentence.words.map((x) => W(x).en).join(', ')}</span><span style="font-size:20px;font-weight:700">${esc(t.sentence.ru)}</span>` : t.type === 'translate' ? `<span style="font-size:24px;font-weight:800">${esc(w.ru)} = <b>${w.en}</b></span>` : t.type === 'show' || t.type === 'speed' ? `<span style="font-size:24px;font-weight:800">${w.en} — ${esc(w.ru)}</span>` : t.type === 'dialog' ? `<span style="font-size:20px;font-weight:700">${Art.NPC_NAMES[t.line.npc]} понял твой ответ: <b>${w.en}</b></span>` : '';
      ov.innerHTML = `<div class="box">${Art.palmi('victory', 150)}<h2 style="font-size:40px;color:var(--ok)">Верно! +${xp} XP</h2>${extra}<span class="muted">Уверенность ИИ: ${Math.round(r.conf * 100)}%${r.hint ? ' · с подсказкой' : ''}</span></div>`;
      el.appendChild(ov);
      setTimeout(() => { ov.remove(); next(); }, 1300);
    } else {
      Sound.fail();
      const isCam = CAMERA_TYPES.includes(t.type) && L.ts.phase === 'sign';
      const tip = isCam && L.ts.best.features ? G.diagnose(r.word, L.ts.best.features, 2).map((d) => `<li>${esc(d.text)}</li>`).join('') : '';
      ov.innerHTML = `<div class="box">${Art.palmi('oops', 120)}<h2 style="font-size:34px">${isCam ? (r.time >= timeLimit(t) ? 'Время вышло' : 'Пропущено') : 'Не совсем'}</h2>
        <div style="display:flex;align-items:center;gap:18px;text-align:left">${Art.referenceHand(r.word, { w: 150, h: 160 })}<div style="display:flex;flex-direction:column;gap:6px"><span style="font-size:30px;font-weight:900">${w.en} — ${esc(w.ru)}</span>${tip ? `<ul style="margin:0;padding-left:20px;font-size:17px;font-weight:700">${tip}</ul>` : `<span class="muted">${esc(w.hint)}</span>`}</div></div>
        <span class="muted" style="font-size:15px">${t.required ? '<b style="color:#B5482E">Это обязательное задание: уровень не будет засчитан.</b> ' : ''}${isCam ? 'Жест добавлен в «Работу над ошибками» — Palmi вернётся к нему позже' : ''}</span>
        <button class="btn" data-act="next-task">Дальше</button></div>`;
      el.appendChild(ov);
    }
  }

  function next() {
    if (!L) return;
    L.idx++;
    if (L.idx >= L.plan.tasks.length) return finishLevel();
    renderTask();
  }

  function finishLevel() {
    const p = S.current();
    const res = A.levelResult(L.results);
    const time = (performance.now() - L.t0) / 1000;
    p.playSeconds = (p.playSeconds || 0) + time;
    const title = L.practice ? L.title : `${L.island.short} · ${L.level.name}`;
    if (L.practice) {
      const fixedWords = new Set(L.results.filter((r) => r.success && r.type !== 'learn').map((r) => r.word));
      p.fixed += fixedWords.size;
      p.mistakes = p.mistakes.filter((m) => !fixedWords.has(m.word));
      S.touchStreak(p);
      const newAch = S.checkAchievements(p);
      S.save();
      const payload = { plan: L.plan, results: L.results, res, xp: L.xp, time, newAch, practice: true, title };
      P.App.go('results', payload);
      return;
    }
    const rec = p.levels[L.level.id] || { stars: 0, bestAcc: 0, bestTime: null, plays: 0 };
    rec.plays++;
    if (res.success) {
      rec.stars = Math.max(rec.stars, res.stars);
      rec.bestAcc = Math.max(rec.bestAcc, res.accuracy);
      rec.bestTime = rec.bestTime == null ? time : Math.min(rec.bestTime, time);
      S.touchStreak(p);
    }
    p.levels[L.level.id] = rec;
    const newAch = S.checkAchievements(p);
    S.save();
    const payload = { plan: L.plan, results: L.results, res, xp: L.xp, time, newAch, title, level: L.level, island: L.island, i: L.i, j: L.j };
    if (res.success) P.App.go('results', payload);
    else P.App.go('mistakes', { failed: payload });
  }

  // ---------- Действия урока ----------
  const act = P.App.actions;
  act.hint = () => { if (L) showHint(true); };
  act.skip = () => { if (L && L.ts && !L.ts.done) finishTask(false, 'skip'); };
  act['next-task'] = (d, el) => { el.closest('.feedback').remove(); next(); };
  act.tile = (d, el) => {
    if (!L || !L.ts || L.ts.phase !== 'build' || el.disabled) return;
    const t = curTask(), ts = L.ts, words = t.sentence.words;
    if (d.v === words[ts.built.length]) {
      ts.built.push(d.v); el.disabled = true; el.classList.add('right'); Sound.click();
      const slot = L.el.querySelectorAll('#slots span')[ts.built.length - 1];
      if (slot) { slot.textContent = W(d.v).en; slot.style.cssText += ';border-style:solid;border-color:#2E9E6B;background:#E2F6EC;display:flex;align-items:center;justify-content:center;padding:0 14px;font-size:22px;font-weight:900'; }
      if (ts.built.length === words.length) { Sound.success(); setTimeout(() => { if (L && L.ts === ts) startSign(); }, 800); }
    } else {
      ts.buildErrors++; Sound.fail(); el.classList.add('wrong'); setTimeout(() => el.classList.remove('wrong'), 600);
      if (ts.buildErrors >= 2) {
        ts.hintUsed = true;
        const nx = L.el.querySelector(`#tiles [data-v="${words[ts.built.length]}"]`);
        if (nx) nx.style.borderColor = '#FFB020';
      }
    }
  };
  act['dlg-ru'] = (d, el) => { L.el.querySelector('#dlg-ru').style.display = ''; el.remove(); if (L.ts) L.ts.hintUsed = true; };
  act.answer = (d, el) => {
    if (!L || L.ts.done) return;
    const t = curTask(), right = d.v === t.word;
    L.ts.done = true;
    L.el.querySelectorAll('.opt').forEach((b) => { if (b.dataset.v === t.word) b.classList.add('right'); else if (b === el) b.classList.add('wrong'); });
    const r = { word: t.word, type: t.type, success: right, hint: false, conf: null, time: (performance.now() - L.ts.start) / 1000 };
    const xp = A.xpFor(r, t, 0);
    L.xp += xp; S.addXp(S.current(), xp); L.results.push(r);
    if (right) Sound.success(); else Sound.fail();
    setTimeout(() => next(), right ? 900 : 1700);
  };
  act.pause = () => togglePause(true);
  act.resume = () => togglePause(false);
  act.restart = () => { const prm = { plan: L.practice ? L.plan : A.generateLevel(L.level, L.island, S.current()), level: L.level, island: L.island, i: L.i, j: L.j, practice: L.practice, title: L.title }; P.App.go('lesson', prm); };
  act['exit-lesson'] = () => P.App.go('map');

  function togglePause(on) {
    if (!L) return;
    L.paused = on;
    const ex = L.el.querySelector('.overlay');
    if (!on) { if (ex) ex.remove(); return; }
    if (ex) return;
    const st = S.state.settings;
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `<div class="modal" style="width:860px;display:flex;gap:36px">
      <div style="width:330px;display:flex;flex-direction:column;gap:12px">
        <h1 style="font-size:44px">Пауза</h1>
        <p class="muted" style="margin:0">${esc(L.practice ? L.title : L.island.short + ' · ' + L.level.name)} · задание ${L.idx + 1} из ${L.plan.tasks.length}. Таймер и распознавание остановлены.</p>
        <button class="btn" data-act="resume">Продолжить</button>
        <button class="btn ghost" data-act="restart">Начать уровень заново</button>
        <button class="btn ghost" data-act="exit-lesson">Выйти на карту</button>
        <div style="display:flex;align-items:flex-end;gap:8px">${Art.palmi('idle', 110)}<span class="bubble" style="font-size:16px;margin-bottom:16px">Отдохни, я подожду!</span></div>
      </div>
      <div style="flex:1;padding-left:32px;border-left:2px solid var(--line);display:flex;flex-direction:column;gap:18px">
        <h2 style="font-size:28px">Настройки</h2>
        <label class="field">Громкость звуков<input type="range" min="0" max="100" value="${Math.round(st.volume * 100)}" id="p-vol"></label>
        <label class="toggle">Показывать скелет руки<input type="checkbox" id="p-skel" ${st.showSkeleton ? 'checked' : ''}></label>
        <label class="toggle">Зеркалить камеру<input type="checkbox" id="p-mir" ${st.mirror ? 'checked' : ''}></label>
        <label class="toggle">Русский перевод сразу<input type="checkbox" id="p-ru" ${st.showRu ? 'checked' : ''}></label>
        <div class="hintbox" style="font-size:15px;display:block">Клавиши: <span style="white-space:nowrap"><span class="kbd">Esc</span> пауза</span> · <span style="white-space:nowrap"><span class="kbd">H</span> подсказка</span> · <span style="white-space:nowrap"><span class="kbd">S</span> пропустить</span></div>
      </div></div>`;
    L.el.appendChild(ov);
    ov.querySelector('#p-vol').oninput = (e) => { st.volume = e.target.value / 100; };
    ov.querySelector('#p-skel').onchange = (e) => { st.showSkeleton = e.target.checked; };
    ov.querySelector('#p-ru').onchange = (e) => { st.showRu = e.target.checked; };
    ov.querySelector('#p-mir').onchange = (e) => { st.mirror = e.target.checked; L.el.querySelectorAll('#cam-video,#cam-canvas').forEach((x) => x.classList.toggle('mirror', st.mirror)); };
  }

  // =====================================================================
  //  РАБОТА НАД ОШИБКАМИ (вместо Game Over)
  // =====================================================================
  SCREENS.mistakes = (params) => {
    const p = S.current();
    const list = P.App.uniqueMistakes(p).slice(0, 6);
    const failed = params.failed;
    let detailed = true;
    if (list.length) {
      if (S.detailedAvailable(p)) { if (!params.reopen) S.useDetailed(p); }
      else { detailed = false; p.metrics.limitHits++; }
    }
    const cards = list.map((m) => {
      const hl = {};
      (m.diag || []).forEach((d) => { if (d.finger && d.finger !== 'out' && d.finger !== 'overMiddle') hl[d.finger === 'im' ? 'index' : d.finger === 'mr' ? 'middle' : d.finger === 'rp' ? 'ring' : d.finger] = '#FF7A59'; if (d.feature.startsWith('thumb') || d.feature.startsWith('touch')) hl.thumb = '#FF7A59'; });
      const mine = m.lm ? Art.hand(m.lm, { style: 'skeleton', w: 120, h: 132, pad: 10, highlight: hl, mirror: S.state.settings.mirror, label: 'Твой жест' }) : `<div style="width:120px;height:132px;display:flex;align-items:center;justify-content:center;text-align:center" class="muted">рука не<br>попала в кадр</div>`;
      const diag = (m.diag && m.diag.length ? m.diag : [{ text: m.lm ? 'Форма почти верная — держи жест ровнее и дольше' : 'Подними руку в рамку кадра и покажи жест' }]).map((d) => `<li>${esc(d.text)}</li>`).join('');
      return `<div class="card" style="display:flex;flex-direction:column;gap:8px;padding:16px 18px">
        <div style="display:flex;align-items:baseline;gap:10px"><span style="font-size:26px;font-weight:900">${W(m.word).en}</span><span class="muted" style="font-size:17px">${esc(W(m.word).ru)}</span></div>
        <div style="display:flex;justify-content:space-around">
          <div style="display:flex;flex-direction:column;align-items:center">${Art.referenceHand(m.word, { w: 120, h: 132, pad: 10 })}<span style="font-size:13px;font-weight:800;color:var(--teal-d)">Эталон</span></div>
          <div style="display:flex;flex-direction:column;align-items:center">${mine}<span style="font-size:13px;font-weight:800;color:#B5482E">Твой жест · ${Math.round((m.conf || 0) * 100)}%</span></div>
        </div>
        <ul class="${detailed ? '' : 'blur'}" style="margin:0;padding:10px 12px 10px 28px;border-radius:14px;background:#FFF1EC;font-size:15px;font-weight:700;line-height:1.35">${diag}</ul>
      </div>`;
    }).join('');
    const acc = failed ? Math.round(failed.res.accuracy * 100) : null;
    return {
      html: `<div style="position:absolute;inset:0;background:var(--sand)"></div>
      <div style="position:absolute;left:40px;top:20px;width:1200px;display:flex;align-items:center;gap:18px">
        ${Art.palmi('oops', 140)}
        <div style="flex:1;display:flex;flex-direction:column;gap:6px">
          <h1 style="font-size:42px">Работа над ошибками</h1>
          <p class="muted" style="margin:0;font-size:19px;max-width:700px">${failed ? (failed.res.requiredFailed && failed.res.requiredFailed.length ? `Обязательное задание «Собери предложение» не выполнено — уровень не засчитан (точность ${acc}%). Повтори уровень и покажи предложение целиком.` : `Точность ${acc}% (${failed.res.passed} из ${failed.res.total}) — уровень пока не засчитан. Это не поражение: разберём жесты и попробуем снова.`) : list.length ? 'Lumo сравнил твою руку с эталоном и подсказывает, что поправить.' : 'Ошибок пока нет. Когда жест не получится, он появится здесь с разбором.'}</p>
        </div>
        <div class="card" style="display:flex;align-items:center;gap:10px;padding:10px 14px">${Art.lumo(list.length ? 'miss' : 'ok', 66)}<span style="font-size:15px;font-weight:800;max-width:170px">${list.length ? 'Красным отмечены пальцы, которые стоят не так' : 'Всё чисто!'}</span></div>
      </div>
      <div style="position:absolute;left:40px;top:180px;width:1200px;height:${list.length > 3 ? 410 : 400}px;overflow:auto;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;align-content:start">${cards}</div>
      ${!list.length && failed ? `<div class="card" style="position:absolute;left:340px;top:230px;width:600px;display:flex;gap:16px;align-items:center">${Art.lumo('near', 90)}<div style="display:flex;flex-direction:column;gap:6px;font-size:17px;font-weight:700;line-height:1.4"><b style="font-size:20px">Как пройти обязательное задание</b><span>1. Нажимай английские слова в том порядке, как в русском предложении.</span><span>2. Покажи каждый жест и держи руку неподвижно, пока кольцо не заполнится.</span></div></div>` : ''}
      <div style="position:absolute;left:40px;bottom:22px;width:1200px;display:flex;align-items:center;gap:14px">
        ${!detailed ? `<div class="lock-note" style="flex:1" data-act="premium" data-src="limit"><span class="chip sun">Plus</span>Подробный разбор: бесплатный лимит на сегодня исчерпан. С Palmi Plus — без ограничений.</div>`
          : list.length && !p.plus ? `<div class="lock-note" style="flex:1" data-act="premium" data-src="limit"><span class="chip sun">Plus</span>Подробный разбор: ${C.PREMIUM.freeDetailedPerDay} бесплатный в день. С Palmi Plus — без ограничений.</div>` : '<div style="flex:1"></div>'}
        <button class="btn ghost" data-act="go" data-to="map">На карту</button>
        ${failed ? '<button class="btn ghost" data-act="retry-level">Повторить уровень</button>' : ''}
        ${list.length ? '<button class="btn lg" data-act="train-mistakes">Тренировать эти жесты</button>' : ''}
      </div>`,
      mount() { if (failed) Sound.retry(); },
    };
  };
  act['train-mistakes'] = () => {
    const words = P.App.uniqueMistakes(S.current()).slice(0, 4).map((m) => m.word);
    P.App.go('lesson', { plan: A.generatePractice(words, S.current()), practice: true, title: 'Тренировка ошибок' });
  };
  act['retry-level'] = () => { const f = P.App.params.failed; act['start-level']({ i: f.i, j: f.j }); };

  // =====================================================================
  //  КАЛИБРОВКА (kNN под руку игрока)
  // =====================================================================
  let CAL = null;
  SCREENS.calibration = () => {
    CAL = { word: 'HELLO', recording: false, buf: [], t: 0 };
    return {
      html: `<div class="lesson-top"><button class="icon-btn" data-act="go" data-to="map" aria-label="Назад">${Art.ICON.back}</button><h1 style="font-size:30px">Калибровка ИИ под твою руку</h1></div>
        ${camHTML()}<div class="task" id="cal"></div>`,
      mount(el) {
        CAL.el = el;
        renderCal();
        const stop = startCam(el, (res, dt, fr) => {
          if (!CAL) return;
          const th = 0.7;
          const conf = res ? res.scores[CAL.word] : 0;
          let line = 'Покажи руку в кадре', tip = 'Запиши 3–8 примеров каждого жеста — ИИ подстроится под тебя';
          if (res) {
            const top = Object.entries(res.scores).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${W(k).en} ${Math.round(v * 100)}%`).join(' · ');
            line = 'ИИ видит: ' + top;
            tip = res.knn ? 'Калибровка включена: правила + kNN' : 'Пока работают только правила (нужно ≥3 примера для 2 жестов)';
          }
          showConf(el, conf, th, line, tip, !!res);
          if (CAL.recording) {
            CAL.t += dt;
            if (res) CAL.buf.push(G.vector(res.features));
            holdRing(el, Math.min(1, CAL.t / 1));
            if (CAL.t >= 1) finishRecord();
          }
        });
        return () => { stop(); CAL = null; };
      },
    };
  };
  function renderCal() {
    const p = S.current();
    const counts = p.calibration.reduce((m, s) => { m[s.label] = (m[s.label] || 0) + 1; return m; }, {});
    const w = W(CAL.word);
    CAL.el.querySelector('#cal').innerHTML = `
      <span class="type">ВЫБЕРИ ЖЕСТ</span>
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px">${G.GESTURE_IDS.map((id) => `<button class="btn ${id === CAL.word ? '' : 'ghost'} sm" style="min-height:38px;padding:0 6px;font-size:13px" data-act="cal-word" data-id="${id}">${W(id).en} · ${counts[id] || 0}</button>`).join('')}</div>
      <div class="hintbox">${Art.referenceHand(CAL.word, { w: 110, h: 120, pad: 10 })}<span><b>${w.en}</b> — ${esc(w.ru)}<br>${esc(w.hint)}</span></div>
      <div style="flex:1"></div>
      <span class="muted" style="font-size:15px">Покажи жест и нажми «Записать»: за 1 секунду ИИ запомнит форму твоей кисти. Примеров для ${w.en}: <b>${counts[CAL.word] || 0}</b> / 8</span>
      <div style="display:flex;gap:8px"><button class="btn" style="flex:1.4" data-act="cal-rec" ${(counts[CAL.word] || 0) >= 8 ? 'disabled' : ''}>Записать</button><button class="btn ghost sm" style="flex:1;padding:0 8px;font-size:14px" data-act="cal-clear">Очистить слово</button><button class="btn ghost sm" style="flex:1;padding:0 8px;font-size:14px" data-act="cal-clear-all">Удалить всё</button></div>`;
  }
  function finishRecord() {
    CAL.recording = false; holdRing(CAL.el, 0);
    if (CAL.buf.length < 5) { P.App.toast('Рука не была видна — попробуй ещё раз'); Sound.fail(); return renderCal(); }
    const n = CAL.buf.length, v = CAL.buf[0].map((_, i) => CAL.buf.reduce((s, x) => s + x[i], 0) / n);
    const p = S.current();
    p.calibration.push({ label: CAL.word, v });
    const got = S.checkAchievements(p);
    S.save(); Sound.success();
    P.App.toast('Пример записан: ' + W(CAL.word).en);
    got.forEach((id) => P.App.toast('Достижение: ' + C.ACHIEVEMENTS.find((a) => a.id === id).name, 'ach'));
    renderCal();
  }
  act['cal-word'] = (d) => { CAL.word = d.id; renderCal(); };
  act['cal-rec'] = () => { if (CAL && !CAL.recording) { CAL.recording = true; CAL.buf = []; CAL.t = 0; Sound.click(); } };
  act['cal-clear'] = () => { const p = S.current(); p.calibration = p.calibration.filter((s) => s.label !== CAL.word); S.save(); renderCal(); };
  act['cal-clear-all'] = (d, el) => {
    if (el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.textContent = 'Нажми ещё раз для удаления'; return; }
    S.current().calibration = []; S.save(); renderCal();
  };

  // =====================================================================
  //  ТЕСТ ИИ (для лабораторной №12): матрица ошибок, accuracy, CSV
  // =====================================================================
  let T = null;
  SCREENS.aitest = () => {
    const p = S.current();
    const prev = (p.aiTests || []).slice(-5).reverse();
    return {
      html: `${P.App.topbar()}<div class="page" style="display:flex;flex-direction:column;gap:16px">
        <div style="display:flex;align-items:center;gap:12px"><button class="icon-btn" data-act="go" data-to="map" aria-label="Назад">${Art.ICON.back}</button><h1 style="font-size:34px">Тест распознавания жестов</h1></div>
        <div class="grid2">
          <div class="card" style="display:flex;flex-direction:column;gap:14px">
            <p style="margin:0;font-size:17px;font-weight:700;line-height:1.45">Протокол: игра по очереди просит показать каждый жест. После отсчёта 3 секунды ИИ 1,2 секунды смотрит на руку и фиксирует ответ (большинство кадров). Результат — точность, матрица ошибок и CSV для отчёта.</p>
            <label class="field">Повторов каждого жеста<select id="t-n"><option>1</option><option>2</option><option selected>3</option><option>5</option></select></label>
            <label class="toggle">Учитывать мою калибровку (kNN)<input type="checkbox" id="t-knn" ${S.state.settings.useKnn ? 'checked' : ''}></label>
            <label class="field">Тестировщик (для отчёта)<input type="text" id="t-who" value="${esc(p.name)}" maxlength="30"></label>
            <button class="btn lg" data-act="t-start">Начать тест · ${G.GESTURE_IDS.length} жестов</button>
            <span class="muted" style="font-size:14px">${S.state.settings.demo || root.PALMI_ARTIFACT ? 'Сейчас включён демо-режим: результаты будут помечены как «демо» и не подходят для отчёта.' : 'Освещение и фон влияют на результат — запиши их в отчёт.'}</span>
          </div>
          <div class="card"><h3 style="font-size:20px;margin-bottom:8px">Прошлые тесты</h3>
            ${prev.length ? `<table class="t"><thead><tr><th>Дата</th><th>Кто</th><th>Режим</th><th>N</th><th>Accuracy</th></tr></thead><tbody>${prev.map((x) => `<tr><td>${new Date(x.at).toLocaleString('ru-RU')}</td><td>${esc(x.who)}</td><td>${x.mode}${x.knn ? ' + kNN' : ''}</td><td>${x.n}</td><td>${Math.round(x.acc * 100)}%</td></tr>`).join('')}</tbody></table>` : '<p class="muted" style="margin:0">Тестов ещё не было.</p>'}
          </div>
        </div></div>`,
    };
  };
  act['t-start'] = () => {
    const n = Number(document.getElementById('t-n').value);
    const useKnn = document.getElementById('t-knn').checked;
    const who = document.getElementById('t-who').value.trim() || S.current().name;
    const queue = [];
    for (let r = 0; r < n; r++) G.GESTURE_IDS.forEach((id) => queue.push(id));
    for (let i = queue.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [queue[i], queue[j]] = [queue[j], queue[i]]; }
    P.App.go('aitest-run', { queue, useKnn, who });
  };

  SCREENS['aitest-run'] = (params) => {
    T = { ...params, i: 0, phase: 'prep', t: 0, votes: {}, confs: {}, out: [], knnWas: S.state.settings.useKnn };
    S.state.settings.useKnn = params.useKnn;
    return {
      html: `<div class="lesson-top"><button class="icon-btn" data-act="t-abort" aria-label="Прервать">${Art.ICON.back}</button><div class="progress"><div id="prog" style="width:0%"></div></div><span style="font-size:20px;font-weight:900" id="count"></span></div>
        ${camHTML()}<div class="task" id="tcard"></div>`,
      mount(el) {
        T.el = el;
        renderT();
        const stop = startCam(el, (res, dt, fr) => {
          if (!T || T.phase === 'done') return;
          const tgt = T.queue[T.i];
          T.t += dt;
          showConf(el, res ? res.scores[tgt] : 0, 0.7, res ? `ИИ видит: ${W(res.best).en} · ${Math.round(res.bestScore * 100)}%` : 'Покажи руку в кадре', T.phase === 'prep' ? 'Приготовься…' : 'Фиксирую ответ', !!res);
          if (T.phase === 'prep') {
            const left = Math.ceil(3 - T.t);
            const c = el.querySelector('#tcount'); if (c) c.textContent = left > 0 ? left : '●';
            if (T.t >= 3) { T.phase = 'rec'; T.t = 0; T.votes = {}; T.confs = {}; T.mode = fr.mode; }
          } else if (T.phase === 'rec') {
            const lbl = res ? res.best : 'NONE';
            T.votes[lbl] = (T.votes[lbl] || 0) + 1;
            if (res) { T.confs[lbl] = T.confs[lbl] || []; T.confs[lbl].push(res.bestScore); }
            holdRing(el, Math.min(1, T.t / 1.2));
            if (T.t >= 1.2) {
              const pred = Object.entries(T.votes).sort((a, b) => b[1] - a[1])[0][0];
              const cs = T.confs[pred] || [0];
              T.out.push({ n: T.out.length + 1, target: tgt, predicted: pred, conf: cs.reduce((a, b) => a + b, 0) / cs.length, correct: pred === tgt, mode: T.mode });
              if (pred === tgt) Sound.success(); else Sound.fail();
              T.i++; T.t = 0; T.phase = 'prep'; holdRing(el, 0);
              if (T.i >= T.queue.length) { T.phase = 'done'; finishTest(); } else renderT();
            }
          }
        });
        return () => { stop(); if (T) S.state.settings.useKnn = T.knnWas; };
      },
    };
  };
  function renderT() {
    const tgt = T.queue[T.i];
    T.el.querySelector('#prog').style.width = Math.round((T.i / T.queue.length) * 100) + '%';
    T.el.querySelector('#count').textContent = `${T.i + 1} / ${T.queue.length}`;
    T.el.querySelector('#tcard').innerHTML = `<span class="type">ТЕСТ ИИ · ${esc(T.who)}</span><span class="muted" style="font-size:18px">Покажи жест:</span>
      <span class="word">${W(tgt).en}</span><span class="ru">${esc(W(tgt).ru)}</span>${Art.referenceHand(tgt, { w: 170, h: 180 })}
      <div style="flex:1"></div><div style="display:flex;align-items:center;gap:12px"><span id="tcount" style="font-size:60px;font-weight:900;color:var(--coral)">3</span><span class="muted">Эталон показан, чтобы тестировщик знал жест. ИИ оценивает только камеру.</span></div>`;
  }
  act['t-abort'] = () => P.App.go('aitest');

  function finishTest() {
    const p = S.current();
    const out = T.out, n = out.length, ok = out.filter((r) => r.correct).length;
    const mode = out.some((r) => r.mode === 'demo') ? 'демо' : 'камера';
    p.aiTests = p.aiTests || [];
    p.aiTests.push({ at: Date.now(), who: T.who, n, correct: ok, acc: ok / n, knn: T.useKnn, mode, rows: out });
    S.save();
    P.App.go('aitest-report', { out, who: T.who, knn: T.useKnn, mode });
  }

  SCREENS['aitest-report'] = (r) => {
    const out = r.out, ids = G.GESTURE_IDS, labels = [...ids, 'NONE'];
    const n = out.length, ok = out.filter((x) => x.correct).length;
    const m = {}; ids.forEach((a) => { m[a] = {}; labels.forEach((b) => { m[a][b] = 0; }); });
    out.forEach((x) => { m[x.target][x.predicted]++; });
    const per = ids.map((id) => {
      const tp = m[id][id], fn = labels.reduce((s, b) => s + (b !== id ? m[id][b] : 0), 0), fp = ids.reduce((s, a) => s + (a !== id ? m[a][id] : 0), 0);
      const prec = tp + fp ? tp / (tp + fp) : 0, rec = tp + fn ? tp / (tp + fn) : 0;
      return { id, tp, fn, fp, prec, rec, f1: prec + rec ? (2 * prec * rec) / (prec + rec) : 0 };
    });
    const SHORT = { HELLO: 'HEL', GOODBYE: 'BYE', HOW_ARE_YOU: 'HOW', I_AM_FINE: 'FINE', GOOD_LUCK: 'LUCK', SEE_YOU: 'SEE', YES: 'YES', NO: 'NO', I_LOVE_YOU: 'ILY', EAT: 'EAT', DRINK: 'DRK', WATER: 'WAT', PHONE: 'PHN' };
    const sh = (id) => (id === 'NONE' ? '—' : SHORT[id] || id);
    const head = labels.map((b) => `<th title="${b === 'NONE' ? 'Рука не найдена' : W(b).en}">${sh(b)}</th>`).join('');
    const body = ids.map((a) => `<tr><th style="text-align:left">${W(a).en}</th>${labels.map((b) => { const v = m[a][b]; return `<td style="background:${v ? (a === b ? '#C9F0DC' : '#FFD9CC') : 'transparent'};font-weight:${v ? 900 : 500}">${v || '·'}</td>`; }).join('')}</tr>`).join('');
    T = { report: r, per };
    return {
      html: `${P.App.topbar()}<div class="page" style="display:flex;flex-direction:column;gap:16px">
        <div style="display:flex;align-items:center;gap:12px"><button class="icon-btn" data-act="go" data-to="aitest" aria-label="Назад">${Art.ICON.back}</button><h1 style="font-size:32px">Отчёт теста ИИ</h1><span class="chip ${r.mode === 'демо' ? 'coral' : ''}">${r.mode}${r.knn ? ' + калибровка' : ''}</span><span class="muted">${esc(r.who)} · ${new Date().toLocaleString('ru-RU')}</span></div>
        <div class="grid4">
          <div class="tile"><span class="k">Accuracy</span><span class="v">${Math.round((ok / n) * 100)}%</span></div>
          <div class="tile"><span class="k">Всего тестов</span><span class="v">${n}</span></div>
          <div class="tile"><span class="k">Верно</span><span class="v">${ok}</span></div>
          <div class="tile"><span class="k">Ошибок</span><span class="v">${n - ok}</span></div>
        </div>
        <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:16px">
          <div class="card"><h3 style="font-size:18px;margin-bottom:6px">Матрица ошибок (строки — что показали, столбцы — что распознал ИИ)</h3>
            <table class="t confusion"><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table></div>
          <div class="card"><h3 style="font-size:18px;margin-bottom:6px">По жестам</h3>
            <table class="t" style="font-size:14px"><thead><tr><th>Жест</th><th>Precision</th><th>Recall</th><th>F1</th></tr></thead><tbody>${per.map((x) => `<tr><td>${W(x.id).en}</td><td>${Math.round(x.prec * 100)}%</td><td>${Math.round(x.rec * 100)}%</td><td>${x.f1.toFixed(2)}</td></tr>`).join('')}</tbody></table></div>
        </div>
        <div style="display:flex;gap:12px"><button class="btn" data-act="t-csv">Скачать CSV для отчёта</button><button class="btn ghost" data-act="go" data-to="aitest">Новый тест</button><button class="btn ghost" data-act="go" data-to="map">На карту</button></div>
      </div>`,
    };
  };
  act['t-csv'] = async () => {
    const r = T.report;
    const lines = ['n;target;predicted;correct;confidence;mode;calibration;tester'];
    r.out.forEach((x) => lines.push([x.n, x.target, x.predicted, x.correct ? 1 : 0, x.conf.toFixed(3), x.mode, r.knn ? 1 : 0, r.who].join(';')));
    const csv = '﻿' + lines.join('\n');
    const name = `palmi-ai-test-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.csv`;
    try {
      const dl = root.claude && root.claude.use ? await root.claude.use('downloads') : null;
      if (dl) { await dl.save({ filename: name, data: csv }); return; }
    } catch (e) { /* откат к обычной ссылке */ }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
  };

  // ---------- Клавиатура ----------
  function onKey(e) {
    if (P.App.screen !== 'lesson' || !L) return;
    if (e.key === 'Escape') { e.preventDefault(); togglePause(!L.paused); }
    if (L.paused) return;
    if (L.ts && L.ts.phase === 'build') return;
    if (e.key === 'h' || e.key === 'р') showHint(true);
    if (e.key === 's' || e.key === 'ы') act.skip();
  }

  P.Lesson = { SCREENS, onKey };
  // для автотестов интерфейса (Playwright): текущее задание урока
  root.__palmiCur = () => (L && L.plan ? { type: curTask().type, word: curTask().word, target: L.ts ? target(curTask(), L.ts) : null, idx: L.idx } : null);
})(window);
