// Inbox: 1:1 + group chats (realtime WebSocket), photos/videos/shared posts, typing, read receipts ("Seen"),
// block / report / leave, and Activity notifications (likes, comments, follows, LIVE).
import { t } from './i18n.js';
import { S, I, api, h, esc, abs, ago, toast, fail, sheet, haptic, $, $$, BASE } from './core.js';
import { needAuth, openUser, openPost } from './app.js';
import * as rt from './rt.js';

let root = null, seg = 'msgs', convs = [], openCid = null;
const ava = u => abs(u?.avatar) || 'icons/icon-192.png';
const convAva = c => c.group ? `<div class="gAva">${c.members.slice(0, 2).map(u => `<img src="${ava(u)}" alt="">`).join('')}</div>` : `<img class="ava" src="${ava(c.members[0])}" alt="">`;
const convName = c => c.group ? (c.name || c.members.map(u => u.name).slice(0, 3).join(', ')) : (c.members[0]?.name || '—');
const preview = (m, mine) => !m ? '' : (mine ? t('you') + ': ' : '') + (m.type === 'image' ? '📷 ' + t('photo') : m.type === 'video' ? '🎬 ' + t('video') : m.type === 'post' ? '🔁 ' + t('sharedPost') : m.type === 'system' ? '✨ ' + t('groupCreated') : m.text);

