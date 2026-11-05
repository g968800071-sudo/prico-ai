// Local media toolkit: face prep, text, watermark, demo photo & video rendering (sharp + ffmpeg).
import sharp from 'sharp';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegStatic from 'ffmpeg-static';
import { loc } from './catalog.js';
import { trackFile } from './music.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FONT = path.join(ROOT, 'assets/fonts/MA-ExtraBold.ttf');
export const FFMPEG = process.env.FFMPEG_PATH || ffmpegStatic || 'ffmpeg';
// Low-memory mode (default): Render free has 512 MB RAM, so keep sharp's cache off and ffmpeg single-threaded.
export const LOW_MEM = process.env.LOW_MEM !== '0';
if (LOW_MEM) { sharp.cache(false); sharp.concurrency(1); }
const FF_THREADS = process.env.FF_THREADS || (LOW_MEM ? '1' : '2');
export function ffTune(args) {
  const a = args.map((x, i) => (x === '-threads' && args[i + 1] !== undefined) ? x : (args[i - 1] === '-threads' ? FF_THREADS : x));
  if (!LOW_MEM) return a;
  const o = a.lastIndexOf('-c:v');
  if (o >= 0 && a[o + 1] === 'libx264') {
    a.splice(o + 2, 0, '-x264-params', 'rc-lookahead=8:ref=1:sync-lookahead=0:sliced-threads=0');
    if (!a.includes('-threads')) a.splice(a.length - 1, 0, '-threads', FF_THREADS);
    const pi = a.indexOf('-preset'); if (pi >= 0) a[pi + 1] = process.env.X264_PRESET || 'ultrafast';
  }
  // single-threaded decoders too (frame-threaded decoders hold many frames each)
  for (let i = a.length - 2; i >= 0; i--) if (a[i] === '-i') a.splice(i, 0, '-threads', '1');
  return ['-filter_complex_threads', '1', '-filter_threads', '1', ...a];
}
const W = 720, H = 1280;          // photo size (9:16)
const VW = 576, VH = 1024;        // video size

const bgCache = new Map();
export async function bg(scene, w = W, h = H) {
  const k = scene + w + 'x' + h;
  if (!bgCache.has(k)) bgCache.set(k, await sharp(path.join(ROOT, 'assets/bg', scene + '.jpg')).resize(w, h, { fit: 'cover' }).toBuffer());
  return bgCache.get(k);
}

const FONT_AR = path.join(ROOT, 'assets/fonts/NotoSansArabic-Bold.ttf');
const FONT_HI = path.join(ROOT, 'assets/fonts/NotoSansDevanagari-Bold.ttf');
const FF = f => path.join(ROOT, 'assets/fonts', f);
export const FONTS = { classic: { file: FONT, name: 'Montserrat Alternates ExtraBold' }, lobster: { file: FF('Lobster-Regular.ttf'), name: 'Lobster' }, pacifico: { file: FF('Pacifico-Regular.ttf'), name: 'Pacifico' },
  pixel: { file: FF('PressStart2P-Regular.ttf'), name: 'Press Start 2P' }, bold: { file: FF('RussoOne-Regular.ttf'), name: 'Russo One' }, script: { file: FF('MarckScript-Regular.ttf'), name: 'Marck Script' } };
