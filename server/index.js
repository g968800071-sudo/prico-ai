// PRICO AI server — API + static PWA. Brand: PRICOP.studio
import http from 'node:http';
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as store from './store.js';
import { db, save, id } from './store.js';
import * as catalog from './catalog.js';
import { byId, todayChallenge, loc, LANGS } from './catalog.js';
import * as reels from './reels.js';
import * as music from './music.js';
import { suggest, NICHES } from './captions.js';
import os from 'node:os';
import { check } from './safety.js';
import * as providers from './providers/index.js';
import { demoPhoto } from './render.js';
import * as payments from './payments.js';
import { seed } from './seed.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WWW = path.join(ROOT, 'www');
const PORT = process.env.PORT || 8080;
const PREVIEW_V = 3;
const PUBLIC_URL = process.env.PUBLIC_URL || 'https://prico-ai.onrender.com';
const FREE_VIDEOS = 3, FREE_PHOTOS_DAY = 20, PLUS_VIDEOS_MONTH = 40, FREE_REELS_DAY = 10;

// ---------- helpers ----------
const now = () => Date.now();
const today = () => new Date().toISOString().slice(0, 10);
const month = () => new Date().toISOString().slice(0, 7);
class HttpError extends Error { constructor(code, msg, extra) { super(msg); this.code = code; this.extra = extra; } }
const bad = (msg, code = 400, extra) => { throw new HttpError(code, msg, extra); };

function send(res, code, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  const data = isBuf ? body : JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': isBuf ? 'application/octet-stream' : 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS, ...headers });
  res.end(data);
}
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS' };

async function readBody(req, max = 8 * 1024 * 1024) {
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > max) bad('too_large', 413); chunks.push(c); }
  return Buffer.concat(chunks);
}
async function json(req) { const b = await readBody(req, 200000); try { return b.length ? JSON.parse(b) : {}; } catch { bad('bad_json'); } }