export function mountInbox(el) {
  root = el;
  el.innerHTML = `<div class="pad"><div class="hdr"><h1>${esc(t('tabInbox'))}</h1><span class="sp"></span><button class="iconBtn newc" aria-label="${esc(t('newChat'))}">✏️</button></div>
    <div class="segs"><button data-s="msgs" class="on">${esc(t('messages'))}<i class="bdg"></i></button><button data-s="act">${esc(t('activity'))}<i class="bdg"></i></button></div><div class="ibody"></div></div>`;
  $('.newc', el).onclick = () => newChat();
  $$('.segs button', el).forEach(b => b.onclick = () => { seg = b.dataset.s; $$('.segs button', el).forEach(z => z.classList.toggle('on', z === b)); draw(); });
  draw();
}
export function refreshInbox() { if (root && S.route === 'inbox') draw(); }
async function draw() {
  if (!root) return; const body = $('.ibody', root);
  if (!S.me) { body.innerHTML = `<div class="empty" style="height:50vh"><div class="big">💬</div><div>${esc(t('inboxLogin'))}</div><button class="btn pri li0">${esc(t('login'))}</button></div>`; $('.li0', body).onclick = () => needAuth().then(draw); return; }
  updBadges();
  if (seg === 'msgs') {
    if (!convs.length) body.innerHTML = `<div class="sk" style="height:64px;border-radius:16px;margin-top:12px"></div>`;
    try { const r = await api('/api/inbox'); convs = r.items; Object.assign(rt.badges, r.badges); updBadges(); } catch (e) { return fail(e); }
    if (seg !== 'msgs') return;
    body.innerHTML = convs.length ? `<div class="list convs">${convs.map(c => `<button class="li conv ${c.unread ? 'unr' : ''}" data-c="${c.id}">${convAva(c)}<div class="sp"><div class="nm">${esc(convName(c))} ${c.group ? `<span class="mut xs">· ${c.members.length + 1}</span>` : ''}</div><div class="mut sm lastm">${esc(preview(c.last, c.last?.uid === S.me.id))}</div></div><div class="mut xs rt">${c.last ? esc(ago(c.last.at)) : ''}${c.unread ? `<i class="dot">${c.unread}</i>` : c.seen ? '<i class="seen">✓✓</i>' : ''}</div></button>`).join('')}</div>`
      : `<div class="empty" style="height:46vh"><div class="big">💌</div><div>${esc(t('noChats'))}</div><button class="btn pri nc2">✏️ ${esc(t('newChat'))}</button></div>`;
    $$('.conv', body).forEach(b => b.onclick = () => openConv(b.dataset.c));
    const nc = $('.nc2', body); if (nc) nc.onclick = () => newChat();
  } else {
    body.innerHTML = `<div class="sk" style="height:64px;border-radius:16px;margin-top:12px"></div>`;
    let r; try { r = await api('/api/notifs'); rt.badges.notifs = 0; updBadges(); } catch (e) { return fail(e); }
    if (seg !== 'act') return;
    const txt = n => n.type === 'like' ? t('nLike') : n.type === 'comment' ? t('nComment') + (n.text ? `: “${n.text}”` : '') : n.type === 'follow' ? t('nFollow') : n.type === 'live' ? '🔴 ' + t('nLive') + (n.text ? ` — ${n.text}` : '') : n.text || '';
    body.innerHTML = r.items.length ? `<div class="list">${r.items.map(n => `<button class="li ntf ${n.at > r.seen ? 'unr' : ''}" data-id="${n.id}"><img class="ava" src="${ava(n.user)}" alt=""><div class="sp"><b>${esc(n.user?.name || '')}</b> <span class="sm">${esc(txt(n))}</span><div class="mut xs">${esc(ago(n.at))}</div></div>${n.poster ? `<img class="np" src="${abs(n.poster)}" alt="">` : n.type === 'follow' ? '<span class="chip2">👤</span>' : ''}</button>`).join('')}</div>`
      : `<div class="empty" style="height:46vh"><div class="big">🔔</div><div>${esc(t('noActivity'))}</div></div>`;
    $$('.ntf', body).forEach(b => b.onclick = async () => {
      const n = r.items.find(x => x.id === b.dataset.id); if (!n) return;
      if (n.type === 'live' && n.live) { const { watchLive } = await import('./live.js'); return watchLive(n.live); }
      if (n.post) { try { const x = await api('/api/posts/' + n.post); openPost(x.post); } catch (e) { fail(e); } return; }
      if (n.user) openUser(n.user.handle);
    });
  }
}
export function updBadges() {
  const b = rt.badges; const tot = (b.msgs || 0) + (b.notifs || 0);
  const tb = document.querySelector('#tabs [data-r="inbox"] .tbdg'); if (tb) { tb.textContent = tot > 99 ? '99+' : tot || ''; tb.classList.toggle('on', tot > 0); }
  if (root) { const [a, c] = $$('.segs .bdg', root); if (a) { a.textContent = b.msgs || ''; a.classList.toggle('on', b.msgs > 0); } if (c) { c.textContent = b.notifs || ''; c.classList.toggle('on', b.notifs > 0); } }
}
rt.on('badges', updBadges);
rt.on('msg', m => {
  const i = convs.findIndex(c => c.id === m.c); if (i >= 0) convs.splice(i, 1); convs.unshift(m.conv);
  if (m.c !== openCid && m.m.uid !== S.me?.id) { haptic(12); if (S.route !== 'inbox') toast(`💬 ${convName(m.conv)}: ${preview(m.m).slice(0, 60)}`); }
  if (S.route === 'inbox' && seg === 'msgs' && m.c !== openCid) draw();
});
rt.on('notif', m => { if (S.route === 'inbox' && seg === 'act') draw(); else if (m.n.type === 'live') toast(`🔴 ${m.n.user?.name} ${t('nLive')}`); });

