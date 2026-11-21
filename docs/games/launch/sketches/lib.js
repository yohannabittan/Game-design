// Throwaway sketch lib for Launch: Tea Party landmark, arrival, together, caramel endings. Not the game; matches its look.
(() => {
const W = 667, H = 375, TAU = Math.PI * 2;
const C = { ink: '#2d2238', critter: '#ff8a1a', light: '#ffb366', powder: '#fff6ec', dough: '#fff0f4', berry: '#e8476a', seed: '#ffe9a8', leaf: '#6fae5a',
  blush: '#f7a8bf', heart: '#ef5b8a', halo: '#fff6ec', mud: '#341b08', mudDeep: '#1f0f04', sheen: '#9a5c16', gloss: '#f6d7a4', mudBub: '#6b3d12',
  wall: '#fbe9d3', awning: '#f29bb5', blue: '#cfe2fb', sugar: '#ffd84d', cube: '#fffaf0', panel: 'rgba(45,34,56,0.84)', text: '#fff6ec', white: '#fff' };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const ease = { out: (t) => 1 - (1 - t) ** 3, io: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2), back: (t) => { const c = 1.70158; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; } };

function heartPath(c, x, y, r) { c.beginPath(); c.moveTo(x, y + r * 0.9); c.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.6, y - r * 1.2, x, y - r * 0.4); c.bezierCurveTo(x + r * 0.6, y - r * 1.2, x + r * 1.4, y - r * 0.1, x, y + r * 0.9); c.closePath(); }
function heart(c, x, y, r, col = C.heart, lw = 1.5) { heartPath(c, x, y, r); c.fillStyle = col; c.fill(); c.strokeStyle = C.ink; c.lineWidth = lw; c.stroke(); }
function star4(c, x, y, r) { c.beginPath(); for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4 - Math.PI / 2, rr = i % 2 ? r * 0.3 : r; c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fillStyle = '#fff'; c.fill(); }
function pill(c, text, x, y, size = 14, o = {}) {
  c.save(); c.font = `800 ${size}px system-ui, sans-serif`; const w = c.measureText(text).width + 20, h = size + 14;
  c.globalAlpha = o.a ?? 1; c.fillStyle = o.bg || C.panel; c.beginPath(); c.roundRect(x - (o.left ? 0 : w / 2), y - h / 2, w, h, 14); c.fill();
  c.fillStyle = o.col || C.text; c.textAlign = o.left ? 'left' : 'center'; c.textBaseline = 'middle'; c.fillText(text, o.left ? x + 10 : x, y + 1); c.restore();
}
let NOCAP = false;
function cap(c, text) { if (NOCAP) return; pill(c, text, 10, 22, 13, { left: true, a: 0.92 }); }

// ---- the mochi (same shapes as the game's mochiBody and face) ----
function face(c, r, mode, look) {
  const ex = Math.cos(look) * r * 0.3 * 0.4, ey = Math.sin(look) * r * 0.3 * 0.4, lw = 1.6;
  const eyes = [-0.05, 0.42];
  c.lineCap = 'round';
  if (mode === 'happy' || mode === 'whee') {
    c.strokeStyle = C.ink; c.lineWidth = Math.max(1.5, r * 0.09);
    for (const ox of eyes) { c.beginPath(); c.arc(ox * r, -r * 0.08, r * 0.17, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
    c.beginPath(); c.arc(r * 0.18, r * 0.12, r * 0.2, 0, Math.PI); c.closePath(); c.fillStyle = C.ink; c.fill();
    c.fillStyle = C.berry; c.beginPath(); c.ellipse(r * 0.18, r * 0.26, r * 0.1, r * 0.06, 0, 0, TAU); c.fill();
  } else if (mode === 'goofy') {
    for (const ox of eyes) {
      c.fillStyle = '#fff'; c.beginPath(); c.arc(ox * r, -r * 0.12, r * 0.25, 0, TAU); c.fill();
      c.fillStyle = C.ink; c.beginPath(); c.arc(ox * r - r * 0.06, -r * 0.05, r * 0.13, 0, TAU); c.fill();
      c.fillStyle = C.critter; c.beginPath(); c.arc(ox * r, -r * 0.12, r * 0.27, Math.PI, TAU); c.fill(); // heavy lids
      c.strokeStyle = C.ink; c.lineWidth = lw; c.beginPath(); c.moveTo(ox * r - r * 0.27, -r * 0.12); c.lineTo(ox * r + r * 0.27, -r * 0.12); c.stroke();
    }
  } else {
    const big = mode === 'wow' ? 1.18 : 1;
    for (const [col, k, rr] of [['#fff', 0.4, 0.24 * big], [C.ink, 0.7, 0.12 * big]]) {
      c.fillStyle = col; c.beginPath();
      for (const ox of eyes) { c.moveTo(ox * r + ex * k + r * rr, -r * 0.12 + ey * k); c.arc(ox * r + ex * k, -r * 0.12 + ey * k, r * rr, 0, TAU); }
      c.fill();
    }
    c.strokeStyle = C.ink; c.lineWidth = Math.max(1, lw * 0.7);
    if (mode === 'wow') { c.beginPath(); c.ellipse(r * 0.18, r * 0.3, r * 0.1, r * 0.14, 0, 0, TAU); c.fillStyle = C.ink; c.fill(); }
    else if (mode === 'sad') { c.beginPath(); c.arc(r * 0.18, r * 0.36, r * 0.12, 1.15 * Math.PI, 1.85 * Math.PI); c.stroke(); }
    else { c.beginPath(); c.arc(r * 0.18 + ex * 0.3, r * 0.22 + ey * 0.2, r * 0.12, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); }
  }
  c.lineCap = 'butt';
}
function mochi(c, x, y, r, o = {}) {
  const { rot = 0, sx = 1, sy = 1, mode = 'n', coat = null, mous = false, wing = 0, look = 0, spin = 0, lw = 2, time = 0, alpha = 1 } = o;
  const rx = r * 1.12 * (1 + 1.15 * wing), ry = r * 0.9 * (1 - 0.5 * wing);
  c.save(); c.globalAlpha = alpha; c.translate(x, y); c.rotate(rot); c.scale(sx, sy); c.rotate(-rot + spin); c.lineJoin = 'round';
  c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, TAU); c.strokeStyle = C.halo; c.lineWidth = 3 * lw; c.stroke();
  c.fillStyle = C.critter; c.strokeStyle = C.ink; c.lineWidth = lw; c.fill(); c.stroke();
  c.fillStyle = C.powder; c.beginPath(); for (const [px, py] of [[-0.4, -0.7], [0.1, -0.82], [0.5, -0.6]]) c.rect(px * rx, py * ry, r * 0.09, r * 0.09); c.fill();
  c.fillStyle = C.light; c.beginPath(); c.ellipse(-rx * 0.45, ry * 0.25, r * 0.2, r * 0.13, 0, 0, TAU); c.moveTo(rx * 0.62 + r * 0.17, ry * 0.25); c.ellipse(rx * 0.62, ry * 0.25, r * 0.17, r * 0.12, 0, 0, TAU); c.fill();
  if (coat !== null) { // caramel coat: below a wavy edge, with drips
    c.save(); c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, TAU); c.clip();
    const e = coat * r; c.beginPath(); c.moveTo(-rx * 1.3, ry * 1.6); c.lineTo(-rx * 1.3, e);
    for (let i = 0; i <= 24; i++) { const u = -rx * 1.3 + (i / 24) * rx * 2.6, d = (i % 6 === 2 ? 0.34 : i % 6 === 5 ? 0.2 : 0.02) * r * Math.min(1, 1.2 - coat * 0.6); c.lineTo(u, e + 2 * Math.sin(i * 1.9) + d); }
    c.lineTo(rx * 1.3, ry * 1.6); c.closePath(); c.fillStyle = C.mud; c.fill();
    c.strokeStyle = C.sheen; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-rx * 0.8, e + 5); c.lineTo(-rx * 0.1, e + 6); c.stroke();
    c.strokeStyle = C.gloss; c.globalAlpha = 0.7 * alpha; c.beginPath(); c.moveTo(rx * 0.3, e + 7); c.lineTo(rx * 0.55, e + 7); c.stroke(); c.restore();
  }
  face(c, r, mode, look);
  if (mous) { // the caramel moustache
    c.fillStyle = C.mud; c.strokeStyle = C.mud; c.lineCap = 'round';
    c.beginPath(); c.ellipse(r * 0.18 - r * 0.2, r * 0.17, r * 0.24, r * 0.09, 0.28, 0, TAU); c.ellipse(r * 0.18 + r * 0.2, r * 0.17, r * 0.24, r * 0.09, -0.28, 0, TAU); c.fill();
    c.lineWidth = r * 0.08; c.beginPath(); c.arc(r * 0.18 - r * 0.46, r * 0.1, r * 0.1, 0.4, Math.PI * 1.4); c.stroke(); c.beginPath(); c.arc(r * 0.18 + r * 0.46, r * 0.1, r * 0.1, -Math.PI * 0.4, Math.PI * 0.6, true); c.stroke();
    c.strokeStyle = C.gloss; c.lineWidth = 1.3; c.beginPath(); c.moveTo(r * 0.18 - r * 0.32, r * 0.13); c.lineTo(r * 0.18 - r * 0.12, r * 0.16); c.stroke();
    c.lineCap = 'butt';
  }
  c.restore();
}

