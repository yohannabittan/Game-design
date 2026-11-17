// kit.js: shared parts for throwaway touch sketches. One <script src="kit.js"></script>, no build step.
// Stage: fixed logical size, letterboxed into any viewport (phone portrait, landscape, iframe), DPR-sharp.
// Touch: pointer events with capture, cancel is NOT a release, touch-event fallback. Figures: fighter + foe with hit areas.
// Controls: switches stored in the URL query, last-input readout. Recording: window.FRAMES / window.renderFrame(n).
// See kit-demo.html for every part in use.
(function (W) {
  const Kit = {};
  const TAU = Math.PI * 2;
  const lerp = (a, b, k) => a + (b - a) * k, cl01 = (k) => Math.max(0, Math.min(1, k));
  const ease = (k) => k * k * (3 - 2 * k);
  Kit.lerp = lerp; Kit.cl01 = cl01; Kit.ease = ease;
  Kit.rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };

  // ---- Stage. Kit.stage({w:874,h:402,bg:'#2b1d12'}) -> {g, w, h, sc, toStage(cx,cy), begin(), end(), onResize}
  // Draw between begin() and end() in logical units (0..w, 0..h). Nothing outside is drawn.
  Kit.stage = function (o) {
    o = o || {};
    const st = { w: o.w || 874, h: o.h || 402, bg: o.bg || '#2b1d12', sc: 1, ox: 0, oy: 0, dpr: 1, onResize: null };
    const s = document.createElement('style');
    s.textContent = 'html,body{margin:0;height:100%;overflow:hidden;overscroll-behavior:none;position:fixed;inset:0;width:100%;background:' + st.bg +
      ';-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;touch-action:none}' +
      'canvas.kit{position:fixed;inset:0;width:100%;height:100%;display:block;touch-action:none;outline:none}';
    document.head.appendChild(s);
    const cv = st.cv = document.createElement('canvas'); cv.className = 'kit';
    document.body.appendChild(cv);
    const g = st.g = cv.getContext('2d');
    // fit the whole stage inside the viewport by width AND height
    st.layout = function () {
      const vw = W.innerWidth, vh = W.innerHeight;
      st.dpr = Math.min(W.devicePixelRatio || 1, 2);
      st.vw = vw; st.vh = vh;
      st.sc = Math.min(vw / st.w, vh / st.h);
      st.ox = (vw - st.w * st.sc) / 2; st.oy = (vh - st.h * st.sc) / 2;
      cv.width = Math.round(vw * st.dpr); cv.height = Math.round(vh * st.dpr);
      if (st.onResize) st.onResize(st);
    };
    st.toStage = (cx, cy) => { const r = cv.getBoundingClientRect(); return { x: (cx - r.left - st.ox) / st.sc, y: (cy - r.top - st.oy) / st.sc }; };
    st.begin = function () {
      g.setTransform(st.dpr, 0, 0, st.dpr, 0, 0); g.fillStyle = st.bg; g.fillRect(0, 0, st.vw, st.vh);
      g.setTransform(st.dpr * st.sc, 0, 0, st.dpr * st.sc, st.dpr * st.ox, st.dpr * st.oy);
      g.save(); g.beginPath(); g.rect(0, 0, st.w, st.h); g.clip();
    };
    st.end = function () { g.restore(); g.setTransform(1, 0, 0, 1, 0, 0); };
    W.addEventListener('resize', st.layout);
    W.addEventListener('orientationchange', () => setTimeout(st.layout, 120));
    st.layout();
    return st;
  };

  // ---- Readout of the last input event (for debugging on a phone)
  const LOG = Kit.log = { t: '', x: 0, y: 0, d: '' };
  Kit.note = (t, x, y, d) => { LOG.t = t; LOG.x = Math.round(x); LOG.y = Math.round(y); LOG.d = d || ''; };
  Kit.readout = function (st, extra) {
    const g = st.g; g.save(); g.textAlign = 'left'; g.font = '10px ui-monospace,monospace'; g.fillStyle = 'rgba(255,242,214,.8)';
    g.fillText(LOG.t ? LOG.t + ' ' + LOG.x + ',' + LOG.y + (LOG.d ? ' -> ' + LOG.d : '') : 'no input yet', 6, st.h - 14);
    g.fillText((extra ? extra + ' · ' : '') + st.vw + 'x' + st.vh + ' scale ' + st.sc.toFixed(2) + ('ontouchstart' in W ? ' touch' : ' mouse'), 6, st.h - 3);
    g.restore();
  };

  // ---- Touch. Kit.touch(stage, {down(id,x,y), move(id,x,y), up(id,x,y), cancel(id)}) ; x,y in stage units.
  // Each handler may return a short string for the readout. id is the pointer id (touches get 1000+identifier).
  Kit.touch = function (st, h) {
    const cv = st.cv, say = (t, x, y, d) => Kit.note(t, x, y, typeof d === 'string' ? d : '');
    const down = new Set(), ptrTouch = new Map(), skipT = new Map();
    const P = (cx, cy) => st.toStage(cx, cy);
    const call = (fn, t, id, q) => { const d = h[fn] && h[fn](id, q.x, q.y); say(t, q.x, q.y, d); };
    const cancelAll = (why) => { for (const id of [...down]) { down.delete(id); h.cancel && h.cancel(id); say(why, 0, 0, 'cancelled (not a release)'); } };
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault(); if (e.pointerType !== 'mouse') ptrTouch.set(e.pointerId, { x: e.clientX, y: e.clientY, paired: false });
      try { cv.setPointerCapture(e.pointerId); } catch (_) {}
      down.add(e.pointerId); call('down', 'pointerdown', e.pointerId, P(e.clientX, e.clientY));
    });
    cv.addEventListener('pointermove', (e) => {
      e.preventDefault(); if (!down.has(e.pointerId) && e.pointerType === 'mouse' && !h.hover) return;
      const q = P(e.clientX, e.clientY); const d = h.move && h.move(e.pointerId, q.x, q.y); if (down.has(e.pointerId)) say('pointermove', q.x, q.y, d);
    });
    cv.addEventListener('pointerup', (e) => {
      e.preventDefault(); ptrTouch.delete(e.pointerId); down.delete(e.pointerId); call('up', 'pointerup', e.pointerId, P(e.clientX, e.clientY));
    });
    // pointercancel: the browser took the touch (scroll, system gesture). Never treat it as a release.
    cv.addEventListener('pointercancel', (e) => {
      if (e.cancelable) e.preventDefault(); ptrTouch.delete(e.pointerId);
      if (down.delete(e.pointerId)) { h.cancel && h.cancel(e.pointerId); say('pointercancel', 0, 0, 'CANCELLED (not a release)'); }
    });
    // touch events as a fallback beside the pointer ones: a touch a pointer already took is skipped
    const tId = (t) => 1000 + t.identifier;
    const paired = (t) => { for (const [id, p] of ptrTouch) if (!p.paired && Math.hypot(p.x - t.clientX, p.y - t.clientY) < 6) { p.paired = true; return id; } return null; };
    const tOpt = { passive: false };
    cv.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) { const pid = paired(t); if (pid !== null) { skipT.set(t.identifier, pid); continue; } down.add(tId(t)); call('down', 'touchstart', tId(t), P(t.clientX, t.clientY)); }
    }, tOpt);
    cv.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) { if (skipT.has(t.identifier)) continue; const q = P(t.clientX, t.clientY); const d = h.move && h.move(tId(t), q.x, q.y); say('touchmove', q.x, q.y, d); }
    }, tOpt);
    cv.addEventListener('touchend', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) { if (skipT.has(t.identifier)) { skipT.delete(t.identifier); continue; } down.delete(tId(t)); call('up', 'touchend', tId(t), P(t.clientX, t.clientY)); }
    }, tOpt);
    cv.addEventListener('touchcancel', (e) => {
      if (e.cancelable) e.preventDefault();
      for (const t of e.changedTouches) { const pid = skipT.get(t.identifier); skipT.delete(t.identifier); const id = pid !== undefined ? pid : tId(t); if (down.delete(id)) { h.cancel && h.cancel(id); say('touchcancel', 0, 0, 'CANCELLED (not a release)'); } }
    }, tOpt);
    for (const ev of ['contextmenu', 'selectstart', 'dragstart', 'gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(ev, (e) => e.preventDefault());
    document.addEventListener('touchmove', (e) => e.preventDefault(), tOpt);
    W.addEventListener('blur', () => cancelAll('blur'));
    document.addEventListener('visibilitychange', () => { if (document.hidden) cancelAll('hidden'); });
  };

  // ---- Figures
  Kit.hit = (kind, name, x, y) => ({ kind, name: name || '', x, y }); // kind: 'gap' | 'skin' | 'plate' | 'miss'
  const limb = (g, a, b, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); };
  // two-bone arm: shoulder a, reaching for h, each bone L long. The elbow bends down-and-back. Returns {e, hand}.
  Kit.arm = function (g, a, h, o) {
    o = o || {}; const L = o.L || 36, w = o.w || 11, skin = o.skin || '#f2c697';
    const d = Math.hypot(h.x - a.x, h.y - a.y) || 1, reach = Math.min(d, 2 * L - 0.5);
    const hand = { x: a.x + (h.x - a.x) * reach / d, y: a.y + (h.y - a.y) * reach / d };
    const hh = Math.sqrt(Math.max(0, L * L - reach * reach / 4)), mx = (a.x + hand.x) / 2, my = (a.y + hand.y) / 2;
    const nx = -(hand.y - a.y) / reach, ny = (hand.x - a.x) / reach;
    const e1 = { x: mx + nx * hh, y: my + ny * hh }, e2 = { x: mx - nx * hh, y: my - ny * hh };
    const e = (e1.y - e1.x * 0.05) > (e2.y - e2.x * 0.05) ? e1 : e2; // elbow hangs low
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const pass of [0, 1]) { g.strokeStyle = pass ? skin : '#2a1a10'; g.lineWidth = pass ? w : w + 4; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(e.x, e.y); g.lineTo(hand.x, hand.y); g.stroke(); }
    g.fillStyle = '#2a1a10'; g.beginPath(); g.arc(hand.x, hand.y, w * 0.62 + 2, 0, TAU); g.fill();
    g.fillStyle = skin; g.beginPath(); g.arc(hand.x, hand.y, w * 0.62, 0, TAU); g.fill();
    return { e, hand };
  };
  // weapons drawn with the grip at (x,y), pointing along ang. Length 'len' is the blade or shaft past the hand.
  Kit.WEAPONS = { knife: { len: 54 }, sword: { len: 84 }, spear: { len: 120 }, none: { len: 0 } };
  Kit.weapon = function (g, kind, x, y, ang) {
    const len = (Kit.WEAPONS[kind] || Kit.WEAPONS.knife).len; if (!len) return;
    g.save(); g.translate(x, y); g.rotate(ang);
    if (kind === 'spear') {
      g.fillStyle = '#7a5530'; g.fillRect(-26, -2.5, len + 26 - 20, 5);
      g.fillStyle = '#e6ebf0'; g.beginPath(); g.moveTo(len, 0); g.lineTo(len - 22, -6); g.lineTo(len - 22, 6); g.closePath(); g.fill();
    } else {
      const w = kind === 'sword' ? 5 : 4;
      g.fillStyle = '#e6ebf0'; g.beginPath(); g.moveTo(len, 0); g.lineTo(len * 0.35, -w); g.lineTo(0, -w + 1); g.lineTo(0, w - 1); g.lineTo(len * 0.35, w); g.closePath(); g.fill();
      g.strokeStyle = '#6b7480'; g.lineWidth = 1; g.stroke();
      g.fillStyle = '#5b3a1e'; Kit.rr(g, -14, -3.5, 14, 7, 3); g.fill();
      g.fillStyle = '#caa24a'; g.fillRect(-1, kind === 'sword' ? -10 : -6, 3, kind === 'sword' ? 20 : 12);
    }
    g.restore();
  };
  // Fighter: Kit.fighter({x, floor, helmet, weapon}). aim(angle) points the arm; tip is the weapon point.
  Kit.fighter = function (o) {
    const f = { x: o.x, floor: o.floor, helmet: !!o.helmet, weapon: o.weapon || 'knife', ang: 0, reach: 56, lean: 0 };
    f.shoulder = () => ({ x: f.x + 4, y: f.floor - 142 });
    f.grip = () => { const s = f.shoulder(); return { x: s.x + Math.cos(f.ang) * f.reach, y: s.y + Math.sin(f.ang) * f.reach }; };
    f.tip = () => { const h = f.grip(), l = (Kit.WEAPONS[f.weapon] || { len: 0 }).len; return { x: h.x + Math.cos(f.ang) * l, y: h.y + Math.sin(f.ang) * l }; };
    f.aimAt = (px, py) => { const s = f.shoulder(); f.ang = Math.atan2(py - s.y, px - s.x); return f; };
    f.draw = function (g) {
      const x = f.x, y = f.floor, skin = '#f2c697';
      g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(x, y + 4, 34, 7, 0, 0, TAU); g.fill();
      limb(g, { x: x - 8, y: y - 78 }, { x: x - 12, y: y - 4 }, 12, '#3a2f2a'); limb(g, { x: x + 8, y: y - 78 }, { x: x + 14, y: y - 4 }, 12, '#3a2f2a');
      g.fillStyle = '#5b3a1e'; Kit.rr(g, x - 24, y - 8, 22, 8, 3); g.fill(); Kit.rr(g, x + 3, y - 8, 24, 8, 3); g.fill();
      g.fillStyle = '#b8432f'; Kit.rr(g, x - 13, y - 146, 34, 76, 10); g.fill();
      g.fillStyle = '#6b2a1e'; g.fillRect(x - 13, y - 100, 34, 6);
      g.fillStyle = skin; g.beginPath(); g.arc(x, y - 166, 16, 0, TAU); g.fill();
      if (f.helmet) { const p = '#8d939b'; g.fillStyle = p; g.beginPath(); g.arc(x, y - 168, 19, Math.PI, 0); g.lineTo(x + 19, y - 160); g.lineTo(x - 19, y - 160); g.closePath(); g.fill(); g.fillStyle = '#2a2018'; g.fillRect(x - 13, y - 164, 26, 4); g.fillStyle = '#5d636b'; g.fillRect(x - 3, y - 186, 6, 16); }
      else { g.fillStyle = '#2a1a10'; g.beginPath(); g.arc(x, y - 170, 16, Math.PI, 0); g.fill(); }
      g.fillStyle = '#2a1a10'; g.fillRect(x + 5, y - 164, 3, 3);
      const os = { x: x - 8, y: y - 140 }; // off arm hangs
      limb(g, os, { x: x - 18, y: y - 98 }, 13, '#2a1a10'); limb(g, os, { x: x - 18, y: y - 98 }, 9, skin);
      const A = Kit.arm(g, f.shoulder(), f.grip(), { skin });
      Kit.weapon(g, f.weapon, A.hand.x - Math.cos(f.ang) * 2, A.hand.y - Math.sin(f.ang) * 2, f.ang);
    };
    return f;
  };
  // Foe: Kit.foe({x, floor, helmet}). Rects are {n,x,y,w,h} in stage units. Gaps first, then skin, then plate.
  Kit.foe = function (o) {
    const x = o.x, y = o.floor, c = (n, dx, dy, w, h) => ({ n, x: x + dx - w / 2, y: y + dy - h / 2, w, h }); // centre-based
    const r = (n, dx, dy, w, h) => ({ n, x: x + dx, y: y + dy, w, h }); // top-left-based
    const f = { x, floor: y, helmet: o.helmet !== false, hp: 0 };
    f.gaps = [c('neck', 0, -190, 32, 12), c('armpit', -36, -152, 14, 34), c('waist', 0, -108, 42, 11), c('elbow', -49, -148, 14, 10), c('elbow', 39, -148, 14, 10), c('knee', 4, -58, 30, 11)];
    f.skin = [c('face', 0, -201, 24, 9), c('forearm', -49, -122, 14, 20), c('forearm', 39, -122, 14, 20)];
    f.plates = [r('chest', -30, -186, 60, 76), r('tasset', -26, -102, 52, 22), r('leg', -20, -84, 18, 84), r('leg', 4, -84, 18, 84), r('arm', -56, -182, 14, 50), r('arm', 32, -182, 14, 50)];
    if (f.helmet) f.plates.push(r('helmet', -19, -233, 38, 27));
    const inR = (q, px, py, pad) => px >= q.x - pad && px <= q.x + q.w + pad && py >= q.y - pad && py <= q.y + q.h + pad;
    // what is at a point: {kind:'gap'|'skin'|'plate'|'miss', name, x, y}. pad widens the gap and skin areas (a forgiving thumb).
    f.hitAt = function (px, py, pad) {
      pad = pad || 0;
      for (const q of f.gaps) if (inR(q, px, py, pad)) return Kit.hit('gap', q.n, px, py);
      for (const q of f.skin) if (inR(q, px, py, pad)) return Kit.hit('skin', q.n, px, py);
      for (const q of f.plates) if (inR(q, px, py, 0)) return Kit.hit('plate', q.n, px, py);
      return Kit.hit('miss', '', px, py);
    };
    // walk a segment from its start; the first thing it touches. A pure miss reports the far end.
    f.lineHits = function (x0, y0, x1, y1, pad) {
      const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d));
      for (let i = 0; i <= n; i++) { const px = x0 + (x1 - x0) * i / n, py = y0 + (y1 - y0) * i / n, h = f.hitAt(px, py, pad); if (h.kind !== 'miss') return h; }
      return Kit.hit('miss', '', x1, y1);
    };
    f.draw = function (g, opt) {
      opt = opt || {}; const plate = '#8d939b', lite = '#b4bac2', dk = '#5d636b';
      g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(x, y + 4, 48, 8, 0, 0, TAU); g.fill();
      g.fillStyle = plate; Kit.rr(g, x - 20, y - 84, 18, 52, 4); g.fill(); Kit.rr(g, x + 4, y - 84, 18, 52, 4); g.fill();
      g.fillStyle = dk; Kit.rr(g, x - 20, y - 46, 18, 46, 4); g.fill(); Kit.rr(g, x + 4, y - 46, 18, 46, 4); g.fill();
      g.fillStyle = '#4a3a2a'; Kit.rr(g, x - 24, y - 8, 24, 8, 3); g.fill(); Kit.rr(g, x + 2, y - 8, 26, 8, 3); g.fill();
      g.fillStyle = plate; Kit.rr(g, x - 26, y - 102, 52, 22, 5); g.fill();
      g.fillStyle = lite; Kit.rr(g, x - 30, y - 186, 60, 76, 10); g.fill();
      g.fillStyle = plate; Kit.rr(g, x - 56, y - 182, 14, 70, 6); g.fill(); Kit.rr(g, x + 32, y - 182, 14, 70, 6); g.fill();
      g.fillStyle = '#f2c697'; Kit.rr(g, x - 56, y - 132, 14, 22, 5); g.fill(); Kit.rr(g, x + 32, y - 132, 14, 22, 5); g.fill();
      g.fillStyle = '#e8b88a'; g.beginPath(); g.arc(x, y - 212, 15, 0, TAU); g.fill();
      if (f.helmet) { g.fillStyle = plate; g.beginPath(); g.arc(x, y - 214, 19, Math.PI, 0); g.lineTo(x + 19, y - 206); g.lineTo(x - 19, y - 206); g.closePath(); g.fill(); g.fillStyle = '#2a2018'; g.fillRect(x - 13, y - 210, 26, 4); g.fillStyle = dk; g.fillRect(x - 3, y - 232, 6, 16); }
      for (const q of f.gaps) {
        if (opt.glow) { g.save(); g.shadowColor = '#7dff8a'; g.shadowBlur = 14; g.fillStyle = 'rgba(125,255,138,.45)'; Kit.rr(g, q.x - 1, q.y - 1, q.w + 2, q.h + 2, 4); g.fill(); g.restore(); }
        g.fillStyle = '#241a12'; Kit.rr(g, q.x, q.y, q.w, q.h, 3); g.fill();
      }
    };
    return f;
  };

  // ---- Controls. Kit.switches(stage, [{key,label,values:['L','R'],def}], {y:4, onChange(key,val)})
  // The current values come from the URL query (?btn=R) and are written back there on every tap, so a link reproduces the setup.
  Kit.switches = function (st, defs, o) {
    o = o || {}; const sw = { defs, val: {}, rects: [], y: o.y === undefined ? 4 : o.y, h: o.h || 44 };
    let q = null; try { q = new URLSearchParams(W.location.search); } catch (_) {}
    for (const d of defs) { const v = q && q.get(d.key); sw.val[d.key] = d.values.includes(v) ? v : (d.def !== undefined ? d.def : d.values[0]); }
    sw.get = (k) => sw.val[k];
    sw.set = (k, v) => { sw.val[k] = v; sw.save(); };
    sw.save = function () { try { const u = new URL(W.location.href); for (const d of defs) u.searchParams.set(d.key, sw.val[d.key]); W.history.replaceState(null, '', u.toString()); } catch (_) {} };
    sw.layout = function () {
      const n = defs.length, gap = 6, bw = Math.min(150, (st.w - 16 - gap * (n - 1)) / n);
      sw.rects = defs.map((d, i) => ({ x: 8 + i * (bw + gap), y: sw.y, w: bw, h: sw.h }));
    };
    // returns the key that changed, or null if the point is not on a switch
    sw.tap = function (x, y) {
      for (let i = 0; i < defs.length; i++) {
        const r = sw.rects[i]; if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
          const d = defs[i], vs = d.values; sw.val[d.key] = vs[(vs.indexOf(sw.val[d.key]) + 1) % vs.length]; sw.save();
          o.onChange && o.onChange(d.key, sw.val[d.key]); return d.key;
        }
      } return null;
    };
    sw.draw = function () {
      const g = st.g; g.save(); g.textAlign = 'center';
      defs.forEach((d, i) => {
        const r = sw.rects[i]; g.fillStyle = '#8a5a24'; Kit.rr(g, r.x, r.y, r.w, r.h, 9); g.fill(); g.strokeStyle = '#e6c68a'; g.lineWidth = 2; g.stroke();
        g.font = '10px system-ui,sans-serif'; g.fillStyle = '#e6c68a'; g.fillText(d.label, r.x + r.w / 2, r.y + 15);
        g.font = 'bold 13px system-ui,sans-serif'; g.fillStyle = '#fff2d6'; g.fillText(String(sw.val[d.key]).toUpperCase(), r.x + r.w / 2, r.y + 33);
      }); g.restore();
    };
    sw.layout(); const prev = st.onResize; st.onResize = (s) => { sw.layout(); prev && prev(s); };
    return sw;
  };

  // ---- Loop and recording. Kit.run({update(dt), draw()}) runs live; under recording only renderFrame draws.
  // Kit.record({frames, fps, frame(n, t)}): sets window.FRAMES and window.renderFrame(n) so `node tools/sketch.mjs page` is exact.
  // frame(n,t) must put the sketch in the state for frame n (t seconds in) and draw it.
  Kit.recording = false;
  Kit.run = function (o) {
    let last = 0;
    const loop = (ts) => { if (Kit.recording) return; const dt = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts; o.update && o.update(dt); o.draw(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  };
  Kit.record = function (o) {
    const fps = o.fps || 18; W.FRAMES = o.frames; W.FPS = fps;
    W.renderFrame = (n) => { Kit.recording = true; o.frame(n, n / fps); };
  };

  W.Kit = Kit;
})(window);