export function fontFor(text, key) {
  if (/[\u0600-\u06FF]/.test(text)) return { file: FONT_AR, name: 'Noto Sans Arabic Bold' };
  if (/[\u0900-\u097F]/.test(text)) return { file: FONT_HI, name: 'Noto Sans Devanagari Bold' };
  return FONTS[key] || FONTS.classic;
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Text rendered with bundled Cyrillic font + soft shadow. Returns {png,w,h}.
export async function textPng(text, px, color = '#ffffff', maxW = 660, stroke = false, font, pill) {
  const F = fontFor(text, font);
  if (pill) { // solid rounded background box (TikTok-style)
    const t = await sharp({ text: { text: `<span foreground="${color}">${esc(text)}</span>`, font: `${F.name} ${px}`, fontfile: F.file, rgba: true, width: maxW, align: 'center', dpi: 72 } }).png().toBuffer();
    const m = await sharp(t).metadata(); const px2 = Math.round(px * 0.45), py = Math.round(px * 0.3);
    const W2 = m.width + px2 * 2, H2 = m.height + py * 2;
    const box = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W2}" height="${H2}"><rect width="${W2}" height="${H2}" rx="${Math.round(px * 0.35)}" fill="${/^#[0-9a-f]{6}$/i.test(pill) ? pill : '#000000'}" fill-opacity="0.78"/></svg>`);
    return { png: await sharp(box).composite([{ input: t, left: px2, top: py }]).png().toBuffer(), w: W2, h: H2 };
  }
  const t = await sharp({ text: { text: `<span foreground="${color}">${esc(text)}</span>`, font: `${F.name} ${px}`, fontfile: F.file, rgba: true, width: maxW, align: 'center', dpi: 72 } }).png().toBuffer();
  const m = await sharp(t).metadata();
  const pad = Math.round(px * 0.5);
  const shadowSrc = await sharp({ text: { text: `<span foreground="#000000">${esc(text)}</span>`, font: `${F.name} ${px}`, fontfile: F.file, rgba: true, width: maxW, align: 'center', dpi: 72 } }).png().toBuffer();
  const base = sharp({ create: { width: m.width + pad * 2, height: m.height + pad * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
  const shadow = await sharp(await base.clone().composite([{ input: shadowSrc, left: pad, top: pad + Math.round(px * 0.08) }]).png().toBuffer()).blur(Math.max(1, px * 0.12)).png().toBuffer();
  const layers = [{ input: shadow }];
  if (stroke) { const r = Math.max(2, Math.round(px * 0.07)); for (const [dx, dy] of [[-r, 0], [r, 0], [0, -r], [0, r], [-r, -r], [r, r], [-r, r], [r, -r]]) layers.push({ input: shadowSrc, left: pad + dx, top: pad + dy }); }
  layers.push({ input: t, left: pad, top: pad });
  const png = await sharp(shadow).composite(layers).png().toBuffer();
  return { png, w: m.width + pad * 2, h: m.height + pad * 2 };
}

// "PRICO AI" watermark pill with logo mark.
const wmCache = new Map();
export async function watermark(scale = 1) {
  if (wmCache.has(scale)) return wmCache.get(scale);
  const h = Math.round(44 * scale), r = h / 2;
  const txt = await sharp({ text: { text: '<span foreground="#ffffff">PRICO AI</span>', font: `Montserrat Alternates ExtraBold ${Math.round(22 * scale)}`, fontfile: FONT, rgba: true, dpi: 72 } }).png().toBuffer();
  const tm = await sharp(txt).metadata();
  const w = Math.round(h + tm.width + 18 * scale);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff3d77"/><stop offset=".55" stop-color="#a64dff"/><stop offset="1" stop-color="#2fd4ff"/></linearGradient></defs>
  <rect width="${w}" height="${h}" rx="${r}" fill="rgba(0,0,0,.38)"/>
  <circle cx="${r}" cy="${r}" r="${r - 5 * scale}" fill="url(#g)"/>
  <path d="M ${r - 5 * scale} ${r - 8 * scale} L ${r + 9 * scale} ${r} L ${r - 5 * scale} ${r + 8 * scale} Z" fill="#fff"/></svg>`;
  const png = await sharp(Buffer.from(svg)).composite([{ input: txt, left: Math.round(h + 4 * scale), top: Math.round((h - tm.height) / 2) }]).png().toBuffer();
  const out = { png, w, h };
  wmCache.set(scale, out);
  return out;
}

const FILTERS = {
  clean: img => img.modulate({ saturation: 1.08 }).linear(1.04, -4),
  anime: img => img.median(5).modulate({ saturation: 1.55, brightness: 1.08 }).sharpen({ sigma: 2.2, m1: 2, m2: 4 }).linear(1.12, -10),
  fantasy: img => img.recomb([[0.95, 0.05, 0.12], [0.02, 0.85, 0.08], [0.1, 0.05, 1.05]]).modulate({ saturation: 1.15 }).linear(1.1, -8),
  business: img => img.modulate({ saturation: 0.82 }).linear(1.12, -10).sharpen({ sigma: 0.8 }),
  neon: img => img.recomb([[1.0, 0.0, 0.18], [0.0, 0.88, 0.14], [0.12, 0.05, 1.1]]).modulate({ saturation: 1.3 }).linear(1.12, -6),
  ghibli: img => img.median(3).modulate({ saturation: 1.25, brightness: 1.1 }).linear(1.05, 6).blur(0.6).sharpen({ sigma: 1.2 }),
  toy: img => img.median(5).modulate({ saturation: 1.45, brightness: 1.06 }).linear(1.18, -14).sharpen({ sigma: 1.5 }),
  baby: img => img.blur(1.1).modulate({ saturation: 1.05, brightness: 1.12 }).linear(0.92, 22),
  aged: img => img.modulate({ saturation: 0.55, brightness: 0.96 }).linear(1.22, -24).sharpen({ sigma: 2.4, m1: 1.5, m2: 6 }),
  old: img => img.grayscale().recomb([[0.95, 0.05, 0], [0.82, 0.12, 0], [0.62, 0.08, 0]]).linear(1.05, 8).toColourspace('srgb'),
  zombie: img => img.recomb([[0.55, 0.3, 0.1], [0.25, 0.85, 0.1], [0.2, 0.3, 0.45]]).modulate({ saturation: 0.75 }).linear(1.15, -12),
  pop: img => img.modulate({ saturation: 1.6 }).linear(1.25, -18).sharpen({ sigma: 1.5 }),
  gold: img => img.recomb([[1.12, 0.06, 0], [0.04, 1.0, 0], [0, 0, 0.78]]).modulate({ saturation: 1.15 }).linear(1.2, -16),
  warm: img => img.recomb([[1.08, 0.04, 0], [0.02, 1.0, 0], [0, 0, 0.9]]).modulate({ saturation: 1.12 }),
  cyber: img => img.recomb([[0.9, 0.0, 0.3], [0.0, 0.8, 0.35], [0.2, 0.1, 1.2]]).modulate({ saturation: 1.4 }).linear(1.2, -14).sharpen({ sigma: 1.2 }),
  noir: img => img.recomb([[0.3, 0.59, 0.11], [0.3, 0.59, 0.11], [0.3, 0.59, 0.11]]).linear(1.35, -30).sharpen({ sigma: 1 }),
  pastel: img => img.modulate({ saturation: 0.8, brightness: 1.12 }).linear(0.85, 34).blur(0.4),
  sketch: img => img.recomb([[0.3, 0.59, 0.11], [0.3, 0.59, 0.11], [0.3, 0.59, 0.11]]).median(3).linear(1.9, -60).sharpen({ sigma: 2.5, m1: 3, m2: 6 }),
  retro: img => img.recomb([[1.1, 0.1, 0], [0.05, 0.95, 0], [0, 0.05, 0.75]]).modulate({ saturation: 1.25 }).linear(1.05, 10),
};

// Face input: { img: jpeg selfie, cut: png person cut-out with alpha (on-device segmentation) | null }
function applyFilter(img, filter) { return (FILTERS[filter] || FILTERS.clean)(img); }

// Fallback: selfie → square face with feathered ellipse alpha (used when no cut-out exists).
export async function prepFace(buf, filter = 'clean', size = 512) {
  let img = sharp(buf).rotate().resize(size, size, { fit: 'cover', position: 'attention' }).removeAlpha();
  const rgb = await applyFilter(img, filter).toBuffer();
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><defs><radialGradient id="m" cx=".5" cy=".47" r=".5" fx=".5" fy=".45" gradientTransform="translate(.5 .47) scale(.84 1) translate(-.5 -.47)"><stop offset=".72" stop-color="#fff"/><stop offset=".9" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="${size}" height="${size}" fill="url(#m)"/></svg>`);
  const alpha = await sharp(mask).extractChannel('alpha').toBuffer();
  return sharp(rgb).joinChannel(alpha).png().toBuffer();
}

const sceneTone = new Map();
async function tone(scene) {
  if (!sceneTone.has(scene)) {
    const st = await sharp(await bg(scene, 72, 128)).stats();
    const m = st.channels.slice(0, 3).map(c => c.mean); const avg = (m[0] + m[1] + m[2]) / 3 || 1;
    sceneTone.set(scene, m.map(v => Math.max(0.86, Math.min(1.14, Math.pow(v / avg, 0.22)))));
  }
  return sceneTone.get(scene);
}

const hex = c => { const n = parseInt(c.slice(1), 16); return { r: n >> 16 & 255, g: n >> 8 & 255, b: n & 255 }; };

// Person layer: filtered + colour-matched cut-out with soft rim glow. Returns {png,w,h,cut}.
export async function personLayer(face, filter, width, scene, glow = '#ffffff') {
  if (!face.cut) {
    const s = Math.round(width * 0.78);
    const f = await sharp(await prepFace(face.img, filter, 512)).resize(s, s).png().toBuffer();
    const hs = Math.round(s * 1.32);
    const png = await sharp({ create: { width: hs, height: hs, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: await halo(hs, glow) }, { input: f, left: Math.round((hs - s) / 2), top: Math.round((hs - s) / 2) }]).png().toBuffer();
    return { png, w: hs, h: hs, cut: false };
  }
  const trimmed = await sharp(face.cut).ensureAlpha().trim({ threshold: 1 }).png().toBuffer().catch(() => face.cut);
  const meta = await sharp(trimmed).metadata();
  const w = Math.round(width), h = Math.round(meta.height * width / meta.width);
  const src = await sharp(trimmed).resize(w, h).png().toBuffer();
  const alpha = await sharp(src).extractChannel(3).toBuffer();
  const t = await tone(scene);
  const rgb = await applyFilter(sharp(src).removeAlpha(), filter).linear(t, [0, 0, 0]).toBuffer();
  const person = await sharp(rgb).joinChannel(alpha).png().toBuffer();
  const pad = Math.round(w * 0.08);
  const g = hex(glow);
  const glowA = await sharp(alpha).extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } }).blur(Math.max(2, w * 0.03)).linear(1.6, 0).toBuffer();
  const glowImg = await sharp({ create: { width: w + 2 * pad, height: h + 2 * pad, channels: 3, background: g } }).joinChannel(glowA).png().toBuffer();
  const png = await sharp(glowImg).composite([{ input: person, left: pad, top: pad }]).png().toBuffer();
  return { png, w: w + 2 * pad, h: h + 2 * pad, cut: true, pad };
}