// ---- the daifuku ----
function dai(c, x, y, r, o = {}) {
  const { time = 0, mode = 'n', heartAbove = false, wave = 0, armsUp = 0, sx = 1, sy = 1, rot = 0, lw = 2, alpha = 1, clip = false } = o;
  c.save(); c.globalAlpha = alpha; c.translate(x, y); c.rotate(rot); c.scale(sx, sy); c.lineJoin = 'round';
  const arm = (side, ang) => { c.save(); c.translate(side * r * 0.95, r * 0.18); c.rotate(ang); c.fillStyle = C.dough; c.strokeStyle = C.ink; c.lineWidth = lw * 0.8; c.beginPath(); c.ellipse(0, -r * 0.3, r * 0.2, r * 0.36, 0, 0, TAU); c.fill(); c.stroke(); c.restore(); };
  if (wave) arm(1, -0.5 + Math.sin(time * 9) * 0.55); else if (armsUp) { arm(1, -armsUp * 2.3 + 0.3); arm(-1, armsUp * 2.3 - 0.3); }
  c.fillStyle = C.berry; c.strokeStyle = C.ink; c.lineWidth = lw * 0.8;
  c.beginPath(); c.moveTo(-r * 0.45, -r * 0.7); c.quadraticCurveTo(0, -r * 1.6, r * 0.45, -r * 0.7); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = C.leaf; c.beginPath(); c.ellipse(0, -r * 1.35, r * 0.25, r * 0.1, 0, 0, TAU); c.fill();
  c.fillStyle = C.seed; c.fillRect(-r * 0.15, -r * 1.0, r * 0.08, r * 0.08); c.fillRect(r * 0.12, -r * 0.9, r * 0.08, r * 0.08);
  c.beginPath(); c.ellipse(0, r * 0.08, r * 1.08, r * 0.92, 0, 0, TAU); c.strokeStyle = C.halo; c.lineWidth = lw * 3; c.stroke();
  c.fillStyle = C.dough; c.strokeStyle = C.ink; c.lineWidth = lw; c.fill(); c.stroke();
  c.fillStyle = C.blush; c.beginPath(); c.ellipse(-r * 0.5, r * 0.3, r * 0.2, r * 0.13, 0, 0, TAU); c.ellipse(r * 0.5, r * 0.3, r * 0.2, r * 0.13, 0, 0, TAU); c.fill();
  c.strokeStyle = C.ink; c.fillStyle = C.ink; c.lineCap = 'round'; c.lineWidth = Math.max(1, lw * 0.7);
  if (mode === 'happy' || mode === 'whee') {
    for (const ox of [-0.28, 0.28]) { c.beginPath(); c.arc(ox * r, 0.04 * r, r * 0.13, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
    if (mode === 'whee') { c.beginPath(); c.arc(0, r * 0.2, r * 0.15, 0, Math.PI); c.fill(); } else { c.beginPath(); c.arc(0, r * 0.2, r * 0.13, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); }
  } else if (mode === 'wow') {
    for (const ox of [-0.28, 0.28]) { c.beginPath(); c.arc(ox * r, 0, r * 0.14, 0, TAU); c.fill(); }
    c.beginPath(); c.ellipse(0, r * 0.28, r * 0.09, r * 0.12, 0, 0, TAU); c.fill();
  } else {
    for (const ox of [-0.28, 0.28]) { c.beginPath(); c.arc(ox * r, 0, r * 0.11, 0, TAU); c.fill(); }
    c.beginPath(); c.arc(0, r * 0.2, r * 0.13, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
  }
  c.lineCap = 'butt';
  if (heartAbove) { const k = 1 + 0.15 * Math.sin(time * 6); heart(c, 0, -r * 2.1, r * 0.45 * k, C.heart, lw * 0.6); }
  c.restore();
}

// ---- places: sky, hills, ground; cam = {x, gy, z, ox}: screen x = ox + (wx - x) * z, screen y = gy - wy * z ----
const X = (cam, wx) => cam.ox + (wx - cam.x) * cam.z, Y = (cam, wy) => cam.gy - wy * cam.z;
function hills(c, cam, col, par, f, w, amp, base, seed) {
  const sc = clamp(cam.z * 1.3, 0.5, 1);
  c.beginPath(); c.moveTo(0, H);
  for (let sx = 0; sx <= W + 6; sx += 6) { const u = (cam.x + (sx - cam.ox) / cam.z) * par; const h = (base + amp * (w[0] * Math.sin(f[0] * u + seed[0]) + w[1] * Math.sin(f[1] * u + seed[1]))) * sc; c.lineTo(sx, cam.gy - h); }
  c.lineTo(W, H); c.closePath(); c.fillStyle = col; c.fill();
}
function sky(c, cam, o = {}) {
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#fff1f2'); g.addColorStop(1, '#f4bfd3'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = '#fff'; c.globalAlpha = 0.6;
  for (let i = 0; i < 7; i++) { const sx = ((((i * 337 - cam.x * 0.18) % 2100) + 2100) % 2100) - 200, sy = 40 + ((i * 53) % 90); for (const [dx, dy, rr] of [[0, 0, 22], [24, 6, 17], [-22, 8, 15]]) { c.beginPath(); c.arc(sx + dx, sy + dy, rr, 0, TAU); c.fill(); } }
  c.globalAlpha = 1;
  hills(c, cam, '#f4c8d6', 0.5, [0.007, 0.016], [0.5, 0.35], 44, 66, [5.9, 3.4]);
  hills(c, cam, '#cfe6bf', 1, [0.007, 0.016], [0.5, 0.35], 32, 38, [5.9, 3.4]);
  if (o.mid) o.mid();
  c.fillStyle = '#5c8a58'; c.fillRect(0, cam.gy, W, H - cam.gy); c.fillStyle = '#86b86f'; c.fillRect(0, cam.gy, W, 12 * clamp(cam.z * 1.3, 0.6, 1));
}
function post(c, x, gy, s) { const h = 34 * s; c.lineCap = 'round'; c.strokeStyle = C.ink; c.lineWidth = 4.5 * s; c.beginPath(); c.moveTo(x, gy); c.lineTo(x, gy - h); c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 2.8 * s; c.stroke(); c.strokeStyle = C.berry; c.setLineDash([3 * s, 3 * s]); c.stroke(); c.setLineDash([]); c.fillStyle = '#86b86f'; c.strokeStyle = C.ink; c.lineWidth = 1.6; c.beginPath(); c.arc(x, gy - h - 6 * s, 7 * s, 0, TAU); c.fill(); c.stroke(); c.lineCap = 'butt'; }

// ---- landmarks (local units, origin at the base centre, y up is negative) ----
function roof(c, cx, y, w, h, lw) {
  const e = 18; c.beginPath(); c.moveTo(cx - w / 2 - e, y - 10); c.quadraticCurveTo(cx - w * 0.2, y - h * 0.1, cx, y - h); c.quadraticCurveTo(cx + w * 0.2, y - h * 0.1, cx + w / 2 + e, y - 10); c.quadraticCurveTo(cx, y + 8, cx - w / 2 - e, y - 10);
  c.fillStyle = C.berry; c.fill(); c.strokeStyle = C.ink; c.lineWidth = lw; c.stroke();
  c.fillStyle = '#fff'; for (let x = cx - w / 2 - 6; x <= cx + w / 2 + 6; x += 15) { c.beginPath(); c.arc(x, y - 1 - Math.abs(x - cx) * 0.05, 6, 0, Math.PI); c.fill(); c.stroke(); }
}
function lantern(c, x, y, lw, time) { c.strokeStyle = C.ink; c.lineWidth = lw * 0.7; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 12); c.stroke(); const g = c.createRadialGradient(x, y + 24, 2, x, y + 24, 30); g.addColorStop(0, 'rgba(255,216,77,.55)'); g.addColorStop(1, 'rgba(255,216,77,0)'); c.fillStyle = g; c.fillRect(x - 32, y - 8, 64, 64); c.fillStyle = C.sugar; c.beginPath(); c.ellipse(x, y + 24, 9, 12, 0, 0, TAU); c.fill(); c.lineWidth = lw * 0.8; c.stroke(); c.fillStyle = C.berry; c.fillRect(x - 5, y + 11, 10, 3); }
function bunting(c, x1, y1, x2, y2, sag, n, lw) {
  const cols = [C.berry, '#fff6ec', C.blush, C.sugar]; const P = (t) => [lerp(x1, x2, t), lerp(y1, y2, t) + sag * 4 * t * (1 - t)];
  c.strokeStyle = C.ink; c.lineWidth = lw * 0.7; c.beginPath(); for (let i = 0; i <= 20; i++) { const [px, py] = P(i / 20); c[i ? 'lineTo' : 'moveTo'](px, py); } c.stroke();
  for (let i = 1; i < n; i++) { const [px, py] = P(i / n), [qx, qy] = P((i + 0.55) / n); c.beginPath(); c.moveTo(px, py); c.lineTo(qx, qy); c.lineTo((px + qx) / 2, (py + qy) / 2 + 17); c.closePath(); c.fillStyle = cols[i % 4]; c.fill(); c.lineWidth = lw * 0.6; c.stroke(); }
}
function strawberry(c, x, y, r, lw) { c.beginPath(); c.moveTo(x - r, y - r * 0.2); c.quadraticCurveTo(x - r * 0.9, y + r * 1.3, x, y + r * 1.4); c.quadraticCurveTo(x + r * 0.9, y + r * 1.3, x + r, y - r * 0.2); c.quadraticCurveTo(x, y - r * 0.9, x - r, y - r * 0.2); c.fillStyle = C.berry; c.fill(); c.strokeStyle = C.ink; c.lineWidth = lw; c.stroke(); c.fillStyle = C.leaf; c.beginPath(); c.ellipse(x, y - r * 0.55, r * 0.7, r * 0.22, 0, 0, TAU); c.fill(); c.stroke(); c.fillStyle = C.seed; for (const [a, b] of [[-0.4, 0.2], [0.1, 0.5], [0.4, 0.1], [-0.1, 0.9]]) c.fillRect(x + a * r, y + b * r, r * 0.12, r * 0.12); }
function steamHearts(c, tx, ty, time, n, seedOff, size) {
  for (let i = 0; i < n; i++) { const p = (time * 0.32 + i / n + seedOff) % 1, x = tx + Math.sin(p * 6 + i * 2.1) * 22 + p * 18, y = ty - p * 250, r = (size + p * size * 1.4); c.globalAlpha = (1 - p * p) * 0.95; c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y + r * 0.3, r * 1.3, 0, TAU); c.fill(); heart(c, x, y, r, i % 2 ? C.heart : C.blush, 2); }
  c.globalAlpha = 1;
}
function towerA(c, x, gy, k, time, o = {}) { // Look A: the tea-house, lanterns and bunting, Daifuku waving from the top
  const lw = Math.max(2, 1.5 / k); c.save(); c.translate(x, gy); c.scale(k, k); c.lineJoin = 'round';
  const wall = (x0, y0, w, h) => { c.fillStyle = C.wall; c.fillRect(x0, y0, w, h); c.strokeStyle = C.ink; c.lineWidth = lw; c.strokeRect(x0, y0, w, h); };
  bunting(c, -64, -276, -250, -44, 50, 9, lw); bunting(c, 64, -276, 250, -44, 50, 9, lw);
  for (const sx of [-250, 250]) { c.strokeStyle = C.ink; c.lineWidth = lw * 1.8; c.beginPath(); c.moveTo(sx, 0); c.lineTo(sx, -46); c.stroke(); }
  wall(-95, -90, 190, 90); c.fillStyle = C.heart; c.beginPath(); c.moveTo(-18, 0); c.lineTo(-18, -34); c.arc(0, -34, 18, Math.PI, 0); c.lineTo(18, 0); c.fill(); c.stroke();
  for (const sx of [-58, 58]) { c.fillStyle = C.blue; c.beginPath(); c.arc(sx, -52, 14, 0, TAU); c.fill(); c.stroke(); }
  roof(c, 0, -90, 190, 46, lw);
  wall(-60, -192, 120, 64); c.fillStyle = C.blue; c.beginPath(); c.arc(0, -160, 15, 0, TAU); c.fill(); c.stroke(); heart(c, 0, -160, 7, C.heart, lw * 0.6);
  roof(c, 0, -192, 130, 42, lw);
  c.fillStyle = '#e9d9ec'; c.fillRect(-44, -268, 88, 72); c.strokeStyle = C.ink; c.lineWidth = lw; c.strokeRect(-44, -268, 88, 72); // the open top room
  if (!o.gone) dai(c, 0, -196 - 26 * 0.92, 26, { time, wave: 1, mode: 'happy', lw: lw * 0.9 });
  c.fillStyle = C.awning; c.fillRect(-52, -202, 104, 8); c.strokeRect(-52, -202, 104, 8); for (let i = -48; i <= 48; i += 16) { c.fillStyle = C.awning; c.fillRect(i - 2, -218, 4, 16); c.strokeRect(i - 2, -218, 4, 16); }
  roof(c, 0, -268, 112, 42, lw);
  strawberry(c, 0, -330, 18, lw); heart(c, 0, -376 - Math.sin(time * 5) * 4, 16 * (1 + 0.12 * Math.sin(time * 6)), C.heart, lw);
  for (const [lx, ly] of [[-100, -96], [100, -96], [-80, -200], [80, -200], [-70, -274], [70, -274]]) lantern(c, lx, ly, lw, time);
  c.restore();
}
function teapotB(c, x, gy, k, time, o = {}) { // Look B: a giant teapot house steaming hearts
  const lw = Math.max(2, 1.5 / k); c.save(); c.translate(x, gy); c.scale(k, k); c.lineJoin = 'round';
  steamHearts(c, -196, -196, time, 6, 0, 12); steamHearts(c, 0, -262, time, 4, 0.5, 11);
  c.fillStyle = C.awning; c.strokeStyle = C.ink; c.lineWidth = lw; c.beginPath(); c.ellipse(0, -8, 168, 20, 0, 0, TAU); c.fill(); c.stroke(); // the saucer
  c.beginPath(); c.moveTo(-118, -128); c.bezierCurveTo(-170, -150, -190, -180, -204, -198); c.lineTo(-184, -214); c.bezierCurveTo(-170, -190, -150, -160, -108, -150); c.closePath(); c.fillStyle = C.berry; c.fill(); c.stroke(); // spout
  c.beginPath(); c.arc(118, -112, 52, -Math.PI * 0.55, Math.PI * 0.55); c.lineWidth = 24 + lw * 2; c.strokeStyle = C.ink; c.stroke(); c.lineWidth = 24 - lw * 0.5; c.strokeStyle = C.berry; c.stroke(); // handle
  c.lineWidth = lw; c.strokeStyle = C.ink;
  c.beginPath(); c.ellipse(0, -112, 132, 100, 0, 0, TAU); c.fillStyle = C.dough; c.fill(); c.stroke(); // the body
  c.save(); c.beginPath(); c.ellipse(0, -112, 132, 100, 0, 0, TAU); c.clip(); c.fillStyle = C.berry; c.fillRect(-140, -86, 280, 14); c.fillStyle = C.blush; for (let i = -4; i <= 4; i++) { heartPath(c, i * 30, -50 + (i % 2) * 8, 7); c.fill(); } c.restore();
  c.beginPath(); c.ellipse(0, -112, 132, 100, 0, 0, TAU); c.stroke();
  c.save(); c.beginPath(); c.arc(0, -138, 38, 0, TAU); c.clip(); c.fillStyle = C.blue; c.fillRect(-40, -180, 80, 80); if (!o.gone) dai(c, 0, -132, 29, { time, wave: 1, mode: 'happy', lw: lw * 0.9 }); c.restore(); c.beginPath(); c.arc(0, -138, 38, 0, TAU); c.strokeStyle = C.berry; c.lineWidth = lw * 3; c.stroke(); c.strokeStyle = C.ink; c.lineWidth = lw; c.beginPath(); c.arc(0, -138, 38 + lw * 1.5, 0, TAU); c.stroke(); // her window
  c.fillStyle = C.heart; c.beginPath(); c.moveTo(-20, -4); c.lineTo(-20, -30); c.arc(0, -30, 20, Math.PI, 0); c.lineTo(20, -4); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.ellipse(0, -204, 72, 22, 0, 0, TAU); c.fillStyle = C.berry; c.fill(); c.stroke(); // lid
  c.beginPath(); c.ellipse(0, -218, 38, 22, 0, Math.PI, TAU); c.fill(); c.stroke();
  strawberry(c, 0, -246, 14, lw); c.restore();
}
function cottage(c, x, gy, k) { // what the game has today: a 90-unit shopfront with a red roof
  const w = 90 * k, h = w * 0.75, lw = 2; c.save(); c.lineJoin = 'round'; c.strokeStyle = C.ink; c.lineWidth = lw * 0.8;
  c.fillStyle = C.wall; c.fillRect(x, gy - h, w, h); c.strokeRect(x, gy - h, w, h);
  c.fillStyle = C.berry; c.beginPath(); c.moveTo(x - 6 * k, gy - h); c.lineTo(x + w / 2, gy - h - w * 0.4); c.lineTo(x + w + 6 * k, gy - h); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = C.blue; c.fillRect(x + w * 0.12, gy - h * 0.55, w * 0.42, h * 0.3); c.strokeRect(x + w * 0.12, gy - h * 0.55, w * 0.42, h * 0.3);
  c.fillStyle = C.heart; c.fillRect(x + w * 0.66, gy - h * 0.5, w * 0.22, h * 0.5); c.strokeRect(x + w * 0.66, gy - h * 0.5, w * 0.22, h * 0.5); c.restore();
}

// ---- scenes ----
const rS = (z) => 12 + 14 * clamp((z - 0.3) / 0.6, 0, 1.4); // critter radius on screen, bigger when zoomed out relative to the world
const S = {};
function arcTrail(c, pts) { c.fillStyle = '#fff'; c.strokeStyle = C.ink; c.lineWidth = 1; for (const [x, y] of pts) { c.beginPath(); c.arc(x, y, 2.4, 0, TAU); c.fill(); } }
function farStill(look, sx, label) {
  return (c, t) => {
    const cam = { z: 0.3, gy: 335, ox: 0, x: 0 }; cam.x = -sx / cam.z; // landmark at world 0 stands at screen sx
    sky(c, cam, { mid: () => {
      const gy = cam.gy, px = X(cam, -430), k = 0.5;
      post(c, px, gy, 1.2);
      if (look === 'A') towerA(c, X(cam, 0), gy, k, t); else if (look === 'B') teapotB(c, X(cam, 0), gy, k, t); else { cottage(c, X(cam, 120), gy, k); dai(c, X(cam, 40), gy - 12, 12, { time: t, mode: 'n' }); }
    } });
    const pts = []; for (let i = 0; i < 9; i++) pts.push([30 + i * 28, 200 - 105 * Math.sin((i / 8) * Math.PI * 0.9) + i * 4]);
    arcTrail(c, pts); mochi(c, 30 + 8 * 28 + 28, 200 - 105 * Math.sin(Math.PI * 0.9) + 36, rS(0.3), { look: 0.3, rot: 0.3, lw: 1.6, time: t });
    cap(c, label);
  };
}
function nearStill(look, z, label) {
  return (c, t) => {
    const cam = { z, gy: 330, ox: 0, x: 0 }; cam.x = -(z > 0.7 ? 430 : 470) / z;
    sky(c, cam, { mid: () => { const gy = cam.gy; post(c, X(cam, -330), gy, z * 1.2); if (look === 'A') towerA(c, X(cam, 0), gy, Math.max(z, 0.5), t); else teapotB(c, X(cam, 0), gy, Math.max(z, 0.5), t); } });
    mochi(c, 120, 170 + 20 * Math.sin(t * 2), rS(z), { look: 0.3, rot: 0.3, time: t, mode: 'wow' });
    cap(c, label);
  };
}
S['far-today'] = { dur: 0, fn: farStill('today', 520, 'Today, zoom 0.3: the cottage, about 27 px wide') };
S['far-A'] = { dur: 0, fn: farStill('A', 520, 'Look A, zoom 0.3: tea-house, lanterns, Daifuku waves on top') };
S['far-B'] = { dur: 0, fn: farStill('B', 520, 'Look B, zoom 0.3: teapot house steaming hearts') };
S['rise-A'] = { dur: 0, fn: farStill('A', 665, 'Look A, a few seconds earlier: first sight over the right edge') };
S['near-A'] = { dur: 0, fn: nearStill('A', 0.9, 'Look A near (zoom 0.9)') };
S['near-B'] = { dur: 0, fn: nearStill('B', 0.9, 'Look B near (zoom 0.9)') };
S['mid-A'] = { dur: 0, fn: nearStill('A', 0.5, 'Look A at zoom 0.5') };
S['mid-B'] = { dur: 0, fn: nearStill('B', 0.5, 'Look B at zoom 0.5') };

// 2. the arrival beat
function arrival(c, t, look = 'A') {
  const DUR = 3.2, MEET = 2.0, P = { x: -150, y: 262 };
  const z = t < 0.7 ? 0.3 : t < 1.5 ? lerp(0.3, 0.85, ease.io(prog(t, 0.7, 1.5))) : t < 2.4 ? 0.85 : lerp(0.85, 0.7, ease.io(prog(t, 2.4, 3.2)));
  // Mochi: fast and high, then slows to meet her
  const pm = t < 0.8 ? (t / 0.8) * 0.55 : 0.55 + ease.out(prog(t, 0.8, MEET)) * 0.45;
  let M = { x: lerp(-1000, P.x, pm), y: lerp(400, P.y, pm ** 1.1) + (t < 0.8 ? 0 : 0) };
  const DB = { x: 0, y: 224 };
  const leap = prog(t, 1.4, MEET); let D = { x: lerp(DB.x, P.x + 40, ease.io(leap)), y: DB.y + Math.sin(leap * Math.PI) * 120 - (leap > 0 ? 0 : 0) };
  if (t >= MEET) { const a = t - MEET; M = { x: P.x + a * 330, y: P.y + 70 * Math.sin(a * 2.4) - a * a * 30 }; D = { x: M.x + 46, y: M.y + 6 }; }
  const fx = t < MEET ? (M.x + 40) / 2 : M.x + 20, cam = { z, gy: 345, ox: W / 2 + (t < MEET ? 0 : -40), x: fx };
  cam.gy = 345 - (t < MEET ? 0 : 0);
  sky(c, cam, { mid: () => { const gy = cam.gy; post(c, X(cam, -330), gy, z * 1.2); if (look === 'A') towerA(c, X(cam, 0), gy, Math.max(z, 0.5), t, { gone: t >= 1.5 }); else teapotB(c, X(cam, 0), gy, Math.max(z, 0.5), t, { gone: t >= 1.5 }); } });
  if (t < 0.9) { c.strokeStyle = '#fff'; c.globalAlpha = 0.8 * (1 - prog(t, 0.6, 0.9)); c.lineWidth = 2; for (let i = 0; i < 6; i++) { const yy = Y(cam, M.y) + (i - 2.5) * 9, xx = X(cam, M.x); c.beginPath(); c.moveTo(xx - 24 - i * 6, yy); c.lineTo(xx - 70 - i * 8, yy - 3); c.stroke(); } c.globalAlpha = 1; }
  const r = rS(z), mx = X(cam, M.x), my = Y(cam, M.y);
  let mmode = t < 1.0 ? 'n' : t < MEET ? 'wow' : 'happy';
  const dmode = t < 0.9 ? 'happy' : t < 1.4 ? 'wow' : 'whee';
  const bump = t >= MEET ? Math.max(0, 1 - (t - MEET) * 5) : 0;
  if (t >= 0.9 && t < MEET) { // she sees him: a heart pops over her
    const k = ease.back(prog(t, 0.9, 1.2)); heart(c, X(cam, DB.x), Y(cam, DB.y + 100) - 6, 11 * z / 0.5 * k, C.heart, 2);
    if (t < 1.4) { c.font = '800 20px system-ui'; c.fillStyle = C.ink; c.textAlign = 'center'; c.fillText('!', X(cam, DB.x) + 24 * z / 0.5, Y(cam, DB.y + 130)); }
  }
  mochi(c, mx, my, r, { look: 0.3, rot: 0.3, sx: 1 + 0.35 * bump, sy: 1 - 0.3 * bump, mode: mmode, time: t });
  if (t < MEET || t >= MEET) dai(c, X(cam, D.x), Y(cam, D.y) - (t < 1.4 ? 0 : 0), r * 0.9, { time: t, mode: dmode, wave: t < 1.4 ? 1 : 0, armsUp: t >= 1.4 && t < MEET ? 0.7 : 0, sx: 1 + 0.35 * bump, sy: 1 - 0.3 * bump, heartAbove: t > 2.5 });
  const slow = prog(t, 0.7, 1.0) * (1 - prog(t, MEET, MEET + 0.5)); // slow-mo vignette
  if (slow) { const g = c.createRadialGradient(W / 2, H / 2, 140, W / 2, H / 2, 420); g.addColorStop(0, 'rgba(143,111,176,0)'); g.addColorStop(1, `rgba(143,111,176,${0.45 * slow})`); c.fillStyle = g; c.fillRect(0, 0, W, H); }
  if (t >= MEET) { // burst of hearts and a soft flash
    const a = t - MEET, ox = (mx + X(cam, D.x)) / 2, oy = my;
    c.fillStyle = `rgba(255,214,230,${0.3 * Math.max(0, 1 - a * 5)})`; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 10; i++) { const ang = (i / 10) * TAU, d = ease.out(clamp(a / 0.9, 0, 1)) * (70 + (i % 3) * 25); c.globalAlpha = 1 - clamp(a / 1.1, 0, 1) ** 2; heart(c, ox + Math.cos(ang) * d, oy - 10 + Math.sin(ang) * d * 0.8, 6 + (i % 3) * 3, i % 2 ? C.heart : C.blush, 1.5); if (i % 2) star4(c, ox + Math.cos(ang + 0.3) * d * 0.7, oy + Math.sin(ang + 0.3) * d * 0.6, 7); }
    c.globalAlpha = 1;
    if (a > 0.05 && a < 1.5) pill(c, 'Daifuku!', ox, oy - 62 - a * 14, 22 * Math.min(1, ease.back(clamp(a * 5, 0, 1))), { a: 1 - prog(a, 1.1, 1.5), bg: '#fff0f4', col: C.ink });
  }
  const bn = prog(t, 0.25, 0.5) * (1 - prog(t, 1.3, 1.6)); if (bn) pill(c, '★ Tea Party', W / 2, 36 + (1 - ease.out(prog(t, 0.25, 0.5))) * -20, 18, { a: bn });
  cap(c, t < 0.8 ? 'Flight, widest zoom' : t < MEET ? 'Slow-mo, camera comes in, she leaps' : 'They meet, then fly on together');
}
S.arrival = { dur: 3.2, fn: (c, t) => arrival(c, t, 'A') };
S['arrival-B'] = { dur: 3.2, fn: (c, t) => arrival(c, t, 'B') };