function hashPw(pw, salt = crypto.randomBytes(16).toString('hex')) { return salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex'); }
function verifyPw(pw, h) { const [salt, hx] = h.split(':'); const a = Buffer.from(hx, 'hex'), b = crypto.scryptSync(pw, salt, 32); return a.length === b.length && crypto.timingSafeEqual(a, b); }

function authUser(req) {
  const m = /^Bearer (\w+)$/.exec(req.headers.authorization || '');
  const s = m && db.sessions[m[1]];
  return s ? db.users[s.uid] : null;
}
const need = req => authUser(req) || bad('auth_required', 401);

const STICKERS = fss.readdirSync(path.join(ROOT, 'www/stickers')).filter(f => f.endsWith('.svg')).map(f => f.slice(0, -4));
const mediaUrl = bid => bid ? `/m/${bid}` : null;
function userPub(u, viewer) {
  if (!u) return null;
  const followers = Object.keys(db.follows).filter(k => k.endsWith(':' + u.id)).length;
  const following = Object.keys(db.follows).filter(k => k.startsWith(u.id + ':')).length;
  return { id: u.id, handle: u.handle, name: u.name, bio: u.bio || '', avatar: mediaUrl(u.avatar), verified: !!u.official, followers, following,
    isFollowing: viewer ? !!db.follows[viewer.id + ':' + u.id] : false, isMe: viewer?.id === u.id,
    posts: Object.values(db.posts).filter(p => p.uid === u.id && !p.hidden).length };
}
function wallet(u) {
  const plus = u.plus && u.plus.until > now();
  if (u.plus?.month !== month()) u.plus = { ...(u.plus || {}), month: month(), used: 0 };
  if (u.photoDay !== today()) { u.photoDay = today(); u.photosToday = 0; u.reelsToday = 0; }
  return { freeVideos: u.freeVideos, credits: u.credits, plus, plusUntil: plus ? u.plus.until : null, plusLeft: plus ? Math.max(0, PLUS_VIDEOS_MONTH - (u.plus.used || 0)) : 0,
    photosLeft: plus ? 999 : Math.max(0, FREE_PHOTOS_DAY - (u.photosToday || 0)), reelsLeft: plus ? 999 : Math.max(0, FREE_REELS_DAY - (u.reelsToday || 0)) };
}
function me(u) { return { ...userPub(u, u), email: u.email, lang: u.lang || 'en', wallet: wallet(u), faces: facesOf(u).map(faceOut), onboarded: !!u.onboarded }; }
const facesOf = u => (u.faces || []).map(f => db.faces[f]).filter(Boolean);
const faceOut = f => ({ id: f.id, url: mediaUrl(f.cut || f.img), cut: !!f.cut });

function tplOut(t, lang) {
  return { id: t.id, kind: t.kind, group: t.group, emoji: t.emoji, faces: t.kind === 'video' ? (t.faces || 1) : 1, name: loc(t.name, lang), preview: `/api/preview/${t.id}.jpg?v=${PREVIEW_V}`, cost: t.kind === 'video' ? 1 : 0, hot: !!t.hot, isNew: !!t.isNew, music: t.music || null };
}
function postOut(p, viewer) {
  const t = byId(p.tpl); const u = db.users[p.uid]; const lang = viewer?.lang || 'en';
  const m = db.media[p.media] || {};
  return { id: p.id, type: m.type, url: mediaUrl(m.blob), poster: mediaUrl(m.poster || m.blob), caption: p.caption, createdAt: p.createdAt,
    user: { handle: u?.handle, name: u?.name, avatar: mediaUrl(u?.avatar), verified: !!u?.official, id: u?.id, isFollowing: viewer ? !!db.follows[viewer.id + ':' + p.uid] : false },
    tpl: t ? { id: t.id, name: loc(t.name, lang), emoji: t.emoji, kind: t.kind, faces: t.kind === 'video' ? (t.faces || 1) : 1 } : (p.reel ? { id: 'reel', name: 'Reels', emoji: '🎬', kind: 'reel' } : null), reel: !!p.reel,
    likes: p.likes || 0, liked: viewer ? !!db.likes[viewer.id + ':' + p.id] : false, comments: p.comments || 0, shares: p.shares || 0, challenge: p.challenge || null, demo: !!m.demo };
}
function handleFrom(name) {
  const tr = { а: 'a', б: 'b', в: 'v', г: 'g', ґ: 'g', д: 'd', е: 'e', ё: 'e', є: 'ye', ж: 'zh', з: 'z', и: 'i', і: 'i', ї: 'yi', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
  let h = String(name).toLowerCase().split('').map(c => tr[c] ?? c).join('').replace(/[^a-z0-9_]/g, '').slice(0, 16) || 'user';
  const taken = new Set(Object.values(db.users).map(u => u.handle));
  let x = h, i = 1; while (taken.has(x)) x = h + (++i);
  return x;
}

// ---------- jobs ----------
const jobs = new Map(); const queue = []; let running = 0;
const MAX_PAR = Number(process.env.JOB_CONCURRENCY || 1);
function pump() {
  while (running < MAX_PAR && queue.length) {
    const j = queue.shift(); running++; j.status = 'running'; j.started = now();
    runJob(j).catch(e => { console.error('[job]', j.id, e.message); j.status = 'error'; j.error = 'generation_failed'; refund(j); })
      .finally(() => { running--; save(); pump(); });
  }
}
function refund(j) { const u = db.users[j.uid]; if (!u || !j.charge) return; if (j.charge === 'reel') u.reelsToday--; else if (j.charge === 'free') u.freeVideos++; else if (j.charge === 'credit') u.credits++; else if (j.charge === 'plus') u.plus.used--; else if (j.charge === 'photo') u.photosToday--; }
async function runJob(j) {
  if (j.type === 'reel') return runReel(j);
  const t = byId(j.tpl); const u = db.users[j.uid];
  const faces = [];
  for (const fid of j.faces) { const f = db.faces[fid]; if (!f) continue; faces.push({ img: (await store.getBlob(f.img))?.data, cut: f.cut ? (await store.getBlob(f.cut))?.data : null }); }
  if (!faces.length || !faces[0].img) throw new Error('no faces');
  const prov = providers.current();
  const o = { lang: u.lang || 'en', prompt: j.prompt, overlay: j.overlay };
  const r = t.kind === 'video' ? await prov.video(t, faces, o) : await prov.photo(t, faces, o);
  const blob = await store.putBlob(r.data, r.mime);
  const poster = r.poster ? await store.putBlob(r.poster, 'image/jpeg') : null;
  const mid = id(10);
  db.media[mid] = { id: mid, uid: u.id, type: t.kind, blob, poster, tpl: t.id, prompt: j.prompt || '', createdAt: now(), demo: prov.name === 'demo' };
  j.status = 'done'; j.media = mid; j.finished = now();
}
async function runReel(j) {
  const u = db.users[j.uid];
  const items = [];
  for (const uid of j.uploads) { const up = uploads.get(uid); if (up && up.uid === u.id) items.push({ kind: up.kind, path: up.path }); }
  const faces = [];
  if (!items.length) for (const f of facesOf(u).slice(0, 3)) faces.push({ img: (await store.getBlob(f.img))?.data, cut: f.cut ? (await store.getBlob(f.cut))?.data : null });
  const r = await reels.render({ items, faces, niche: j.niche, idea: j.prompt, musicId: j.musicId, lang: u.lang || 'en', overlay: j.overlay, subtitles: j.subtitles !== false, lines: j.lines });
  const blob = await store.putBlob(r.mp4, 'video/mp4'); const poster = await store.putBlob(r.poster, 'image/jpeg');
  const mid = id(10);
  db.media[mid] = { id: mid, uid: u.id, type: 'video', reel: true, blob, poster, tpl: null, niche: j.niche, prompt: j.prompt || '', createdAt: now(), duration: r.duration, captions: r.captions };
  j.status = 'done'; j.media = mid; j.finished = now();
}
function jobOut(j) {
  const eta = (j.type === 'reel' ? 10 + 4 * (j.uploads.length || 4) : (providers.current().etaSec[byId(j.tpl).kind] || 10)) * 1000;
  const ahead = j.status === 'queued' ? queue.indexOf(j) + running : 0;
  const prog = j.status === 'done' ? 1 : j.status === 'running' ? Math.min(0.95, (now() - j.started) / eta) : 0;
  return { id: j.id, status: j.status, progress: prog, ahead, error: j.error, media: j.media ? mediaOut(db.media[j.media]) : null };
}
const mediaOut = m => m && ({ id: m.id, type: m.type, url: mediaUrl(m.blob), poster: mediaUrl(m.poster || m.blob), tpl: m.tpl, createdAt: m.createdAt, posted: !!m.post, demo: !!m.demo, reel: !!m.reel, captions: m.captions || null, duration: m.duration || null });

// ---------- preview thumbnails (template cards) ----------
const previewCache = new Map();
async function preview(tid) {
  if (previewCache.has(tid)) return previewCache.get(tid);
  const t = byId(tid); if (!t) return null;
  const pre = path.join(ROOT, 'assets/previews', tid + '.jpg');
  let buf;
  try { buf = await fs.readFile(pre); } catch {
    const faces = [];
    for (let i = 1; i <= 3; i++) faces.push({ img: await fs.readFile(path.join(ROOT, `assets/seed/face${i}.jpg`)), cut: await fs.readFile(path.join(ROOT, `assets/seed/cut${i}.png`)).catch(() => null) });
    if (t.kind === 'video') { const v = await (await import('./render.js')).demoVideo(t, faces, 'en'); buf = v.poster; }
    else buf = await demoPhoto(t, faces, 'en');
  }
  const sharp = (await import('sharp')).default;
  buf = await sharp(buf).resize(360, 640, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer();
  previewCache.set(tid, buf);
  return buf;
}

// ---------- feed ----------
function feed(tab, viewer, cursor = 0, limit = 8) {
  let list = Object.values(db.posts).filter(p => !p.hidden && db.media[p.media]);
  if (tab === 'following') { if (!viewer) return { items: [], next: null }; list = list.filter(p => db.follows[viewer.id + ':' + p.uid] || p.uid === viewer.id).sort((a, b) => b.createdAt - a.createdAt); }
  else if (tab === 'challenge') { const d = todayChallenge().day; list = list.filter(p => p.challenge === d || p.evergreen).sort((a, b) => (b.likes || 0) - (a.likes || 0) || b.createdAt - a.createdAt); }
  else {
    const score = p => ((p.likes || 0) * 2 + (p.comments || 0) * 3 + (p.shares || 0) * 4 + 6) / Math.pow((now() - p.createdAt) / 3600000 + 2, 0.9);
    list.sort((a, b) => score(b) - score(a));
  }
  const items = list.slice(cursor, cursor + limit).map(p => postOut(p, viewer));
  return { items, next: cursor + limit < list.length ? cursor + limit : null };
}

// ---------- routes ----------
const routes = [];
const r = (method, pattern, fn) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn });

r('GET', '/api/health', async () => ({ ok: true, provider: providers.current().name, store: store.backend(), payments: payments.mode(), users: Object.keys(db.users).length, posts: Object.keys(db.posts).length }));

r('POST', '/api/auth/register', async (req) => {
  const { email, password, name, lang } = await json(req);
  const em = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) bad('bad_email');
  if (String(password || '').length < 6) bad('weak_password');
  const nm = String(name || '').trim().slice(0, 40) || em.split('@')[0];
  if (!check(nm).ok) bad('unsafe_text');
  if (Object.values(db.users).some(u => u.email === em)) bad('email_taken', 409);
  const u = { id: id(8), email: em, pw: hashPw(String(password)), name: nm, handle: handleFrom(nm), lang: LANGS.includes(lang) ? lang : 'en', createdAt: now(), freeVideos: FREE_VIDEOS, credits: 0, faces: [] };
  db.users[u.id] = u;
  const tok = crypto.randomBytes(24).toString('hex'); db.sessions[tok] = { uid: u.id, at: now() };
  save(); return { token: tok, me: me(u) };
});
r('POST', '/api/auth/login', async (req) => {
  const { email, password } = await json(req);
  const u = Object.values(db.users).find(x => x.email === String(email || '').trim().toLowerCase());
  if (!u || !u.pw || !verifyPw(String(password || ''), u.pw)) bad('bad_login', 401);
  const tok = crypto.randomBytes(24).toString('hex'); db.sessions[tok] = { uid: u.id, at: now() };
  save(); return { token: tok, me: me(u) };
});
r('POST', '/api/auth/logout', async (req) => { const m = /^Bearer (\w+)$/.exec(req.headers.authorization || ''); if (m) delete db.sessions[m[1]]; save(); return { ok: true }; });

