// PRICO AI by PRICOP.studio — app shell: boot, router, tabs, auth, onboarding, Top, Me, profiles, settings, shop.
import { t, setLang, detect, LANGS, lang } from './i18n.js';
import { S, I, api, h, esc, abs, fmt, toast, fail, sheet, haptic, setToken, closeAll, confetti, NATIVE, $, $$ } from './core.js';
import { mountHome, pauseAll, resumeCur, reset as resetFeed } from './feed.js';
import { mountCreate, openTemplate, manageFaces } from './create.js';
import { mountReels, stopAudio } from './reelsui.js';

const TABS = [['home', 'tabHome', 'home', 'homeF'], ['create', 'tabCreate', 'sparkle', 'sparkle'], ['reels', 'tabReels', 'plus', 'plus'], ['top', 'tabTop', 'trophy', 'trophyF'], ['me', 'tabMe', 'user', 'userF']];
const mounted = {};

export async function refreshMe() { if (!S.tok) { S.me = null; return null; } try { S.me = await api('/api/me', { quiet: true }); } catch (e) { if (e.status === 401) { setToken(''); S.me = null; } } updWallet(); return S.me; }
export function walletChip() {
  const b = h(`<button class="wal walChip">${I.bolt}<b></b></button>`); b.querySelector('svg').style.cssText = 'width:15px;height:15px;color:var(--gold)';
  b.onclick = () => openShop(); fillWal(b); return b;
}
function fillWal(b) { const w = S.me && S.me.wallet; $('b', b).textContent = !w ? t('freeVideos', { n: 3 }) : w.plus ? 'Plus · ' + (w.unlimited ? '∞' : w.plusLeft) : (w.freeVideos + w.credits) + ' 🎬'; }
function updWallet() { $$('.walChip').forEach(fillWal); }

let authP = null;
export function needAuth() {
  if (S.me) return Promise.resolve(S.me);
  if (authP) return authP;
  authP = new Promise(res => openAuth(res)).finally(() => authP = null);
  return authP;
}
function openAuth(done, mode = 'signup') {
  const body = h(`<div><div class="brand" style="margin:4px 0 8px"><img src="logo.svg" alt=""><b>PRICO AI</b></div>
    <p class="mut" style="text-align:center;margin:0 0 18px">${esc(t('authWhy'))}</p>
    <form class="col" autocomplete="on">
      <input class="field nm" name="name" autocomplete="nickname" placeholder="${esc(t('name'))}" maxlength="40">
      <input class="field em" name="email" type="email" autocomplete="email" inputmode="email" placeholder="${esc(t('email'))}" required>
      <input class="field pw" name="password" type="password" autocomplete="new-password" placeholder="${esc(t('password'))}" minlength="6" required>
      <button class="btn pri wide go" type="submit"></button>
      <button class="btn ghost wide sw" type="button" style="height:44px;font-size:14px"></button>
      <div class="mut xs" style="text-align:center">${esc(t('terms'))}</div></form></div>`);
  let ok = false;
  const sh = sheet({ title: '', body, onClose: () => { if (!ok) { /* stay pending until login */ authP = null; } } });
  const set = () => { $('.nm', body).style.display = mode === 'signup' ? '' : 'none'; $('.go', body).textContent = t(mode === 'signup' ? 'signup' : 'login'); $('.sw', body).textContent = t(mode === 'signup' ? 'haveAcc' : 'noAcc'); $('.pw', body).autocomplete = mode === 'signup' ? 'new-password' : 'current-password'; };
  set(); $('.sw', body).onclick = () => { mode = mode === 'signup' ? 'login' : 'signup'; set(); };
  $('form', body).onsubmit = async e => {
    e.preventDefault(); const go = $('.go', body); go.disabled = true;
    try {
      const r = await api('/api/auth/' + (mode === 'signup' ? 'register' : 'login'), { body: { email: $('.em', body).value, password: $('.pw', body).value, name: $('.nm', body).value, lang: lang() } });
      setToken(r.token); S.me = r.me || await api('/api/me'); ok = true;
      if (S.me.lang && S.me.lang !== lang() && !localStorage.getItem('prico.lang')) { /* keep device language */ api('/api/me', { method: 'PATCH', body: { lang: lang() } }).catch(() => {}); }
      updWallet(); sh.close(); haptic([10, 30, 10]); toast(mode === 'signup' ? '🎁 ' + t('freeVideos', { n: S.me.wallet.freeVideos }) : '👋 ' + S.me.name);
      if (mounted.me && S.route === 'me') drawMe(); done(S.me);
    } catch (er) { fail(er); go.disabled = false; }
  };
}

