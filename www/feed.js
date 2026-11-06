// Home: TikTok-style vertical feed with autoplay, double-tap like, comments, share, report, "Put me in".
import { t } from './i18n.js';
import { S, I, api, h, esc, fmt, ago, abs, toast, fail, sheet, haptic, shareRow, origin, $, $$ } from './core.js';
import { needAuth, go, openUser, openShop } from './app.js';
import { openTemplate } from './create.js';

let tab = 'foryou', next = 0, loading = false, io, root, scroller, cur = null;
const seen = new Set();

export function mountHome(el) {
  root = el; el.innerHTML = '';
  el.append(h(`<div id="feed" style="position:absolute;inset:0"><div id="feedScroll"></div>
    <img class="logoMini" src="logo.svg" alt="PRICO AI">
    <div class="feedSide"><button class="liveP" aria-label="LIVE">🔴 LIVE</button><button class="topP" aria-label="${esc(t('tabTop'))}">🏆</button></div>
    <div class="feedTop">${['following', 'foryou', 'challenge'].map(k => `<button data-k="${k}" class="${k === tab ? 'on' : ''}">${esc(t(k === 'foryou' ? 'forYou' : k))}</button>`).join('')}</div>
    <button class="soundBtn" aria-label="sound">${S.muted ? I.volOff : I.volOn}</button></div>`));
  scroller = $('#feedScroll', el);
  $('.liveP', el).onclick = () => { location.hash = '#/live'; };
  $('.topP', el).onclick = () => { location.hash = '#/top'; };
  $$('.feedTop button', el).forEach(b => b.onclick = () => { if (b.dataset.k === 'following' && !S.me) return needAuth().then(() => switchTab('following')); switchTab(b.dataset.k); });
  $('.soundBtn', el).onclick = () => { S.muted = !S.muted; $('.soundBtn', el).innerHTML = S.muted ? I.volOff : I.volOn; if (cur) { const v = $('video', cur); if (v) { v.muted = S.muted; v.play().catch(() => {}); } } haptic(); };
  io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting && e.intersectionRatio > .6) activate(e.target); else deactivate(e.target); }), { root: scroller, threshold: [0, .6, 1] });
  scroller.addEventListener('scroll', () => { if (next != null && !loading && scroller.scrollTop + scroller.clientHeight * 3 > scroller.scrollHeight) load(); }, { passive: true });
  reset();
}
export function switchTab(k) { tab = k; $$('.feedTop button', root).forEach(b => b.classList.toggle('on', b.dataset.k === k)); reset(); }
export function reset(first) { scroller.innerHTML = ''; next = 0; seen.clear(); cur = null; if (first) scroller.append(slide(first)); load(); }
export function pauseAll() { $$('video', scroller || document.createElement('div')).forEach(v => v.pause()); }
export function resumeCur() { if (cur && S.route === 'home') { const v = $('video', cur); v && v.play().catch(() => {}); } }

async function load() {
  if (loading || next == null) return; loading = true;
  if (!scroller.children.length) scroller.append(h('<div class="slide sk"></div>'));
  try {
    const r = await api(`/api/feed?tab=${tab}&cursor=${next}`);
    $$('.slide.sk', scroller).forEach(x => x.remove());
    for (const p of r.items) if (!seen.has(p.id)) scroller.append(slide(p));
    next = r.next;
    if (!scroller.children.length) scroller.append(h(`<div class="slide"><div class="empty"><div class="big">${tab === 'following' ? '👥' : '✨'}</div><div>${esc(t(tab === 'following' ? 'emptyFollowing' : 'emptyLib'))}</div><button class="btn pri" onclick="location.hash='#/create'">${esc(t('tabCreate'))}</button></div></div>`));
  } catch (e) { $$('.slide.sk', scroller).forEach(x => x.remove()); if (!scroller.children.length) scroller.append(h(`<div class="slide"><div class="empty"><div class="big">📡</div><div>${esc(t('e_network'))}</div><button class="btn" id="rt">${esc(t('retry'))}</button></div></div>`)), $('#rt', scroller).onclick = reset; }
  loading = false;
}

