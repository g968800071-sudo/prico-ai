// Cold-start checks for the native shell. Device mode and a chosen server stay separate.
import { S, origin } from './core.js';
import { exportLocal } from './localexport.js';

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
  const info = { videoWidth: v.videoWidth, videoHeight: v.videoHeight, duration: v.duration };
  URL.revokeObjectURL(v.src);
  return info;
}

async function draftRoundtrip() {
  const id = 'smoke-' + Date.now().toString(36);
  const project = { clips: [{ kind: 'image', note: 'smoke' }], texts: [{ text: 'PRICO' }], captions: [{ text: 'on phone' }] };
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
  return { id, read: row?.project?.texts?.[0]?.text === 'PRICO' && row?.project?.captions?.[0]?.text === 'on phone' };
}

async function shareAndSave(blob) {
  const Filesystem = window.Capacitor?.Plugins?.Filesystem;
  const Share = window.Capacitor?.Plugins?.Share;
  let saved = null;
  if (Filesystem) {
    try {
      const uri = await Filesystem.getUri({ path: 'prico-export.mp4', directory: 'DOCUMENTS' });
      const back = await Filesystem.readFile({ path: 'prico-export.mp4', directory: 'DOCUMENTS' });
      const raw = atob(back.data || '').length;
      saved = { uri: uri.uri, bytes: raw };
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
  return { saved, share, blobBytes: blob.size };
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
  const live = await call(base, '/api/lives', { token: ta, body: { title: 'smoke live' } });
  const liveGet = live.status === 200 ? await call(base, '/api/lives/' + live.data.live.id, { token: ta }) : { status: live.status, data: {} };
  if (live.status === 200) await call(base, '/api/lives/' + live.data.live.id + '/end', { token: ta, body: {} });
  const gen = await call(base, '/api/generate', { token: ta, body: { templateId: 'none', faceIds: [] } });
  const buy = await call(base, '/api/shop/buy', { token: ta, body: { productId: 'plus_month' } });
  const home = document.body.innerText || '';
  return {
    ok: profile.status === 200 && post.status === 200 && like.data.liked === true && msg.status === 200 && liveGet.status === 200 && gen.status >= 400 && !gen.data.job && buy.status === 503 && feedHit,
    register: a.status === 200 && b.status === 200,
    profile: profile.data?.bio === 'throwaway profile',
    feed: feedHit,
    like: like.data.liked === true && like.data.likes === 1,
    message: inbox.data?.items?.[0]?.last?.text === 'hello from smoke',
    live: { created: live.status === 200, fetched: liveGet.status === 200, hostMediaConnected: false },
    generate: { status: gen.status, error: gen.data.error || '' },
    buy: buy.status,
    deviceModeStillShowing: /On this phone|На этом телефоне/.test(home),
    note: 'Throwaway server only. LIVE room was created and read back. No camera broadcast and no generative model ran.',
  };
}

export async function runDeviceSmoke() {
  await waitReady();
  const home = (document.body?.innerText || '').slice(0, 700);
  const out = {
    ok: false,
    version: '1.4.0',
    apiBase: S.apiBase || '',
    deviceMode: !!S.device,
    home,
    export: null,
    persistence: null,
    share: null,
    online: { attempted: false, note: 'On this phone does not include an account, the feed, messages, or LIVE.' },
  };
  try {
    const video = await fetch('offline/sample-clip.mp4');
    if (!video.ok) throw Object.assign(new Error('bad_video'), { code: 'bad_video', detail: 'fetch ' + video.status });
    const clipBytes = new Uint8Array(await video.arrayBuffer());
    let vurl;
    const Filesystem = window.Capacitor?.Plugins?.Filesystem;
    if (Filesystem && window.Capacitor.convertFileSrc) {
      let bin = '';
      for (let i = 0; i < clipBytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, clipBytes.subarray(i, i + 0x8000));
      await Filesystem.writeFile({ path: 'sample-clip.mp4', data: btoa(bin), directory: 'CACHE' });
      const uri = await Filesystem.getUri({ path: 'sample-clip.mp4', directory: 'CACHE' });
      vurl = window.Capacitor.convertFileSrc(uri.uri);
    } else vurl = URL.createObjectURL(new Blob([clipBytes], { type: 'video/mp4' }));
    let musicUrl = 'offline/sample-tone.m4a';
    const tone = await fetch(musicUrl);
    if (!tone.ok) {
      const cat = await (await fetch('offline/catalog.json')).json();
      musicUrl = cat.music?.[0]?.url || '';
    }
    const exp = await exportLocal({
      clips: [
        { kind: 'video', url: vurl, dur: 1.2 },
        { kind: 'image', url: still('#143d6b', 'STILL'), dur: 1.2 },
        { kind: 'image', url: still('#6b2d14', 'FADE'), dur: 1.2 },
      ],
      texts: [{ text: 'PRICO', start: 0.2, end: 2.4, y: 0.22 }],
      captions: [{ text: 'on-phone export', start: 0.4, end: 2.6 }],
      musicUrl,
      aspect: '9:16',
    });
    const bytes = new Uint8Array(await exp.blob.arrayBuffer());
    let head = '';
    for (let i = 0; i < 16; i++) head += bytes[i].toString(16).padStart(2, '0');
    const play = await playback(exp.blob);
    out.export = { mime: exp.mime, bytes: bytes.length, header: head, path: exp.path || '', musicDecoded: !!exp.music, ...play, ai: false, local: true };
    out.persistence = await draftRoundtrip();
    out.share = await shareAndSave(exp.blob);
    out.ok = exp.mime === 'video/mp4' && bytes.length > 800 && head.includes('66747970') && play.videoWidth === 540 && play.videoHeight === 960 && play.duration > 1 && out.persistence.read === true;
  } catch (e) {
    out.ok = false;
    out.error = [e && (e.code || e.message) || String(e), e && e.detail].filter(Boolean).join(' ');
  }
  if (S.apiBase && !S.device) {
    try { out.online = { attempted: true, ...(await onlineFlow()) }; }
    catch (e) { out.online = { attempted: true, ok: false, error: e && (e.message || e.code) || String(e) }; }
    if (out.online.deviceModeStillShowing) out.online.ok = false;
  }
  return out;
}

