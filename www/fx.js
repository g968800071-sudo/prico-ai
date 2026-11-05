// PRICO AI face-effects engine: MediaPipe Face Landmarker (self-hosted) + Canvas2D effects that also work on iOS Safari
// (no ctx.filter — grades are built from blend modes, blur from down/up-scaling). Used by the Camera, Photo FX and LIVE.
const MP = new URL('./vendor/mp/', import.meta.url).href;
let lmP = null, lmImg = null, lmMode = 'VIDEO';
async function landmarker(mode) {
  if (!lmP) lmP = (async () => {
    const v = await import(MP + 'vision_bundle.mjs');
    const fileset = { wasmLoaderPath: MP + 'vision_wasm_internal.js', wasmBinaryPath: MP + 'vision_wasm_internal.wasm' };
    const opts = d => ({ baseOptions: { modelAssetPath: MP + 'face_landmarker.task', delegate: d }, runningMode: 'VIDEO', numFaces: 2, outputFaceBlendshapes: false });
    let lm; try { lm = await v.FaceLandmarker.createFromOptions(fileset, opts('GPU')); } catch { lm = await v.FaceLandmarker.createFromOptions(fileset, opts('CPU')); }
    lm._v = v; return lm;
  })().catch(e => { lmP = null; throw e; });
  const lm = await lmP;
  if (mode !== lmMode) { await lm.setOptions({ runningMode: mode }); lmMode = mode; }
  return lm;
}
export const preload = () => landmarker('VIDEO').catch(() => {});

export const EFFECTS = [
  ['none', '🚫'], ['bigeyes', '👀'], ['bighead', '🎈'], ['baby', '👶'], ['old', '👴'], ['beauty', '✨'], ['cartoon', '🎨'], ['alien', '👽'], ['bigmouth', '👄'], ['tinyface', '🐜'],
  ['glitch', '📺'], ['vhs', '📼'], ['m_glasses', '😎'], ['m_crown', '👑'], ['m_cat', '🐱'], ['m_dog', '🐶'], ['m_hearts', '😍'], ['m_clown', '🤡'], ['m_devil', '😈'], ['m_flowers', '🌸'], ['m_tears', '😭'], ['m_money', '🤑'],
];
export const GRADES = ['none', 'vivid', 'warm', 'cool', 'bw', 'vintage', 'film', 'cyber', 'fade', 'drama', 'glow'];
// CSS approximations (used for editor previews of the same named server filters)
export const CSS = { none: '', vivid: 'saturate(1.5) contrast(1.08)', warm: 'sepia(.25) saturate(1.3) hue-rotate(-8deg)', cool: 'saturate(1.1) hue-rotate(12deg) brightness(1.03)', bw: 'grayscale(1) contrast(1.15)',
  vintage: 'sepia(.45) contrast(.95) brightness(1.05)', film: 'sepia(.75) contrast(1.05)', cyber: 'hue-rotate(-25deg) saturate(1.7) contrast(1.15)', fade: 'contrast(.85) brightness(1.06) saturate(.75)', drama: 'contrast(1.35) saturate(.85)', glow: 'brightness(1.08) saturate(1.2)' };

const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tmp = cv(2, 2), small = cv(2, 2), snap = cv(2, 2);

