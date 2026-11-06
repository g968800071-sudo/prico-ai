// PRICO LIVE: go live from the camera (with face effects), WebRTC to viewers (JPEG relay fallback when P2P fails),
// live chat, hearts, gifts bought with coins, gift banners, per-live + global leaderboards, end-of-live stats.
import { t } from './i18n.js';
import { S, I, api, h, esc, abs, fmt, toast, fail, sheet, haptic, confetti, $, $$, paymentsGate } from './core.js';
import { needAuth, refreshMe } from './app.js';
import * as rt from './rt.js';

const ICE = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }] };
const ava = u => abs(u?.avatar) || 'icons/icon-192.png';
let root = null, listT = 0;

export function mountLive(el) {
  root = el;
  el.innerHTML = `<div class="pad"><div class="hdr"><h1>🔴 ${esc(t('live'))}</h1><span class="sp"></span><button class="btn pri sm go">${esc(t('goLive'))}</button></div><div class="mut xs scopeNote">${esc(t('liveScope'))}</div><div class="liveGrid"></div><div class="lbl">🏆 ${esc(t('topGifters'))}</div><div class="gtop"></div></div>`;
  $('.go', el).onclick = () => goLive();
  drawList(); clearInterval(listT); listT = setInterval(() => { if (S.route === 'live') drawList(); }, 10000);
}
export function refreshLive() { if (root) drawList(); }
async function drawList() {
  const g = $('.liveGrid', root);
  try {
    const [r, gf] = await Promise.all([api('/api/lives'), api('/api/gifts')]);
    g.innerHTML = r.items.length ? r.items.map(L => `<button class="liveCard" data-id="${L.id}"><img src="${ava(L.host)}" alt=""><span class="lvTag">🔴 LIVE</span><span class="lvV">👁 ${fmt(L.viewers)}</span><div class="lvIn"><b>${esc(L.host?.name || '')}</b><div class="xs">${esc(L.title)}</div></div></button>`).join('')
      : `<div class="empty liveEmpty"><div class="big">📡</div><div>${esc(t('noLives'))}</div><button class="btn pri go2">🔴 ${esc(t('goLiveFirst'))}</button></div>`;
    $$('.liveCard', g).forEach(b => b.onclick = () => watchLive(b.dataset.id));
    const g2 = $('.go2', g); if (g2) g2.onclick = () => goLive();
    $('.gtop', root).innerHTML = gf.top.length ? gf.top.slice(0, 10).map((x, i) => `<div class="lb"><span class="rk">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span><img class="ava" src="${ava(x.user)}" alt=""><div class="sp"><b>${esc(x.user.name)}</b></div><b>🪙 ${fmt(x.coins)}</b></div>`).join('') : `<div class="mut sm">${esc(t('noGiftsYet'))}</div>`;
  } catch (e) { g.innerHTML = ''; fail(e); }
}

