// PRICO AI — shared core: state, API client, DOM helpers, icons, sheets, toasts, sharing.
import { t, lang } from './i18n.js';
import { I } from './icons.js';
import { assessServer } from './capabilities.js';
import { acceptServerUrl } from './device.js';
export { I };
export const S = { me: null, cat: null, tok: localStorage.getItem('prico.tok') || '', muted: true, route: 'home', apiBase: '' };
export const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
// Native builds read www/server.json. An empty apiBase does not fall back to the public site.
export let BASE = '';
export const origin = () => NATIVE ? BASE : location.origin;
export const abs = u => !u ? u : /^(https?:|data:|blob:)/.test(u) ? u : BASE + u;
export async function loadServer() {
  let fromFile = '';
  if (NATIVE) {
    try { fromFile = String((await (await fetch('server.json', { cache: 'no-store' })).json()).apiBase || ''); } catch { fromFile = ''; }
  }
  const saved = (() => { try { return localStorage.getItem('prico.server') || ''; } catch { return ''; } })();
  const picked = acceptServerUrl(saved || fromFile);
  BASE = picked.ok ? picked.url : '';
  S.apiBase = BASE;
  S.device = NATIVE && !BASE;
  S.blockedHost = picked.reason === 'blocked_host';
  return BASE;
}
export function useDeviceMode() {
  BASE = '';
  S.apiBase = '';
  S.device = true;
}
export async function generationGate() {
  const health = await api('/api/health');
  const cap = assessServer(health);
  if (!cap.generationSafe) throw Object.assign(new Error('server_unsafe_ai'), { code: 'server_unsafe_ai', health });
  return health;
}
export async function paymentsGate() {
  const health = await api('/api/health');
  const cap = assessServer(health);
  if (!cap.paymentsSafe) throw Object.assign(new Error('server_unsafe_pay'), { code: 'server_unsafe_pay', health });
  return health;
}
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function h(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; }
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const haptic = (n = 8) => { try { navigator.vibrate && navigator.vibrate(n); } catch {} };
export function fmt(n) { n = +n || 0; if (n < 1000) return String(n); if (n < 1e6) return (n / 1e3).toFixed(n < 1e4 ? 1 : 0).replace(/\.0$/, '') + 'K'; return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'; }
export function ago(ts) { const s = (Date.now() - ts) / 1000; if (s < 60) return t('now'); if (s < 3600) return t('ago_m', { n: Math.floor(s / 60) }); if (s < 86400) return t('ago_h', { n: Math.floor(s / 3600) }); return t('ago_d', { n: Math.floor(s / 86400) }); }

export async function api(path, o = {}) {
  const headers = {}; if (S.tok) headers.Authorization = 'Bearer ' + S.tok;
  let body = o.body;
  if (body && !(body instanceof Blob) && !(body instanceof ArrayBuffer)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
  if (o.type) headers['Content-Type'] = o.type;
  let r;
  try { r = await fetch(BASE + path + (path.includes('?') ? '&' : '?') + 'lang=' + lang(), { method: o.method || (body ? 'POST' : 'GET'), headers, body }); }
  catch { throw Object.assign(new Error('network'), { code: 'network' }); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { if (r.status === 401 && S.tok && !o.quiet) { setToken(''); S.me = null; } throw Object.assign(new Error(j.error || 'generic'), { code: j.error || 'generic', status: r.status }); }
  return j;
}
export function upload(file, onProg) {
  return new Promise((res, rej) => {
    const x = new XMLHttpRequest(); x.open('POST', BASE + '/api/uploads');
    if (S.tok) x.setRequestHeader('Authorization', 'Bearer ' + S.tok);
    x.setRequestHeader('Content-Type', file.type || (/\.(mov)$/i.test(file.name) ? 'video/quicktime' : 'video/mp4'));
    x.upload.onprogress = e => e.lengthComputable && onProg && onProg(e.loaded / e.total);
    x.onload = () => { let j = {}; try { j = JSON.parse(x.responseText); } catch {} x.status < 300 ? res(j) : rej(Object.assign(new Error(j.error || 'generic'), { code: j.error || (x.status === 413 ? 'too_large' : 'generic') })); };
    x.onerror = () => rej(Object.assign(new Error('network'), { code: 'network' }));
    x.send(file);
  });
}
export function setToken(tok) { S.tok = tok || ''; tok ? localStorage.setItem('prico.tok', tok) : localStorage.removeItem('prico.tok'); }
export const errMsg = e => { const k = 'e_' + (e && e.code || 'generic'); const s = t(k); return s === k ? t('e_generic') : s; };

let toastT;
export function toast(msg, err) {
  const el = $('#toast'); el.textContent = msg; el.className = err ? 'on err' : 'on'; haptic(err ? [20, 40, 20] : 8);
  clearTimeout(toastT); toastT = setTimeout(() => el.className = '', 2600);
}
export const fail = e => { console.warn(e); toast(errMsg(e), true); };

// Bottom sheets with swipe-down to close
const stack = [];
export function sheet({ title = '', body = '', foot = '', full = false, cls = '', onClose } = {}) {
  const scrim = h('<div class="scrim"></div>');
  const el = h(`<div class="sheet ${full ? 'fullh' : ''} ${cls}"><div class="grab"></div><div class="sh"><h2>${title}</h2><button class="iconBtn x" aria-label="${esc(t('close'))}">${I.close}</button></div><div class="sb"></div>${foot ? '<div class="sf"></div>' : ''}</div>`);
  if (!title) el.querySelector('.sh h2').innerHTML = '';
  const sb = el.querySelector('.sb'); typeof body === 'string' ? sb.innerHTML = body : sb.append(body);
  if (foot) { const sf = el.querySelector('.sf'); typeof foot === 'string' ? sf.innerHTML = foot : sf.append(foot); }
  document.body.append(scrim, el);
  requestAnimationFrame(() => requestAnimationFrame(() => { scrim.classList.add('on'); el.classList.add('on'); }));
  let closed = false;
  const close = () => { if (closed) return; closed = true; stack.splice(stack.indexOf(api_), 1); scrim.classList.remove('on'); el.classList.remove('on'); el.style.transform = ''; $$('video', el).forEach(v => v.pause()); setTimeout(() => { scrim.remove(); el.remove(); }, 400); onClose && onClose(); };
  const api_ = { el, sb, close, $: s => el.querySelector(s) };
  scrim.onclick = close; el.querySelector('.x').onclick = close;
  // drag to dismiss from the handle/header
  let y0 = null, dy = 0;
  const hd = el.querySelector('.sh'), gr = el.querySelector('.grab');
  for (const z of [hd, gr]) {
    z.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; dy = 0; el.style.transition = 'none'; }, { passive: true });
    z.addEventListener('touchmove', e => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); el.style.transform = `translateY(${dy}px)`; }, { passive: true });
    z.addEventListener('touchend', () => { el.style.transition = ''; if (dy > 110) close(); else el.style.transform = ''; y0 = null; });
  }
  stack.push(api_); return api_;
}
export const closeAll = () => [...stack].forEach(s => s.close());
window.addEventListener('popstate', () => { if (stack.length) stack[stack.length - 1].close(); });