// ---------- new chat / group ----------
export async function newChat(onPick) {
  await needAuth();
  const picked = new Map();
  const body = h(`<div class="col"><input class="field q" placeholder="🔎 ${esc(t('searchUsers'))}" autocomplete="off"><div class="chipRow pk"></div><div class="list us"></div></div>`);
  const foot = h(`<div class="col"><input class="field gn" placeholder="${esc(t('groupName'))}" maxlength="40" style="display:none"><button class="btn pri wide go" disabled>${esc(t('startChat'))}</button></div>`);
  const sh = sheet({ title: '✏️ ' + t('newChat'), body, foot, full: true });
  const drawPk = () => { $('.pk', body).innerHTML = [...picked.values()].map(u => `<button class="chip2 on" data-id="${u.id}"><img src="${ava(u)}" alt="" style="width:20px;height:20px;border-radius:50%"> ${esc(u.name)} ✕</button>`).join(''); $$('.pk button', body).forEach(b => b.onclick = () => { picked.delete(b.dataset.id); drawPk(); search(); });
    const n = picked.size; $('.go', foot).disabled = !n; $('.go', foot).textContent = n > 1 ? t('createGroup', { n: n + 1 }) : t('startChat'); $('.gn', foot).style.display = n > 1 ? '' : 'none'; };
  let qT;
  const search = async () => {
    try { const r = await api('/api/search/users?q=' + encodeURIComponent($('.q', body).value.trim()));
      $('.us', body).innerHTML = r.items.map(u => `<button class="li" data-id="${u.id}"><img class="ava" src="${ava(u)}" alt=""><div class="sp"><b>${esc(u.name)}</b><div class="mut xs">@${esc(u.handle)}</div></div><span class="check ${picked.has(u.id) ? 'on' : ''}"></span></button>`).join('') || `<div class="mut sm" style="padding:20px;text-align:center">${esc(t('noUsers'))}</div>`;
      $$('.us .li', body).forEach(b => b.onclick = () => { const u = r.items.find(x => x.id === b.dataset.id); picked.has(u.id) ? picked.delete(u.id) : picked.set(u.id, u); haptic(5); $('.check', b).classList.toggle('on', picked.has(u.id)); drawPk(); });
    } catch (e) { fail(e); }
  };
  $('.q', body).oninput = () => { clearTimeout(qT); qT = setTimeout(search, 250); };
  search();
  $('.go', foot).onclick = async () => {
    try { const r = await api('/api/convs', { body: { users: [...picked.values()].map(u => u.handle), group: picked.size > 1, name: $('.gn', foot).value } }); sh.close(); onPick ? onPick(r.conv) : openConv(r.conv.id); } catch (e) { fail(e); }
  };
}
export async function chatWith(handle) { await needAuth(); try { const r = await api('/api/convs', { body: { users: [handle] } }); openConv(r.conv.id); } catch (e) { fail(e); } }

