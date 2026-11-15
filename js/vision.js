/* Palmi — камера и MediaPipe Hands.
 * Режим 'camera': веб-камера → MediaPipe → 21 точка (сглаживание по кадрам).
 * Режим 'demo': камеры нет (или она недоступна) — точки берутся из синтетической руки выбранного жеста.
 * Видео обрабатывается только на этом компьютере и никуда не отправляется.
 */
(function (root) {
  'use strict';
  const G = () => root.Palmi.Gestures;
  const MP_BASE = root.PALMI_MP_BASE || 'node_modules/@mediapipe/hands/';

  const st = {
    mode: 'off', video: null, stream: null, hands: null, busy: false, raf: 0,
    lm: null, raw: null, handed: null, lastTs: 0, fps: 0, frames: 0, fpsT: 0,
    demoGesture: null, demoT: 0, error: null, mpLoaded: false,
  };

  function loadScript(src) {
    return new Promise((res, rej) => {
      if (root.Hands) return res();
      const s = document.createElement('script');
      s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error('Не удалось загрузить ' + src));
      document.head.appendChild(s);
    });
  }

  function smooth(prev, next, a) {
    if (!prev) return next;
    return next.map((p, i) => ({ x: prev[i].x + (p.x - prev[i].x) * a, y: prev[i].y + (p.y - prev[i].y) * a, z: prev[i].z + (p.z - prev[i].z) * a }));
  }

  async function listCameras() {
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      return devs.filter((d) => d.kind === 'videoinput').map((d, i) => ({ id: d.deviceId, label: d.label || 'Камера ' + (i + 1) }));
    } catch (e) { return []; }
  }

  async function startCamera(video, deviceId) {
    st.error = null;
    if (root.PALMI_ARTIFACT || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      st.error = 'Камера недоступна в этом окне';
      return startDemo();
    }
    try {
      const constraints = { video: deviceId ? { deviceId: { exact: deviceId }, width: 640, height: 480 } : { width: 640, height: 480, facingMode: 'user' }, audio: false };
      st.stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = st.stream;
      st.video = video;
      await video.play();
      await loadScript(MP_BASE + 'hands.js');
      if (!st.hands) {
        st.hands = new root.Hands({ locateFile: (f) => MP_BASE + f });
        st.hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.6 });
        st.hands.onResults(onResults);
        await st.hands.initialize();
      }
      st.mpLoaded = true;
      st.mode = 'camera';
      loop();
      return { ok: true, mode: 'camera' };
    } catch (e) {
      st.error = e && e.name === 'NotAllowedError' ? 'Доступ к камере запрещён' : e && e.name === 'NotFoundError' ? 'Камера не найдена' : (e && e.message) || 'Ошибка камеры';
      stopStream();
      return startDemo();
    }
  }

  function onResults(res) {
    const W = st.video.videoWidth || 640, H = st.video.videoHeight || 480;
    const hands = res.multiHandLandmarks || [];
    if (!hands.length) { st.lm = null; st.raw = null; return; }
    const px = hands[0].map((p) => ({ x: p.x * W, y: p.y * H, z: p.z * W }));
    st.raw = px;
    st.lm = smooth(st.lm, px, 0.45);
    st.handed = res.multiHandedness && res.multiHandedness[0] ? res.multiHandedness[0].label : null;
    st.lastTs = performance.now();
    st.frames++;
  }

  async function loop() {
    if (st.mode !== 'camera') return;
    st.raf = requestAnimationFrame(loop);
    if (st.busy || !st.video || st.video.readyState < 2) return;
    st.busy = true;
    try { await st.hands.send({ image: st.video }); } catch (e) { /* пропускаем кадр */ }
    st.busy = false;
    const now = performance.now();
    if (now - st.fpsT > 1000) { st.fps = st.frames; st.frames = 0; st.fpsT = now; }
  }

  function startDemo() {
    st.mode = 'demo';
    return { ok: true, mode: 'demo', error: st.error };
  }

  function stopStream() {
    if (st.stream) st.stream.getTracks().forEach((t) => t.stop());
    st.stream = null;
  }

  function stop() {
    cancelAnimationFrame(st.raf);
    stopStream();
    if (st.video) st.video.srcObject = null;
    st.mode = 'off'; st.lm = null;
  }

  // Демо: синтетическая рука с лёгким «дрожанием», как у живой камеры
  function demoFrame() {
    if (!st.demoGesture) return null;
    st.demoT += 0.05;
    const t = st.demoT;
    return G().synthHand(st.demoGesture, { noise: 0.015, rotate: Math.sin(t) * 6, scale: 92 + Math.sin(t * 0.7) * 3, cx: 320, cy: 378 });
  }

  function frame() {
    if (st.mode === 'demo') {
      const lm = demoFrame();
      return { lm, mode: 'demo', fps: 30, stale: false };
    }
    if (st.mode === 'camera') {
      const stale = performance.now() - st.lastTs > 400;
      return { lm: stale ? null : st.lm, mode: 'camera', fps: st.fps, stale };
    }
    return { lm: null, mode: 'off' };
  }

  root.Palmi.Vision = {
    startCamera, startDemo, stop, frame, listCameras,
    setDemoGesture(id) { st.demoGesture = id; },
    get demoGesture() { return st.demoGesture; },
    get mode() { return st.mode; },
    get error() { return st.error; },
    get videoSize() { return st.video ? { w: st.video.videoWidth || 640, h: st.video.videoHeight || 480 } : { w: 640, h: 480 }; },
  };
})(window);