// ---------- router ----------
export function go(r) { if (location.hash !== '#/' + r) location.hash = '#/' + r; else route(); }
function route() {
  const r = (location.hash.slice(2) || 'home').split('/')[0];
  const v = TABS.some(x => x[0] === r) ? r : 'home';
  if (v === 'me' && !S.me) { needAuth().then(() => route()); if (S.route === 'me') return; }
  S.route = v;
  $$('#tabs button').forEach(b => { const on = b.dataset.r === v; b.classList.toggle('on', on); const tb = TABS.find(x => x[0] === b.dataset.r); if (tb[0] !== 'reels') b.querySelector('.ic').innerHTML = I[on ? tb[3] : tb[2]]; });
  $('#tabs').classList.toggle('dark', v === 'home');
  $$('.view').forEach(e => e.classList.toggle('on', e.id === 'v-' + v));
  $('#v-home').classList.add('full');
  if (v !== 'home') pauseAll(); else resumeCur();
  if (v !== 'reels') stopAudio();
  const el = $('#v-' + v);
  if (v === 'home' && !mounted.home) { mounted.home = 1; mountHome(el); }
  if (v === 'create' && !mounted.create) { mounted.create = 1; mountCreate(el); }
  if (v === 'reels' && !mounted.reels) { mounted.reels = 1; mountReels(el); }
  if (v === 'top') { mounted.top = 1; drawTop(); }
  if (v === 'me' && S.me) { mounted.me = 1; drawMe(); }
}
function remountAll() { for (const k of Object.keys(mounted)) delete mounted[k]; buildTabs(); route(); }
function buildTabs() {
  const nav = $('#tabs');
  nav.innerHTML = TABS.map(([r, k, ic]) => r === 'reels' ? `<button data-r="${r}" class="plus" aria-label="${esc(t(k))}"><span class="ic">${I.plus}</span></button>` : `<button data-r="${r}"><span class="ic" style="display:contents">${I[ic]}</span>${esc(t(k))}</button>`).join('');
  $$('button', nav).forEach(b => b.onclick = () => { haptic(6); if (b.dataset.r === S.route && b.dataset.r === 'home') resetFeed(); go(b.dataset.r); });
}

// ---------- Top / daily challenge ----------
let timerT;
async function drawTop() {
  const el = $('#v-top');
  if (!el.firstChild) el.innerHTML = `<div class="pad"><div class="hdr"><h1>${esc(t('topTitle'))}</h1></div><div class="sk" style="height:260px;border-radius:24px"></div></div>`;
  try {
    const c = await api('/api/challenge');
    el.innerHTML = `<div class="pad"><div class="hdr"><h1>${esc(t('topTitle'))}</h1><span class="sp"></span></div>
      <div class="chHero"><img src="${abs(c.tpl.preview)}" alt=""><div class="in"><div class="badge hot" style="display:inline-block">🏆 ${esc(c.day)}</div>
      <h1 style="margin:8px 0 4px">${esc(c.tpl.emoji || '')} ${esc(c.name)}</h1><div class="row mut sm"><span class="timer"></span><span>·</span><span>${esc(t('entries', { n: c.entries }))}</span></div>
      <button class="btn pri wide join" style="margin-top:12px">${I.sparkle}<span>${esc(t('joinCh'))}</span></button></div></div>
      <div class="lbl">${esc(t('leaders'))}</div><div class="lbs"></div></div>`;
    $('.join', el).onclick = () => openTemplate(c.tpl.id, { challenge: true });
    const tick = () => { const s = Math.max(0, (c.endsAt - Date.now()) / 1000 | 0); const tm = $('.timer', el); if (tm) tm.textContent = '⏳ ' + t('endsIn', { t: `${String(s / 3600 | 0).padStart(2, '0')}:${String(s % 3600 / 60 | 0).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` }); };
    clearInterval(timerT); tick(); timerT = setInterval(tick, 1000);
    const lb = $('.lbs', el);
    c.top.forEach((p, i) => { const r = h(`<button class="lb" style="animation-delay:${i * 40}ms"><span class="rk">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span><img class="pv" src="${abs(p.poster)}" alt="" loading="lazy"><div class="sp"><div style="font-weight:750">@${esc(p.user.handle)}</div><div class="mut xs" style="margin-top:3px;max-height:2.6em;overflow:hidden">${esc(p.caption || '')}</div></div><span class="lk">${I.heart}${fmt(p.likes)}</span></button>`); r.onclick = () => openPost(p); lb.append(r); });
    if (!c.top.length) lb.innerHTML = `<div class="empty" style="height:160px">🏁</div>`;
  } catch (e) { fail(e); }
}
export function openPost(p) { closeAll(); go('home'); setTimeout(() => resetFeed(p), 60); }