function activate(el) {
  if (!el.dataset.id) return; cur = el;
  const v = $('video', el);
  if (v) { if (!v.src) v.src = abs(v.dataset.src); v.muted = S.muted; if (S.route === 'home') v.play().catch(() => { v.muted = true; S.muted = true; v.play().catch(() => {}); }); }
  // warm the next slide
  const n = el.nextElementSibling; const nv = n && $('video', n); if (nv && !nv.src) { nv.preload = 'auto'; nv.src = abs(nv.dataset.src); }
}
function deactivate(el) { const v = $('video', el); if (v && !v.paused) v.pause(); }

function slide(p) {
  seen.add(p.id);
  const u = p.user || {};
  const el = h(`<div class="slide" data-id="${p.id}">
    ${p.type === 'video' ? `<video class="media" playsinline loop muted preload="none" poster="${abs(p.poster)}" data-src="${abs(p.url)}"></video>` : `<img class="media" src="${abs(p.url)}" alt="" loading="lazy" decoding="async">`}
    <div class="shade"></div>
    ${p.demo ? `<span class="badge demoTag">DEMO</span>` : ''}
    <div class="rail">
      <div class="avaWrap"><img class="ava" src="${abs(u.avatar) || 'icons/icon-96.png'}" alt=""><button class="fol ${u.isFollowing ? 'done' : ''}" ${S.me && S.me.id === u.id ? 'style="display:none"' : ''}>${u.isFollowing ? '✓' : '+'}</button></div>
      <button class="act like ${p.liked ? 'liked' : ''}">${I.heart}<span>${fmt(p.likes)}</span></button>
      <button class="act cmt">${I.comment}<span>${fmt(p.comments)}</span></button>
      <button class="act shr">${I.share}<span>${fmt(p.shares)}</span></button>
      <button class="act rep" aria-label="${esc(t('report'))}">${I.more}</button>
    </div>
    <div class="cap">
      <div class="who">@${esc(u.handle)} ${u.verified ? `<span class="verified">${I.verified}</span>` : ''} <span class="mut xs" style="font-weight:600">· ${ago(p.createdAt)}</span></div>
      ${p.caption ? `<div class="txt">${esc(p.caption)}</div>` : ''}
      ${p.tpl ? `<div><button class="wantBtn">${I.sparkle}<span>${esc(t('wantSame'))}</span><span style="opacity:.85">· ${esc(p.tpl.emoji || '')} ${esc(p.tpl.name)}</span></button></div>` : ''}
    </div>
    <div class="progressLine"></div></div>`);
  const v = $('video', el), pl = $('.progressLine', el);
  if (v) v.addEventListener('timeupdate', () => { pl.style.width = (v.currentTime / (v.duration || 1) * 100) + '%'; });
  // tap = pause/play, double tap = like
  let lastTap = 0, tapT;
  $('.media', el).parentElement.addEventListener('click', e => {
    if (e.target.closest('.rail,.cap,button')) return;
    const now = Date.now();
    if (now - lastTap < 300) { clearTimeout(tapT); burst(el, e); if (!p.liked) like(p, el); lastTap = 0; return; }
    lastTap = now;
    tapT = setTimeout(() => { if (v) { if (v.paused) { v.play().catch(() => {}); } else v.pause(); } }, 300);
  });
  $('.ava', el).onclick = () => openUser(u.handle);
  $('.fol', el).onclick = async ev => { ev.stopPropagation(); await needAuth(); try { const r = await api(`/api/users/${u.handle}/follow`, { method: 'POST' }); const b = $('.fol', el); b.classList.toggle('done', r.user.isFollowing); b.textContent = r.user.isFollowing ? '✓' : '+'; haptic(); $$(`.slide`, scroller).forEach(s => { if (s !== el && $('.who', s)?.textContent.includes('@' + u.handle + ' ')) { const f = $('.fol', s); f.classList.toggle('done', r.user.isFollowing); f.textContent = r.user.isFollowing ? '✓' : '+'; } }); } catch (e) { fail(e); } };
  $('.like', el).onclick = () => like(p, el);
  $('.cmt', el).onclick = () => openComments(p, el);
  $('.shr', el).onclick = () => openShare(p, el);
  $('.rep', el).onclick = () => openReport(p);
  const w = $('.wantBtn', el); if (w) w.onclick = () => { haptic(); p.tpl.kind === 'reel' || p.reel ? go('reels') : openTemplate(p.tpl.id); };
  io && io.observe(el);
  return el;
}