// Glow halo behind the face.
async function halo(size, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><defs><radialGradient id="h"><stop offset=".45" stop-color="${color}" stop-opacity=".85"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs><ellipse cx="${size / 2}" cy="${size / 2}" rx="${size * .48}" ry="${size * .5}" fill="url(#h)"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// Readability gradients top/bottom + vignette.
function shade(w, h) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs>
  <linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset=".18" stop-color="#000" stop-opacity="0"/><stop offset=".72" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient>
  <radialGradient id="v" cx=".5" cy=".45" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#t)"/><rect width="${w}" height="${h}" fill="url(#v)"/></svg>`);
}

// Per-scene layout. Cut-out people: pw = width fraction, by = bottom (fraction of H), x = centre. Fallback faces: y/s.
const LAYOUT = {
  space: { y: .40, s: .62, pw: .92, by: 1.02, glow: '#8f7bff' }, sakura: { y: .44, s: .60, pw: .9, by: 1.02, glow: '#ffd1e8' }, castle: { y: .45, s: .58, pw: .9, by: 1.02, glow: '#c08bff' },
  office: { y: .42, s: .64, pw: .95, by: 1.02, glow: '#ffe2b8' }, neon: { y: .44, s: .60, pw: .9, by: 1.02, glow: '#ff4fd8' }, berlin: { y: .34, s: .58, pw: .8, by: .96, glow: '#ffb35c' },
  paris: { y: .58, s: .52, pw: .78, by: 1.02, glow: '#ffd38a' }, moon: { y: .52, s: .56, pw: .8, by: 1.02, glow: '#bcd6ff' }, tankfield: { y: .37, s: .42, pw: .30, by: .535, x: .338, glow: '#ffd23d' },
  beach: { y: .55, s: .56, pw: .8, by: 1.02, glow: '#fff3c4' }, nyc: { y: .56, s: .56, pw: .8, by: 1.02, glow: '#ff5ce1' }, birthday: { y: .40, s: .56, pw: .74, by: .84, glow: '#ffd76a' },
  newyear: { y: .42, s: .54, pw: .78, by: 1.02, glow: '#a9c9ff' }, love: { y: .42, s: .58, pw: .86, by: 1.02, glow: '#ff7aa8' }, disco: { y: .45, s: .56, pw: .8, by: 1.02, glow: '#ff5cf0' },
  shock: { y: .46, s: .68, pw: .95, by: 1.02, glow: '#fff6b0' }, boom: { y: .55, s: .55, pw: .82, by: 1.02, glow: '#ff9a3c' }, wedding: { y: .50, s: .44, pw: .72, by: 1.02, glow: '#fff0d6' },
  toon: { y: .52, s: .46, pw: .74, by: 1.02, glow: '#ffffff' }, stadium: { y: .48, s: .54, pw: .8, by: 1.02, glow: '#cfe8ff' },
  ghibli: { y: .52, s: .56, pw: .84, by: 1.02, glow: '#fff6d8' }, figurebox: { y: .5, s: .4, pw: .44, by: .84, x: .42, glow: '#ffffff', clip: [.17, .22, .64, .84] },
  dollbox: { y: .5, s: .46, pw: .6, by: .80, glow: '#ffd1ec', clip: [.21, .14, .86, .82] }, nursery: { y: .5, s: .56, pw: .86, by: 1.02, glow: '#fff4dc' },
  pool: { y: .6, s: .36, pw: .40, by: .70, x: .46, glow: '#fff0f6' }, year2027: { y: .62, s: .5, pw: .74, by: 1.02, glow: '#ffe3a8' },
  barber: { y: .56, s: .5, pw: .7, by: 1.02, glow: '#ffcf8a' }, zombie: { y: .56, s: .54, pw: .84, by: 1.02, glow: '#7dff8a' },
  elf: { y: .56, s: .5, pw: .8, by: 1.02, glow: '#ffe7a8' }, parking: { y: .56, s: .5, pw: .8, by: 1.02, glow: '#ff9bd2' },
  vintage: { y: .5, s: .5, pw: .62, by: .775, glow: '#d8c3a0', glowA: .35, clip: [.23, .21, .77, .775] }, park: { y: .56, s: .54, pw: .84, by: 1.02, glow: '#fff1c8' },
  comic: { y: .5, s: .62, pw: .92, by: 1.02, glow: '#ffffff' }, figurine: { y: .62, s: .3, pw: .34, by: .79, x: .435, glow: '#ffffff' },
  podcast: { y: .55, s: .58, pw: .86, by: 1.02, x: .55, glow: '#c38bff' }, gym: { y: .55, s: .58, pw: .92, by: 1.02, glow: '#ffc35c' },
  halloween: { y: .55, s: .54, pw: .84, by: 1.02, x: .56, glow: '#b07bff' }, christmas: { y: .55, s: .54, pw: .84, by: 1.02, x: .58, glow: '#ffd38a' },
  diwali: { y: .52, s: .54, pw: .84, by: 1.0, glow: '#ffb347' }, ramadan: { y: .52, s: .54, pw: .84, by: .98, x: .45, glow: '#ffd98a' },
  lunar: { y: .55, s: .54, pw: .84, by: 1.02, glow: '#ff6a5c' }, cake: { y: .5, s: .5, pw: .78, by: .98, glow: '#ffd1e8' },
  kpop: { y: .5, s: .54, pw: .82, by: .98, glow: '#ff7af0' }, redcarpet: { y: .52, s: .54, pw: .82, by: 1.02, glow: '#fff1c2' },
  ocean: { y: .45, s: .56, pw: .84, by: 1.0, glow: '#a8f0ff' }, tokyo: { y: .52, s: .56, pw: .84, by: 1.02, glow: '#ff5ce1' },
  dubai: { y: .52, s: .56, pw: .84, by: 1.02, x: .56, glow: '#ffd08a' }, gamer: { y: .52, s: .58, pw: .9, by: 1.02, glow: '#9b7bff' },
  hallway: { y: .52, s: .56, pw: .84, by: 1.02, glow: '#ffffff' }, snowglobe: { y: .46, s: .44, pw: .58, by: .80, glow: '#d6ecff' },
  carnival: { y: .52, s: .56, pw: .84, by: 1.02, glow: '#ffcf5c' }, runway: { y: .52, s: .56, pw: .8, by: 1.02, glow: '#ffffff' },
};