// ---------- conversation ----------
export async function openConv(cid) {
  await needAuth(); rt.connect();
  openCid = cid;
  const el = h(`<div class="chat"><div class="chTop"><button class="iconBtn bk">${I.back}</button><button class="who"></button><span class="sp"></span><button class="iconBtn more">${I.more}</button></div>
    <div class="msgs"><div class="sk" style="height:40px;width:60%;border-radius:18px;margin:12px"></div></div><div class="typing"></div>
    <form class="composer"><button type="button" class="iconBtn att" aria-label="${esc(t('attach'))}">${I.image}</button><input class="field ci" placeholder="${esc(t('msgPh'))}" maxlength="1000" autocomplete="off" enterkeyhint="send"><button class="iconBtn snd" aria-label="send">➤</button></form></div>`);
  document.body.append(el); requestAnimationFrame(() => el.classList.add('on'));
  const list = $('.msgs', el); let conv = null, items = [], typT, lastTyping = 0;
  const offs = [];
  const close = () => { openCid = null; offs.forEach(f => f()); el.classList.remove('on'); setTimeout(() => el.remove(), 300); draw(); window.removeEventListener('popstate', close); };
  $('.bk', el).onclick = close;
  const users = () => new Map([[S.me.id, S.me], ...(conv?.members || []).map(u => [u.id, u])]);
  const bubble = m => {
    const mine = m.uid === S.me.id, u = users().get(m.uid);
    if (m.type === 'system') return `<div class="sysm">✨ ${esc(t('groupCreated'))}</div>`;
    let inner = '';
    if (m.type === 'image') inner = `<img class="mimg" src="${abs(m.url)}" alt="" loading="lazy">`;
    else if (m.type === 'video') inner = `<video class="mimg" src="${abs(m.url)}" playsinline controls preload="metadata"></video>`;
    else if (m.type === 'post') inner = m.post ? `<button class="pcard" data-p="${m.post.id}"><img src="${abs(m.post.poster)}" alt=""><div><b>@${esc(m.post.user?.handle || '')}</b><div class="xs">${esc((m.post.caption || '').slice(0, 60))}</div></div></button>` : `<i class="mut">${esc(t('postGone'))}</i>`;
    if (m.text) inner += `<div class="mtx">${esc(m.text)}</div>`;
    return `<div class="mrow ${mine ? 'me' : ''}" data-id="${m.id}">${!mine && conv?.group ? `<img class="mava" src="${ava(u)}" alt="">` : ''}<div class="bub ${m.type !== 'text' ? 'media' : ''}">${!mine && conv?.group ? `<div class="mfrom">${esc(u?.name || '')}</div>` : ''}${inner}<span class="mt">${new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div></div>`;
  };
  const render = () => {
    list.innerHTML = items.map(bubble).join('') + (conv?.seen ? `<div class="seenL">${esc(t('seen'))} ✓✓</div>` : '');
    $$('.pcard', list).forEach(b => b.onclick = async () => { try { const x = await api('/api/posts/' + b.dataset.p); close(); openPost(x.post); } catch (e) { fail(e); } });
    $$('.mrow:not(.me) .bub', list).forEach(b => { let lt; b.oncontextmenu = e => { e.preventDefault(); msgMenu(b.closest('.mrow').dataset.id); }; b.ontouchstart = () => { lt = setTimeout(() => msgMenu(b.closest('.mrow').dataset.id), 600); }; b.ontouchend = b.ontouchmove = () => clearTimeout(lt); });
    list.scrollTop = 1e7;
  };
  const head = () => {
    $('.who', el).innerHTML = `${convAva(conv)}<div><b>${esc(convName(conv))}</b><div class="mut xs">${conv.group ? esc(t('members', { n: conv.members.length + 1 })) : '@' + esc(conv.members[0]?.handle || '')}</div></div>`;
    $('.who', el).onclick = () => !conv.group && conv.members[0] && openUser(conv.members[0].handle);
    const blockedNow = conv.blocked; $('.composer', el).classList.toggle('dis', blockedNow); $('.ci', el).placeholder = blockedNow ? t('chatBlocked') : t('msgPh'); $('.ci', el).disabled = blockedNow;
  };
  const markRead = () => api(`/api/convs/${cid}/read`, { method: 'POST' }).then(r => { Object.assign(rt.badges, r.badges); updBadges(); }).catch(() => {});
  try { const r = await api('/api/convs/' + cid); conv = r.conv; items = r.items; head(); render(); markRead(); } catch (e) { fail(e); return close(); }
  offs.push(rt.on('msg', m => { if (m.c !== cid) return; conv = m.conv; if (!items.some(x => x.id === m.m.id)) items.push(m.m); $('.typing', el).textContent = ''; render(); if (m.m.uid !== S.me.id) markRead(); }));
  offs.push(rt.on('read', m => { if (m.c !== cid) return; conv.seen = items.length && items[items.length - 1].uid === S.me.id; render(); }));
  offs.push(rt.on('typing', m => { if (m.c !== cid) return; const u = users().get(m.uid); $('.typing', el).textContent = `${u?.name || ''} ${t('typing')}…`; clearTimeout(typT); typT = setTimeout(() => $('.typing', el).textContent = '', 3000); }));
  offs.push(rt.on('open', () => api('/api/convs/' + cid).then(r => { conv = r.conv; items = r.items; render(); }).catch(() => {})));
  const inp = $('.ci', el);
  inp.oninput = () => { if (Date.now() - lastTyping > 2000) { lastTyping = Date.now(); rt.send({ t: 'typing', c: cid }); } };
  const sendMsg = async body => { try { const r = await api(`/api/convs/${cid}/messages`, { body }); if (!items.some(x => x.id === r.m.id)) items.push(r.m); conv.seen = false; render(); haptic(5); } catch (e) { fail(e); if (e.code === 'blocked') { conv.blocked = true; head(); } } };
  $('.composer', el).onsubmit = e => { e.preventDefault(); const text = inp.value.trim(); if (!text) return; inp.value = ''; sendMsg({ type: 'text', text }); };
  $('.att', el).onclick = () => {
    const f = h('<input type="file" accept="image/*,video/*" style="display:none">'); document.body.append(f);
    f.onchange = async () => { const file = f.files[0]; f.remove(); if (!file) return; if (file.size > 30e6) return toast(t('e_too_large'), true);
      const tmp = h(`<div class="mrow me"><div class="bub media"><div class="spin"></div></div></div>`); list.append(tmp); list.scrollTop = 1e7;
      try { const r = await api('/api/chat/upload', { body: file, type: file.type || 'image/jpeg' }); tmp.remove(); await sendMsg({ type: r.type, blob: r.blob }); } catch (e) { tmp.remove(); fail(e); } };
    f.click();
  };
  const msgMenu = mid => {
    const body = h(`<div class="list"><button class="li rep">${I.flag}<span>${esc(t('reportMsg'))}</span></button></div>`);
    const sh = sheet({ title: '', body }); $('.rep', body).onclick = async () => { try { await api(`/api/convs/${cid}/report`, { body: { msgId: mid, reason: 'abuse' } }); toast(t('reported')); } catch (e) { fail(e); } sh.close(); };
  };
  $('.more', el).onclick = () => {
    const o = conv.members[0];
    const body = h(`<div class="list">${!conv.group && o ? `<button class="li prof">${I.user}<span>${esc(t('viewProfile'))}</span></button><button class="li blk">🚫<span>${esc(t(conv.iBlocked ? 'unblock' : 'block'))} @${esc(o.handle)}</span></button>` : ''}
      <button class="li rpt">${I.flag}<span>${esc(t('reportChat'))}</span></button>${conv.group ? `<button class="li lv">🚪<span>${esc(t('leaveGroup'))}</span></button>` : ''}</div>`);
    const sh = sheet({ title: convName(conv), body });
    const pb = $('.prof', body); if (pb) pb.onclick = () => { sh.close(); openUser(o.handle); };
    const bb = $('.blk', body); if (bb) bb.onclick = async () => { if (!conv.iBlocked && !confirm(t('blockConfirm'))) return; try { const r = await api(`/api/users/${o.handle}/block`, { method: 'POST' }); conv.iBlocked = r.blocked; conv.blocked = r.blocked; toast(r.blocked ? '🚫 ' + t('blocked') : '✓ ' + t('unblocked')); head(); sh.close(); } catch (e) { fail(e); } };
    $('.rpt', body).onclick = async () => { try { await api(`/api/convs/${cid}/report`, { body: { reason: 'abuse' } }); toast(t('reported')); } catch (e) { fail(e); } sh.close(); };
    const lv = $('.lv', body); if (lv) lv.onclick = async () => { if (!confirm(t('leaveGroup') + '?')) return; try { await api(`/api/convs/${cid}/leave`, { method: 'POST' }); convs = convs.filter(c => c.id !== cid); sh.close(); close(); } catch (e) { fail(e); } };
  };
  setTimeout(() => !('ontouchstart' in window) && inp.focus(), 350);
}