// 3. together after
function together(kind) {
  return (c, t) => {
    const DUR = 3.4, z = 0.7, u = t / DUR, h = 4 * 150 * u * (1 - u) + 12;
    const wx = (tt) => 560 * tt, cam = { z, ox: 230, x: wx(t), gy: 322 + clamp(h * 0.45, 0, 70) };
    sky(c, cam, {});
    const boost = prog(t, 0.9, 1.4) * (1 - prog(t, 1.4, 1.5)), gl = ease.io(prog(t, 1.9, 2.3)) * (1 - ease.io(prog(t, 2.9, 3.2)));
    const r = 24, my = Y(cam, h + 40), mx = 230;
    for (let i = 0; i < 30; i++) { const ts = i * 0.12; if (ts > t) break; const age = t - ts, a = 1 - age / 1.3; if (a <= 0) continue; const hh = 4 * 150 * (ts / DUR) * (1 - ts / DUR) + 12 + 40 + age * 26; c.globalAlpha = a; heart(c, X(cam, wx(ts)) - 10, Y(cam, hh), 5 + 3 * a, i % 2 ? C.heart : C.blush, 1.2); } c.globalAlpha = 1;
    if (boost > 0) { c.globalAlpha = boost; c.fillStyle = '#fff'; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(mx - 30 - i * 14 - ((t * 200) % 14), my + 6 + Math.sin(i * 2 + t * 30) * 7, 8 - i * 0.8, 0, TAU); c.fill(); } c.globalAlpha = 1; }
    const rot = -0.5 + u * 1.0;
    if (kind === 'ride') {
      mochi(c, mx, my, r, { wing: gl, rot, look: 0.3, mode: gl > 0.5 ? 'happy' : 'n', time: t });
      const dr = r * 0.6, ry = r * 0.9 * (1 - 0.5 * gl), lean = boost * 0.3 + gl * 0.1 - 0.05, bob = Math.sin(t * 8) * 1.5;
      dai(c, mx - r * 0.1 + lean * 12, my - ry - dr * 0.78 + bob, dr, { time: t, mode: boost > 0.2 || gl > 0.4 ? 'whee' : 'happy', armsUp: gl * 0.9 + boost * 0.5, rot: lean, sx: 1 + boost * 0.12, sy: 1 - boost * 0.1, lw: 1.6 });
      cap(c, 'Ride: she sits on his back; on the glide she rides the wing');
    } else {
      let th0 = 0; const om = (tt) => 4.5 + 9 * (prog(tt, 0.9, 1.4) * (1 - prog(tt, 1.4, 1.5))) + 0; for (let tt = 0; tt < Math.min(t, 1.9); tt += 0.01) th0 += om(tt) * 0.01;
      const m0 = (((th0 % TAU) + TAU) % TAU), m1 = m0 > Math.PI ? m0 - TAU : m0; let th = t < 1.9 ? th0 : m1 * (1 - gl); if (t >= 1.9 && gl < 1 && t > 2.3) th = m1 * (1 - gl);
      const sep = lerp(R2(), R2() * 1.15, gl), cy = my, a = { x: mx + Math.cos(th) * sep / 2, y: cy + Math.sin(th) * sep / 2 * 0.9 }, b = { x: mx - Math.cos(th) * sep / 2, y: cy - Math.sin(th) * sep / 2 * 0.9 };
      c.lineCap = 'round'; c.strokeStyle = C.ink; c.lineWidth = r * 0.5 + 4; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); c.strokeStyle = C.light; c.lineWidth = r * 0.5; c.stroke(); c.lineCap = 'butt';
      heart(c, mx, cy, 7 + Math.sin(t * 10) * 1.2, C.heart, 1.5);
      const order = a.y < b.y ? [a, b] : [b, a];
      for (const p of order) { if (p === a) mochi(c, p.x, p.y, r, { look: 0.3, mode: boost > 0.3 ? 'wow' : 'happy', time: t, lw: 2 }); else dai(c, p.x, p.y, r * 0.88, { time: t, mode: 'whee', lw: 1.8 }); }
      cap(c, 'Hold hands: they spin around each other, flat in the glide');
    }
    if (boost > 0.5) pill(c, 'BOOST', W - 60, 30, 14, { a: boost });
    if (gl > 0.5) pill(c, 'GLIDE', W - 60, 30, 14, { a: gl });
  };
}
const R2 = () => 24 * 2.5;
S.ride = { dur: 3.4, fn: together('ride') };
S.hold = { dur: 3.4, fn: together('hold') };