// ---------- shared overlay (chat, hearts, gifts) ----------
function overlay(L, host) {
  const el = h(`<div class="lv on"><div class="lvStage"></div>
    <div class="lvTop"><img class="ava" src="${ava(L.host)}" alt=""><div class="hostI"><b>${esc(L.host?.name || '')}</b><div class="xs"><span class="lk">❤️ ${fmt(L.likes)}</span> · 🪙 <span class="cn">${fmt(L.coins)}</span></div></div>
      <span class="sp"></span><button class="topG">🏆</button><span class="vw">👁 ${fmt(L.viewers)}</span><button class="iconBtn x">${I.close}</button></div>
    <div class="lvTitle">🔴 ${esc(L.title)}</div><div class="lvMsg"></div>
    <div class="banners"></div><div class="hearts"></div><div class="chatL"></div>
    <form class="lvBar"><input class="field ci" placeholder="${esc(t('sayHi'))}" maxlength="200" autocomplete="off" enterkeyhint="send">${host ? `<button type="button" class="iconBtn fxB">🎭</button><button type="button" class="iconBtn flipB">🔄</button><button type="button" class="btn sm endB">${esc(t('endLive'))}</button>` : `<button type="button" class="iconBtn giftB">🎁</button><button type="button" class="iconBtn likeB">❤️</button>`}</form></div>`);
  document.body.append(el);
  const chat = $('.chatL', el);
  const addChat = e => { const n = h(`<div class="cm ${e.join ? 'join' : ''} ${e.gift ? 'gift' : ''} ${e.host ? 'host' : ''}"><img src="${ava(e.user)}" alt=""><span><b>${esc(e.user?.name || '')}</b> ${e.join ? esc(t('joined')) : e.gift ? `${esc(t('sent'))} ${e.gift.emoji}${e.count > 1 ? ' ×' + e.count : ''}` : esc(e.text)}</span></div>`); chat.append(n); while (chat.children.length > 40) chat.firstChild.remove(); chat.scrollTop = 1e6; };
  const heart = () => { const hh = h(`<i style="left:${Math.random() * 40}px;--d:${(Math.random() - .5) * 80}px">${['❤️', '💖', '💜', '💛', '🧡'][Math.random() * 5 | 0]}</i>`); $('.hearts', el).append(hh); setTimeout(() => hh.remove(), 2200); };
  const gift = ev => {
    addChat({ user: ev.from, gift: ev.gift, count: ev.count });
    const f = h(`<div class="gfly ${ev.cost >= 99 ? 'big' : ''}">${ev.gift.emoji}</div>`); el.append(f); setTimeout(() => f.remove(), 2600);
    if (ev.banner) { const b = h(`<div class="gban"><img src="${ava(ev.from)}" alt=""><div><b>${esc(ev.from?.name || '')}</b><div class="xs">${esc(t('sent'))} ${esc(t('g_' + ev.gift.id))} ×${ev.count}</div></div><span class="ge">${ev.gift.emoji}</span></div>`); $('.banners', el).append(b); setTimeout(() => b.remove(), 4200); if (ev.cost >= 299) confetti(); }
    haptic([10, 20, 10]);
  };
  const st = s => { $('.vw', el).textContent = '👁 ' + fmt(s.viewers); $('.lk', el).textContent = '❤️ ' + fmt(s.likes); $('.cn', el).textContent = fmt(s.coins); L.top = s.top; };
  const msg = s => { const m = $('.lvMsg', el); m.textContent = s || ''; m.classList.toggle('on', !!s); };
  $('.topG', el).onclick = () => { const body = h(`<div class="list">${(L.top || []).map((x, i) => `<div class="lb"><span class="rk">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span><img class="ava" src="${ava(x.user)}" alt=""><div class="sp"><b>${esc(x.user?.name || '')}</b></div><b>🪙 ${fmt(x.coins)}</b></div>`).join('') || `<div class="mut sm" style="padding:16px;text-align:center">${esc(t('noGiftsYet'))}</div>`}</div>`); sheet({ title: '🏆 ' + t('topGifters'), body, cls: 'over' }); };
  $('.lvBar', el).onsubmit = async e => { e.preventDefault(); const i = $('.ci', el); const text = i.value.trim(); if (!text) return; if (!S.me) { await needAuth(); } i.value = ''; rt.send({ t: 'live:chat', text }); };
  return { el, addChat, heart, gift, st, msg, stage: $('.lvStage', el) };
}
function endScreen(stats, host) {
  const d = Math.round((stats?.duration || 0) / 1000);
  const body = h(`<div class="col" style="text-align:center;align-items:center"><div style="font-size:52px">${host ? '🎉' : '👋'}</div><h2 style="margin:0">${esc(t(host ? 'liveEndedHost' : 'liveEnded'))}</h2>
    ${stats ? `<div class="stats"><div><b>${fmt(stats.viewers)}</b><span>${esc(t('viewers'))}</span></div><div><b>${fmt(stats.likes)}</b><span>❤️</span></div><div><b>${fmt(stats.coins)}</b><span>🪙</span></div><div><b>${d / 60 | 0}:${String(d % 60).padStart(2, '0')}</b><span>⏱️</span></div></div>` : ''}
    ${host && stats?.coins ? `<div class="mut sm">💎 +${fmt(Math.floor(stats.coins / 2))} ${esc(t('diamonds'))}</div>` : ''}</div>`);
  sheet({ title: '', body, cls: 'over' });
}