export async function copyText(s) {
  try { await navigator.clipboard.writeText(s); return true; } catch {}
  const ta = h('<textarea style="position:fixed;opacity:0"></textarea>'); ta.value = s; document.body.append(ta); ta.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch {} ta.remove(); return ok;
}

// ---------- one-tap sharing ----------
const fileCache = new Map();
export function prepFile(url, type) {
  if (!url) return Promise.resolve(null);
  if (!fileCache.has(url)) fileCache.set(url, fetch(abs(url)).then(r => r.blob()).then(b => new File([b], 'PRICO-AI-' + Date.now().toString(36) + (type === 'video' ? '.mp4' : '.jpg'), { type: type === 'video' ? 'video/mp4' : 'image/jpeg' })).catch(() => null));
  return fileCache.get(url);
}
const APPS = {
  tiktok: { name: 'TikTok', web: 'https://www.tiktok.com/upload' },
  instagram: { name: 'Instagram', web: 'https://www.instagram.com/' },
  shorts: { name: 'YouTube Shorts', web: 'https://www.youtube.com/upload' },
  whatsapp: { name: 'WhatsApp', link: u => 'https://wa.me/?text=' + encodeURIComponent(u) },
  telegram: { name: 'Telegram', link: (u, c) => 'https://t.me/share/url?url=' + encodeURIComponent(u) + '&text=' + encodeURIComponent(c || '') },
};
async function blobToB64(b) { const buf = new Uint8Array(await b.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); return btoa(s); }
export function download(file) { const u = URL.createObjectURL(file); const a = h(`<a href="${u}" download="${file.name}"></a>`); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 30000); }
export async function shareMedia({ url, type, caption = '', app = 'more', link = '' }) {
  const A = APPS[app]; const text = [caption, link].filter(Boolean).join('\n');
  if (caption) copyText(caption);
  const file = await prepFile(url, type);
  if (NATIVE && window.Capacitor.Plugins.Share) {
    try {
      const { Filesystem, Share } = window.Capacitor.Plugins;
      let files;
      if (file && Filesystem) { const w = await Filesystem.writeFile({ path: file.name, data: await blobToB64(file), directory: 'CACHE' }); files = [w.uri]; }
      await Share.share({ title: 'PRICO AI', text, url: files ? undefined : link || undefined, files, dialogTitle: A ? A.name : t('share') });
      return 'shared';
    } catch (e) { if (/cancel/i.test(String(e && e.message))) return 'cancel'; }
  }
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], text: caption, title: 'PRICO AI' }); return 'shared'; }
    catch (e) { if (e && e.name === 'AbortError') return 'cancel'; }
  }
  if (A && A.link && link) { window.open(A.link(link, caption), '_blank'); return 'link'; }
  if (file) download(file);
  if (A && A.web) setTimeout(() => window.open(A.web, '_blank'), 400);
  else if (!file && navigator.share && link) { try { await navigator.share({ url: link, text: caption }); return 'shared'; } catch {} }
  toast(t('shareHint', { app: A ? A.name : '' }).replace('  ', ' '));
  return 'download';
}
export const SHARE_APPS = [
  ['tiktok', 'TikTok', '#000', 'tiktok'], ['instagram', 'Reels', 'linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)', 'instagram'], ['shorts', 'Shorts', '#ff0033', 'youtube'],
  ['whatsapp', 'WhatsApp', '#25d366', 'whatsapp'], ['telegram', 'Telegram', '#2aabee', 'telegram'], ['more', null, '#2a2a3a', 'more'],
];
export function shareRow(get) {
  const row = h('<div class="shareRow"></div>');
  for (const [id, name, bg, ic] of SHARE_APPS) {
    const b = h(`<button data-app="${id}"><span class="ic" style="background:${bg}">${I[ic]}</span>${esc(name || t('more'))}</button>`);
    b.onclick = async () => { haptic(); b.style.opacity = .6; try { await shareMedia({ ...(await get()), app: id }); } finally { b.style.opacity = ''; } };
    row.append(b);
  }
  return row;
}

// ---------- confetti ----------
export function confetti() {
  const c = h('<canvas class="confetti"></canvas>'); document.body.append(c);
  const W = c.width = innerWidth * devicePixelRatio, H = c.height = innerHeight * devicePixelRatio, x = c.getContext('2d');
  const cols = ['#ff2d78', '#8b5cff', '#22d3ee', '#ffcc33', '#2ee59d', '#fff'];
  const ps = Array.from({ length: 140 }, () => ({ x: W / 2 + (Math.random() - .5) * W * .3, y: H * .45, vx: (Math.random() - .5) * 26, vy: -Math.random() * 30 - 10, r: Math.random() * 7 + 4, c: cols[Math.random() * cols.length | 0], a: Math.random() * 6, va: (Math.random() - .5) * .4 }));
  let f = 0; (function step() { x.clearRect(0, 0, W, H); for (const p of ps) { p.vy += .9; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.a += p.va; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); x.restore(); } if (++f < 110) requestAnimationFrame(step); else c.remove(); })();
}
