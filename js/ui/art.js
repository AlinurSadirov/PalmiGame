/* Palmi — графика: персонажи (Palmi, Lumo, жители), рисунок руки по 21 точке, острова. Всё — SVG. */
(function (root) {
  'use strict';

  // ---------- Palmi: морской выдрёнок. Позы: idle, action, victory, oops ----------
  function palmi(pose = 'idle', size = 200) {
    const on = (b) => (b ? '' : ' style="display:none"');
    const isV = pose === 'victory';
    const labels = { idle: 'Palmi ждёт', action: 'Palmi показывает жест', victory: 'Palmi радуется', oops: 'Palmi задумался' };
    return `<svg class="palmi palmi-${pose}" viewBox="0 0 200 200" width="${size}" height="${size}" role="img" aria-label="${labels[pose] || 'Palmi'}">
  <ellipse cx="100" cy="190" rx="58" ry="7" fill="#1D3557" opacity="0.12"/>
  <path d="M140 165 C 175 170, 188 150, 180 128 C 176 142, 162 150, 142 148 Z" fill="#7A4F31"/>
  <ellipse cx="100" cy="138" rx="52" ry="52" fill="#8B5E3C"/>
  <ellipse cx="100" cy="148" rx="34" ry="36" fill="#F3DDBE"/>
  <g${on(isV)}>
    <path d="M64 120 L 40 76" stroke="#8B5E3C" stroke-width="17" stroke-linecap="round" fill="none"/>
    <path d="M136 120 L 160 76" stroke="#8B5E3C" stroke-width="17" stroke-linecap="round" fill="none"/>
    <circle cx="38" cy="70" r="12" fill="#7A4F31"/><circle cx="162" cy="70" r="12" fill="#7A4F31"/>
    <circle cx="26" cy="46" r="4" fill="#FFD24D"/><circle cx="176" cy="40" r="5" fill="#FFD24D"/>
    <circle cx="186" cy="64" r="3" fill="#1FB5A8"/><circle cx="14" cy="70" r="3" fill="#1FB5A8"/>
  </g>
  <circle cx="64" cy="38" r="12" fill="#7A4F31"/><circle cx="136" cy="38" r="12" fill="#7A4F31"/>
  <circle cx="64" cy="38" r="5" fill="#F3DDBE"/><circle cx="136" cy="38" r="5" fill="#F3DDBE"/>
  <circle cx="100" cy="72" r="45" fill="#8B5E3C"/>
  <path d="M58 104 C 80 122, 120 122, 142 104 L 146 116 C 120 134, 80 134, 54 116 Z" fill="#1FB5A8"/>
  <path d="M120 120 L 132 150 L 116 148 Z" fill="#137F76"/>
  <ellipse cx="100" cy="88" rx="27" ry="19" fill="#F3DDBE"/>
  <circle cx="72" cy="86" r="7" fill="#FF9C85" opacity="0.55"/><circle cx="128" cy="86" r="7" fill="#FF9C85" opacity="0.55"/>
  <g class="eyes"${on(!isV)}>
    <circle cx="84" cy="68" r="6.5" fill="#1D3557"/><circle cx="116" cy="68" r="6.5" fill="#1D3557"/>
    <circle cx="86" cy="66" r="2.2" fill="#fff"/><circle cx="118" cy="66" r="2.2" fill="#fff"/>
  </g>
  <g${on(isV)}>
    <path d="M77 70 Q 84 60 91 70" stroke="#1D3557" stroke-width="4" stroke-linecap="round" fill="none"/>
    <path d="M109 70 Q 116 60 123 70" stroke="#1D3557" stroke-width="4" stroke-linecap="round" fill="none"/>
  </g>
  <ellipse cx="100" cy="80" rx="7.5" ry="5.5" fill="#3A2A20"/>
  <path d="M80 86 L 64 83 M80 90 L 64 92 M120 86 L 136 83 M120 90 L 136 92" stroke="#7A4F31" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M92 92 Q 100 100 108 92" stroke="#3A2A20" stroke-width="3" stroke-linecap="round" fill="none"${on(pose === 'idle' || pose === 'action')}/>
  <path d="M90 91 Q 100 108 110 91 Z" fill="#3A2A20"${on(isV)}/>
  <path d="M91 96 Q 95 92 99 96 Q 103 100 107 96" stroke="#3A2A20" stroke-width="3" stroke-linecap="round" fill="none"${on(pose === 'oops')}/>
  <g${on(pose === 'idle')}><ellipse cx="84" cy="128" rx="11" ry="9" fill="#7A4F31"/><ellipse cx="116" cy="128" rx="11" ry="9" fill="#7A4F31"/></g>
  <g${on(pose === 'action')}>
    <ellipse cx="80" cy="130" rx="11" ry="9" fill="#7A4F31"/>
    <path d="M138 122 L 164 86" stroke="#8B5E3C" stroke-width="17" stroke-linecap="round" fill="none"/>
    <path d="M156 66 L 154 48 M164 64 L 164 44 M172 66 L 174 48 M179 70 L 183 56" stroke="#7A4F31" stroke-width="7" stroke-linecap="round"/>
    <path d="M154 80 L 144 72" stroke="#7A4F31" stroke-width="7" stroke-linecap="round"/>
    <circle cx="166" cy="76" r="14" fill="#7A4F31"/>
    <path d="M186 40 Q 194 52 186 64" stroke="#1FB5A8" stroke-width="3" stroke-linecap="round" fill="none"/>
    <path d="M194 34 Q 206 52 194 70" stroke="#1FB5A8" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.6"/>
  </g>
  <g${on(pose === 'oops')}>
    <ellipse cx="84" cy="130" rx="11" ry="9" fill="#7A4F31"/>
    <path d="M138 122 C 158 104, 156 70, 140 50" stroke="#8B5E3C" stroke-width="16" stroke-linecap="round" fill="none"/>
    <circle cx="138" cy="46" r="11" fill="#7A4F31"/>
    <text x="160" y="40" font-family="Nunito, sans-serif" font-size="30" font-weight="900" fill="#FF7A59">?</text>
  </g>
</svg>`;
  }

  // ---------- Lumo: робот-светлячок, «глаз» ИИ. Цвет = уверенность ----------
  const LUMO = { ok: '#2E9E6B', near: '#FFD24D', miss: '#FF7A59', neutral: '#5CC8F0', off: '#9FB0C3' };
  function lumo(tone = 'neutral', size = 120) {
    const g = LUMO[tone] || LUMO.neutral;
    return `<svg class="lumo" viewBox="0 0 140 140" width="${size}" height="${size}" role="img" aria-label="Lumo">
  <circle cx="70" cy="74" r="58" fill="${g}" opacity="0.22"/>
  <ellipse cx="38" cy="50" rx="26" ry="15" fill="#fff" opacity="0.85" stroke="#9FD8D2" stroke-width="2" transform="rotate(-25 38 50)"/>
  <ellipse cx="102" cy="50" rx="26" ry="15" fill="#fff" opacity="0.85" stroke="#9FD8D2" stroke-width="2" transform="rotate(25 102 50)"/>
  <path d="M58 30 Q 52 14 44 12 M82 30 Q 88 14 96 12" stroke="#1D3557" stroke-width="3" fill="none" stroke-linecap="round"/>
  <circle cx="44" cy="12" r="5" fill="${g}"/><circle cx="96" cy="12" r="5" fill="${g}"/>
  <ellipse cx="70" cy="104" rx="20" ry="18" fill="${g}"/>
  <rect x="34" y="34" width="72" height="66" rx="30" fill="#E8EEF5" stroke="#1D3557" stroke-width="3"/>
  <circle cx="70" cy="66" r="22" fill="#1D3557"/><circle cx="70" cy="66" r="13" fill="${g}"/><circle cx="64" cy="60" r="4" fill="#fff"/>
  <path d="M54 98 L 50 112 M86 98 L 90 112" stroke="#1D3557" stroke-width="3" stroke-linecap="round"/>
</svg>`;
  }

  // ---------- Жители: чайка Пип и черепаха Тори ----------
  function npc(id, size = 140) {
    if (id === 'tori') {
      return `<svg viewBox="0 0 160 160" width="${size}" height="${size}" role="img" aria-label="Черепаха Тори">
  <ellipse cx="80" cy="148" rx="54" ry="6" fill="#1D3557" opacity="0.12"/>
  <ellipse cx="44" cy="134" rx="14" ry="10" fill="#7BC47F"/><ellipse cx="116" cy="134" rx="14" ry="10" fill="#7BC47F"/>
  <path d="M28 118 Q 80 40 132 118 Z" fill="#3E8E5A"/>
  <path d="M50 112 L 64 82 L 96 82 L 110 112 M64 82 L 80 66 L 96 82 M80 66 L 80 112" stroke="#2C6B43" stroke-width="3" fill="none"/>
  <rect x="24" y="112" width="112" height="14" rx="7" fill="#F2D49B"/>
  <circle cx="132" cy="84" r="22" fill="#7BC47F"/>
  <circle cx="139" cy="78" r="4.5" fill="#1D3557"/><circle cx="140.5" cy="76.5" r="1.5" fill="#fff"/>
  <path d="M132 92 Q 140 97 148 91" stroke="#1D3557" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M112 70 Q 132 52 152 70 Z" fill="#FF7A59"/><circle cx="132" cy="54" r="4" fill="#FFD24D"/>
</svg>`;
    }
    return `<svg viewBox="0 0 160 160" width="${size}" height="${size}" role="img" aria-label="Чайка Пип">
  <ellipse cx="80" cy="150" rx="40" ry="6" fill="#1D3557" opacity="0.12"/>
  <path d="M66 132 L 62 148 M94 132 L 98 148" stroke="#FF9C2B" stroke-width="5" stroke-linecap="round"/>
  <ellipse cx="80" cy="104" rx="40" ry="34" fill="#fff" stroke="#C9D6E3" stroke-width="3"/>
  <path d="M44 100 Q 20 90 26 118 Q 44 120 56 110 Z" fill="#9FB0C3"/>
  <path d="M116 100 Q 140 90 134 118 Q 116 120 104 110 Z" fill="#9FB0C3"/>
  <circle cx="80" cy="58" r="30" fill="#fff" stroke="#C9D6E3" stroke-width="3"/>
  <circle cx="70" cy="54" r="5" fill="#1D3557"/><circle cx="92" cy="54" r="5" fill="#1D3557"/>
  <circle cx="71.5" cy="52.5" r="1.6" fill="#fff"/><circle cx="93.5" cy="52.5" r="1.6" fill="#fff"/>
  <path d="M74 66 L 98 70 L 76 76 Z" fill="#FFB020"/>
  <path d="M60 34 Q 80 22 100 34" stroke="#1FB5A8" stroke-width="7" fill="none" stroke-linecap="round"/>
</svg>`;
  }
  const NPC_NAMES = { pip: 'Чайка Пип', tori: 'Черепаха Тори' };

  // ---------- Рука по 21 точке ----------
  // style: 'cartoon' — нарисованная кисть (эталон), 'skeleton' — точки и кости (камера/игрок)
  // highlight: { index: '#FF7A59' } — подсветка пальцев при разборе ошибок
  const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];
  const FINGER_OF = (i) => (i >= 1 && i <= 4 ? 'thumb' : i >= 5 && i <= 8 ? 'index' : i >= 9 && i <= 12 ? 'middle' : i >= 13 && i <= 16 ? 'ring' : i >= 17 ? 'pinky' : null);

  function fit(lm, w, h, pad, mirror) {
    const xs = lm.map((p) => p.x), ys = lm.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const s = Math.min((w - 2 * pad) / ((maxX - minX) || 1), (h - 2 * pad) / ((maxY - minY) || 1));
    const ox = (w - (maxX - minX) * s) / 2, oy = (h - (maxY - minY) * s) / 2;
    return lm.map((p) => ({ x: mirror ? w - (ox + (p.x - minX) * s) : ox + (p.x - minX) * s, y: oy + (p.y - minY) * s, z: p.z || 0 }));
  }

  function hand(lm, opts = {}) {
    const w = opts.w || 220, h = opts.h || 240, style = opts.style || 'cartoon';
    const P = fit(lm, w, h, opts.pad != null ? opts.pad : 22, opts.mirror);
    const hl = opts.highlight || {};
    const label = opts.label || 'Форма кисти';
    if (style === 'skeleton') {
      const bone = BONES.map(([a, b]) => {
        const col = hl[FINGER_OF(b)] || opts.color || '#1D3557';
        return `<line x1="${P[a].x.toFixed(1)}" y1="${P[a].y.toFixed(1)}" x2="${P[b].x.toFixed(1)}" y2="${P[b].y.toFixed(1)}" stroke="${col}" stroke-width="${hl[FINGER_OF(b)] ? 5 : 3.5}" stroke-linecap="round"/>`;
      }).join('');
      const dots = P.map((p, i) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${i === 0 ? 5 : 4}" fill="${hl[FINGER_OF(i)] || opts.dot || '#137F76'}"/>`).join('');
      return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${label}">${bone}${dots}</svg>`;
    }
    // мультяшная кисть: ладонь + пальцы толстыми скруглёнными линиями, от дальних к ближним
    const skin = opts.skin || '#F3C9A5', line = opts.outline || '#8A5A3C';
    // ладонь шире линии запястья: добавляем два угла запястья вдоль направления «мизинец → указательный»
    const across = { x: P[5].x - P[17].x, y: P[5].y - P[17].y };
    const wl = { x: P[0].x + across.x * 0.42, y: P[0].y + across.y * 0.42 }, wr = { x: P[0].x - across.x * 0.4, y: P[0].y - across.y * 0.4 };
    const outI = { x: P[5].x + across.x * 0.18, y: P[5].y + across.y * 0.18 }, outP = { x: P[17].x - across.x * 0.16, y: P[17].y - across.y * 0.16 };
    const palmPts = [wl, P[1], outI, P[5], P[9], P[13], P[17], outP, wr].map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ');
    const unit = Math.hypot(P[0].x - P[9].x, P[0].y - P[9].y) || 60;
    const fingers = { thumb: [1, 2, 3, 4], index: [5, 6, 7, 8], middle: [9, 10, 11, 12], ring: [13, 14, 15, 16], pinky: [17, 18, 19, 20] };
    const widths = { thumb: 0.2, index: 0.2, middle: 0.21, ring: 0.195, pinky: 0.17 };
    const order = Object.keys(fingers).sort((a, b) => P[fingers[b][3]].z - P[fingers[a][3]].z); // z больше = дальше
    const drawFinger = (name) => {
      const ids = fingers[name];
      const d = ids.map((i, k) => `${k ? 'L' : 'M'}${P[i].x.toFixed(1)} ${P[i].y.toFixed(1)}`).join(' ');
      const wd = widths[name] * unit;
      const col = hl[name];
      return `<path d="${d}" stroke="${line}" stroke-width="${(wd + 5).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
<path d="${d}" stroke="${col ? '#FFD9CC' : skin}" stroke-width="${wd.toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
${col ? `<path d="${d}" stroke="${col}" stroke-width="3" stroke-dasharray="6 5" stroke-linecap="round" fill="none"/>` : ''}`;
    };
    const behind = order.filter((n) => P[fingers[n][3]].z > P[0].z + unit * 0.05);
    const front = order.filter((n) => !behind.includes(n));
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${label}">
${behind.map(drawFinger).join('')}
<polygon points="${palmPts}" fill="${skin}" stroke="${line}" stroke-width="5" stroke-linejoin="round"/>
${front.map(drawFinger).join('')}
</svg>`;
  }

  // Эталонная кисть для слова (синтетическая рука из gestures.js)
  // Ракурс рисунка: сжатые и согнутые формы лучше видны в повороте на 3/4
  const VIEW_YAW = { YES: 18, GOOD_LUCK: 28, EAT: 22, DRINK: 34, NO: 18, HOW_ARE_YOU: 10, PHONE: 10, GOODBYE: 72 };
  function referenceHand(word, opts = {}) {
    const yaw = (opts.yaw != null ? opts.yaw : VIEW_YAW[word] || 0) * Math.PI / 180;
    const lm = root.Palmi.Gestures.synthHand(word, { noise: 0, cx: 0, cy: 0, scale: 100 })
      .map((q) => ({ x: q.x * Math.cos(yaw) - q.z * Math.sin(yaw), y: q.y, z: q.x * Math.sin(yaw) + q.z * Math.cos(yaw) }));
    return hand(lm, Object.assign({ label: 'Эталон жеста ' + word }, opts));
  }

  // ---------- Острова для карты ----------
  function island(kind, locked) {
    const sand = locked ? '#D7DEE6' : '#F6E7C8';
    const deco = {
      greet: `<path d="M150 64 Q 156 26 176 16" stroke="#7A4F31" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M176 16 q -26 -4 -38 12 M176 16 q 20 -16 42 -6 M176 16 q 18 2 26 22" stroke="#2E8B57" stroke-width="9" fill="none" stroke-linecap="round"/>`,
      talk: `<path d="M64 30 h 56 a 10 10 0 0 1 10 10 v 18 a 10 10 0 0 1 -10 10 h -34 l -12 10 v -10 h -10 a 10 10 0 0 1 -10 -10 v -18 a 10 10 0 0 1 10 -10 z" fill="#fff" stroke="#1D3557" stroke-width="2.5"/><path d="M130 50 h 44 a 9 9 0 0 1 9 9 v 14 a 9 9 0 0 1 -9 9 h -6 v 9 l -11 -9 h -27 a 9 9 0 0 1 -9 -9 v -14 a 9 9 0 0 1 9 -9 z" fill="#FFD24D" stroke="#1D3557" stroke-width="2.5"/>`,
      numbers: `<text x="70" y="70" font-family="Nunito, sans-serif" font-size="30" font-weight="900" fill="#1D3557" opacity="0.7">1 2 3</text>`,
      kitchen: `<path d="M74 66 l 18 -18 l 18 18 v 14 h -36 z M122 66 l 14 -14 l 14 14 v 14 h -28 z" fill="#FF9C85" stroke="#1D3557" stroke-width="2"/>`,
      harbor: `<path d="M80 74 h 70 l -10 14 h -50 z" fill="#8B5E3C"/><path d="M112 74 V 30 L 140 66 Z" fill="#fff" stroke="#1D3557" stroke-width="2"/>`,
      summit: `<path d="M50 80 L 115 14 L 180 80 Z" fill="${locked ? '#B8C4D2' : '#9DB4C9'}" stroke="#fff" stroke-width="4"/><path d="M96 34 L 115 14 L 134 34 L 124 30 L 115 38 L 106 30 Z" fill="#fff"/>`,
    }[kind] || '';
    const lock = locked ? `<rect x="100" y="44" width="30" height="24" rx="5" fill="#1D3557"/><path d="M106 44 v -8 a 9 9 0 0 1 18 0 v 8" stroke="#1D3557" stroke-width="5" fill="none"/>` : '';
    return `<svg viewBox="0 0 230 110" width="230" height="110" aria-hidden="true"><ellipse cx="115" cy="72" rx="108" ry="36" fill="${sand}" stroke="#fff" stroke-width="5"/>${deco}${lock}</svg>`;
  }

  function logo(size = 56) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#1FB5A8"/><path d="M22 44 V 28 M28 42 V 18 M34 42 V 16 M40 42 V 20 M46 44 L 50 32" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M20 44 Q 32 54 46 44" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none"/></svg>`;
  }

  const ICON = {
    gear: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    pause: '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="5" height="16" rx="1.5" fill="currentColor"/><rect x="14" y="4" width="5" height="16" rx="1.5" fill="currentColor"/></svg>',
    flame: '<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 1 2 2 3 3 3 0-3-1-5 0-8z" fill="#FF7A59"/></svg>',
    star: (on = true, s = 26) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21l1.5-7L2 9.3l7-.8z" fill="${on ? '#FFD24D' : '#fff'}" stroke="${on ? '#C99A12' : '#9FB0C3'}" stroke-width="1"/></svg>`,
    chart: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    book: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>',
    camera: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 10l4.5-2.5v9L15 14"/><rect x="3" y="7" width="12" height="10" rx="2"/></svg>',
    medal: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="9" r="6"/><path d="M8.5 14L7 22l5-3 5 3-1.5-8"/></svg>',
    back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
    flask: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6M10 3v6L4 19a2 2 0 0 0 1.7 3h12.6A2 2 0 0 0 20 19l-6-10V3"/></svg>',
    hand: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8a8 8 0 0 0 16 0v-2a2 2 0 0 0-4 0"/></svg>',
  };

  root.Palmi.Art = { palmi, lumo, npc, NPC_NAMES, hand, referenceHand, island, logo, ICON };
})(window);