// ---------- Me / profiles ----------
async function drawMe() {
  const el = $('#v-me'); const u = S.me; if (!u) return;
  el.innerHTML = `<div class="pad"><div class="hdr"><h2>@${esc(u.handle)}</h2><span class="sp"></span><button class="iconBtn set" aria-label="${esc(t('settings'))}">${I.gear}</button></div>
    <div class="prof"><label style="display:inline-block;position:relative;cursor:pointer"><img class="bigAva" src="${abs(u.avatar) || 'icons/icon-192.png'}" alt=""><input type="file" accept="image/*" class="avIn" style="display:none"><span class="iconBtn" style="position:absolute;right:-4px;bottom:-4px;width:30px;height:30px;background:var(--a1)">${I.camera}</span></label>
    <h2 style="margin-top:10px">${esc(u.name)} ${u.verified ? `<span class="verified" style="display:inline-block;vertical-align:-2px">${I.verified}</span>` : ''}</h2>${u.bio ? `<div class="mut sm" style="margin-top:4px">${esc(u.bio)}</div>` : ''}
    <div class="stats"><div><b>${fmt(u.followers)}</b><span>${esc(t('followers'))}</span></div><div><b>${fmt(u.following)}</b><span>${esc(t('followingN'))}</span></div><div><b class="pc">–</b><span>${esc(t('posts'))}</span></div></div>
    <div class="row" style="justify-content:center"><button class="btn sm edit">${esc(t('editProfile'))}</button><button class="btn sm fcs">🤳 ${esc(t('facesTitle'))} · ${u.faces.length}/3</button></div></div>
    <div class="walletCard"><div style="font-size:30px">${u.wallet.plus ? '👑' : '🎬'}</div><div class="sp" style="position:relative"><div style="font-weight:800">${esc(u.wallet.plus ? t('plusActive') + (u.wallet.unlimited ? ' · ∞' : '') : t('freeVideos', { n: u.wallet.freeVideos }))}</div><div class="mut sm">${esc(t('credits', { n: u.wallet.credits }))} · 📸 ${u.wallet.photosLeft > 99 ? '∞' : u.wallet.photosLeft} · 🎞️ ${u.wallet.reelsLeft > 99 ? '∞' : u.wallet.reelsLeft}</div></div><button class="btn pri sm shop" style="position:relative">${esc(t(u.wallet.plus ? 'buy' : 'getPlus'))}</button></div>
    <div class="ptabs"><button data-t="posts" class="on">${esc(t('posts'))}</button><button data-t="lib">${esc(t('creations'))}</button></div><div class="pgrid"></div></div>`;
  $('.set', el).onclick = openSettings; $('.shop', el).onclick = () => openShop(); $('.fcs', el).onclick = manageFaces; $('.edit', el).onclick = editProfile;
  $('.avIn', el).onchange = async e => { const f = e.target.files[0]; if (!f) return; try { S.me = await api('/api/me/avatar', { body: f, type: f.type }); drawMe(); } catch (er) { fail(er); } };
  const grid = $('.pgrid', el);
  const [pr, lr] = await Promise.all([api('/api/users/' + u.handle).catch(() => ({ posts: [] })), api('/api/library').catch(() => ({ items: [] }))]);
  $('.pc', el).textContent = fmt(pr.posts.length);
  const show = k => {
    grid.innerHTML = '';
    const list = k === 'posts' ? pr.posts : lr.items;
    if (!list.length) { grid.innerHTML = `<div class="empty" style="grid-column:1/-1;height:200px"><div class="big">✨</div>${esc(t('emptyLib'))}</div>`; return; }
    for (const x of list) { const b = h(`<button><img src="${abs(x.poster)}" alt="" loading="lazy">${k === 'posts' ? `<span class="lk">${I.heart}${fmt(x.likes)}</span>` : x.type === 'video' ? `<span class="lk">${I.play}</span>` : ''}</button>`); b.onclick = async () => { if (k === 'posts') openPost(x); else { const { showResult } = await import('./create.js'); showResult(x, {}); } }; grid.append(b); }
  };
  $$('.ptabs button', el).forEach(b => b.onclick = () => { $$('.ptabs button', el).forEach(z => z.classList.toggle('on', z === b)); show(b.dataset.t); });
  show('posts');
}
function editProfile() {
  const body = h(`<div class="col"><input class="field n" maxlength="40" placeholder="${esc(t('name'))}"><textarea class="field b" maxlength="160" placeholder="${esc(t('bio'))}"></textarea></div>`);
  $('.n', body).value = S.me.name; $('.b', body).value = S.me.bio || '';
  const foot = h(`<button class="btn pri wide">${esc(t('done'))}</button>`);
  const sh = sheet({ title: t('editProfile'), body, foot });
  foot.onclick = async () => { try { S.me = await api('/api/me', { method: 'PATCH', body: { name: $('.n', body).value, bio: $('.b', body).value } }); sh.close(); drawMe(); } catch (e) { fail(e); } };
}
export async function openUser(handle) {
  if (S.me && S.me.handle === handle) { closeAll(); return go('me'); }
  const body = h('<div><div class="sk" style="height:200px;border-radius:20px"></div></div>');
  const sh = sheet({ title: '@' + handle, body, full: true });
  try {
    const r = await api('/api/users/' + encodeURIComponent(handle)); const u = r.user;
    body.innerHTML = `<div class="prof"><img class="bigAva" src="${abs(u.avatar) || 'icons/icon-192.png'}" alt=""><h2 style="margin-top:10px">${esc(u.name)} ${u.verified ? `<span class="verified" style="display:inline-block;vertical-align:-2px">${I.verified}</span>` : ''}</h2>${u.bio ? `<div class="mut sm" style="margin-top:4px">${esc(u.bio)}</div>` : ''}
      <div class="stats"><div><b class="fc">${fmt(u.followers)}</b><span>${esc(t('followers'))}</span></div><div><b>${fmt(u.following)}</b><span>${esc(t('followingN'))}</span></div><div><b>${fmt(r.posts.length)}</b><span>${esc(t('posts'))}</span></div></div>
      <button class="btn ${u.isFollowing ? '' : 'pri'} fol" style="min-width:160px">${esc(t(u.isFollowing ? 'unfollow' : 'follow'))}</button></div><div class="pgrid"></div>`;
    const fb = $('.fol', body);
    fb.onclick = async () => { await needAuth(); try { const x = await api(`/api/users/${handle}/follow`, { method: 'POST' }); fb.className = 'btn fol ' + (x.user.isFollowing ? '' : 'pri'); fb.textContent = t(x.user.isFollowing ? 'unfollow' : 'follow'); $('.fc', body).textContent = fmt(x.user.followers); haptic(); } catch (e) { fail(e); } };
    const g = $('.pgrid', body); r.posts.forEach(p => { const b = h(`<button><img src="${abs(p.poster)}" alt="" loading="lazy"><span class="lk">${I.heart}${fmt(p.likes)}</span></button>`); b.onclick = () => { sh.close(); openPost(p); }; g.append(b); });
  } catch (e) { fail(e); sh.close(); }
}