// 4. caramel endings
function pool(c, x0, x1, gy, time, def) {
  const top = (sx) => gy + 1.2 + 0.8 * Math.sin(time * 1.3 + sx * 0.02) + def(sx), d = 52;
  c.beginPath(); c.moveTo(x0, gy); for (let sx = x0; sx <= x1; sx += 5) c.lineTo(sx, top(sx)); c.lineTo(x1, gy + d - 5); c.quadraticCurveTo(x1, gy + d, x1 - 6, gy + d); c.lineTo(x0 + 6, gy + d); c.quadraticCurveTo(x0, gy + d, x0, gy + d - 5); c.closePath(); c.fillStyle = C.mud; c.fill();
  c.fillStyle = C.mudDeep; c.beginPath(); c.ellipse((x0 + x1) / 2, gy + d * 0.62, (x1 - x0) * 0.4, d * 0.22, 0, 0, TAU); c.fill();
  c.strokeStyle = C.sheen; c.lineWidth = 1.8; c.beginPath(); for (let sx = x0 + 8; sx <= x1 - 8; sx += 5) c[sx === x0 + 8 ? 'moveTo' : 'lineTo'](sx, top(sx) + 3.4); c.stroke();
  c.strokeStyle = C.gloss; c.globalAlpha = 0.7; c.lineCap = 'round'; for (const u of [0.18, 0.4, 0.62, 0.83]) { const sx = x0 + (x1 - x0) * u; c.beginPath(); c.moveTo(sx, top(sx) + 5); c.lineTo(sx + 12, top(sx + 12) + 5); c.stroke(); } c.globalAlpha = 1; c.lineCap = 'butt';
  for (let i = 0; i < 5; i++) { const ph = (time * 0.45 + i * 0.31) % 1, bx = x0 + (x1 - x0) * (0.12 + 0.19 * i), k = ph; if (ph < 0.85) { c.fillStyle = C.mudBub; c.strokeStyle = C.gloss; c.lineWidth = 0.9; c.globalAlpha = 0.8; c.beginPath(); c.arc(bx, top(bx) + 14 - 9 * k, 1 + 2.4 * k, 0, TAU); c.fill(); c.stroke(); c.globalAlpha = 1; } }
  return top;
}
function strand(c, ax, ay, bx, by, wid) { c.strokeStyle = C.sheen; c.lineCap = 'round'; c.lineWidth = wid + 2.4; c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo((ax + bx) / 2, Math.max(ay, by) + 10 - wid, bx, by); c.stroke(); c.strokeStyle = C.mud; c.lineWidth = wid; c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo((ax + bx) / 2, Math.max(ay, by) + 10 - wid, bx, by); c.stroke(); c.strokeStyle = C.sheen; c.lineWidth = Math.max(0.6, wid * 0.22); c.globalAlpha = 0.7; c.beginPath(); c.moveTo(ax, ay - wid * 0.2); c.quadraticCurveTo((ax + bx) / 2, Math.max(ay, by) + 8 - wid, bx, by - wid * 0.2); c.stroke(); c.globalAlpha = 1; c.lineCap = 'butt'; }
function caramelBase(c, t) { const cam = { z: 1, gy: 292, ox: 0, x: 0 }; sky(c, cam, {}); return cam; }
const GY = 292, RR = 34, P0 = 150, P1 = 650, REST = GY - RR * 0.62;
function flag(c, x, text, a = 1) { c.globalAlpha = a; c.strokeStyle = C.ink; c.lineWidth = 2; c.beginPath(); c.moveTo(x, GY - 2); c.lineTo(x, GY - 52); c.stroke(); c.globalAlpha = 1; pill(c, text, x, GY - 64, 12, { a }); }
function drops(c, ox, oy, t0, t, n, sp, col = C.mud) { const a = t - t0; if (a < 0 || a > 1) return; c.fillStyle = col; for (let i = 0; i < n; i++) { const ang = Math.PI * (1.12 + 0.76 * (i / (n - 1))), v = sp * (0.6 + 0.4 * ((i * 7) % 3) / 2); c.globalAlpha = 1 - a * a; c.beginPath(); c.arc(ox + Math.cos(ang) * v * a, oy + Math.sin(ang) * v * a + 260 * a * a, 3.2 - a * 1.6, 0, TAU); c.fill(); } c.globalAlpha = 1; }

