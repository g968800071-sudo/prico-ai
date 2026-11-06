// Cold-start checks for the native shell. Device mode and a chosen server stay separate.
import { S, origin } from './core.js';
import { exportLocal, planSegments } from './localexport.js';

function still(color, label) {
  const c = document.createElement('canvas');
  c.width = 540; c.height = 960;
  const g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 540, 960);
  g.fillStyle = '#fff'; g.font = '800 64px sans-serif'; g.textAlign = 'center';
  g.fillText(label, 270, 480);
  return c.toDataURL('image/jpeg', 0.85);
}

function waitReady() {
  return new Promise(resolve => {
    const t0 = Date.now();
    const tick = () => {
      if (window.__pricoReady || Date.now() - t0 > 25000) resolve();
      else setTimeout(tick, 200);
    };
    tick();
  });
}

async function playback(blob) {
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto';
  v.src = URL.createObjectURL(blob);
  await new Promise((res, rej) => { v.onloadedmetadata = () => res(); v.onerror = () => rej(new Error('playback')); });
  const info = { videoWidth: v.videoWidth || 0, videoHeight: v.videoHeight || 0, duration: Number.isFinite(v.duration) ? v.duration : 0 };
  URL.revokeObjectURL(v.src);
  return info;
}

function summarize(exp) {
  return { mime: exp.mime, bytes: exp.bytes, header: exp.header, path: exp.path, copyUri: exp.copyUri, music: exp.music, width: exp.width, height: exp.height, fps: exp.fps, frames: exp.frames, duration: exp.duration };
}
async function draftRoundtrip() {
  const id = 'reel-' + Date.now().toString(36);
  const project = { clips: [{ kind: 'video' }, { kind: 'image' }, { kind: 'image' }, { kind: 'image' }], texts: [{ text: 'PRICO' }], captions: [{ text: 'CAP-B' }], music: { id: 'pop' } };
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('prico-ed', 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('drafts')) r.result.createObjectStore('drafts', { keyPath: 'id' }); if (!r.result.objectStoreNames.contains('media')) r.result.createObjectStore('media', { keyPath: 'lid' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  await new Promise((res, rej) => { const x = db.transaction('drafts', 'readwrite'); x.objectStore('drafts').put({ id, updated: Date.now(), project, dur: 1.2 }); x.oncomplete = () => res(); x.onerror = () => rej(x.error); });
  db.close();
  const db2 = await new Promise((res, rej) => { const r = indexedDB.open('prico-ed', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const row = await new Promise((res, rej) => { const q = db2.transaction('drafts', 'readonly').objectStore('drafts').get(id); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  db2.close();
  return { id, read: row?.project?.texts?.[0]?.text === 'PRICO' && row?.project?.captions?.[0]?.text === 'CAP-B' && row?.project?.music?.id === 'pop' && row?.project?.clips?.length === 4 };
}

async function playbackSrc(src) {
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = src;
  await new Promise((res, rej) => { v.onloadedmetadata = () => res(); v.onerror = () => rej(new Error('playback')); });
  return { videoWidth: v.videoWidth || 0, videoHeight: v.videoHeight || 0, duration: Number.isFinite(v.duration) ? v.duration : 0 };
}
async function shareSaved(name) {
  const Filesystem = window.Capacitor?.Plugins?.Filesystem;
  const Share = window.Capacitor?.Plugins?.Share;
  let saved = null;
  if (Filesystem) {
    try {
      const uri = await Filesystem.getUri({ path: name, directory: 'DOCUMENTS' });
      saved = { uri: uri.uri, name };
    } catch (e) { saved = { error: String(e && (e.message || e.code) || e) }; }
  }
  let share = { canShare: false, result: 'unavailable' };
  if (Share?.canShare) {
    try { share.canShare = !!(await Share.canShare()).value; } catch (e) { share.canShare = String(e.message || e); }
  }
  if (Share?.share && saved?.uri) {
    const pending = Share.share({ title: 'PRICO AI', files: [saved.uri], dialogTitle: 'PRICO AI' }).then(() => 'shared').catch(e => /cancel/i.test(String(e && e.message)) ? 'cancel' : String(e && e.message || e));
    share.result = await Promise.race([pending, new Promise(r => setTimeout(() => r('sheet-open'), 1200))]);
  }
  return { saved, share };
}

async function call(base, path, { token, body, raw, type, method } = {}) {
  const headers = { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(raw ? { 'Content-Type': type } : body ? { 'Content-Type': 'application/json' } : {}) };
  const r = await fetch(base + path, { method: method || (body || raw ? 'POST' : 'GET'), headers, body: raw || (body ? JSON.stringify(body) : undefined) });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}

async function onlineFlow() {
  const base = origin();
  const stamp = Date.now().toString(36);
  const a = await call(base, '/api/auth/register', { body: { email: `ada-${stamp}@pricoai.test`, password: 'secret123', name: 'Ada Smoke' } });
  const b = await call(base, '/api/auth/register', { body: { email: `bea-${stamp}@pricoai.test`, password: 'secret123', name: 'Bea Smoke' } });
  if (a.status !== 200 || b.status !== 200) return { ok: false, step: 'register', a: a.status, b: b.status, error: a.data.error || b.data.error || '' };
  const ta = a.data.token, tb = b.data.token;
  const profile = await call(base, '/api/me', { token: ta, method: 'PATCH', body: { bio: 'throwaway profile' } });
  const jpg = await (await fetch(still('#245', 'POST'))).blob();
  const up = await call(base, '/api/media/photo', { token: ta, raw: await jpg.arrayBuffer(), type: 'image/jpeg' });
  const post = up.status === 200 ? await call(base, '/api/posts', { token: ta, body: { mediaId: up.data.media.id, caption: 'throwaway feed' } }) : { status: up.status, data: up.data };
  let feedHit = false;
  if (post.status === 200) {
    let cursor = 0;
    for (let i = 0; i < 6 && !feedHit; i++) {
      const page = await call(base, '/api/feed?cursor=' + cursor);
      feedHit = !!page.data.items?.some(p => p.id === post.data.post.id);
      if (page.data.next == null) break;
      cursor = page.data.next;
    }
  }
  const like = post.status === 200 ? await call(base, '/api/posts/' + post.data.post.id + '/like', { token: tb, body: {} }) : { status: 0, data: {} };
  const conv = await call(base, '/api/convs', { token: ta, body: { users: [b.data.me.handle] } });
  const msg = conv.status === 200 ? await call(base, '/api/convs/' + conv.data.conv.id + '/messages', { token: ta, body: { type: 'text', text: 'hello from smoke' } }) : { status: conv.status, data: conv.data };
  const inbox = await call(base, '/api/inbox', { token: tb });
  const before = await call(base, '/api/me', { token: ta });
  const cat = await call(base, '/api/catalog', { token: ta });
  const tpl = (cat.data.templates || []).find(t => t.kind === 'video' && t.faces === 1 && t.identity === 'single');
  const faceJpg = still('#336699', 'FACE');
  const face = await call(base, '/api/faces', { token: ta, body: { img: faceJpg, consent: true } });
  const faceId = face.data?.faces?.slice(-1)[0]?.id;
  const gen = tpl && faceId ? await call(base, '/api/generate', { token: ta, body: { templateId: tpl.id, faceIds: [faceId] } }) : { status: 0, data: { error: 'no_template' } };
  const after = await call(base, '/api/me', { token: ta });
  const buy = await call(base, '/api/shop/buy', { token: ta, body: { productId: 'plus_month' } });
  const relay = await liveRelay(base, ta, tb);
  const home = document.body.innerText || '';
  const creditsSame = before.data?.wallet?.freeVideos === after.data?.wallet?.freeVideos && before.data?.wallet?.credits === after.data?.wallet?.credits;
  const generateOk = gen.status === 503 && gen.data.error === 'ai_unavailable' && !gen.data.job && creditsSame;
  return {
    ok: profile.status === 200 && post.status === 200 && like.data.liked === true && msg.status === 200 && relay.ok && generateOk && buy.status === 503 && feedHit,
    register: a.status === 200 && b.status === 200,
    profile: profile.data?.bio === 'throwaway profile',
    feed: feedHit,
    like: like.data.liked === true && like.data.likes === 1,
    message: inbox.data?.items?.[0]?.last?.text === 'hello from smoke',
    live: relay,
    generate: { status: gen.status, error: gen.data.error || '', templateId: tpl?.id || '', job: !!gen.data.job, freeVideos: after.data?.wallet?.freeVideos, credits: after.data?.wallet?.credits, creditsUnchanged: creditsSame },
    buy: buy.status,
    deviceModeStillShowing: /On this phone|На этом телефоне/.test(home),
    note: 'Throwaway server only. LIVE frames and audio are a synthetic canvas and oscillator sent between two logged-in clients, not a camera broadcast. No generative model ran.',
  };
}

function wsConnect(base, token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(base.replace(/^http/, 'ws') + '/ws?token=' + encodeURIComponent(token));
    const timer = setTimeout(() => reject(new Error('ws')), 8000);
    ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.t === 'hello') { clearTimeout(timer); resolve({ ws, cid: m.cid }); } };
    ws.onerror = () => reject(new Error('ws'));
  });
}
function waitMsg(ws, type, ms = 4000) {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(null), ms);
    const prev = ws.onmessage;
    ws.onmessage = ev => { const m = JSON.parse(ev.data); if (prev) prev(ev); if (m.t === type) { clearTimeout(timer); resolve(m); } };
  });
}
async function liveRelay(base, tokenHost, tokenViewer) {
  const made = await call(base, '/api/lives', { token: tokenHost, body: { title: 'relay smoke' } });
  if (made.status !== 200) return { ok: false, step: 'create', status: made.status };
  const id = made.data.live.id;
  const host = await wsConnect(base, tokenHost);
  const viewer = await wsConnect(base, tokenViewer);
  const frames = [];
  const audio = [];
  viewer.ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.t === 'live:frame') frames.push(m.d);
    if (m.t === 'live:audio') audio.push(m.d);
  });
  host.ws.send(JSON.stringify({ t: 'live:host', live: id }));
  viewer.ws.send(JSON.stringify({ t: 'live:join', live: id }));
  await waitMsg(viewer.ws, 'live:joined');
  viewer.ws.send(JSON.stringify({ t: 'live:fb' }));
  await new Promise(r => setTimeout(r, 150));
  const paint = color => { const c = document.createElement('canvas'); c.width = 96; c.height = 160; const g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, 96, 160); return c.toDataURL('image/jpeg', 0.8); };
  const pcm = n => { const a = new Int16Array(n); for (let i = 0; i < n; i++) a[i] = Math.round(Math.sin(i / 6) * 12000); const u8 = new Uint8Array(a.buffer); let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };
  for (const color of ['#e10600', '#00a651', '#0047bb']) host.ws.send(JSON.stringify({ t: 'live:frame', d: paint(color) }));
  for (let i = 0; i < 4; i++) host.ws.send(JSON.stringify({ t: 'live:audio', d: pcm(320), seq: i }));
  await new Promise(r => setTimeout(r, 400));
  const got = await call(base, '/api/lives/' + id, { token: tokenHost });
  await call(base, '/api/lives/' + id + '/end', { token: tokenHost, body: {} });
  host.ws.close(); viewer.ws.close();
  const relay = got.data.live?.relay || {};
  return {
    ok: frames.length >= 3 && audio.length >= 3 && relay.frames >= 3 && relay.audioBytes > 100,
    source: 'synthetic-canvas-and-oscillator',
    camera: false,
    microphone: false,
    frames: frames.length,
    audioChunks: audio.length,
    relay,
    webrtc: false,
    hostMediaConnected: true,
  };
}