export async function demoPhoto(tpl, faces, lang = 'en', opts = {}) {
  const L = LAYOUT[tpl.scene] || { y: .45, s: .58, pw: .85, by: 1.02, glow: '#ffffff' };
  const face = faces[0];
  const layers = [];
  if (face.cut) {
    const p = await personLayer(face, tpl.filter, W * L.pw, tpl.scene, L.glow);
    const cx = W * (L.x || .5);
    layers.push({ input: p.png, left: Math.round(cx - p.w / 2), top: Math.round(H * L.by - p.h + p.pad) });
  } else {
    const p = await personLayer(face, tpl.filter, W * L.s / 0.78, tpl.scene, L.glow);
    layers.push({ input: p.png, left: Math.round(W / 2 - p.w / 2), top: Math.round(H * L.y - p.h / 2) });
  }
  layers.push({ input: shade(W, H) });
  if (tpl.title) {
    const t = await textPng(loc(tpl.title, lang), tpl.meme ? 72 : 64, '#ffffff', 660, !!tpl.meme);
    layers.push({ input: t.png, left: Math.round((W - t.w) / 2), top: Math.round(H * (face.cut ? 0.08 : 0.80) - (face.cut ? 0 : t.h / 2)) });
  }
  if (opts.overlay) { const o = await overlayPng(opts.overlay, W, H); if (o) layers.push({ input: o, left: 0, top: 0 }); }
  const wm = await watermark(1.2);
  layers.push({ input: wm.png, left: W - wm.w - 24, top: H - wm.h - 28 });
  // clip layers that overflow the canvas
  const clipped = [];
  for (const l of layers) {
    if (l.left === undefined) { clipped.push(l); continue; }
    const m = await sharp(l.input).metadata();
    let { left, top } = l, img = sharp(l.input);
    const x0 = Math.max(0, -left), y0 = Math.max(0, -top);
    const w = Math.min(m.width - x0, W - Math.max(0, left)), h = Math.min(m.height - y0, H - Math.max(0, top));
    if (w <= 0 || h <= 0) continue;
    if (x0 || y0 || w < m.width || h < m.height) img = img.extract({ left: x0, top: y0, width: w, height: h });
    clipped.push({ ...l, input: await img.png().toBuffer(), left: Math.max(0, left), top: Math.max(0, top) });
  }
  if (L.clip && clipped[0]?.left !== undefined) {
    // keep the person inside the box/frame window
    const person = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([clipped[0]]).png().toBuffer();
    const [x0, y0, x1, y1] = L.clip;
    const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect x="${x0 * W}" y="${y0 * H}" width="${(x1 - x0) * W}" height="${(y1 - y0) * H}" rx="18" fill="#fff"/></svg>`);
    clipped[0] = { input: await sharp(person).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer(), left: 0, top: 0 };
  }
  const base = sharp(await bg(tpl.scene));
  if (opts.raw) return base.composite(clipped.slice(0, 1)).png().toBuffer();
  return base.composite(clipped).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
}

// Text + sticker overlay layer (user editor). ov = { text, pos: top|center|bottom, color, stickers: [{ c: '1f602', x, y, s, r }] }
const STICKERS = path.join(ROOT, 'www/stickers');
export async function overlayPng(ov, w, h) {
  if (!ov || (!ov.text && !(ov.stickers || []).length)) return null;
  const layers = [];
  for (const st of (ov.stickers || []).slice(0, 12)) {
    if (!/^[0-9a-f-]{2,20}$/.test(st.c || '')) continue;
    const size = Math.round(Math.max(0.06, Math.min(0.6, Number(st.s) || 0.18)) * w);
    let img;
    try { img = await sharp(path.join(STICKERS, st.c + '.svg'), { density: 300 }).resize(size, size).png().toBuffer(); } catch { continue; }
    if (st.r) img = await sharp(img).rotate(Number(st.r) || 0, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const m = await sharp(img).metadata();
    const left = Math.round(Math.max(0, Math.min(w - m.width, (Number(st.x) || .5) * w - m.width / 2)));
    const top = Math.round(Math.max(0, Math.min(h - m.height, (Number(st.y) || .5) * h - m.height / 2)));
    layers.push({ input: img, left, top });
  }
  if (ov.text) {
    const col = /^#[0-9a-f]{6}$/i.test(ov.color || '') ? ov.color : '#ffffff';
    const t = await textPng(String(ov.text).slice(0, 120), Math.round(w * 0.075), col, Math.round(w * 0.9), true);
    const tw = Math.min(t.w, w), th = Math.min(t.h, h);
    const img = (t.w > w || t.h > h) ? await sharp(t.png).resize(tw, th, { fit: 'inside' }).png().toBuffer() : t.png;
    const mm = await sharp(img).metadata();
    const y = ov.pos === 'top' ? h * 0.12 : ov.pos === 'center' ? h * 0.5 - mm.height / 2 : h * 0.72;
    layers.push({ input: img, left: Math.round((w - mm.width) / 2), top: Math.round(Math.max(0, Math.min(h - mm.height, y))) });
  }
  return sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(layers).png().toBuffer();
}

// ---------- video ----------
function run(args, timeoutMs = 240000) {
  return new Promise((res, rej) => {
    if (process.env.FF_DEBUG) fss_dbg(ffTune(args));
    const p = spawn(FFMPEG, ffTune(args), { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', d => { err += d; if (err.length > 20000) err = err.slice(-10000); });
    const to = setTimeout(() => { p.kill('SIGKILL'); rej(new Error('ffmpeg timeout')); }, timeoutMs);
    p.on('close', c => { clearTimeout(to); c === 0 ? res() : rej(new Error('ffmpeg failed: ' + err.slice(-800))); });
    p.on('error', e => { clearTimeout(to); rej(e); });
  });
}

const MUSIC = {
  disco: [220, 277, 330, 277], drama: [147, 139, 131, 123], epic: [110, 131, 147, 165], love: [262, 330, 392, 330],
  toon: [392, 440, 494, 523], birthday: [262, 294, 330, 349], newyear: [330, 392, 440, 523], stadium: [196, 247, 294, 247],
};
function musicExpr(kind, bpm = 120) {
  const n = MUSIC[kind] || MUSIC.disco; const b = 60 / bpm;
  const note = `if(lt(mod(t,${4 * b * 2}),${2 * b}),${n[0]},if(lt(mod(t,${8 * b}),${4 * b}),${n[1]},if(lt(mod(t,${8 * b}),${6 * b}),${n[2]},${n[3]})))`;
  // plucked arpeggio + soft bass + kick on beats
  return `0.16*sin(2*PI*(${note})*2*t)*exp(-6*mod(t,${b / 2}))+0.12*sin(2*PI*(${note})*t)+0.22*sin(2*PI*55*t*(1+2*exp(-30*mod(t,${b}))))*exp(-12*mod(t,${b}))`;
}

// Particle layer (PNG, transparent) used for falling confetti/sparkles/hearts.
async function particles(kind, w, h, seed = 1) {
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const cols = { confetti: ['#ffd23d', '#ff3d77', '#2fd4ff', '#7dff8a', '#ffffff', '#a64dff'], hearts: ['#ff4f8b', '#ff8fb5', '#ffffff'], sparkle: ['#ffffff', '#fff3b0', '#b9f2ff'], snow: ['#ffffff'] }[kind] || ['#fff'];
  let items = '';
  for (let i = 0; i < 70; i++) {
    const x = rnd() * w, y = rnd() * h, c = cols[Math.floor(rnd() * cols.length)], r = 4 + rnd() * 9, a = rnd() * 180;
    if (kind === 'confetti') items += `<rect x="${x}" y="${y}" width="${r * 1.6}" height="${r * .8}" fill="${c}" transform="rotate(${a} ${x} ${y})" opacity=".95"/>`;
    else if (kind === 'hearts') items += `<path d="M${x} ${y + r * .3} C ${x - r} ${y - r * .6}, ${x - r * 1.6} ${y + r * .5}, ${x} ${y + r * 1.4} C ${x + r * 1.6} ${y + r * .5}, ${x + r} ${y - r * .6}, ${x} ${y + r * .3} Z" fill="${c}" opacity=".85"/>`;
    else if (kind === 'snow') items += `<circle cx="${x}" cy="${y}" r="${r * .45}" fill="${c}" opacity="${.5 + rnd() * .5}"/>`;
    else items += `<path d="M${x} ${y - r} L${x + r * .25} ${y - r * .25} L${x + r} ${y} L${x + r * .25} ${y + r * .25} L${x} ${y + r} L${x - r * .25} ${y + r * .25} L${x - r} ${y} L${x - r * .25} ${y - r * .25} Z" fill="${c}" opacity="${.6 + rnd() * .4}"/>`;
  }
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${items}</svg>`)).png().toBuffer();
}