// ---------- settings ----------
function openSettings() {
  const cur = localStorage.getItem('prico.lang') || 'auto';
  const body = h(`<div class="list">
    <div class="lbl" style="margin-top:4px">${I.globe.replace('<svg', '<svg style="width:15px;height:15px;vertical-align:-2px"')} ${esc(t('language'))}</div>
    ${[['auto', t('auto')], ...LANGS].map(([c, n]) => `<button class="li lg" data-l="${c}"><span class="sp" ${c !== 'auto' ? `lang="${c}"` : ''}>${esc(n)}</span><span class="check ${c === cur ? 'on' : ''}"></span></button>`).join('')}
    <div class="lbl">${esc(t('about'))}</div>
    <button class="li sfty">${I.shield}<span class="sp">${esc(t('safety'))}</span>${I.chev}</button>
    <button class="li inst" style="${NATIVE ? 'display:none' : ''}">${I.download}<span class="sp">${esc(t('install'))}</span></button>
    <button class="li out">${I.logout}<span class="sp">${esc(t('logout'))}</span></button>
    <div class="mut xs" style="margin-top:18px;line-height:1.5">PRICO AI · ${esc(t('version'))} 1.0.0 · © PRICOP.studio<br>AI: ${esc(S.cat.provider)}<br>${esc(t('credit'))}</div></div>`);
  const sh = sheet({ title: t('settings'), body, full: true });
  $$('.lg', body).forEach(b => b.onclick = async () => {
    const l = b.dataset.l; l === 'auto' ? localStorage.removeItem('prico.lang') : localStorage.setItem('prico.lang', l);
    await setLang(l === 'auto' ? detect() : l); haptic();
    if (S.me) api('/api/me', { method: 'PATCH', body: { lang: lang() } }).catch(() => {});
    await loadCatalog(); sh.close(); remountAll(); toast('✓ ' + t('language'));
  });
  $('.sfty', body).onclick = () => sheet({ title: t('safety'), body: `<p style="line-height:1.55;margin-top:0">${esc(t('safetyText'))}</p>` });
  $('.inst', body).onclick = () => { if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; } else toast(/iP(hone|ad)/.test(navigator.userAgent) ? 'Safari → Share → Add to Home Screen' : 'Menu → Install app'); };
  $('.out', body).onclick = async () => { await api('/api/auth/logout', { method: 'POST' }).catch(() => {}); setToken(''); S.me = null; sh.close(); remountAll(); go('home'); };
}
let deferredInstall = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });

// ---------- shop (demo payments) ----------
export async function openShop() {
  await needAuth();
  const body = h('<div><div class="sk" style="height:160px;border-radius:22px"></div></div>');
  const sh = sheet({ title: t('shopTitle'), body });
  try {
    const r = await api('/api/shop');
    const sub = r.products.find(p => p.kind === 'sub'); const packs = r.products.filter(p => p.kind === 'pack');
    const money = p => new Intl.NumberFormat(lang(), { style: 'currency', currency: p.currency }).format(p.price);
    body.innerHTML = `<div class="plan"><span class="badge hot best">${esc(t('best'))}</span><div class="row"><span style="font-size:30px">👑</span><div class="sp"><h2>${esc(t('plusName'))}</h2><div class="mut sm">${esc(t('plusDesc'))}</div></div></div>
      <div class="row" style="margin-top:12px"><span class="price">${money(sub)}</span><span class="mut">${esc(t('perMonth'))}</span><span class="sp"></span><button class="btn pri sm" data-p="${sub.id}">${esc(t(r.wallet && r.wallet.plus ? 'plusActive' : 'getPlus'))}</button></div></div>
      ${packs.map(p => `<button class="pack" data-p="${p.id}"><span style="font-size:24px">🎬</span><span class="sp" style="font-weight:750">${esc(t('pack', { n: p.credits }))}</span><span class="price" style="font-size:18px">${money(p)}</span></button>`).join('')}
      ${r.mode === 'demo' ? `<div class="mut xs" style="text-align:center;margin-top:14px">🧪 ${esc(t('demoPay'))}</div>` : ''}`;
    $$('[data-p]', body).forEach(b => b.onclick = async () => { try { const x = await api('/api/shop/buy', { body: { productId: b.dataset.p } }); S.me.wallet = x.wallet; updWallet(); confetti(); toast(t('bought')); sh.close(); if (S.route === 'me') drawMe(); } catch (e) { fail(e); } });
  } catch (e) { fail(e); }
}