// ---------- host ----------
export async function goLive() {
  await needAuth();
  const fx = await import('./fx.js');
  let cam;
  const pre = h(`<div class="lv on prep"><div class="lvStage"><div class="camMsg">${esc(t('camStarting'))}</div></div><div class="lvTop"><span class="sp"></span><button class="iconBtn flipB">🔄</button><button class="iconBtn x">${I.close}</button></div>
    <div class="prepBox"><input class="field ttl" maxlength="80" placeholder="${esc(t('liveTitlePh'))}"><div class="fxRow hscroll"></div><button class="btn pri wide start">🔴 ${esc(t('goLive'))}</button><div class="mut xs" style="text-align:center">${esc(t('liveScope'))}</div><div class="mut xs" style="text-align:center">${esc(t('liveRules'))}</div></div></div>`);
  document.body.append(pre);
  let cancelled = false;
  $('.x', pre).onclick = () => { cancelled = true; cam && cam.stop(); pre.remove(); };
  try { cam = await fx.camera({ audio: true, W: 540, H: 960 }); } catch { try { cam = await fx.camera({ audio: false, W: 540, H: 960 }); } catch { $('.camMsg', pre).textContent = t('camDenied'); return; } }
  if (cancelled) return cam.stop();
  $('.lvStage', pre).innerHTML = ''; $('.lvStage', pre).append(cam.canvas);
  const rail = el => { el.innerHTML = fx.EFFECTS.map(([k, e]) => `<button data-k="${k}" class="${k === (cam.effect || 'none') ? 'on' : ''}"><b>${e}</b><span>${esc(t('fx_' + k))}</span></button>`).join(''); $$('button', el).forEach(b => b.onclick = () => { $$('button', el).forEach(z => z.classList.toggle('on', z === b)); cam.set(b.dataset.k); }); };
  rail($('.fxRow', pre));
  $('.flipB', pre).onclick = () => cam.flip().catch(fail);
  $('.start', pre).onclick = async () => {
    let L; try { L = (await api('/api/lives', { body: { title: $('.ttl', pre).value } })).live; } catch (e) { return fail(e); }
    pre.remove(); hostRun(L, cam, fx, rail);
  };
}
function hostRun(L, cam, fx, rail) {
  rt.connect();
  const ui = overlay(L, true); ui.stage.append(cam.canvas);
  const stream = cam.canvas.captureStream(24); for (const a of cam.audioTracks()) stream.addTrack(a);
  const peers = new Map(); let fb = false, fbT = 0, ended = false;
  const offs = [];
  const hello = () => rt.send({ t: 'live:host', live: L.id });
  async function offer(vid) {
    peers.get(vid)?.close();
    const pc = new RTCPeerConnection(ICE); peers.set(vid, pc);
    stream.getTracks().forEach(tr => pc.addTrack(tr, stream));
    pc.onicecandidate = e => e.candidate && rt.send({ t: 'rtc', to: vid, data: { ice: e.candidate } });
    pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) { peers.delete(vid); } };
    const o = await pc.createOffer(); await pc.setLocalDescription(o);
    rt.send({ t: 'rtc', to: vid, data: { sdp: pc.localDescription } });
  }
  offs.push(rt.on('open', hello));
  offs.push(rt.on('live:viewer', m => offer(m.vid).catch(console.warn)));
  offs.push(rt.on('live:viewer:left', m => { peers.get(m.vid)?.close(); peers.delete(m.vid); }));
  offs.push(rt.on('rtc', async m => { const pc = peers.get(m.from); if (!pc) return; try { if (m.data.sdp) await pc.setRemoteDescription(m.data.sdp); else if (m.data.ice) await pc.addIceCandidate(m.data.ice); } catch (e) { console.warn(e); } }));
  offs.push(rt.on('live:state', ui.st));
  offs.push(rt.on('live:chat', ui.addChat));
  offs.push(rt.on('live:like', () => ui.heart()));
  offs.push(rt.on('live:gift', ui.gift));
  offs.push(rt.on('live:fb:on', () => { if (fb) return; fb = true; const c = document.createElement('canvas'); c.width = 270; c.height = 480; const x = c.getContext('2d');
    fbT = setInterval(() => { x.drawImage(cam.canvas, 0, 0, 270, 480); rt.send({ t: 'live:frame', d: c.toDataURL('image/jpeg', 0.5) }); }, 500); }));
  offs.push(rt.on('live:fb:off', () => { fb = false; clearInterval(fbT); }));
  offs.push(rt.on('live:end', m => finish(m.stats)));
  if (rt.ready()) hello(); else rt.connect();
  ui.addChat({ user: S.me, text: t('youAreLive'), host: true });
  const finish = stats => { if (ended) return; ended = true; offs.forEach(f => f()); clearInterval(fbT); peers.forEach(p => p.close()); cam.stop(); ui.el.remove(); endScreen(stats, true); refreshMe().catch(() => {}); refreshLive(); };
  const end = async () => { try { await api(`/api/lives/${L.id}/end`, { method: 'POST' }); } catch {} setTimeout(() => finish(null), 1500); };
  $('.endB', ui.el).onclick = () => confirm(t('endLive') + '?') && end();
  $('.x', ui.el).onclick = () => confirm(t('endLive') + '?') && end();
  $('.flipB', ui.el).onclick = () => cam.flip().catch(fail);
  $('.fxB', ui.el).onclick = () => { const body = h(`<div class="fxRow hscroll light"></div>`); rail(body); sheet({ title: '🎭 ' + t('effects'), body, cls: 'over' }); };
}