export async function runDeviceSmoke() {
  try {
  await waitReady();
  const home = (document.body?.innerText || '').slice(0, 700);
  const out = {
    ok: false,
    version: '1.5.0',
    apiBase: S.apiBase || '',
    deviceMode: !!S.device,
    home,
    export: null,
    persistence: null,
    share: null,
    online: { attempted: false, note: 'On this phone does not include an account, the feed, messages, or LIVE.' },
  };
  if (S.apiBase && !S.device) {
    try { out.online = { attempted: true, ...(await onlineFlow()) }; }
    catch (e) { out.online = { attempted: true, ok: false, error: e && (e.message || e.code) || String(e) }; }
    if (out.online.deviceModeStillShowing) out.online.ok = false;
    out.ok = !!out.online.ok;
    return JSON.parse(JSON.stringify(out));
  }
  try {
    const vurl = 'offline/sample-clip.mp4';
    const musicUrl = 'offline/music/pop.m4a';
    const music = { id: 'pop', title: 'Feeling Happy', source: 'bundled-library', fixture: false };
    const width = 1080;
    const height = 1920;
    const withTimeout = (p, ms, code) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error(code), { code })), ms))]);
    const short = await withTimeout(exportLocal({
      clips: [
        { kind: 'video', url: vurl, dur: 1.4 },
        { kind: 'image', url: still('#ff2040', 'STILL'), dur: 1.4 },
      ],
      texts: [{ text: 'PRICO', start: 0, end: 3, y: 0.18 }],
      captions: [{ text: 'on-phone export', start: 0.2, end: 3 }],
      musicUrl, outName: 'prico-short.mp4', fade: 0.3, width, height,
    }), 240000, 'export_timeout');
    const shortPlay = short.playSrc ? await Promise.race([playbackSrc(short.playSrc).catch(() => ({})), new Promise(r => setTimeout(() => r({}), 8000))]) : {};
    out.short = { ...summarize(short), ...shortPlay, musicTrack: music, wallMs: short.wallMs, elapsedMs: short.elapsedMs, engine: short.engine };
    const reelClips = [
      { kind: 'video', url: vurl, dur: 10 },
      { kind: 'image', url: still('#ff2040', 'RED'), dur: 17 },
      { kind: 'image', url: still('#00c853', 'GREEN'), dur: 17 },
      { kind: 'image', url: still('#2962ff', 'BLUE'), dur: 17 },
    ];
    const reelPlan = planSegments(reelClips, 0.4, { maxSpan: 60, maxTotal: 90 });
    const reel = await withTimeout(exportLocal({
      clips: reelClips,
      texts: [{ text: 'PRICO', start: 0, end: 8, y: 0.16 }],
      captions: [
        { text: 'CAP-A', start: 0, end: 20 },
        { text: 'CAP-B', start: 20, end: 40 },
        { text: 'CAP-C', start: 40, end: 70 },
      ],
      musicUrl, outName: 'prico-reel.mp4', fade: 0.4, maxSpan: 60, maxTotal: 90, width, height,
    }), 420000, 'export_timeout');
    const reelPlay = reel.playSrc ? await Promise.race([playbackSrc(reel.playSrc).catch(() => ({})), new Promise(r => setTimeout(() => r({}), 8000))]) : {};
    out.reel = { ...summarize(reel), ...reelPlay, musicTrack: music, plan: reelPlan, wallMs: reel.wallMs, elapsedMs: reel.elapsedMs, engine: reel.engine };
    out.persistence = await draftRoundtrip();
    out.share = await shareSaved('prico-reel.mp4');
    const sizeOk = (m) => {
      const w = m?.videoWidth || m?.width || 0;
      const h = m?.videoHeight || m?.height || 0;
      return m && m.mime === 'video/mp4' && w >= 720 && h >= 1280 && m.duration > 1 && String(m.header || '').includes('66747970') && m.music === 'library';
    };
    out.ok = sizeOk(out.short) && sizeOk({ ...out.reel, duration: out.reel.duration }) && out.reel.duration > 50 && out.persistence.read === true;
    out.export = out.reel;
  } catch (e) {
    out.ok = false;
    out.error = [e && (e.code || e.message) || String(e), e && e.detail].filter(Boolean).join(' ');
  }
  return JSON.parse(JSON.stringify(out));
  } catch (e) {
    return { ok: false, error: String(e && (e.code || e.message) || e) };
  }
}