// ---------- onboarding ----------
function onboarding() {
  return new Promise(res => {
    const P = S.cat.templates.map(x => abs(x.preview)); const pick = o => [0, 1, 2, 3].map(i => P[(i * 7 + o) % P.length]);
    const col = o => `<div class="colm">${[...pick(o), ...pick(o)].map(s => `<img src="${s}" alt="">`).join('')}</div>`;
    const el = h(`<div class="onb"><button class="skip">${esc(t('skip'))}</button><div class="slides">${[1, 2, 3].map(i => `<div class="sl"><div class="collage">${col(i * 3)}${col(i * 3 + 1)}${col(i * 3 + 2)}</div><div class="tx">${i === 1 ? `<div class="brand" style="margin-bottom:18px"><img src="logo.svg" alt=""><b>PRICO AI</b></div>` : ''}<h1>${esc(t('onb' + i + 't'))}</h1><p>${esc(t('onb' + i + 'd'))}</p></div></div>`).join('')}</div>
      <div class="ctl"><div class="dots"><i class="on"></i><i></i><i></i></div><button class="btn pri wide nx">${esc(t('next'))}</button><button class="mut sm lgb" style="font-weight:650">${I.globe.replace('<svg', '<svg style="width:15px;height:15px;vertical-align:-3px"')} ${esc(LANGS.find(l => l[0] === lang())[1])}</button></div></div>`);
    document.body.append(el);
    let i = 0; const sl = $('.slides', el);
    const set = () => { sl.style.transform = `translateX(${-i * 100}%)`; $$('.dots i', el).forEach((d, k) => d.classList.toggle('on', k === i)); $('.nx', el).textContent = t(i === 2 ? 'start' : 'next'); };
    const fin = () => { localStorage.setItem('prico.onb', '1'); el.style.transition = 'opacity .4s'; el.style.opacity = 0; setTimeout(() => el.remove(), 400); res(); };
    $('.nx', el).onclick = () => { haptic(); if (i < 2) { i++; set(); } else fin(); };
    $('.skip', el).onclick = fin;
    let x0 = null; el.addEventListener('touchstart', e => x0 = e.touches[0].clientX, { passive: true });
    el.addEventListener('touchend', e => { if (x0 == null) return; let dx = e.changedTouches[0].clientX - x0; if (lang() === 'ar') dx = -dx; if (dx < -50 && i < 2) { i++; set(); } else if (dx > 50 && i > 0) { i--; set(); } x0 = null; });
    $('.lgb', el).onclick = () => { const body = h(`<div class="list">${LANGS.map(([c, n]) => `<button class="li" data-l="${c}" lang="${c}"><span class="sp">${esc(n)}</span><span class="check ${c === lang() ? 'on' : ''}"></span></button>`).join('')}</div>`); body.style.cssText = ''; const sh = sheet({ title: t('language'), body }); sh.el.style.zIndex = 80; $$('button', body).forEach(b => b.onclick = async () => { localStorage.setItem('prico.lang', b.dataset.l); await setLang(b.dataset.l); await loadCatalog(); sh.close(); el.remove(); buildTabs(); onboarding().then(res); }); };
  });
}

async function loadCatalog() { S.cat = await api('/api/catalog'); }

// ---------- boot ----------
async function boot() {
  await setLang(detect());
  buildTabs();
  const [, me] = await Promise.all([loadCatalog().catch(async e => { await new Promise(r => setTimeout(r, 1500)); return loadCatalog(); }), refreshMe()]);
  if (S.me && !localStorage.getItem('prico.lang') && S.me.lang && S.me.lang !== lang() && LANGS.some(l => l[0] === S.me.lang)) { /* device language wins in auto mode */ }
  const deep = location.pathname.match(/^\/p\/([\w-]+)/);
  const q = new URLSearchParams(location.search);
  if (!localStorage.getItem('prico.onb') && !deep) await onboarding();
  addEventListener('hashchange', route);
  if (deep) { try { const r = await api('/api/posts/' + deep[1]); history.replaceState(null, '', '/#/home'); route(); setTimeout(() => resetFeed(r.post), 30); } catch { history.replaceState(null, '', '/#/home'); route(); } }
  else route();
  if (q.get('tpl')) setTimeout(() => openTemplate(q.get('tpl')), 300);
  document.addEventListener('visibilitychange', () => document.hidden ? pauseAll() : resumeCur());
  if ('serviceWorker' in navigator && !NATIVE && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {});
  setTimeout(() => import('./seg.js').then(m => S.me && !S.me.faces.length && m.warmup()).catch(() => {}), 4000);
}
boot().catch(e => { console.error(e); document.body.insertAdjacentHTML('beforeend', `<div class="empty" style="position:fixed;inset:0;z-index:99;background:var(--bg)"><div class="big">📡</div><div>${esc(t('e_network'))}</div><button class="btn pri" onclick="location.reload()">${esc(t('retry'))}</button></div>`); });