// C1: the stretchy catch, a slingshot
function c1(c, t) {
  const cam = caramelBase(c, t), HX = 270, X2 = 520, rest = REST;
  const D1 = t < 0.5 ? 0 : t < 1.0 ? 38 * ease.out(prog(t, 0.5, 0.95)) : 38 * Math.exp(-(t - 1) * 6) * Math.cos((t - 1) * 22);
  const D2 = t < 1.9 ? 0 : (14 * ease.out(prog(t, 1.9, 2.1)) + (t > 2.1 ? -4 * Math.exp(-(t - 2.1) * 6) * Math.cos((t - 2.1) * 20) : 0)) ;
  const def = (sx) => D1 * Math.exp(-(((sx - HX) / 105) ** 2)) + D2 * Math.exp(-(((sx - X2) / 60) ** 2));
  let mx, my, sx = 1, sy = 1, mode = 'wow', spin = 0, rot = 0.5;
  if (t < 0.5) { const u = t / 0.5; mx = lerp(40, HX, u); my = lerp(70, rest, u ** 1.6); sx = 1.1; sy = 0.92; }
  else if (t < 1.0) { mx = HX; my = rest + D1 * 0.9; const q = prog(t, 0.5, 0.95); sx = 1 + 0.22 * q; sy = 1 - 0.28 * q; rot = 0; }
  else if (t < 1.9) { const u = (t - 1) / 0.9; mx = lerp(HX, X2, u); my = rest + (D1 * 0.9) * (1 - ease.out(prog(t, 1, 1.12))) - 4 * 130 * u * (1 - u); sx = 1 + 0.2 * (1 - u); sy = 1 - 0.1 * (1 - u); spin = u * TAU * 1.2; mode = 'happy'; }
  else { mx = X2; my = rest + D2 * 0.9; const q = 1 - prog(t, 1.9, 2.4); sx = 1 + 0.2 * q; sy = 1 - 0.25 * q; rot = 0; mode = t < 2.4 ? 'wow' : 'goofy'; }
  if (t > 1 && t < 1.9) { c.fillStyle = '#fff'; for (let i = 0; i < 9; i++) { const u = (t - 1) / 0.9 * (i / 8) * 0.9 + 0, uu = Math.min((t - 1) / 0.9, i / 8); const px = lerp(HX, X2, uu), py = rest - 4 * 130 * uu * (1 - uu); c.beginPath(); c.arc(px, py, 2.4, 0, TAU); c.fill(); } }
  flag(c, HX, 'old end', t > 0.5 ? 0.9 : 0);
  mochi(c, mx, my, RR, { sx, sy, rot, look: 0.4, mode, spin, time: t });
  pool(c, P0, P1, GY, t, def);
  if (t >= 0.55 && t < 1.02) { const q = prog(t, 0.55, 0.98), wid = lerp(5.5, 1.3, q); strand(c, P0 + 2, GY, mx - RR * 1.05, my + 8, wid); strand(c, P1 - 2, GY, mx + RR * 1.05, my + 8, wid); strand(c, P0 + 60, GY + 2, mx - RR * 0.6, my + 14, wid * 0.8); strand(c, P1 - 60, GY + 2, mx + RR * 0.6, my + 14, wid * 0.8); }
  if (t >= 1.0 && t < 1.4) { const f = (t - 1) / 0.4; for (const o of [-26, -8, 12, 28]) strand(c, HX + o * 1.3, GY + 6 + D1 * 0.3, mx + o * 0.6, my + RR * 0.6, Math.max(0.4, 5 * (1 - f))); drops(c, mx, my + 10, 1.0, t, 7, 90); }
  if (t > 1.04 && t < 1.7) pill(c, 'BOING', HX + 30, 190 - (t - 1) * 40, 20, { a: 1 - prog(t, 1.4, 1.7), bg: C.sugar, col: C.ink });
  if (t > 2.0) { flag(c, X2 + 70, 'new end', prog(t, 2.0, 2.2)); pill(c, '+ 250 m', (HX + X2) / 2, 235, 15, { a: prog(t, 2.0, 2.3), bg: C.sugar, col: C.ink }); }
  if (t >= 1.9) drops(c, X2, GY + 4, 1.9, t, 6, 60);
  cap(c, 'A. Stretchy catch: sinks, stretches, slingshots, sticks');
}
// C2: the glorp
function c2(c, t) {
  const cam = caramelBase(c, t), HX = 340;
  const ripple = (sx) => { const a = t - 0.5; if (a < 0) return 0; const dd = Math.abs(sx - HX); return 7 * Math.exp(-a * 1.6) * Math.exp(-dd / 170) * Math.sin(dd * 0.09 - a * 11) + (t < 1.5 ? 6 * Math.exp(-Math.pow((sx - HX) / 55, 2)) * ease.out(prog(t, 0.5, 1.2)) : 0); };
  let my, sx = 1, sy = 1, mode = 'wow', rot = 0.4, coat = null, mous = false, mx = HX;
  if (t < 0.5) { const u = t / 0.5; mx = lerp(40, HX, u); my = lerp(70, REST, u ** 1.6); sx = 1.1; sy = 0.92; }
  else if (t < 1.4) { const q = ease.io(prog(t, 0.5, 1.4)); my = lerp(REST, GY + 4, q); rot = 0; sx = 1.12; sy = 0.9; mode = 'wow'; }
  else if (t < 1.85) { my = GY + 4 + Math.sin(t * 20) * 0.8; rot = 0; mode = (t * 3.3 % 1 > 0.85) ? 'goofy' : 'wow'; }
  else { const q = ease.back(prog(t, 1.85, 2.3)); my = lerp(GY + 4, GY - RR * 0.85, q) + (t > 2.4 ? Math.sin((t - 2.4) * 3) * 2 : 0); rot = 0; coat = lerp(0.2, 0.5, prog(t, 1.9, 2.8)); mous = true; mode = t < 2.5 ? 'goofy' : 'happy'; sx = 1 + 0.18 * Math.max(0, 1 - (t - 1.85) * 4); sy = 1 - 0.15 * Math.max(0, 1 - (t - 1.85) * 4); }
  mochi(c, mx, my, RR, { sx, sy, rot, look: 0.4, mode, coat, mous, time: t });
  pool(c, P0, P1, GY, t, ripple);
  if (t > 0.9 && t < 1.8) pill(c, 'glorp...', HX + 70, 215 - (t - 0.9) * 20, 20, { a: Math.min(1, (t - 0.9) * 5) * (1 - prog(t, 1.5, 1.8)), bg: C.panel });
  if (t > 1.85 && t < 2.8) { pill(c, 'POP!', HX + 62, 205 - (t - 1.85) * 25, 22, { a: 1 - prog(t, 2.4, 2.8), bg: C.sugar, col: C.ink }); }
  if (t > 1.85) drops(c, HX, GY, 1.85, t, 8, 120);
  if (t > 1.1 && t < 1.85) { c.fillStyle = C.mudBub; c.strokeStyle = C.gloss; c.lineWidth = 1; for (let i = 0; i < 4; i++) { const ph = ((t * 1.7 + i * 0.27) % 1); c.globalAlpha = 1 - ph; c.beginPath(); c.arc(HX + (i - 1.5) * 12, GY + 6 - ph * 28, 2 + ph * 3, 0, TAU); c.fill(); c.stroke(); } c.globalAlpha = 1; }
  if (t > 2.6) pill(c, 'Flight ends: result card', W / 2, 60, 14, { a: prog(t, 2.6, 2.9) * 0.0 + 0 });
  cap(c, 'B. Glorp: sinks with a comic glorp, pops up with a caramel moustache');
}
// C3: the sticky landing pays
function c3(c, t) {
  const cam = caramelBase(c, t), HX = 330;
  const dent = t < 0.5 ? 0 : 14 * ease.out(prog(t, 0.5, 0.65)) * (1 - 0.4 * prog(t, 0.65, 1.2)) + (t > 1 ? 0 : 0);
  const def = (sx) => dent * Math.exp(-(((sx - HX) / 70) ** 2)) + (t > 0.5 ? 4 * Math.exp(-(t - 0.5) * 3) * Math.sin(Math.abs(sx - HX) * 0.1 - (t - 0.5) * 12) * Math.exp(-Math.abs(sx - HX) / 160) : 0);
  let mx = HX, my, sx = 1, sy = 1, mode = 'wow', rot = 0.2;
  if (t < 0.5) { const u = t / 0.5; mx = lerp(30, HX, u); my = lerp(190, REST, u ** 2.2); sx = 1.15; sy = 0.88; rot = 0.1; }
  else { const q = Math.exp(-(t - 0.5) * 5); my = GY - RR * 0.5 + dent * 0.8; sx = 1.2 + 0.35 * q * Math.cos((t - 0.5) * 10); sy = 0.78 - 0.2 * q * Math.cos((t - 0.5) * 10); rot = 0; mode = t < 1.0 ? 'wow' : t < 2.2 ? 'happy' : 'goofy'; if (t > 1.2) { sx = 1.18 + Math.sin((t - 1.2) * 5) * 0.02; sy = 0.82 - Math.sin((t - 1.2) * 5) * 0.02; } }
  mochi(c, mx, my, RR, { sx, sy, rot, look: 0.4, mode, time: t });
  pool(c, P0, P1, GY, t, def);
  if (t > 0.55) { const q = prog(t, 0.55, 1.1), wob = Math.sin(t * 6) * 0.6; for (const [ax, dx] of [[P0 + 2, -1], [P1 - 2, 1], [P0 + 70, -1], [P1 - 70, 1]]) strand(c, ax, GY, mx + dx * RR * 1.1, my + 10, lerp(4, 2, q) + wob * 0.4); }
  drops(c, mx, GY, 0.5, t, 9, 110); drops(c, mx, GY, 0.52, t, 5, 70);
  if (t > 0.75) { const k = ease.back(prog(t, 0.75, 1.05)); const yy = 150 - prog(t, 0.75, 1.6) * 6; c.save(); c.translate(mx, yy); c.rotate(-0.08); c.scale(k, k); pill(c, 'STICKY!', 0, 0, 30, { bg: C.sugar, col: C.ink, a: 1 }); pill(c, 'flat landing +40 sugar', 0, 34, 14, { bg: C.panel }); c.restore(); }
  const flyT = 1.0, fa = prog(t, flyT, 2.0); // cubes fly to the counter
  const cnt = Math.round(120 + 40 * ease.io(prog(t, 1.6, 2.3)));
  pill(c, `♦ ${cnt}`, W - 14 - 40, 24, 16, { bg: C.panel });
  if (t > flyT && t < 2.35) for (let i = 0; i < 8; i++) { const u = clamp((t - flyT - i * 0.07) / 0.8, 0, 1); if (u <= 0 || u >= 1) continue; const e = ease.io(u), px = lerp(mx + (i - 4) * 5, W - 54, e), py = lerp(GY - 20, 24, e) - Math.sin(u * Math.PI) * 60; c.fillStyle = C.cube; c.strokeStyle = C.ink; c.lineWidth = 1.5; c.fillRect(px - 5, py - 5, 10, 10); c.strokeRect(px - 5, py - 5, 10, 10); }
  cap(c, 'C. Sticky landing: he sticks, the caramel pays by how flat he landed');
}
S['c2-close'] = { dur: 3.1, fn: (c, t) => { c.fillStyle = '#fbe3ea'; c.fillRect(0, 0, W, H); c.save(); c.translate(W / 2, H * 0.55); c.scale(2.6, 2.6); c.translate(-340, -(GY - 8)); NOCAP = true; c2(c, t); NOCAP = false; c.restore(); pill(c, 'close-up', 10, 22, 13, { left: true }); } };
S.c1 = { dur: 3.1, fn: c1 }; S.c2 = { dur: 3.1, fn: c2 }; S.c3 = { dur: 3.1, fn: c3 };

window.SCENES = S;
window.draw = (name, t, c) => { c.save(); c.lineJoin = 'round'; S[name].fn(c, t); c.restore(); };
window.boot = (name) => {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.style.cssText = 'display:block;width:100vw;height:auto;max-height:100vh'; document.body.style.cssText = 'margin:0;background:#2d2238'; document.body.appendChild(cv);
  const c = cv.getContext('2d'), FPS = 18, d = S[name].dur;
  window.FRAMES = d ? Math.round(d * FPS) : 0; window.renderFrame = (n) => window.draw(name, n / FPS, c);
  if (d && !navigator.webdriver) { let t0 = performance.now(); (function loop() { window.draw(name, ((performance.now() - t0) / 1000) % d, c); requestAnimationFrame(loop); })(); } else window.renderFrame(0.4 * FPS);
};
})();