// ---------- send a post to friends (from feed share) ----------
export async function sendPostTo(post) {
  await needAuth();
  let list = []; try { list = (await api('/api/inbox')).items; } catch {}
  const body = h(`<div class="col"><div class="list"></div><button class="btn ghost more">➕ ${esc(t('newChat'))}</button></div>`);
  const sh = sheet({ title: '💌 ' + t('sendToFriend'), body, full: list.length > 5 });
  $('.list', body).innerHTML = list.slice(0, 12).map(c => `<div class="li"><div style="display:contents">${convAva(c)}</div><div class="sp"><b>${esc(convName(c))}</b></div><button class="btn sm pri s" data-c="${c.id}">${esc(t('send'))}</button></div>`).join('') || `<div class="mut sm" style="text-align:center;padding:12px">${esc(t('noChats'))}</div>`;
  const doSend = async (cid, b) => { try { await api(`/api/convs/${cid}/messages`, { body: { type: 'post', post: post.id } }); if (b) { b.disabled = true; b.textContent = '✓ ' + t('sent'); } else toast('✓ ' + t('sent')); haptic(); } catch (e) { fail(e); } };
  $$('.s', body).forEach(b => b.onclick = () => doSend(b.dataset.c, b));
  $('.more', body).onclick = () => { sh.close(); newChat(c => doSend(c.id)); };
}