// Motion presets. x: expr for left edge, yo: vertical offset expr (added), a: rotation, size: width fraction,
// cy: centre-y fraction (fallback faces) / by: bottom fraction (cut-outs), sc: scale expr.
const D = 6;
function motion(name, i, n) {
  const ph = (i * 2.1).toFixed(2);
  const slot = n > 1 ? `(W*${((i + 1) / (n + 1)).toFixed(3)}-w/2)` : `(W-w)/2`;
  switch (name) {
    case 'dance': return { x: `(W-w)/2+60*sin(2*PI*0.5*t)`, yo: `-34*abs(sin(2*PI*t))`, a: `0.14*sin(2*PI*t)`, size: .8, cy: .44 };
    case 'gang': return { x: `${slot}+14*sin(2*PI*t+${ph})`, yo: `-28*abs(sin(2*PI*t+${ph}))`, a: `0.14*sin(2*PI*t+${ph})`, size: n > 2 ? .5 : .62, cy: .45 };
    case 'couple': return { x: `${slot}+${i ? -1 : 1}*20*(1-cos(2*PI*t/3))`, yo: `+10*sin(2*PI*t/2+${ph})`, a: `${i ? -1 : 1}*0.08*sin(2*PI*t/3)`, size: .6, cy: .47 };
    case 'bounce': return { x: `(W-w)/2`, yo: `-36*abs(sin(2*PI*0.75*t))`, a: `0.07*sin(2*PI*0.75*t)`, size: .74, cy: .40, by: .86 };
    case 'shock': return { x: `(W-w)/2+if(gt(t,1.6),14*sin(60*t),0)`, yo: `+if(gt(t,1.6),10*cos(50*t),0)`, a: '0', size: .66, cy: .5, sc: `if(lt(t,1.6),1,min(1.6,1+(t-1.6)*3))` };
    case 'walk': return { x: `(W-w)/2+14*sin(2*PI*t/1.2)`, yo: `+8*abs(sin(2*PI*t/0.6))`, a: '0.03*sin(2*PI*t/1.2)', size: .78, cy: .56, sc: `(0.6+0.4*t/${D})` };
    case 'action': return { x: `(W-w)/2+120*sin(2*PI*t/3)`, yo: `-24*abs(sin(2*PI*t*1.5))`, a: `0.1*sin(2*PI*t/3)`, size: .72, cy: .55 };
    case 'goal': return { x: `if(lt(t,1.2),W-(W-(W-w)/2)*t/1.2,(W-w)/2)`, yo: `-if(gt(t,3),36*abs(sin(2*PI*1.5*t)),0)`, a: `if(lt(t,1.2),0.2,0.08*sin(2*PI*1.5*t))`, size: .74, cy: .47 };
    case 'fly': return { x: `-w+(W+w)*(0.2+0.6*t/${D})+20*sin(2*PI*t)`, yo: `-110*sin(PI*t/${D})+14*sin(2*PI*t*1.3)`, a: `-0.2+0.05*sin(2*PI*t)`, size: .62, cy: .42, by: .8 };
    case 'tank': return { x: `W*0.338-w/2+5*sin(2*PI*t*2)`, yo: `+h*0.8*if(lt(t,0.8),1-t/0.8,0)+if(gt(t,0.8),4*sin(2*PI*t*2),0)`, a: `0.04*sin(2*PI*t*2)`, size: .30, cy: .37, by: .535, fsize: .42 };
    case 'float': return { x: `W*0.46-w/2+10*sin(2*PI*t/2)+if(gt(t,4),(t-4)*150,0)`, yo: `+6*sin(2*PI*t/1.5)+if(gt(t,4.2),(t-4.2)*(t-4.2)*300,0)`, a: `0.05*sin(2*PI*t/2)+if(gt(t,4),(t-4)*0.45,0)`, size: .40, cy: .6, by: .70, fsize: .34 };
    case 'climb': return { x: `(W-w)/2`, yo: `+h*0.55*max(0,1-t/2)-if(gt(t,2),26*abs(sin(2*PI*t*1.2)),0)`, a: `if(gt(t,2),0.06*sin(2*PI*t*1.2),0)`, size: .72, cy: .6 };
    case 'strut': return { x: `(W-w)/2+18*sin(2*PI*t/2.2)`, yo: `+34*abs(sin(2*PI*t/1.1))-(1-min(1,t/4.5))*H*0.16`, a: `0.07*sin(2*PI*t/1.1)`, size: .64, cy: .56, by: 1.0, sc: `(0.42+0.58*min(1,t/4.5))` };
    case 'turns': return { x: `${slot}`, yo: `-if(eq(floor(t/2),${i}),40*abs(sin(2*PI*t)),10*abs(sin(2*PI*t+${ph})))`, a: `if(eq(floor(t/2),${i}),2*PI*min(1,mod(t,2)/0.7),0.08*sin(2*PI*t+${ph}))`, size: n > 2 ? .48 : .6, cy: .5, sc: `if(eq(floor(t/2),${i}),1.12,0.92)` };
    case 'inflate': return { x: `(W-w)/2+if(gt(t,3.2),40*sin(2*PI*t),0)`, yo: `-if(gt(t,3.2),(t-3.2)*(t-3.2)*170,0)`, a: `0.08*sin(2*PI*t*1.4)`, size: .6, cy: .5, by: 1.0, sc: `(1+min(0.9,t*0.3))` };
    case 'spin': return { x: `(W-w)/2+40*sin(2*PI*t/3)`, yo: `-30*abs(sin(2*PI*t))`, a: `2*PI*t/1.2`, size: .6, cy: .5, by: .9 };
    case 'talk': return { x: `W*0.55-w/2+4*sin(2*PI*t*0.7)`, yo: `+3*sin(2*PI*t*3.1)`, a: `0.03*sin(2*PI*t*0.8)`, size: .84, cy: .5, sc: `(1+0.012*sin(2*PI*t*4.3))` };
    // 2026 physics FX (Pika-style) — sx/sy: separate axis scale, fx: extra face filters, vfx: whole-frame filters
    case 'squish': return { x: `(W-w)/2`, yo: '', a: '0', size: .66, cy: .52, by: 1.0, sx: `(1+0.38*abs(sin(2*PI*t*0.9))*min(1,t/0.8))`, sy: `(1-0.32*abs(sin(2*PI*t*0.9))*min(1,t/0.8))` };
    case 'melt': return { x: `(W-w)/2+6*sin(2*PI*t)`, yo: `+if(gt(t,1.2),(t-1.2)*28,0)`, a: '0', size: .66, cy: .5, by: 1.0, sx: `(1+0.22*max(0,t-1.2)/4.8)`, sy: `(1+0.55*max(0,t-1.2)/4.8)`, fx: `,gblur=sigma=1.2:steps=1` };
    case 'explode': return { x: `(W-w)/2+if(between(t,2.4,3.2),20*sin(80*t),0)`, yo: '', a: `if(gt(t,3.2),0.6*(t-3.2),0)`, size: .62, cy: .5, by: .95, sc: `if(lt(t,2.4),1+0.06*t,if(lt(t,3.2),1.15+0.4*(t-2.4),min(3.5,1.47+2.5*(t-3.2))))`, fx: `,fade=t=out:st=3.3:d=0.5:alpha=1`, vfx: `,eq=brightness='if(between(t,3.2,3.45),0.45,0)':eval=frame` };
    case 'crashzoom': return { x: `(W-w)/2`, yo: '', a: '0', size: .7, cy: .5, by: 1.0, sc: `if(lt(t,1.5),1,if(lt(t,1.75),1+3.2*(t-1.5),1.8+0.03*sin(2*PI*t*6)))`, vfx: `,rgbashift=rh=10:bh=-10:enable='between(t,1.5,2.1)'` };
    case 'jelly': return { x: `(W-w)/2`, yo: `-20*abs(sin(2*PI*t*1.2))`, a: `0.06*sin(2*PI*t*2.4)`, size: .64, cy: .5, by: 1.0, sx: `(1+0.12*sin(2*PI*t*2.4))`, sy: `(1-0.12*sin(2*PI*t*2.4))` };
    case 'shrink': return { x: `(W-w)/2+30*sin(2*PI*t/2)`, yo: `-12*abs(sin(2*PI*t*2))`, a: `0.1*sin(2*PI*t*2)`, size: .7, cy: .6, by: 1.0, sc: `max(0.3,1-0.7*min(1,t/2.2))` };
    case 'glitch': return { x: `(W-w)/2+if(lt(mod(t,1.1),0.12),24*sin(200*t),0)`, yo: '', a: '0', size: .74, cy: .5, by: 1.02, vfx: `,rgbashift=rh=14:bh=-14:enable='lt(mod(t,1.1),0.15)',noise=alls=10:allf=t` };
    case 'vhs': return { x: `(W-w)/2+4*sin(2*PI*t/3)`, yo: '', a: '0', size: .76, cy: .5, by: 1.02, vfx: `,rgbashift=rh=3:bh=-3,noise=alls=16:allf=t,eq=saturation=0.75:contrast=1.08,vignette` };
    case 'hug': return { x: i === 0 ? `W*0.5-w*0.8-(1-min(1,t/2.5))*W*0.32` : `W*0.5-w*0.2+(1-min(1,t/2.5))*W*0.32`, yo: `+if(lt(t,2.5),10*abs(sin(2*PI*t*1.2)),0)`, a: `${i === 0 ? '' : '-'}0.13*min(1,max(0,(t-2.5)/0.5))`, size: .52, cy: .5 };
    default: return { x: `(W-w)/2`, yo: '', a: '0', size: .75, cy: .45 };
  }
}

