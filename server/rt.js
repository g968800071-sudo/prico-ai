// Realtime: WebSocket hub for chat/DMs, notifications and LIVE (WebRTC signalling relay, live chat, gifts, leaderboards).
import { WebSocketServer } from 'ws';
import crypto from 'node:crypto';

export const GIFTS = [
  { id: 'rose', emoji: '🌹', coins: 1 }, { id: 'heart', emoji: '💖', coins: 5 }, { id: 'fire', emoji: '🔥', coins: 10 }, { id: 'donut', emoji: '🍩', coins: 30 },
  { id: 'crown', emoji: '👑', coins: 99 }, { id: 'rocket', emoji: '🚀', coins: 299 }, { id: 'unicorn', emoji: '🦄', coins: 499 }, { id: 'lion', emoji: '🦁', coins: 999 },
];
const MAX_VIEWERS = 20, MSG_CAP = 300, NOTIF_CAP = 100;

export function install(ctx) {
  const { r, need, authUser, bad, json, readBody, db, save, id, mediaUrl, server, store, check, isOwner, userOf } = ctx;
  for (const k of ['convs', 'blocks', 'notifs', 'gifters']) db[k] ||= {};
  const conns = new Map(); // connId -> {ws, uid, live}
  const byUser = new Map(); // uid -> Set(connId)
  const lives = new Map(); // liveId -> live
  const now = () => Date.now();
  const sendTo = (cid, o) => { const c = conns.get(cid); if (c && c.ws.readyState === 1) c.ws.send(JSON.stringify(o)); };
  const toUser = (uid, o) => { for (const cid of byUser.get(uid) || []) sendTo(cid, o); };
  const pub = u => u ? { id: u.id, handle: u.handle, name: u.name, avatar: mediaUrl(u.avatar), verified: !!u.official } : null;
  const blocked = (a, b) => !!(db.blocks[a + ':' + b] || db.blocks[b + ':' + a]);

  // ---------- notifications ----------
  function badges(uid) {
    const u = db.users[uid]; if (!u) return { msgs: 0, notifs: 0 };
    const msgs = Object.values(db.convs).filter(c => c.members.includes(uid)).reduce((n, c) => n + c.msgs.filter(m => m.uid !== uid && m.at > (c.reads[uid] || 0)).length, 0);
    const notifs = (db.notifs[uid] || []).filter(n => n.at > (u.notifSeen || 0)).length;
    return { msgs, notifs };
  }
  function notify(uid, n) {
    if (!uid || n.from === uid || blocked(uid, n.from)) return;
    const list = (db.notifs[uid] ||= []);
    if (n.type === 'like' && list.some(x => x.type === 'like' && x.from === n.from && x.post === n.post)) return;
    const x = { id: id(8), at: now(), ...n }; list.unshift(x); if (list.length > NOTIF_CAP) list.length = NOTIF_CAP; save();
    toUser(uid, { t: 'notif', n: notifOut(x), badges: badges(uid) });
  }
  const notifOut = n => ({ ...n, user: pub(db.users[n.from]), poster: n.post && db.posts[n.post] ? mediaUrl(db.media[db.posts[n.post].media]?.poster || db.media[db.posts[n.post].media]?.blob) : null });

  r('GET', '/api/badges', async req => badges(need(req).id));
  r('GET', '/api/notifs', async req => { const u = need(req); const items = (db.notifs[u.id] || []).slice(0, 60).map(notifOut); const seen = u.notifSeen || 0; u.notifSeen = now(); save(); return { items, seen }; });

  // ---------- chat ----------
  const msgOut = m => ({ id: m.id, uid: m.uid, type: m.type, text: m.text || '', url: m.blob ? mediaUrl(m.blob) : null, at: m.at,
    post: m.post && db.posts[m.post] && !db.posts[m.post].hidden ? (p => ({ id: p.id, caption: p.caption, poster: mediaUrl(db.media[p.media]?.poster || db.media[p.media]?.blob), type: db.media[p.media]?.type, user: pub(db.users[p.uid]) }))(db.posts[m.post]) : null,
    gift: m.gift || null });
  function convOut(c, uid) {
    const others = c.members.filter(x => x !== uid).map(x => pub(db.users[x])).filter(Boolean);
    const last = c.msgs[c.msgs.length - 1];
    const readBy = c.members.filter(x => x !== uid).every(x => last && (c.reads[x] || 0) >= last.at);
    return { id: c.id, group: c.group, name: c.group ? c.name : (others[0]?.name || ''), members: others, last: last ? msgOut(last) : null, updatedAt: c.updatedAt,
      unread: c.msgs.filter(m => m.uid !== uid && m.at > (c.reads[uid] || 0)).length, seen: !!(last && last.uid === uid && readBy),
      blocked: !c.group && others[0] ? blocked(uid, others[0].id) : false, iBlocked: !c.group && others[0] ? !!db.blocks[uid + ':' + others[0].id] : false };
  }
  const convFor = (req, cid) => { const u = need(req); const c = db.convs[cid]; if (!c || !c.members.includes(u.id)) bad('not_found', 404); return [u, c]; };
  r('GET', '/api/inbox', async req => { const u = need(req); return { items: Object.values(db.convs).filter(c => c.members.includes(u.id) && (c.msgs.length || c.createdBy === u.id || c.group)).sort((a, b) => b.updatedAt - a.updatedAt).map(c => convOut(c, u.id)), badges: badges(u.id) }; });
  r('POST', '/api/convs', async req => {
    const u = need(req); const b = await json(req);
    const ids = [...new Set((Array.isArray(b.users) ? b.users : []).map(h => Object.values(db.users).find(x => x.handle === h || x.id === h)?.id).filter(x => x && x !== u.id))].slice(0, 30);
    if (!ids.length) bad('not_found', 404);
    if (ids.some(x => blocked(u.id, x))) bad('blocked', 403);
    if (ids.length === 1 && !b.group) { const ex = Object.values(db.convs).find(c => !c.group && c.members.length === 2 && c.members.includes(u.id) && c.members.includes(ids[0])); if (ex) return { conv: convOut(ex, u.id) }; }
    const name = String(b.name || '').trim().slice(0, 40); if (name && !check(name).ok) bad('unsafe_text', 422);
    const c = { id: id(9), members: [u.id, ...ids], group: ids.length > 1 || !!b.group, name: name || '', createdBy: u.id, createdAt: now(), updatedAt: now(), reads: { [u.id]: now() }, msgs: [] };
    if (c.group) c.msgs.push({ id: id(9), uid: u.id, type: 'system', text: 'created', at: now() });
    db.convs[c.id] = c; save(); return { conv: convOut(c, u.id) };
  });
  r('GET', '/api/convs/:cid', async (req, p) => { const [u, c] = convFor(req, p.cid); return { conv: convOut(c, u.id), items: c.msgs.slice(-120).map(msgOut), reads: c.reads }; });
  const rate = new Map();
  function postMsg(u, c, m) {
    const k = u.id, w = (rate.get(k) || []).filter(t => now() - t < 10000); if (w.length >= 20) bad('slow_down', 429); w.push(now()); rate.set(k, w);
    if (!c.group && c.members.some(x => x !== u.id && blocked(u.id, x))) bad('blocked', 403);
    const msg = { id: id(9), uid: u.id, at: now(), ...m }; c.msgs.push(msg); if (c.msgs.length > MSG_CAP) c.msgs.splice(0, c.msgs.length - MSG_CAP);
    c.updatedAt = msg.at; c.reads[u.id] = msg.at; save();
    for (const x of c.members) toUser(x, { t: 'msg', c: c.id, m: msgOut(msg), conv: convOut(c, x), badges: badges(x) });
    return msg;
  }
  r('POST', '/api/convs/:cid/messages', async (req, p) => {
    const [u, c] = convFor(req, p.cid); const b = await json(req);
    const type = ['text', 'image', 'video', 'post'].includes(b.type) ? b.type : 'text';
    const text = String(b.text || '').trim().slice(0, 1000); if (text && !check(text).ok) bad('unsafe_text', 422);
    const m = { type, text };
    if (type === 'text' && !text) bad('empty');
    if (type === 'image' || type === 'video') { if (!/^[A-Za-z0-9]{8,40}$/.test(b.blob || '') || !(u.chatBlobs || []).includes(b.blob)) bad('bad_media'); m.blob = b.blob; }
    if (type === 'post') { if (!db.posts[b.post]) bad('not_found', 404); m.post = b.post; }
    return { m: msgOut(postMsg(u, c, m)) };
  });
  r('POST', '/api/chat/upload', async req => {
    const u = need(req); const ct = String(req.headers['content-type'] || '');
    const buf = await readBody(req, ct.startsWith('video/') ? 30e6 : 12e6);
    let data = buf, mime = ct;
    if (ct.startsWith('image/')) { const sharp = (await import('sharp')).default; data = await sharp(buf).rotate().resize(1280, 1280, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 84 }).toBuffer().catch(() => bad('bad_image')); mime = 'image/jpeg'; }
    else if (!/^video\/(mp4|webm|quicktime)/.test(ct)) bad('bad_type');
    const blob = await store.putBlob(data, mime); (u.chatBlobs ||= []).push(blob); if (u.chatBlobs.length > 200) u.chatBlobs.shift(); save();
    return { blob, url: mediaUrl(blob), type: ct.startsWith('image/') ? 'image' : 'video' };
  });
  r('POST', '/api/convs/:cid/read', async (req, p) => {
    const [u, c] = convFor(req, p.cid); c.reads[u.id] = now(); save();
    for (const x of c.members) if (x !== u.id) toUser(x, { t: 'read', c: c.id, uid: u.id, at: c.reads[u.id] });
    return { badges: badges(u.id) };
  });
  r('POST', '/api/convs/:cid/leave', async (req, p) => { const [u, c] = convFor(req, p.cid); c.members = c.members.filter(x => x !== u.id); if (!c.members.length) delete db.convs[c.id]; save(); return { ok: true }; });
  r('POST', '/api/convs/:cid/report', async (req, p) => { const [u, c] = convFor(req, p.cid); const b = await json(req); db.reports.push({ conv: c.id, msg: String(b.msgId || '').slice(0, 20), by: u.id, reason: String(b.reason || 'other').slice(0, 40), at: now() }); save(); return { ok: true }; });
  r('POST', '/api/users/:handle/block', async (req, p) => {
    const u = need(req); const o = Object.values(db.users).find(x => x.handle === p.handle); if (!o || o.id === u.id) bad('not_found', 404);
    const k = u.id + ':' + o.id; if (db.blocks[k]) delete db.blocks[k]; else { db.blocks[k] = now(); delete db.follows[u.id + ':' + o.id]; delete db.follows[o.id + ':' + u.id]; }
    save(); return { blocked: !!db.blocks[k] };
  });
  r('GET', '/api/search/users', async req => {
    const u = authUser(req); const q = String(new URL(req.url, 'http://x').searchParams.get('q') || '').trim().toLowerCase().replace(/^@/, '');
    let list = Object.values(db.users).filter(x => x.id !== u?.id && !(u && blocked(u.id, x.id)));
    if (q) list = list.filter(x => x.handle.includes(q) || String(x.name).toLowerCase().includes(q));
    else if (u) { const f = new Set(Object.keys(db.follows).filter(k => k.startsWith(u.id + ':')).map(k => k.split(':')[1])); list.sort((a, b) => (f.has(b.id) ? 1 : 0) - (f.has(a.id) ? 1 : 0)); }
    return { items: list.slice(0, 30).map(pub) };
  });
  r('GET', '/api/blocks', async req => { const u = need(req); return { items: Object.keys(db.blocks).filter(k => k.startsWith(u.id + ':')).map(k => pub(db.users[k.split(':')[1]])).filter(Boolean) }; });

  // ---------- LIVE ----------
  const liveOut = (L, viewer) => ({ id: L.id, title: L.title, host: pub(db.users[L.host]), startedAt: L.startedAt, viewers: L.viewers.size, likes: L.likes, coins: L.coins, cover: L.cover ? mediaUrl(L.cover) : mediaUrl(db.users[L.host]?.avatar), isHost: viewer?.id === L.host, top: top(L), relay: { frames: L.frames || 0, audioChunks: L.audioChunks || 0, audioBytes: L.audioBytes || 0 } });
  const top = L => Object.entries(L.gifters).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([uid, c]) => ({ user: pub(db.users[uid]), coins: c }));
  const bcast = (L, o, except) => { for (const cid of [L.hostConn, ...L.viewers]) if (cid && cid !== except) sendTo(cid, o); };
  const state = L => bcast(L, { t: 'live:state', viewers: L.viewers.size, likes: L.likes, coins: L.coins, top: top(L) });
  function endLive(L, why = 'ended') {
    if (!lives.has(L.id)) return; lives.delete(L.id); clearTimeout(L.gone);
    bcast(L, { t: 'live:end', why, stats: { viewers: L.peak, likes: L.likes, coins: L.coins, duration: now() - L.startedAt } });
    for (const cid of L.viewers) { const c = conns.get(cid); if (c) c.live = null; }
    const h = db.users[L.host]; if (h) { h.liveStats = { ...(h.liveStats || {}), lives: (h.liveStats?.lives || 0) + 1, coins: (h.liveStats?.coins || 0) + L.coins }; save(); }
  }
  r('GET', '/api/lives', async req => ({ items: [...lives.values()].filter(L => L.hostConn).sort((a, b) => b.viewers.size - a.viewers.size).map(L => liveOut(L, authUser(req))) }));
  r('POST', '/api/lives', async req => {
    const u = need(req); const b = await json(req);
    const title = String(b.title || '').trim().slice(0, 80); if (title && !check(title).ok) bad('unsafe_text', 422);
    for (const L of lives.values()) if (L.host === u.id) endLive(L, 'restarted');
    const L = { id: id(8), host: u.id, title: title || `${u.name} LIVE`, startedAt: now(), viewers: new Set(), hostConn: null, likes: 0, coins: 0, gifters: {}, peak: 0, chat: [] };
    lives.set(L.id, L); L.gone = setTimeout(() => !L.hostConn && endLive(L, 'host_gone'), 60000);
    for (const k of Object.keys(db.follows)) if (k.endsWith(':' + u.id)) notify(k.split(':')[0], { type: 'live', from: u.id, live: L.id, text: L.title });
    return { live: liveOut(L, u), maxViewers: MAX_VIEWERS };
  });
  r('GET', '/api/lives/:lid', async (req, p) => { const L = lives.get(p.lid); if (!L) bad('live_ended', 404); return { live: liveOut(L, authUser(req)), chat: L.chat.slice(-30) }; });
  r('POST', '/api/lives/:lid/end', async (req, p) => { const u = need(req); const L = lives.get(p.lid); if (!L || L.host !== u.id) bad('not_found', 404); endLive(L); return { ok: true }; });
  r('GET', '/api/gifts', async req => { const u = authUser(req); return { gifts: GIFTS, coins: u ? (isOwner(u) ? 999999 : u.coins || 0) : 0, unlimited: isOwner(u), top: globalTop() }; });
  const globalTop = () => Object.entries(db.gifters).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([uid, c]) => ({ user: pub(db.users[uid]), coins: c })).filter(x => x.user);
  r('POST', '/api/lives/:lid/gift', async (req, p) => {
    const u = need(req); const L = lives.get(p.lid); if (!L) bad('live_ended', 404); if (L.host === u.id) bad('own_live');
    const b = await json(req); const g = GIFTS.find(x => x.id === b.gift) || bad('bad_gift'); const n = Math.max(1, Math.min(99, b.count | 0 || 1));
    const cost = g.coins * n;
    if (!isOwner(u)) { if ((u.coins || 0) < cost) bad('no_coins', 402); u.coins -= cost; }
    const h = db.users[L.host]; if (h) h.diamonds = (h.diamonds || 0) + Math.floor(cost / 2);
    L.coins += cost; L.gifters[u.id] = (L.gifters[u.id] || 0) + cost; db.gifters[u.id] = (db.gifters[u.id] || 0) + cost; save();
    const ev = { t: 'live:gift', from: pub(u), gift: g, count: n, cost, banner: cost >= 99, combo: n };
    bcast(L, ev); state(L);
    return { coins: isOwner(u) ? 999999 : u.coins, live: liveOut(L, u) };
  });

  // ---------- WebSocket ----------
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://x'); const tok = url.searchParams.get('token');
    const u = tok && db.sessions[tok] ? db.users[db.sessions[tok].uid] : null;
    const cid = crypto.randomBytes(6).toString('hex');
    const me = { ws, uid: u?.id || null, live: null, alive: true };
    conns.set(cid, me); if (u) { if (!byUser.has(u.id)) byUser.set(u.id, new Set()); byUser.get(u.id).add(cid); }
    ws.send(JSON.stringify({ t: 'hello', cid, uid: me.uid, badges: u ? badges(u.id) : null }));
    ws.on('pong', () => { me.alive = true; });
    const chatRate = [];
    ws.on('message', raw => {
      let m; try { m = JSON.parse(raw); } catch { return; }
      const L = me.live && lives.get(me.live);
      if (m.t === 'ping') return sendTo(cid, { t: 'pong' });
      if (m.t === 'typing' && u && db.convs[m.c]?.members.includes(u.id)) { for (const x of db.convs[m.c].members) if (x !== u.id) toUser(x, { t: 'typing', c: m.c, uid: u.id }); return; }
      if (m.t === 'live:host' && u) { const H = lives.get(m.live); if (!H || H.host !== u.id) return sendTo(cid, { t: 'live:end', why: 'not_found' }); H.hostConn = cid; me.live = H.id; clearTimeout(H.gone); for (const v of H.viewers) sendTo(cid, { t: 'live:viewer', vid: v, user: pub(db.users[conns.get(v)?.uid]) }); if ([...H.viewers].some(v => conns.get(v)?.fb)) sendTo(cid, { t: 'live:fb:on' }); return state(H); }
      if (m.t === 'live:join') {
        const J = lives.get(m.live); if (!J) return sendTo(cid, { t: 'live:end', why: 'not_found' });
        if (u && blocked(u.id, J.host)) return sendTo(cid, { t: 'live:end', why: 'blocked' });
        if (J.viewers.size >= MAX_VIEWERS) return sendTo(cid, { t: 'live:full', max: MAX_VIEWERS });
        J.viewers.add(cid); me.live = J.id; J.peak = Math.max(J.peak, J.viewers.size);
        sendTo(cid, { t: 'live:joined', live: liveOut(J, u), chat: J.chat.slice(-30) });
        if (J.hostConn) sendTo(J.hostConn, { t: 'live:viewer', vid: cid, user: pub(u) });
        if (u) { const e = { user: pub(u), text: '', join: true, at: now() }; bcast(J, { t: 'live:chat', ...e }); }
        return state(J);
      }
      if (!L) return;
      if (m.t === 'live:leave') { leaveLive(); return; }
      if (m.t === 'live:chat' && u) {
        const w = chatRate.filter(t => now() - t < 5000); if (w.length >= 6) return; chatRate.length = 0; chatRate.push(...w, now());
        const text = String(m.text || '').trim().slice(0, 200); if (!text || !check(text).ok) return sendTo(cid, { t: 'live:chat:blocked' });
        const e = { user: pub(u), text, at: now(), host: u.id === L.host }; L.chat.push(e); if (L.chat.length > 100) L.chat.shift();
        return bcast(L, { t: 'live:chat', ...e });
      }
      if (m.t === 'live:like') { L.likes += Math.max(1, Math.min(10, m.n | 0 || 1)); bcast(L, { t: 'live:like', n: m.n | 0 || 1 }, cid); if (L.likes % 5 === 0) state(L); return; }
      if (m.t === 'live:fb' && L.hostConn !== cid) { me.fb = true; if (L.hostConn) sendTo(L.hostConn, { t: 'live:fb:on' }); return; } // WebRTC failed (no TURN) → JPEG relay
      if (m.t === 'live:frame' && L.hostConn === cid && typeof m.d === 'string' && m.d.length < 60000 && m.d.startsWith('data:image/jpeg')) { L.frames = (L.frames || 0) + 1; let any = false; for (const v of L.viewers) { const c = conns.get(v); if (c?.fb) { any = true; sendTo(v, { t: 'live:frame', d: m.d, seq: L.frames }); } } if (!any) sendTo(cid, { t: 'live:fb:off' }); return; }
      if (m.t === 'live:audio' && L.hostConn === cid && typeof m.d === 'string' && m.d.length > 8 && m.d.length < 50000) { L.audioChunks = (L.audioChunks || 0) + 1; L.audioBytes = (L.audioBytes || 0) + m.d.length; for (const v of L.viewers) { const c = conns.get(v); if (c?.fb) sendTo(v, { t: 'live:audio', d: m.d, seq: L.audioChunks }); } return; }
      if (m.t === 'rtc') { // relay only host <-> viewer of the same live
        const isHost = L.hostConn === cid;
        if (isHost && L.viewers.has(m.to)) sendTo(m.to, { t: 'rtc', from: cid, data: m.data });
        else if (!isHost && m.to === 'host' && L.hostConn) sendTo(L.hostConn, { t: 'rtc', from: cid, data: m.data });
      }
    });
    function leaveLive() {
      const L = me.live && lives.get(me.live); me.live = null; if (!L) return;
      if (L.hostConn === cid) { L.hostConn = null; bcast(L, { t: 'live:paused' }); L.gone = setTimeout(() => !L.hostConn && endLive(L, 'host_gone'), 30000); }
      else { L.viewers.delete(cid); if (L.hostConn) sendTo(L.hostConn, { t: 'live:viewer:left', vid: cid }); state(L); }
    }
    ws.on('close', () => { leaveLive(); conns.delete(cid); if (u) { byUser.get(u.id)?.delete(cid); if (!byUser.get(u.id)?.size) byUser.delete(u.id); } });
  });
  setInterval(() => { for (const [, c] of conns) { if (!c.alive) { c.ws.terminate(); continue; } c.alive = false; try { c.ws.ping(); } catch {} } }, 30000).unref();
  return { notify, badges, lives, online: uid => byUser.has(uid) };
}