function burst(el, e) {
  const r = el.getBoundingClientRect();
  const b = h(`<div class="heartBurst" style="left:${e.clientX - r.left}px;top:${e.clientY - r.top}px">${I.heart}</div>`); el.append(b); haptic(12);
  setTimeout(() => b.remove(), 850);
}
async function like(p, el) {
  await needAuth();
  const b = $('.like', el); p.liked = !p.liked; p.likes += p.liked ? 1 : -1; b.classList.toggle('liked', p.liked); $('span', b).textContent = fmt(p.likes); haptic();
  try { const r = await api(`/api/posts/${p.id}/like`, { method: 'POST' }); p.liked = r.liked; p.likes = r.likes; b.classList.toggle('liked', r.liked); $('span', b).textContent = fmt(r.likes); } catch (e) { fail(e); }
}

export async function openComments(p, el) {
  const list = h('<div><div class="sk" style="height:60px;border-radius:14px"></div></div>');
  const foot = h(`<form class="composer"><input class="field" maxlength="300" placeholder="${esc(t('addComment'))}"><button class="btn pri sm" style="height:46px">${esc(t('send'))}</button></form>`);
  const sh = sheet({ title: `${t('comments')} · ${fmt(p.comments)}`, body: list, foot });
  const row = c => h(`<div class="cm"><img src="${abs(c.user.avatar) || 'icons/icon-96.png'}" alt=""><div><div class="h">@${esc(c.user.handle)} · ${ago(c.createdAt)}</div><div class="b">${esc(c.text)}</div></div></div>`);
  try { const r = await api(`/api/posts/${p.id}/comments`); list.innerHTML = ''; r.items.forEach(c => list.append(row(c))); if (!r.items.length) list.innerHTML = `<div class="empty" style="height:160px">${esc(t('noComments'))}</div>`; } catch (e) { fail(e); }
  foot.onsubmit = async ev => {
    ev.preventDefault(); const inp = $('input', foot); const text = inp.value.trim(); if (!text) return;
    await needAuth();
    try { const r = await api(`/api/posts/${p.id}/comments`, { body: { text } }); if (!list.querySelector('.cm')) list.innerHTML = ''; list.append(row(r.comment)); inp.value = ''; p.comments = r.comments; el && ($('.cmt span', el).textContent = fmt(r.comments)); sh.sb.scrollTop = 1e6; haptic(); } catch (e) { fail(e); }
  };
}
export function openShare(p, el) {
  const link = `${origin()}/p/${p.id}`;
  const body = h(`<div class="col"></div>`);
  const sh = sheet({ title: t('share'), body });
  body.append(shareRow(async () => { api(`/api/posts/${p.id}/share`, { method: 'POST' }).then(r => { p.shares = r.shares; el && ($('.shr span', el).textContent = fmt(r.shares)); }).catch(() => {}); return { url: p.url, type: p.type, caption: p.caption ? p.caption + ' #PRICOAI' : '#PRICOAI', link }; }));
  const cp = h(`<button class="btn wide" style="margin-top:8px">${I.copy} ${esc(t('copy'))} link</button>`);
  cp.onclick = async () => { const { copyText } = await import('./core.js'); await copyText(link); toast(t('copied')); sh.close(); };
  body.append(cp);
  const dm = h(`<button class="btn pri wide" style="margin-top:8px">💌 ${esc(t('sendToFriend'))}</button>`);
  dm.onclick = async () => { sh.close(); (await import('./inbox.js')).sendPostTo(p); };
  body.prepend(dm);
}
export function openReport(p) {
  const rs = ['rNude', 'rMinor', 'rHate', 'rFake', 'rSpam', 'rOther'];
  const body = h(`<div class="list">${rs.map(r => `<button class="li" data-r="${r}">${I.flag}<span>${esc(t(r))}</span></button>`).join('')}</div>`);
  const sh = sheet({ title: t('reasons'), body });
  $$('button', body).forEach(b => b.onclick = async () => { try { await api(`/api/posts/${p.id}/report`, { body: { reason: b.dataset.r.slice(1).toLowerCase() } }); toast(t('reported')); sh.close(); } catch (e) { fail(e); } });
}