// ---------- viewer ----------
export async function watchLive(lid) {
  let L; try { L = (await api('/api/lives/' + lid)).live; } catch (e) { return toast(t('liveEnded'), true); }
  if (L.isHost) return toast(t('youAreLive'));
  rt.connect();
  const ui = overlay(L, false);
  const v = h(`<video autoplay playsinline></video>`); const img = h(`<img class="fbImg" alt="">`); ui.stage.append(v, img);
  let pc = null, done = false, connected = false, fbT = 0, wantSound = true;
  const offs = [];
  const join = () => rt.send({ t: 'live:join', live: lid });
  ui.msg(t('connecting'));
  const resetPc = () => { pc?.close(); pc = new RTCPeerConnection(ICE);
    pc.ontrack = e => { v.srcObject = e.streams[0]; v.play().catch(() => { v.muted = true; v.play().catch(() => {}); ui.msg(t('tapForSound')); }); };
    pc.onicecandidate = e => e.candidate && rt.send({ t: 'rtc', to: 'host', data: { ice: e.candidate } });
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'connected') { connected = true; clearTimeout(fbT); img.style.display = 'none'; v.style.display = ''; if (!v.muted) ui.msg(''); } if (pc.connectionState === 'failed') fallback(); };
  };
  const fallback = () => { if (connected || done) return; rt.send({ t: 'live:fb' }); ui.msg(t('liveLowBw')); setTimeout(() => ui.msg(''), 3500); };
  offs.push(rt.on('open', join));
  offs.push(rt.on('live:joined', m => { L = m.live; ui.st(L); m.chat.forEach(ui.addChat); clearTimeout(fbT); fbT = setTimeout(fallback, 9000); }));
  offs.push(rt.on('rtc', async m => {
    try {
      if (m.data.sdp && m.data.sdp.type === 'offer') { resetPc(); await pc.setRemoteDescription(m.data.sdp); const a = await pc.createAnswer(); await pc.setLocalDescription(a); rt.send({ t: 'rtc', to: 'host', data: { sdp: pc.localDescription } }); }
      else if (m.data.ice && pc) await pc.addIceCandidate(m.data.ice);
    } catch (e) { console.warn(e); }
  }));
  offs.push(rt.on('live:frame', m => { if (connected) return; img.src = m.d; img.style.display = ''; v.style.display = 'none'; ui.msg(''); }));
  offs.push(rt.on('live:state', ui.st));
  offs.push(rt.on('live:chat', ui.addChat));
  offs.push(rt.on('live:like', () => ui.heart()));
  offs.push(rt.on('live:gift', ui.gift));
  offs.push(rt.on('live:paused', () => ui.msg('⏸ ' + t('livePaused'))));
  offs.push(rt.on('live:full', m => { ui.msg(t('liveFull', { n: m.max })); }));
  offs.push(rt.on('live:end', m => { finish(); endScreen(m.stats, false); }));
  offs.push(rt.on('live:chat:blocked', () => toast(t('e_unsafe_text'), true)));
  if (rt.ready()) join();
  const finish = () => { if (done) return; done = true; rt.send({ t: 'live:leave' }); offs.forEach(f => f()); clearTimeout(fbT); pc?.close(); ui.el.remove(); refreshLive(); };
  $('.x', ui.el).onclick = finish;
  let likes = 0, likeT = 0;
  const like = () => { ui.heart(); likes++; haptic(4); clearTimeout(likeT); likeT = setTimeout(() => { rt.send({ t: 'live:like', n: Math.min(10, likes) }); likes = 0; }, 400); };
  $('.likeB', ui.el).onclick = like;
  ui.stage.ondblclick = like;
  ui.stage.onclick = () => { if (v.muted) { v.muted = false; v.play().catch(() => {}); ui.msg(''); } };
  $('.giftB', ui.el).onclick = () => giftSheet(L);
}