function bulge(ctx, src, cx, cy, rx, ry, k, edge = 0.72) {
  rx = Math.max(4, rx) | 0; ry = Math.max(4, ry) | 0; const w = rx * 2, h = ry * 2;
  tmp.width = w; tmp.height = h; const t = tmp.getContext('2d');
  const sw = w / k, sh = h / k; t.drawImage(src, cx - sw / 2, cy - sh / 2, sw, sh, 0, 0, w, h);
  t.globalCompositeOperation = 'destination-in'; t.setTransform(1, 0, 0, h / w, 0, 0);
  const g = t.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(edge, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  t.fillStyle = g; t.fillRect(0, 0, w, w); t.setTransform(1, 0, 0, 1, 0, 0); t.globalCompositeOperation = 'source-over';
  ctx.drawImage(tmp, cx - rx, cy - ry);
}
function softBlur(ctx, src, x, y, w, h, alpha, clip) {
  const f = 7; small.width = Math.max(2, w / f | 0); small.height = Math.max(2, h / f | 0);
  const s = small.getContext('2d'); s.imageSmoothingEnabled = true; s.drawImage(src, x, y, w, h, 0, 0, small.width, small.height);
  ctx.save(); if (clip) { ctx.beginPath(); clip(ctx); ctx.clip(); } ctx.globalAlpha = alpha; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(small, x, y, w, h); ctx.restore();
}
function fill(ctx, W, H, op, color, a) { ctx.save(); ctx.globalCompositeOperation = op; ctx.globalAlpha = a; ctx.fillStyle = color; ctx.fillRect(0, 0, W, H); ctx.restore(); }
function self(ctx, src, W, H, op, a) { ctx.save(); ctx.globalCompositeOperation = op; ctx.globalAlpha = a; ctx.drawImage(src, 0, 0, W, H); ctx.restore(); }
function vignette(ctx, W, H, a = .55) { const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .7); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
export function grade(ctx, W, H, name, src) {
  switch (name) {
    case 'vivid': self(ctx, src, W, H, 'overlay', .35); fill(ctx, W, H, 'saturation', 'hsl(0,100%,50%)', .12); break;
    case 'warm': fill(ctx, W, H, 'soft-light', '#ff9a3c', .45); break;
    case 'cool': fill(ctx, W, H, 'soft-light', '#3c8bff', .45); break;
    case 'bw': fill(ctx, W, H, 'saturation', '#808080', 1); fill(ctx, W, H, 'soft-light', '#000', .15); break;
    case 'vintage': fill(ctx, W, H, 'saturation', '#808080', .35); fill(ctx, W, H, 'soft-light', '#e3a75f', .55); fill(ctx, W, H, 'screen', '#2a1a40', .25); vignette(ctx, W, H, .35); break;
    case 'film': fill(ctx, W, H, 'saturation', '#808080', 1); fill(ctx, W, H, 'color', '#8a5a2b', .55); vignette(ctx, W, H, .4); break;
    case 'cyber': fill(ctx, W, H, 'color', '#b100ff', .22); fill(ctx, W, H, 'soft-light', '#00ffe1', .35); self(ctx, src, W, H, 'overlay', .2); break;
    case 'fade': fill(ctx, W, H, 'saturation', '#808080', .3); fill(ctx, W, H, 'screen', '#3a3a46', .35); break;
    case 'drama': self(ctx, src, W, H, 'overlay', .55); fill(ctx, W, H, 'saturation', '#808080', .25); vignette(ctx, W, H, .6); break;
    case 'glow': self(ctx, src, W, H, 'screen', .28); fill(ctx, W, H, 'soft-light', '#ffd1e8', .3); break;
  }
}
const P = (pts, i) => pts[i];
function emoji(ctx, ch, x, y, size, rot = 0) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.font = `${size | 0}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ch, 0, 0); ctx.restore(); }
function face(pts) {
  const le = P(pts, 468) || P(pts, 33), re = P(pts, 473) || P(pts, 263);
  const top = P(pts, 10), chin = P(pts, 152), l = P(pts, 234), r = P(pts, 454);
  const ew = Math.hypot(P(pts, 133).x - P(pts, 33).x, P(pts, 133).y - P(pts, 33).y);
  return { le, re, top, chin, l, r, ew, roll: Math.atan2(re.y - le.y, re.x - le.x), fw: Math.hypot(r.x - l.x, r.y - l.y), fh: Math.hypot(chin.x - top.x, chin.y - top.y),
    cx: (l.x + r.x) / 2, cy: (top.y + chin.y) / 2, mouth: { x: (P(pts, 61).x + P(pts, 291).x) / 2, y: (P(pts, 13).y + P(pts, 14).y) / 2, w: Math.hypot(P(pts, 291).x - P(pts, 61).x, P(pts, 291).y - P(pts, 61).y) }, nose: P(pts, 4) };
}
function ovalPath(pts, oval) { return c => { oval.forEach((e, i) => { const p = pts[e.start]; i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); }); c.closePath(); }; }
function posterize(ctx, src, W, H) {
  small.width = W / 2 | 0; small.height = H / 2 | 0; const s = small.getContext('2d', { willReadFrequently: true }); s.drawImage(src, 0, 0, small.width, small.height);
  const d = s.getImageData(0, 0, small.width, small.height), a = d.data;
  for (let i = 0; i < a.length; i += 4) { const r = a[i], g = a[i + 1], b = a[i + 2], m = (r + g + b) / 3; a[i] = Math.min(255, (((m + (r - m) * 1.6) / 51 | 0) * 51) + 20); a[i + 1] = Math.min(255, (((m + (g - m) * 1.6) / 51 | 0) * 51) + 20); a[i + 2] = Math.min(255, (((m + (b - m) * 1.6) / 51 | 0) * 51) + 20); }
  s.putImageData(d, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(small, 0, 0, W, H);
}
function stroke(ctx, pts, conns, w, col) { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); for (const e of conns) { const a = pts[e.start], b = pts[e.end]; ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); } ctx.stroke(); ctx.restore(); }

// Applies effect + grade onto ctx (already holding the frame). faces = arrays of canvas-space points.
export function apply(ctx, W, H, faces, effect, gradeName, t, C) {
  if (snap.width !== W || snap.height !== H) { snap.width = W; snap.height = H; }
  const sc = snap.getContext('2d'); sc.drawImage(ctx.canvas, 0, 0);
  for (const pts of faces) {
    const f = face(pts);
    switch (effect) {
      case 'bigeyes': bulge(ctx, snap, f.le.x, f.le.y, f.ew * 1.25, f.ew * 1.05, 1.7); bulge(ctx, snap, f.re.x, f.re.y, f.ew * 1.25, f.ew * 1.05, 1.7); break;
      case 'alien': bulge(ctx, snap, f.le.x, f.le.y, f.ew * 1.5, f.ew * 1.3, 2.2); bulge(ctx, snap, f.re.x, f.re.y, f.ew * 1.5, f.ew * 1.3, 2.2); sc.drawImage(ctx.canvas, 0, 0); bulge(ctx, snap, f.mouth.x, f.mouth.y, f.mouth.w * .9, f.mouth.w * .6, 0.6); break;
      case 'bighead': bulge(ctx, snap, f.cx, f.cy, f.fw * 0.95, f.fh * 0.85, 1.5, .8); break;
      case 'tinyface': { ctx.save(); ctx.beginPath(); ctx.ellipse(f.cx, f.cy, f.fw * .62, f.fh * .7, f.roll, 0, 7); ctx.clip(); softBlur(ctx, snap, Math.max(0, f.cx - f.fw), Math.max(0, f.cy - f.fh), f.fw * 2, f.fh * 2, 1); ctx.restore(); bulge(ctx, snap, f.cx, f.cy, f.fw * .62, f.fh * .7, 0.55, .85); break; }
      case 'bigmouth': bulge(ctx, snap, f.mouth.x, f.mouth.y, f.mouth.w * 1.1, f.mouth.w * .8, 1.9); break;
      case 'baby': bulge(ctx, snap, f.cx, f.cy, f.fw * .9, f.fh * .8, 1.15, .8); sc.drawImage(ctx.canvas, 0, 0); bulge(ctx, snap, f.le.x, f.le.y, f.ew * 1.2, f.ew, 1.35); bulge(ctx, snap, f.re.x, f.re.y, f.ew * 1.2, f.ew, 1.35); sc.drawImage(ctx.canvas, 0, 0);
        softBlur(ctx, snap, 0, 0, W, H, .45, ovalPath(pts, C.FACE_LANDMARKS_FACE_OVAL)); ctx.save(); ctx.beginPath(); ovalPath(pts, C.FACE_LANDMARKS_FACE_OVAL)(ctx); ctx.clip(); fill(ctx, W, H, 'soft-light', '#ffb3c6', .5); ctx.restore(); break;
      case 'old': { ctx.save(); ctx.beginPath(); ovalPath(pts, C.FACE_LANDMARKS_FACE_OVAL)(ctx); ctx.clip(); fill(ctx, W, H, 'saturation', '#808080', .55); self(ctx, snap, W, H, 'overlay', .5); fill(ctx, W, H, 'multiply', '#c8a27a', .25);
        ctx.strokeStyle = 'rgba(60,35,20,.35)'; ctx.lineWidth = Math.max(1, f.fw / 140); const fy = f.top.y + f.fh * .1;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(f.cx - f.fw * .3, fy + i * f.fh * .045); ctx.quadraticCurveTo(f.cx, fy + i * f.fh * .045 - f.fh * .02, f.cx + f.fw * .3, fy + i * f.fh * .045); ctx.stroke(); }
        for (const e of [f.le, f.re]) for (let i = 0; i < 3; i++) { const sx = e === f.le ? -1 : 1; ctx.beginPath(); ctx.moveTo(e.x + sx * f.ew * .9, e.y - f.ew * .2 + i * f.ew * .25); ctx.lineTo(e.x + sx * f.ew * 1.4, e.y - f.ew * .35 + i * f.ew * .35); ctx.stroke(); }
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(f.nose.x + s * f.fw * .12, f.nose.y); ctx.quadraticCurveTo(f.nose.x + s * f.fw * .2, f.mouth.y, f.mouth.x + s * f.mouth.w * .65, f.mouth.y + f.fh * .06); ctx.stroke(); }
        ctx.restore(); ctx.save(); ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = .9; ctx.fillStyle = '#888'; ctx.beginPath(); ctx.ellipse(f.cx, f.top.y - f.fh * .05, f.fw * .75, f.fh * .25, f.roll, Math.PI, 0); ctx.fill(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = .35; ctx.fill(); ctx.restore(); break; }
      case 'beauty': softBlur(ctx, snap, 0, 0, W, H, .55, ovalPath(pts, C.FACE_LANDMARKS_FACE_OVAL)); ctx.save(); ctx.beginPath(); ovalPath(pts, C.FACE_LANDMARKS_FACE_OVAL)(ctx); ctx.clip(); fill(ctx, W, H, 'screen', '#ffe9ef', .12); ctx.restore(); break;
      case 'cartoon': break;
      case 'm_glasses': emoji(ctx, '🕶️', (f.le.x + f.re.x) / 2, (f.le.y + f.re.y) / 2 + f.ew * .1, f.fw * 1.05, f.roll); break;
      case 'm_crown': emoji(ctx, '👑', f.top.x, f.top.y - f.fh * .28, f.fw * .9, f.roll); break;
      case 'm_cat': case 'm_dog': case 'm_devil': {
        const ear = effect === 'm_cat' ? '#ff9ec7' : effect === 'm_dog' ? '#8b5a2b' : '#e0162b';
        ctx.save(); ctx.translate(f.top.x, f.top.y); ctx.rotate(f.roll);
        for (const s of [-1, 1]) { ctx.beginPath(); if (effect === 'm_dog') ctx.ellipse(s * f.fw * .55, f.fh * .25, f.fw * .18, f.fh * .38, s * .35, 0, 7); else if (effect === 'm_devil') { ctx.moveTo(s * f.fw * .22, -f.fh * .02); ctx.quadraticCurveTo(s * f.fw * .42, -f.fh * .2, s * f.fw * .38, -f.fh * .42); ctx.quadraticCurveTo(s * f.fw * .28, -f.fh * .16, s * f.fw * .1, -f.fh * .06); } else { ctx.moveTo(s * f.fw * .12, -f.fh * .02); ctx.lineTo(s * f.fw * .38, -f.fh * .42); ctx.lineTo(s * f.fw * .48, -f.fh * .02); } ctx.closePath(); ctx.fillStyle = ear; ctx.fill(); if (effect === 'm_cat') { ctx.lineWidth = f.fw / 30; ctx.strokeStyle = '#fff'; ctx.stroke(); } }
        ctx.restore();
        if (effect !== 'm_devil') { ctx.save(); ctx.fillStyle = effect === 'm_cat' ? '#ff6fa8' : '#222'; ctx.beginPath(); ctx.ellipse(f.nose.x, f.nose.y, f.fw * .09, f.fw * .065, f.roll, 0, 7); ctx.fill();
          if (effect === 'm_cat') { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = f.fw / 90; for (const s of [-1, 1]) for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(f.nose.x + s * f.fw * .1, f.nose.y + f.fw * .03); ctx.lineTo(f.nose.x + s * f.fw * .45, f.nose.y + i * f.fw * .08); ctx.stroke(); } }
          else { ctx.fillStyle = '#ff6b8a'; ctx.beginPath(); ctx.ellipse(f.mouth.x, f.mouth.y + f.fh * .12, f.mouth.w * .28, f.mouth.w * .4, f.roll, 0, 7); ctx.fill(); }
          ctx.restore(); }
        break; }
      case 'm_hearts': emoji(ctx, '❤️', f.le.x, f.le.y, f.ew * 2.4, f.roll); emoji(ctx, '❤️', f.re.x, f.re.y, f.ew * 2.4, f.roll); for (let i = 0; i < 4; i++) { const k = ((t / 1600 + i / 4) % 1); emoji(ctx, '💕', f.cx + Math.sin(i * 2 + t / 500) * f.fw * .6, f.top.y - k * f.fh * .9, f.fw * .22 * (1 - k * .5)); } break;
      case 'm_clown': ctx.save(); ctx.fillStyle = '#ff1f3d'; ctx.beginPath(); ctx.arc(f.nose.x, f.nose.y, f.fw * .1, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(f.nose.x - f.fw * .03, f.nose.y - f.fw * .03, f.fw * .025, 0, 7); ctx.fill(); ctx.restore(); emoji(ctx, '🎩', f.top.x, f.top.y - f.fh * .3, f.fw * .85, f.roll); break;
      case 'm_flowers': for (let i = -3; i <= 3; i++) { const a = f.roll + i * .22 - Math.PI / 2; emoji(ctx, i % 2 ? '🌼' : '🌸', f.cx + Math.cos(a) * f.fw * .62, f.cy - f.fh * .08 + Math.sin(a) * f.fh * .62, f.fw * .24, f.roll); } break;
      case 'm_tears': for (const e of [f.le, f.re]) for (let i = 0; i < 3; i++) { const k = ((t / 700 + i / 3) % 1); emoji(ctx, '💧', e.x, e.y + f.ew * .6 + k * f.fh * .7, f.ew * .9); } break;
      case 'm_money': for (let i = 0; i < 6; i++) { const k = ((t / 1800 + i / 6) % 1); emoji(ctx, '💵', f.cx + Math.sin(i * 7 + t / 900) * W * .4, k * H, W * .1, Math.sin(t / 300 + i)); } emoji(ctx, '💲', f.le.x, f.le.y, f.ew * 1.8, f.roll); emoji(ctx, '💲', f.re.x, f.re.y, f.ew * 1.8, f.roll); break;
    }
  }
  if (effect === 'cartoon') { posterize(ctx, ctx.canvas, W, H); for (const pts of faces) { const w = Math.max(2, face(pts).fw / 70); stroke(ctx, pts, C.FACE_LANDMARKS_FACE_OVAL, w, '#111'); stroke(ctx, pts, C.FACE_LANDMARKS_LEFT_EYE, w, '#111'); stroke(ctx, pts, C.FACE_LANDMARKS_RIGHT_EYE, w, '#111'); stroke(ctx, pts, C.FACE_LANDMARKS_LIPS, w, '#111'); stroke(ctx, pts, C.FACE_LANDMARKS_LEFT_EYEBROW, w * 1.5, '#111'); stroke(ctx, pts, C.FACE_LANDMARKS_RIGHT_EYEBROW, w * 1.5, '#111'); } }
  if (effect === 'alien') fill(ctx, W, H, 'color', '#5dff6a', .28);
  if (effect === 'glitch') {
    sc.drawImage(ctx.canvas, 0, 0); const off = 6 + 10 * Math.abs(Math.sin(t / 170));
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .55;
    tmp.width = W; tmp.height = H; const tc = tmp.getContext('2d');
    for (const [col, dx] of [['#f00', -off], ['#0ff', off]]) { tc.globalCompositeOperation = 'source-over'; tc.drawImage(snap, 0, 0); tc.globalCompositeOperation = 'multiply'; tc.fillStyle = col; tc.fillRect(0, 0, W, H); ctx.drawImage(tmp, dx, 0); }
    ctx.restore();
    if (Math.sin(t / 90) > .3) for (let i = 0; i < 5; i++) { const y = (Math.sin(t / 37 + i * 9) * .5 + .5) * H, hh = 6 + (i * 13 % 30); ctx.drawImage(snap, 0, y, W, hh, (Math.sin(t / 23 + i) * 30), y, W, hh); }
  }
  if (effect === 'vhs') {
    sc.drawImage(ctx.canvas, 0, 0); ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = .35; ctx.drawImage(snap, 3, 0); ctx.restore();
    fill(ctx, W, H, 'saturation', '#808080', .25); fill(ctx, W, H, 'soft-light', '#5a3cff', .25);
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.18)'; for (let y = (t / 40 | 0) % 4; y < H; y += 4) ctx.fillRect(0, y, W, 1.5); ctx.restore();
    const ny = ((t / 6) % (H + 80)) - 40; ctx.save(); ctx.globalAlpha = .25; ctx.fillStyle = '#fff'; ctx.fillRect(0, ny, W, 10); ctx.restore();
    ctx.save(); ctx.fillStyle = '#fff'; ctx.shadowColor = '#000'; ctx.shadowBlur = 4; ctx.font = `bold ${W / 18 | 0}px monospace`; ctx.fillText('▶ PLAY', W * .06, H * .07); const d = new Date(); ctx.fillText(`${d.toLocaleDateString()} ${d.toTimeString().slice(0, 8)}`, W * .06, H * .95); ctx.restore();
  }
  if (gradeName && gradeName !== 'none') { sc.drawImage(ctx.canvas, 0, 0); grade(ctx, W, H, gradeName, snap); }
}

// Live camera with effects → canvas (+ MediaStream for recording/LIVE)
export async function camera({ W = 720, H = 1280, facing = 'user', audio = false } = {}) {
  const video = document.createElement('video'); video.playsInline = true; video.muted = true; video.setAttribute('playsinline', '');
  const canvas = cv(W, H); const ctx = canvas.getContext('2d');
  let stream = null, raf = 0, effect = 'none', gr = 'none', lm = null, C = null, lastTs = -1, faces = [], stopped = false, mirror = facing === 'user';
  let aStream = null;
  async function open() {
    stream?.getVideoTracks().forEach(t => t.stop());
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: audio && !aStream ? { echoCancellation: true, noiseSuppression: true } : false });
    if (audio && !aStream) aStream = new MediaStream(stream.getAudioTracks()); // mic survives camera flips (recording/LIVE keep their audio track)
    video.srcObject = new MediaStream(stream.getVideoTracks()); await video.play().catch(() => {});
    mirror = facing === 'user';
  }
  await open();
  landmarker('VIDEO').then(l => { lm = l; C = l._v.FaceLandmarker; }).catch(e => console.warn('landmarker', e));
  const loop = () => {
    if (stopped) return; raf = requestAnimationFrame(loop);
    const vw = video.videoWidth, vh = video.videoHeight; if (!vw) return;
    const s = Math.max(W / vw, H / vh), sw = W / s, sh = H / s, sx = (vw - sw) / 2, sy = (vh - sh) / 2;
    ctx.save(); if (mirror) { ctx.translate(W, 0); ctx.scale(-1, 1); } ctx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H); ctx.restore();
    const needFace = effect !== 'none' && effect !== 'glitch' && effect !== 'vhs';
    if (lm && needFace && video.currentTime !== lastTs) {
      lastTs = video.currentTime;
      try { const r = lm.detectForVideo(video, performance.now()); faces = (r.faceLandmarks || []).map(f => f.map(p => { const x = (p.x * vw - sx) * s, y = (p.y * vh - sy) * s; return { x: mirror ? W - x : x, y }; })); } catch {}
    }
    apply(ctx, W, H, needFace ? faces : [], effect, gr, performance.now(), C || {});
  };
  loop();
  return {
    canvas, video, get stream() { return stream; }, get faces() { return faces.length; },
    set(e, g) { if (e != null) effect = e; if (g != null) gr = g; }, get effect() { return effect; }, get grade() { return gr; },
    async flip() { facing = facing === 'user' ? 'environment' : 'user'; await open(); },
    audioTracks: () => aStream ? aStream.getAudioTracks() : [],
    stop() { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach(t => t.stop()); aStream?.getTracks().forEach(t => t.stop()); video.srcObject = null; },
  };
}

// Apply the same effects to a still photo (File/Blob/img) → canvas
export async function photo(src, effect, gr, maxW = 1080) {
  const img = src instanceof HTMLImageElement ? src : await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(src); });
  const k = Math.min(1, maxW / img.naturalWidth), W = Math.round(img.naturalWidth * k), H = Math.round(img.naturalHeight * k);
  const canvas = cv(W, H), ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, W, H);
  let faces = [], C = {};
  if (effect && !['none', 'glitch', 'vhs'].includes(effect)) {
    try { const lm = await landmarker('IMAGE'); C = lm._v.FaceLandmarker; const r = lm.detect(canvas); faces = (r.faceLandmarks || []).map(f => f.map(p => ({ x: p.x * W, y: p.y * H }))); await landmarker('VIDEO'); } catch (e) { console.warn(e); }
  }
  apply(ctx, W, H, faces, effect, gr, 1000, C);
  return { canvas, faces: faces.length };
}