export async function demoVideo(tpl, faces, lang = 'en', opts = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prico-'));
  try {
    const still = tpl.motion === 'kenburns' || tpl.motion === 'develop';
    const n = still ? 0 : Math.max(1, tpl.faces || 1);
    const useFaces = Array.from({ length: n }, (_, i) => faces[i % faces.length]);
    const BW = Math.round(VW * 1.12), BH = Math.round(VH * 1.12);
    const bgBuf = still ? await sharp(await demoPhoto({ ...tpl, title: null }, faces, lang, { raw: true })).resize(BW, BH, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer()
      : await sharp(await bg(tpl.scene, BW, BH)).jpeg({ quality: 90 }).toBuffer();
    await fs.writeFile(path.join(dir, 'bg.jpg'), bgBuf);
    const L = LAYOUT[tpl.scene] || { glow: '#ffffff' };
    const cutInfo = [];
    for (let i = 0; i < n; i++) {
      const m = motion(tpl.motion, i, n);
      const f = useFaces[i];
      const width = f.cut ? VW * m.size : VW * (m.fsize || m.size * 0.7) / 0.78;
      const p = await personLayer(f, tpl.filter || 'clean', width, tpl.scene, L.glow);
      await fs.writeFile(path.join(dir, `f${i}.png`), p.png);
      cutInfo.push(p);
    }
    const pk = tpl.particles || { birthday: 'confetti', newyear: 'snow', love: 'hearts', wedding: 'hearts', stadium: 'confetti', christmas: 'snow', snowglobe: 'snow', carnival: 'confetti', kpop: 'confetti', cake: 'confetti', lunar: 'confetti', valentine: 'hearts' }[tpl.scene] || 'sparkle';
    await fs.writeFile(path.join(dir, 'p.png'), await particles(pk, VW, VH, 7));
    await fs.writeFile(path.join(dir, 'shade.png'), await sharp(shade(VW, VH)).png().toBuffer());
    await fs.writeFile(path.join(dir, 'wm.png'), (await watermark(1)).png);
    let title = tpl.title ? loc(tpl.title, lang) : '';
    if (tpl.motion === 'shock' && !tpl.title) title = { ru: 'ЧТООО?!', uk: 'ЩООО?!', es: '¿¡QUÉEE?!', pt: 'QUÊEE?!', de: 'WAAAS?!', fr: 'QUOIII ?!', tr: 'NEEE?!', ar: 'ماذاااا؟!', hi: 'क्याआआ?!', id: 'APAAA?!' }[lang] || 'WHAAT?!';
    const ovPng = opts.overlay ? await overlayPng(opts.overlay, VW, VH) : null;
    if (ovPng) await fs.writeFile(path.join(dir, 'ov.png'), ovPng);
    if (title) await fs.writeFile(path.join(dir, 't.png'), (await textPng(title, 50, '#ffffff', 520)).png);

    const fps = 24;
    // stills are decoded once and repeated inside the graph (-loop 1 inputs pile up frame queues → 400+ MB RAM)
    const img = f => ['-i', path.join(dir, f)];
    const args = ['-y', '-loglevel', 'error', ...img('bg.jpg')];
    for (let i = 0; i < n; i++) args.push(...img(`f${i}.png`));
    const pIdx = n + 1, sIdx = n + 2, wIdx = n + 3; args.push(...img('p.png'), ...img('shade.png'), ...img('wm.png'));
    let tIdx = -1; if (title) { tIdx = n + 4; args.push(...img('t.png')); }
    let oIdx = -1; if (ovPng) { oIdx = title ? n + 5 : n + 4; args.push(...img('ov.png')); }
    const aIdx = n + 4 + (title ? 1 : 0) + (ovPng ? 1 : 0);
    args.push('-stream_loop', '-1', '-t', String(D), '-i', await trackFile(tpl.music || 'pop'));

    const shake = ['tank', 'action', 'walk', 'shock', 'inflate'].includes(tpl.motion) ? `+if(lt(mod(t,2),0.25),8*sin(90*t),0)` : '';
    const dx = BW - VW, dy = BH - VH;
    const camX = still ? `${dx / 2}+${dx / 2 - 2}*sin(2*PI*t/${D * 2})*0.6` : tpl.motion === 'fly' ? `${dx / 2}+${dx / 2}*sin(2*PI*t/${D * 2})` : `${dx / 2}+${dx / 2 - 2}*sin(2*PI*t/${D * 1.6})`;
    const camY = tpl.motion === 'fly' ? `${dy}*t/${D}` : `${dy / 2}+${dy / 2 - 2}*cos(2*PI*t/${D * 1.6})`;
    let fg = `[0:v]crop=${VW}:${VH}:x='${camX}${shake}':y='${camY}',format=rgba${tpl.scene === 'disco' ? `,hue=h='25*sin(2*PI*t/2)'` : ''}[b0];`;
    let last = 'b0';
    // draw back-to-front: for groups draw outer faces first, centre last
    const order = [...Array(n).keys()].sort((a, b) => Math.abs(b - (n - 1) / 2) - Math.abs(a - (n - 1) / 2));
    for (const i of order) {
      const m = motion(tpl.motion, i, n), p = cutInfo[i];
      const sc = m.sc || '1';
      const sx = m.sx || sc, sy = m.sy || sc;
      fg += `[${i + 1}:v]format=rgba,scale=w='max(2,trunc(iw*${sx}/2)*2)':h='max(2,trunc(ih*${sy}/2)*2)':eval=frame,rotate=a='${m.a}':c=none:ow='hypot(iw,ih)':oh='hypot(iw,ih)'${m.fx || ''}[f${i}];`;
      // rotate enlarges the frame to the diagonal; compensate so the anchor stays put
      const y = p.cut
        ? `H*${m.by || 1.02}+(${p.pad}-${p.h / 2})*${m.sy || sc}-h/2${m.yo}`
        : `H*${m.cy}-h/2${m.yo}`;
      fg += `[${last}][f${i}]overlay=x='${m.x}':y='${y}':eval=frame[o${i}];`;
      last = `o${i}`;
    }
    fg += `[${pIdx}:v]format=rgba,split[pa][pb];[${last}][pa]overlay=x=0:y='mod(t*120,${VH})-${VH}'[q1];[q1][pb]overlay=x=0:y='mod(t*120,${VH})'[q2];`;
    fg += `[q2][${sIdx}:v]overlay=0:0[q3]`;
    last = 'q3';
    if (tIdx >= 0) {
      const appear = tpl.motion === 'shock' ? 1.6 : tpl.motion === 'goal' ? 3 : 0.6;
      const ty = (tpl.motion === 'shock' || still || cutInfo[0]?.cut) ? 'H*0.09' : 'H*0.76';
      fg += `;[${tIdx}:v]format=rgba,fade=t=in:st=${appear}:d=0.35:alpha=1[tt];[${last}][tt]overlay=x='(W-w)/2':y='${ty}+if(lt(t,${appear + 0.4}),40*(1-(t-${appear})/0.4),0)'[q4]`;
      last = 'q4';
    }
    if (oIdx >= 0) { fg += `;[${last}][${oIdx}:v]overlay=0:0[q5]`; last = 'q5'; }
    const vfx = (motion(tpl.motion, 0, 1).vfx || '') + (tpl.vfx ? ',' + tpl.vfx : '');
    if (vfx) { fg += `;[${last}]format=yuv420p${vfx}[qx]`; last = 'qx'; }
    if (tpl.fade === 'white' || tpl.motion === 'develop') { fg += `;[${last}]fade=t=in:st=0:d=2.2:color=white[qd]`; last = 'qd'; }
    if (tpl.filter === 'old' && still) { fg += `;[${last}]noise=alls=14:allf=t,eq=brightness='0.02*sin(2*PI*t*7)'[q6]`; last = 'q6'; }
    fg += `;[${last}][${wIdx}:v]overlay=x=W-w-18:y=H-h-22,format=yuv420p[v];`;
    fg += `[${aIdx}:a]afade=t=in:d=0.3,afade=t=out:st=${D - 0.6}:d=0.6,volume=0.9[a]`;
    const NF = Math.round(D * fps);
    let pre = '';
    fg = fg.replace(/\[(\d+):v\]/g, (m, k) => { if (+k >= aIdx) return m; pre += `[${k}:v]loop=loop=${NF - 1}:size=1,setpts=N/${fps}/TB[L${k}];`; return `[L${k}]`; });
    fg = pre + fg;
    const out = path.join(dir, 'out.mp4');
    args.push('-filter_complex', fg, '-map', '[v]', '-map', '[a]', '-r', String(fps), '-c:v', 'libx264', '-preset', process.env.X264_PRESET || 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p', '-profile:v', 'main',
      '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', '-threads', '2', out);
    await run(args);
    const mp4 = await fs.readFile(out);
    await run(['-y', '-loglevel', 'error', '-ss', '2.4', '-i', out, '-frames:v', '1', '-q:v', '3', path.join(dir, 'poster.jpg')]);
    return { mp4, poster: await fs.readFile(path.join(dir, 'poster.jpg')) };
  } finally {
    fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// Watermark + normalise an externally generated image (real AI provider).
export async function brandImage(buf) {
  const img = sharp(buf).rotate().resize(W, H, { fit: 'cover' });
  const wm = await watermark(1.2);
  return img.composite([{ input: wm.png, left: W - wm.w - 24, top: H - wm.h - 28 }]).jpeg({ quality: 88 }).toBuffer();
}
// Watermark an externally generated video (real AI provider).
export async function brandVideo(buf) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prico-'));
  try {
    await fs.writeFile(path.join(dir, 'in.mp4'), buf);
    await fs.writeFile(path.join(dir, 'wm.png'), (await watermark(1)).png);
    const out = path.join(dir, 'out.mp4');
    await run(['-y', '-loglevel', 'error', '-i', path.join(dir, 'in.mp4'), '-i', path.join(dir, 'wm.png'), '-filter_complex',
      `[0:v]scale=${VW}:${VH}:force_original_aspect_ratio=increase,crop=${VW}:${VH}[b];[b][1:v]overlay=W-w-18:H-h-22,format=yuv420p[v]`,
      '-map', '[v]', '-map', '0:a?', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-c:a', 'aac', '-movflags', '+faststart', out]);
    const mp4 = await fs.readFile(out);
    await run(['-y', '-loglevel', 'error', '-ss', '1', '-i', out, '-frames:v', '1', '-q:v', '4', path.join(dir, 'p.jpg')]);
    return { mp4, poster: await fs.readFile(path.join(dir, 'p.jpg')) };
  } finally { fs.rm(dir, { recursive: true, force: true }).catch(() => {}); }
}

function fss_dbg(a) { import('node:fs').then(f => { f.appendFileSync(process.env.FF_DEBUG, JSON.stringify(a) + "\n"); const o = a[a.length - 1]; f.cpSync(path.dirname(o), '/tmp/ffdbg', { recursive: true }); }); }

export async function stickerPng(code, size, rot = 0) {
  if (!/^[0-9a-f-]{2,20}$/.test(code || '')) return null;
  try {
    let img = await sharp(path.join(STICKERS, code + '.svg'), { density: 300 }).resize(size, size).png().toBuffer();
    if (rot) img = await sharp(img).rotate(rot, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    return img;
  } catch { return null; }
}