async function giftSheet(L) {
  await needAuth();
  const body = h(`<div><div class="row coinsRow"><b class="cb">🪙 …</b><span class="sp"></span><button class="btn sm pri buy">➕ ${esc(t('getCoins'))}</button></div><div class="giftGrid"></div><div class="row" style="margin-top:12px"><span class="mut sm">${esc(t('count'))}</span><div class="chipRow cnt">${[1, 5, 10, 99].map(n => `<button class="chip2 ${n === 1 ? 'on' : ''}" data-n="${n}">×${n}</button>`).join('')}</div></div></div>`);
  const sh = sheet({ title: '🎁 ' + t('sendGift'), body, cls: 'over' });
  let count = 1, coins = 0, unl = false;
  const load = async () => { const r = await api('/api/gifts'); coins = r.coins; unl = r.unlimited; $('.cb', body).textContent = '🪙 ' + (unl ? '∞' : fmt(coins));
    $('.giftGrid', body).innerHTML = r.gifts.map(g => `<button class="gift" data-g="${g.id}"><b>${g.emoji}</b><span>${esc(t('g_' + g.id))}</span><i>🪙 ${g.coins}</i></button>`).join('');
    $$('.gift', body).forEach(b => b.onclick = async () => {
      const g = r.gifts.find(x => x.id === b.dataset.g);
      if (!unl && coins < g.coins * count) { toast(t('e_no_coins'), true); return coinShop(load); }
      b.disabled = true;
      try { const x = await api(`/api/lives/${L.id}/gift`, { body: { gift: g.id, count } }); coins = x.coins; $('.cb', body).textContent = '🪙 ' + (unl ? '∞' : fmt(coins)); haptic([8, 20, 8]); if (S.me) S.me.coins = x.coins; }
      catch (e) { if (e.code === 'no_coins') coinShop(load); else fail(e); }
      b.disabled = false;
    }); };
  $$('.cnt button', body).forEach(b => b.onclick = () => { count = +b.dataset.n; $$('.cnt button', body).forEach(z => z.classList.toggle('on', z === b)); });
  $('.buy', body).onclick = () => coinShop(load);
  load().catch(fail);
}
export async function coinShop(after) {
  await needAuth();
  const body = h(`<div><div class="sk" style="height:120px;border-radius:18px"></div></div>`);
  const sh = sheet({ title: '🪙 ' + t('getCoins'), body, cls: 'over' });
  try {
    const r = await api('/api/shop'); const packs = r.products.filter(p => p.kind === 'coins');
    const { lang } = await import('./i18n.js');
    const money = p => new Intl.NumberFormat(lang(), { style: 'currency', currency: p.currency }).format(p.price);
    body.innerHTML = `<div class="payNote">${esc(t('paymentsPostponed'))}</div><div class="coinGrid">${packs.map(p => `<button class="coinPack ${p.best ? 'best' : ''}" data-p="${p.id}">${p.best ? `<span class="badge hot">${esc(t('best'))}</span>` : ''}<b>🪙 ${fmt(p.coins)}</b><span class="price">${money(p)}</span></button>`).join('')}</div><div class="mut xs" style="text-align:center;margin-top:14px">${esc(t('paymentsPostponedShort'))}</div>`;
    $$('[data-p]', body).forEach(b => b.onclick = async () => { b.disabled = true; try { await paymentsGate(); await api('/api/shop/buy', { body: { productId: b.dataset.p } }); toast(t('e_payments_postponed'), true); } catch (e) { toast(e.code === 'payments_postponed' ? t('e_payments_postponed') : e.code === 'server_unsafe_pay' ? t('serverUnsafePay') : (await import('./core.js')).errMsg(e), true); } finally { b.disabled = false; } });
  } catch (e) { fail(e); }
}