r('GET', '/api/me', async (req) => me(need(req)));
r('PATCH', '/api/me', async (req) => {
  const u = need(req); const b = await json(req);
  if (b.name !== undefined) { const n = String(b.name).trim().slice(0, 40); if (!n || !check(n).ok) bad('unsafe_text'); u.name = n; }
  if (b.bio !== undefined) { const t = String(b.bio).slice(0, 160); if (!check(t).ok) bad('unsafe_text'); u.bio = t; }
  if (b.lang && LANGS.includes(b.lang)) u.lang = b.lang;
  if (b.onboarded) u.onboarded = true;
  save(); return me(u);
});
r('POST', '/api/me/avatar', async (req) => {
  const u = need(req); const buf = await readBody(req, 3e6);
  const sharp = (await import('sharp')).default;
  const img = await sharp(buf).rotate().resize(256, 256, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer().catch(() => bad('bad_image'));
  if (u.avatar) store.delBlob(u.avatar).catch(() => {});
  u.avatar = await store.putBlob(img, 'image/jpeg'); save(); return me(u);
});

// Faces: multipart-free — client sends JSON {img: dataURL jpeg, cut: dataURL png|null, consent:true}
r('POST', '/api/faces', async (req) => {
  const u = need(req); const b = JSON.parse((await readBody(req, 6e6)).toString() || '{}');
  if (!b.consent) bad('consent_required');
  if ((u.faces || []).length >= 3) bad('max_faces');
  const sharp = (await import('sharp')).default;
  const dec = s => { const m = /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(s || ''); return m ? Buffer.from(m[2], 'base64') : null; };
  const img = dec(b.img); if (!img) bad('bad_image');
  const jpg = await sharp(img).rotate().resize(640, 640, { fit: 'cover' }).jpeg({ quality: 88 }).toBuffer().catch(() => bad('bad_image'));
  let cut = null; const c = dec(b.cut);
  if (c) cut = await sharp(c).resize(640, 640, { fit: 'cover' }).png().toBuffer().catch(() => null);
  const f = { id: id(8), uid: u.id, img: await store.putBlob(jpg, 'image/jpeg'), cut: cut ? await store.putBlob(cut, 'image/png') : null, createdAt: now() };
  db.faces[f.id] = f; u.faces = [...(u.faces || []), f.id];
  if (!u.avatar) u.avatar = await store.putBlob(await sharp(jpg).resize(256, 256).jpeg().toBuffer(), 'image/jpeg');
  save(); return me(u);
});
r('DELETE', '/api/faces/:fid', async (req, p) => {
  const u = need(req); const f = db.faces[p.fid]; if (!f || f.uid !== u.id) bad('not_found', 404);
  u.faces = u.faces.filter(x => x !== f.id); delete db.faces[f.id];
  store.delBlob(f.img).catch(() => {}); if (f.cut) store.delBlob(f.cut).catch(() => {});
  save(); return me(u);
});

r('GET', '/api/catalog', async (req) => {
  const u = authUser(req); const q = new URL(req.url, 'http://x').searchParams.get('lang'); const lang = LANGS.includes(q) ? q : (u?.lang || 'en');
  const ch = todayChallenge();
  return { groups: Object.fromEntries(Object.entries(catalog.GROUPS).map(([k, v]) => [k, loc(v, lang)])), templates: catalog.ALL.map(t => tplOut(t, lang)),
    challenge: { day: ch.day, name: loc(ch.name, lang), tpl: ch.tpl }, provider: providers.current().name,
    niches: Object.entries(NICHES).map(([k, v]) => ({ id: k, emoji: v.emoji, music: v.music })), music: music.list(),
    stickers: STICKERS };
});
r('GET', '/api/preview/:file', async (req, p, res) => {
  const buf = await preview(p.file.replace(/\.jpg$/, '')); if (!buf) bad('not_found', 404);
  send(res, 200, buf, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' });
});

r('POST', '/api/generate', async (req) => {
  const u = need(req); const b = await json(req);
  const t = byId(b.templateId); if (!t) bad('bad_template');
  const prompt = String(b.prompt || '').slice(0, 200);
  if (!check(prompt).ok) bad('unsafe_prompt', 422);
  const overlay = cleanOverlay(b.overlay);
  const want = t.kind === 'video' ? (t.faces || 1) : 1;
  const fids = (Array.isArray(b.faceIds) ? b.faceIds : []).filter(f => db.faces[f] && (db.faces[f].uid === u.id || (db.faces[f].shared))).slice(0, want);
  if (!fids.length) bad('no_face');
  while (fids.length < want) fids.push(fids[fids.length - 1]);
  if ([...jobs.values()].some(j => j.uid === u.id && (j.status === 'queued' || j.status === 'running'))) bad('busy', 429);
  const w = wallet(u); let charge;
  if (t.kind === 'video') {
    if (w.plus && w.plusLeft > 0) { u.plus.used++; charge = 'plus'; }
    else if (u.freeVideos > 0) { u.freeVideos--; charge = 'free'; }
    else if (u.credits > 0) { u.credits--; charge = 'credit'; }
    else bad('no_credits', 402);
  } else {
    if (!w.plus && w.photosLeft <= 0) bad('photo_limit', 402);
    u.photosToday = (u.photosToday || 0) + 1; charge = 'photo';
  }
  const j = { id: id(10), uid: u.id, tpl: t.id, faces: fids, prompt, overlay, status: 'queued', created: now(), charge };
  jobs.set(j.id, j); queue.push(j); save(); pump();
  return { job: jobOut(j), wallet: wallet(u) };
});
r('GET', '/api/jobs/:jid', async (req, p) => { const u = need(req); const j = jobs.get(p.jid); if (!j || j.uid !== u.id) bad('not_found', 404); return { job: jobOut(j), wallet: wallet(u) }; });
r('GET', '/api/library', async (req) => { const u = need(req); return { items: Object.values(db.media).filter(m => m.uid === u.id).sort((a, b) => b.createdAt - a.createdAt).map(mediaOut) }; });

function cleanOverlay(o) {
  if (!o || typeof o !== 'object') return null;
  const text = String(o.text || '').slice(0, 120); if (text && !check(text).ok) bad('unsafe_text', 422);
  const stickers = (Array.isArray(o.stickers) ? o.stickers : []).slice(0, 12).filter(s => STICKERS.includes(s.c)).map(s => ({ c: s.c, x: +s.x || .5, y: +s.y || .5, s: +s.s || .18, r: +s.r || 0 }));
  if (!text && !stickers.length) return null;
  return { text, pos: ['top', 'center', 'bottom'].includes(o.pos) ? o.pos : 'bottom', color: /^#[0-9a-f]{6}$/i.test(o.color || '') ? o.color : '#ffffff', stickers };
}

// ---- uploads for the Reels maker (kept on the instance's temp disk for 3 h; only the result is stored) ----
const UP_DIR = path.join(os.tmpdir(), 'prico-uploads'); fss.mkdirSync(UP_DIR, { recursive: true });
const uploads = new Map();
setInterval(() => { for (const [k, v] of uploads) if (now() - v.at > 3 * 3600000) { uploads.delete(k); fs.rm(v.path, { force: true }).catch(() => {}); } }, 600000).unref();
r('POST', '/api/uploads', async (req) => {
  const u = need(req);
  const ct = String(req.headers['content-type'] || '');
  const kind = ct.startsWith('video/') ? 'video' : ct.startsWith('image/') ? 'image' : bad('bad_type');
  if ([...uploads.values()].filter(x => x.uid === u.id).length >= 30) bad('too_many_uploads', 429);
  const buf = await readBody(req, kind === 'video' ? 60e6 : 15e6);
  const uid = id(10); const ext = kind === 'video' ? (ct.includes('quicktime') ? '.mov' : ct.includes('webm') ? '.webm' : '.mp4') : '.img';
  const file = path.join(UP_DIR, uid + ext); await fs.writeFile(file, buf);
  let info = { duration: 0 };
  if (kind === 'video') { info = await reels.probe(file); if (!info.video) { fs.rm(file, { force: true }); bad('bad_video'); } if (info.duration > 180) { fs.rm(file, { force: true }); bad('video_too_long'); } }
  else { const sharp = (await import('sharp')).default; const m = await sharp(file).metadata().catch(() => null); if (!m) { fs.rm(file, { force: true }); bad('bad_image'); } }
  uploads.set(uid, { uid: u.id, kind, path: file, at: now(), duration: info.duration });
  return { id: uid, kind, duration: info.duration };
});
r('POST', '/api/reels', async (req) => {
  const u = need(req); const b = await json(req);
  const ups = (Array.isArray(b.uploads) ? b.uploads : []).filter(x => uploads.get(x)?.uid === u.id).slice(0, 12);
  const prompt = String(b.idea || '').slice(0, 300); if (!check(prompt).ok) bad('unsafe_prompt', 422);
  const lines = (Array.isArray(b.lines) ? b.lines : []).map(x => String(x).slice(0, 80)).slice(0, 12);
  if (lines.some(l => !check(l).ok)) bad('unsafe_text', 422);
  if (!ups.length && !facesOf(u).length) bad('need_media');
  if ([...jobs.values()].some(j => j.uid === u.id && (j.status === 'queued' || j.status === 'running'))) bad('busy', 429);
  const w = wallet(u); if (!w.plus && w.reelsLeft <= 0) bad('reel_limit', 402);
  u.reelsToday = (u.reelsToday || 0) + 1;
  const j = { id: id(10), type: 'reel', uid: u.id, uploads: ups, niche: NICHES[b.niche] ? b.niche : 'funny', musicId: b.musicId, prompt, lines, subtitles: b.subtitles !== false, overlay: cleanOverlay(b.overlay), status: 'queued', created: now(), charge: 'reel' };
  jobs.set(j.id, j); queue.push(j); save(); pump();
  return { job: jobOut(j), wallet: wallet(u) };
});
r('GET', '/api/captions', async (req) => {
  const q = new URL(req.url, 'http://x').searchParams; const u = authUser(req);
  const lang = LANGS.includes(q.get('lang')) ? q.get('lang') : (u?.lang || 'en');
  const m = q.get('media') && db.media[q.get('media')];
  return suggest({ lang, templateId: q.get('tpl') || m?.tpl, niche: q.get('niche') || m?.niche, idea: q.get('idea') || m?.prompt });
});
r('GET', '/api/music/:file', async (req, p, res) => {
  const f = await music.trackFile(p.file.replace(/\.m4a$/, ''));
  const buf = await fs.readFile(f);
  send(res, 200, buf, { 'Content-Type': 'audio/mp4', 'Cache-Control': 'public, max-age=604800', 'Accept-Ranges': 'bytes' });
});
r('POST', '/api/admin/templates', async (req) => {
  if (!process.env.ADMIN_TOKEN || req.headers['x-admin-token'] !== process.env.ADMIN_TOKEN) bad('forbidden', 403);
  const n = catalog.load(JSON.parse((await readBody(req, 2e6)).toString())); previewCache.clear(); return { ok: true, templates: n };
});

r('POST', '/api/posts', async (req) => {
  const u = need(req); const b = await json(req);
  const m = db.media[b.mediaId]; if (!m || m.uid !== u.id) bad('not_found', 404);
  if (m.post) return { post: postOut(db.posts[m.post], u) };
  const caption = String(b.caption || '').slice(0, 220); if (!check(caption).ok) bad('unsafe_text', 422);
  const ch = todayChallenge();
  const p = { id: id(9), uid: u.id, media: m.id, tpl: m.tpl, reel: !!m.reel, caption, createdAt: now(), likes: 0, comments: 0, shares: 0, challenge: b.challenge ? ch.day : null, reports: [] };
  db.posts[p.id] = p; m.post = p.id; save();
  return { post: postOut(p, u) };
});
r('GET', '/api/feed', async (req) => { const q = new URL(req.url, 'http://x').searchParams; return feed(q.get('tab') || 'foryou', authUser(req), Number(q.get('cursor') || 0)); });
r('GET', '/api/posts/:pid', async (req, p) => { const x = db.posts[p.pid]; if (!x || x.hidden) bad('not_found', 404); return { post: postOut(x, authUser(req)) }; });
r('DELETE', '/api/posts/:pid', async (req, p) => { const u = need(req); const x = db.posts[p.pid]; if (!x || x.uid !== u.id) bad('not_found', 404); delete db.posts[x.id]; if (db.media[x.media]) db.media[x.media].post = null; save(); return { ok: true }; });
r('POST', '/api/posts/:pid/like', async (req, p) => {
  const u = need(req); const x = db.posts[p.pid]; if (!x) bad('not_found', 404);
  const k = u.id + ':' + x.id;
  if (db.likes[k]) { delete db.likes[k]; x.likes = Math.max(0, (x.likes || 0) - 1); } else { db.likes[k] = now(); x.likes = (x.likes || 0) + 1; }
  save(); return { liked: !!db.likes[k], likes: x.likes };
});
r('POST', '/api/posts/:pid/share', async (req, p) => { const x = db.posts[p.pid]; if (!x) bad('not_found', 404); x.shares = (x.shares || 0) + 1; save(); return { shares: x.shares, url: `${PUBLIC_URL}/p/${x.id}` }; });
r('GET', '/api/posts/:pid/comments', async (req, p) => {
  const viewer = authUser(req);
  return { items: Object.values(db.comments).filter(c => c.post === p.pid && !c.hidden).sort((a, b) => a.createdAt - b.createdAt).map(c => ({ id: c.id, text: c.text, createdAt: c.createdAt, user: (({ handle, name, avatar, id }) => ({ handle, name, id, avatar: mediaUrl(avatar) }))(db.users[c.uid] || {}), mine: viewer?.id === c.uid })) };
});
r('POST', '/api/posts/:pid/comments', async (req, p) => {
  const u = need(req); const x = db.posts[p.pid]; if (!x) bad('not_found', 404);
  const { text } = await json(req); const t = String(text || '').trim().slice(0, 300);
  if (!t) bad('empty'); if (!check(t).ok) bad('unsafe_text', 422);
  const c = { id: id(9), post: x.id, uid: u.id, text: t, createdAt: now() }; db.comments[c.id] = c; x.comments = (x.comments || 0) + 1; save();
  return { comment: { id: c.id, text: c.text, createdAt: c.createdAt, user: { handle: u.handle, name: u.name, id: u.id, avatar: mediaUrl(u.avatar) }, mine: true }, comments: x.comments };
});
r('POST', '/api/posts/:pid/report', async (req, p) => {
  const u = authUser(req); const x = db.posts[p.pid]; if (!x) bad('not_found', 404);
  const { reason } = await json(req);
  x.reports = x.reports || []; const who = u?.id || 'anon:' + (req.socket.remoteAddress || '');
  if (!x.reports.includes(who)) x.reports.push(who);
  db.reports.push({ post: x.id, by: who, reason: String(reason || 'other').slice(0, 40), at: now() });
  if (x.reports.length >= 3) x.hidden = true; // auto-hide pending review
  save(); return { ok: true, hidden: !!x.hidden };
});

r('GET', '/api/users/:handle', async (req, p) => {
  const viewer = authUser(req); const u = Object.values(db.users).find(x => x.handle === p.handle); if (!u) bad('not_found', 404);
  const posts = Object.values(db.posts).filter(x => x.uid === u.id && !x.hidden).sort((a, b) => b.createdAt - a.createdAt).map(x => postOut(x, viewer));
  return { user: userPub(u, viewer), posts };
});
r('POST', '/api/users/:handle/follow', async (req, p) => {
  const me_ = need(req); const u = Object.values(db.users).find(x => x.handle === p.handle); if (!u || u.id === me_.id) bad('not_found', 404);
  const k = me_.id + ':' + u.id; if (db.follows[k]) delete db.follows[k]; else db.follows[k] = now();
  save(); return { user: userPub(u, me_) };
});

r('GET', '/api/challenge', async (req) => {
  const viewer = authUser(req); const lang = viewer?.lang || 'en'; const ch = todayChallenge();
  const list = Object.values(db.posts).filter(p => (p.challenge === ch.day || p.evergreen) && !p.hidden).sort((a, b) => (b.likes || 0) - (a.likes || 0));
  const end = new Date(ch.day + 'T23:59:59Z').getTime();
  const t = byId(ch.tpl);
  return { day: ch.day, name: loc(ch.name, lang), tpl: tplOut(t, lang), endsAt: end, entries: list.length, top: list.slice(0, 20).map(p => postOut(p, viewer)) };
});

r('GET', '/api/shop', async (req) => ({ mode: payments.mode(), products: payments.PRODUCTS, wallet: authUser(req) ? wallet(authUser(req)) : null }));
r('POST', '/api/shop/buy', async (req) => {
  const u = need(req); const { productId } = await json(req);
  const out = await payments.buy(u, productId, { publicUrl: PUBLIC_URL });
  save(); return { ...out, wallet: wallet(u) };
});

// Share page with Open Graph tags (nice link previews in Telegram/WhatsApp/Instagram)
async function sharePage(pid, res) {
  const p = db.posts[pid]; let html = await fs.readFile(path.join(WWW, 'index.html'), 'utf8');
  if (p && !p.hidden) {
    const m = db.media[p.media] || {}; const u = db.users[p.uid] || {};
    const t = `${u.name || 'PRICO AI'} · PRICO AI`; const img = `${PUBLIC_URL}/m/${m.poster || m.blob}`;
    const tags = `<meta property="og:title" content="${esc(t)}"><meta property="og:description" content="${esc(p.caption || 'Make the same one starring you — PRICO AI')}"><meta property="og:image" content="${img}"><meta name="twitter:card" content="summary_large_image">` + (m.type === 'video' ? `<meta property="og:video" content="${PUBLIC_URL}/m/${m.blob}"><meta property="og:video:type" content="video/mp4">` : '');
    html = html.replace('</head>', tags + '</head>');
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }); res.end(html);
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Media with HTTP Range support (required by iOS Safari for <video>)
async function serveMedia(req, res, bid) {
  const b = await store.getBlob(bid); if (!b) { res.writeHead(404, CORS); return res.end(); }
  const total = b.data.length; const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  const h = { 'Content-Type': b.mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=31536000, immutable', ...CORS };
  if (range) {
    let s = range[1] === '' ? total - Number(range[2]) : Number(range[1]); let e = range[2] === '' || range[1] === '' ? total - 1 : Math.min(Number(range[2]), total - 1);
    if (s < 0) s = 0; if (s > e) { res.writeHead(416, { 'Content-Range': `bytes */${total}`, ...CORS }); return res.end(); }
    res.writeHead(206, { ...h, 'Content-Range': `bytes ${s}-${e}/${total}`, 'Content-Length': e - s + 1 });
    return res.end(req.method === 'HEAD' ? undefined : b.data.subarray(s, e + 1));
  }
  res.writeHead(200, { ...h, 'Content-Length': total }); res.end(req.method === 'HEAD' ? undefined : b.data);
}

// Static files (gzip + cache)
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.tflite': 'application/octet-stream', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.txt': 'text/plain' };
const gzCache = new Map();
async function serveStatic(req, res, pathname) {
  let f = path.normalize(path.join(WWW, decodeURIComponent(pathname)));
  if (!f.startsWith(WWW)) { res.writeHead(403); return res.end(); }
  let st = await fs.stat(f).catch(() => null);
  if (st?.isDirectory()) { f = path.join(f, 'index.html'); st = await fs.stat(f).catch(() => null); }
  if (!st) { if (path.extname(pathname)) { res.writeHead(404); return res.end('not found'); } f = path.join(WWW, 'index.html'); st = await fs.stat(f); }
  const ext = path.extname(f); const type = TYPES[ext] || 'application/octet-stream';
  const immutable = /\/vendor\/|\/assets\//.test(f);
  const h = { 'Content-Type': type, 'Cache-Control': ext === '.html' || f.endsWith('sw.js') ? 'no-cache' : immutable ? 'public, max-age=604800' : 'public, max-age=300', ...CORS };
  const gz = /gzip/.test(req.headers['accept-encoding'] || '') && /text|json|javascript|wasm|svg|manifest|octet/.test(type) && st.size > 1024;
  if (gz) {
    const k = f + st.mtimeMs; let z = gzCache.get(k);
    if (!z) { z = zlib.gzipSync(await fs.readFile(f), { level: 9 }); gzCache.set(k, z); }
    res.writeHead(200, { ...h, 'Content-Encoding': 'gzip', 'Content-Length': z.length, Vary: 'Accept-Encoding' }); return res.end(z);
  }
  res.writeHead(200, { ...h, 'Content-Length': st.size }); fss.createReadStream(f).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
    if (url.pathname.startsWith('/m/')) return await serveMedia(req, res, url.pathname.slice(3));
    if (url.pathname.startsWith('/p/')) return await sharePage(url.pathname.slice(3), res);
    if (url.pathname.startsWith('/api/')) {
      for (const rt of routes) {
        if (rt.method !== req.method) continue;
        const m = rt.re.exec(url.pathname); if (!m) continue;
        const out = await rt.fn(req, m.groups || {}, res);
        if (out !== undefined && !res.headersSent) send(res, 200, out);
        return;
      }
      return send(res, 404, { error: 'not_found' });
    }
    return await serveStatic(req, res, url.pathname);
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    if (!res.headersSent) send(res, typeof e.code === 'number' ? e.code : 500, { error: (e instanceof HttpError || typeof e.code === 'number') ? e.message : 'server_error', ...(e.extra || {}) });
  }
});

await store.init();
await seed();
server.listen(PORT, () => console.log(`PRICO AI on :${PORT} provider=${providers.current().name} store=${store.backend()} payments=${payments.mode()}`));
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, async () => { try { await store.flushNow(); } catch {} process.exit(0); });
