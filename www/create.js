// Create: template catalog, template editor (faces + text + stickers), face manager, generation progress and result.
import { t, lang } from './i18n.js';
import { S, I, api, h, esc, abs, toast, fail, sheet, haptic, shareRow, prepFile, copyText, confetti, download, PUBLIC, $, $$, sleep } from './core.js';
import { needAuth, go, openShop, refreshMe, walletChip } from './app.js';

let root, q = '', grp = 'all';
const tpl = id => S.cat.templates.find(x => x.id === id);

export function showGroup(g) { grp = g || 'all'; if (root) mountCreate(root); }
export function mountCreate(el) {
  root = el;
  el.innerHTML = `<div class="pad">
    <div class="hdr"><h1>${esc(t('tabCreate'))}</h1><span class="sp"></span><span class="walSlot"></span></div>
    <div class="search">${I.search}<input class="field" type="search" placeholder="${esc(t('search'))}" enterkeyhint="search"></div>
    <div class="chips grpChips"></div><div class="body"></div></div>`;
  $('.walSlot', el).replaceWith(walletChip());
  const inp = $('input', el); inp.value = q; inp.oninput = () => { q = inp.value.trim().toLowerCase(); draw(); };
  const chips = $('.grpChips', el);
  const groups = [['all', t('all')], ...Object.entries(S.cat.groups)];
  chips.innerHTML = groups.map(([k, n]) => `<button class="chip ${k === grp ? 'on' : ''}" data-g="${k}">${esc(n)}</button>`).join('');
  $$('.chip', chips).forEach(c => c.onclick = () => { grp = c.dataset.g; $$('.chip', chips).forEach(x => x.classList.toggle('on', x === c)); haptic(); draw(); el.scrollTo({ top: 0, behavior: 'smooth' }); });
  draw();
}
function card(x) {
  const c = h(`<button class="card" data-id="${x.id}"><div class="th"><img alt="" loading="lazy" decoding="async" src="${abs(x.preview)}">
    <div class="bd">${x.hot ? `<span class="badge hot">${esc(t('hot'))}</span>` : ''}${x.isNew ? `<span class="badge new">${esc(t('isNew'))}</span>` : ''}${x.kind === 'photo' ? `<span class="badge free">${esc(t('free'))}</span>` : ''}${x.faces > 1 ? `<span class="badge">👥 ${x.faces}</span>` : ''}</div>
    <span class="ty">${x.kind === 'video' ? I.video : I.image}</span></div><div class="nm">${esc(x.emoji || '')} ${esc(x.name)}</div></button>`);
  const img = $('img', c); const ld = () => img.classList.add('ld'); img.complete ? ld() : img.onload = ld; img.onerror = ld;
  c.onclick = () => { haptic(); openTemplate(x.id); };
  return c;
}
function draw() {
  const body = $('.body', root); body.innerHTML = '';
  let list = S.cat.templates;
  if (q) list = list.filter(x => (x.name + ' ' + x.id + ' ' + x.group).toLowerCase().includes(q));
  if (grp !== 'all') list = list.filter(x => x.group === grp);
  if (q || grp !== 'all') { const g = h('<div class="grid"></div>'); list.forEach(x => g.append(card(x))); body.append(g); if (!list.length) body.append(h(`<div class="empty" style="height:200px">🔍</div>`)); return; }
  // quick tools (camera FX, editor, photo FX, LIVE)
  const qt = h(`<div class="quick">${[['cam', '📸', 'plCamera'], ['studio', '📷', 'plStudio'], ['edit', '✂️', 'plEditor'], ['pfx', '🪄', 'plPhotoFx'], ['live', '🔴', 'plLive']].map(([k, e, n]) => `<button data-k="${k}" class="qk qk-${k}"><b>${e}</b><span>${esc(t(n))}</span></button>`).join('')}</div>`);
  $$('button', qt).forEach(b => b.onclick = async () => { haptic(); const k = b.dataset.k; if (k === 'cam') (await import('./camera.js')).openCamera(); else if (k === 'edit') (await import('./editor.js')).openEditor(); else if (k === 'pfx') (await import('./camera.js')).openPhotoFx(); else if (k === 'studio') (await import('./studio.js')).openStudio(); else (await import('./live.js')).goLive(); });
  body.append(qt);
  // challenge hero
  const ch = S.cat.challenge, ct = tpl(ch.tpl);
  if (ct) {
    const hero = h(`<button class="hero" style="width:100%;text-align:start"><img src="${abs(ct.preview)}" alt=""><div class="in"><div><div class="k">🏆 ${esc(t('topTitle')).toUpperCase()}</div><h2 style="margin-top:6px">${esc(ch.name)}</h2></div><span class="btn pri sm" style="align-self:flex-start">${esc(t('joinCh'))}</span></div></button>`);
    hero.onclick = () => openTemplate(ct.id, { challenge: true }); body.append(hero);
  }
  // reels promo
  const promo = h(`<button class="reelHero" style="width:100%;text-align:start;margin-top:12px"><div class="k" style="font-size:12px;font-weight:800;color:var(--a3);letter-spacing:.08em">🎬 ${esc(t('reelsKicker'))}</div><h2 style="margin:6px 0 4px">${esc(t('reelsTitle'))}</h2><div class="mut sm" style="max-width:80%">${esc(t('reelsSub'))}</div></button>`);
  promo.onclick = () => go('reels'); body.append(promo);
  for (const [g, name] of Object.entries(S.cat.groups)) {
    const items = list.filter(x => x.group === g); if (!items.length) continue;
    const sec = h(`<div class="sec"><div class="row"><h2>${esc(name)}</h2><span class="sp"></span><button class="mut sm" style="font-weight:700">${esc(t('all'))} ›</button></div><div class="rail2"></div></div>`);
    $('.row button', sec).onclick = () => { grp = g; mountCreate(root); };
    const r = $('.rail2', sec); items.forEach(x => r.append(card(x))); body.append(sec);
  }
}

// ---------- template editor ----------
export async function openTemplate(id, opt = {}) {
  const x = tpl(id); if (!x) return;
  await needAuth();
  const ov = { text: '', pos: 'bottom', color: '#ffffff', stickers: [] };
  let pick = [];
  const body = h(`<div>
    <div class="stage"><img class="bg" src="${abs(x.preview)}" alt=""><div class="ovText"></div></div>
    <div style="text-align:center;margin-top:12px"><h2>${esc(x.emoji || '')} ${esc(x.name)}</h2><div class="mut sm" style="margin-top:4px">${x.kind === 'video' ? '🎬 ' + esc(t('costVideo')) : '📸 ' + esc(t('free'))}${x.faces > 1 ? ' · ' + esc(t('faces', { n: x.faces })) : ''}</div></div>
    <div class="lbl">${esc(t('pickFaces'))} <span class="pickN" style="text-transform:none">· ${esc(t('pickN', { n: x.faces }))}</span></div>
    <div class="faceRow"></div>
    <div class="lbl">${esc(t('customize'))}</div>
    <input class="field ovIn" maxlength="120" placeholder="${esc(t('addText'))}">
    <div class="row" style="margin-top:10px"><div class="seg sp">${['top', 'center', 'bottom'].map(p => `<button data-p="${p}" class="${p === 'bottom' ? 'on' : ''}">${esc(t(p))}</button>`).join('')}</div>
    <div class="colors">${['#ffffff', '#ffe14d', '#ff4f9a', '#4de1ff'].map((c, i) => `<button data-c="${c}" class="${i ? '' : 'on'}" style="background:${c}"></button>`).join('')}</div></div>
    <div class="lbl">${esc(t('stickers'))}</div><div class="stkGrid">${S.cat.stickers.map(s => `<button data-s="${s}"><img src="stickers/${s}.svg" alt="" loading="lazy"></button>`).join('')}</div>
  </div>`);
  const ai = S.cat?.ai || { available: false, reason: 'provider_off' };
  const foot = h(`<button class="btn pri wide go">${I.sparkle}<span>${esc(t(ai.available ? (x.kind === 'video' ? 'makeVideo' : 'makePhoto') : 'aiUnavailableCta'))}</span></button>`);
  if (!ai.available) body.prepend(h(`<div class="aiOff"><b>${esc(t('aiUnavailableTitle'))}</b><div>${esc(t('aiUnavailableBody'))}</div><div class="mut xs" style="margin-top:6px">${esc(t('aiModelLine', { model: ai.videoModel || '' }))} · ${esc(t('reason_' + (ai.reason || 'provider_off')))}</div></div>`));
  const sh = sheet({ title: '', body, foot, full: true });
  const stage = $('.stage', body), ovt = $('.ovText', body);
  const drawText = () => { ovt.textContent = ov.text; ovt.style.color = ov.color; ovt.style.fontSize = (stage.clientWidth * 0.075) + 'px'; ovt.style.top = ov.pos === 'top' ? '12%' : ov.pos === 'center' ? '50%' : '72%'; ovt.style.transform = ov.pos === 'center' ? 'translateY(-50%)' : ''; };
  $('.ovIn', body).oninput = e => { ov.text = e.target.value; drawText(); };
  $$('.seg button', body).forEach(b => b.onclick = () => { ov.pos = b.dataset.p; $$('.seg button', body).forEach(z => z.classList.toggle('on', z === b)); drawText(); });
  $$('.colors button', body).forEach(b => b.onclick = () => { ov.color = b.dataset.c; $$('.colors button', body).forEach(z => z.classList.toggle('on', z === b)); drawText(); });
  $$('.stkGrid button', body).forEach(b => b.onclick = () => { if (ov.stickers.length >= 12) return; haptic(); addSticker({ c: b.dataset.s, x: .25 + Math.random() * .5, y: .2 + Math.random() * .45, s: .2, r: Math.round((Math.random() - .5) * 30) }); stage.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  function addSticker(st) {
    ov.stickers.push(st);
    const e = h(`<div class="stk" style="width:${st.s * 100}%;aspect-ratio:1;left:${st.x * 100}%;top:${st.y * 100}%;rotate:${st.r}deg"><img src="stickers/${st.c}.svg" alt=""><button class="x">×</button></div>`);
    stage.append(e);
    $('.x', e).onpointerdown = ev => { ev.stopPropagation(); ov.stickers.splice(ov.stickers.indexOf(st), 1); e.remove(); };
    let sx, sy, ox, oy, moved, lastT = 0;
    e.onpointerdown = ev => { ev.preventDefault(); e.setPointerCapture(ev.pointerId); e.classList.add('drag'); sx = ev.clientX; sy = ev.clientY; ox = st.x; oy = st.y; moved = false; };
    e.onpointermove = ev => { if (sx == null) return; const r = stage.getBoundingClientRect(); st.x = Math.max(0, Math.min(1, ox + (ev.clientX - sx) / r.width)); st.y = Math.max(0, Math.min(1, oy + (ev.clientY - sy) / r.height)); moved = moved || Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 4; e.style.left = st.x * 100 + '%'; e.style.top = st.y * 100 + '%'; };
    e.onpointerup = () => { sx = null; e.classList.remove('drag'); if (!moved) { const n = Date.now(); st.s = st.s >= .34 ? .14 : +(st.s + .07).toFixed(2); e.style.width = st.s * 100 + '%'; lastT = n; } };
  }
  const faces = () => {
    const row = $('.faceRow', body); row.innerHTML = '';
    for (const f of S.me.faces) {
      const i = pick.indexOf(f.id);
      const b = h(`<button class="face ${i >= 0 ? 'on' : ''}"><img src="${abs(f.url)}" alt="">${i >= 0 && x.faces > 1 ? `<span class="n">${i + 1}</span>` : ''}</button>`);
      b.onclick = () => { haptic(); const k = pick.indexOf(f.id); if (k >= 0) pick.splice(k, 1); else { if (pick.length >= x.faces) pick.shift(); pick.push(f.id); } faces(); };
      row.append(b);
    }
    if (S.me.faces.length < 3) { const a = h(`<button class="face add" aria-label="${esc(t('addFace'))}">${I.camera}</button>`); a.onclick = () => addFace().then(f => { if (f) { if (pick.length < x.faces) pick.push(f.id); faces(); } }); row.append(a); }
  };
  if (!S.me.faces.length) { faces(); addFace().then(f => { if (f) pick = [f.id]; faces(); }); } else { pick = S.me.faces.slice(0, x.faces).map(f => f.id); faces(); }
  requestAnimationFrame(drawText);
  foot.onclick = async () => {
    if (!S.cat?.ai?.available) { toast(t('e_ai_unavailable'), true); return; }
    if (!pick.length) { toast(t('e_no_face'), true); return addFace().then(f => { if (f) { pick = [f.id]; faces(); } }); }
    haptic(15);
    try {
      const r = await api('/api/generate', { body: { templateId: x.id, faceIds: pick, overlay: (ov.text || ov.stickers.length) ? ov : null } });
      S.me.wallet = r.wallet || S.me.wallet;
      const face = S.me.faces.find(f => f.id === pick[0]);
      const media = await progress(r.job, face && face.url);
      if (media) { sh.close(); showResult(media, { tpl: x, challenge: opt.challenge }); }
    } catch (e) { if (e.code === 'no_credits') { openShop(); } fail(e); }
  };
}

// ---------- face manager ----------
export function addFace() {
  return new Promise(resolve => {
    const inp = h('<input type="file" accept="image/*" style="display:none">'); document.body.append(inp);
    inp.onchange = async () => {
      const f = inp.files[0]; inp.remove(); if (!f) return resolve(null);
      const body = h(`<div style="text-align:center"><div class="stage" style="width:66%;aspect-ratio:1;border-radius:50%;background:repeating-conic-gradient(#1c1c29 0 25%,#15151f 0 50%) 0 0/20px 20px"><div class="empty" style="height:100%"><div class="spinner"></div></div></div>
        <div class="mut sm st" style="margin:14px 0">${esc(t('cutting'))}</div>
        <button class="row cons" style="text-align:start;gap:12px;padding:12px;background:var(--card);border-radius:14px;width:100%"><span class="check"></span><span class="sm">${esc(t('consent'))}</span></button></div>`);
      const foot = h(`<button class="btn pri wide" disabled>${esc(t('cont'))}</button>`);
      let done = false, ok = false, cons = false, img, cut;
      const sh = sheet({ title: t('facesTitle'), body, foot, onClose: () => { if (!done) resolve(null); } });
      const upd = () => foot.disabled = !(ok && cons);
      $('.cons', body).onclick = () => { cons = !cons; $('.check', body).classList.toggle('on', cons); haptic(); upd(); };
      try {
        const bmp = await createImageBitmap(f, { imageOrientation: 'from-image' }).catch(() => null) || await new Promise((r, j) => { const im = new Image(); im.onload = () => r(im); im.onerror = j; im.src = URL.createObjectURL(f); });
        const sc = Math.min(1, 1024 / Math.max(bmp.width, bmp.height)); const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * sc); cv.height = Math.round(bmp.height * sc);
        cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height); img = cv.toDataURL('image/jpeg', .9);
        let blob = null; try { const { cutout } = await import('./seg.js'); blob = await cutout(cv); } catch (e) { console.warn('seg', e); }
        const st = $('.stage', body);
        if (blob) { cut = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); }); st.innerHTML = `<img class="bg" src="${cut}" style="object-fit:cover">`; $('.st', body).textContent = '✨ ' + t('ready'); }
        else { st.innerHTML = `<img class="bg" src="${img}" style="object-fit:cover">`; $('.st', body).textContent = t('noPerson'); }
        ok = true; upd();
      } catch (e) { $('.st', body).textContent = t('e_bad_image'); }
      foot.onclick = async () => {
        foot.disabled = true; foot.innerHTML = '<span class="spinner"></span>';
        try { const r = await api('/api/faces', { body: { img, cut, consent: true } }); await refreshMe(); done = true; sh.close(); const nf = S.me.faces[S.me.faces.length - 1]; resolve(nf); toast('✓ ' + t('facesTitle')); }
        catch (e) { fail(e); foot.disabled = false; foot.textContent = t('cont'); }
      };
    };
    inp.click();
  });
}
export function manageFaces() {
  const body = h(`<div><p class="mut sm" style="margin-top:0">${esc(t('facesHint'))}</p><div class="faceRow fr" style="gap:16px"></div></div>`);
  const sh = sheet({ title: t('facesTitle'), body });
  const draw = () => {
    const r = $('.fr', body); r.innerHTML = '';
    for (const f of S.me.faces) { const b = h(`<div class="face"><img src="${abs(f.url)}" alt=""><button class="n" style="background:#000c" aria-label="${esc(t('del'))}">×</button></div>`); $('button', b).onclick = async () => { if (!confirm(t('deleteQ'))) return; try { await api('/api/faces/' + f.id, { method: 'DELETE' }); await refreshMe(); draw(); } catch (e) { fail(e); } }; r.append(b); }
    if (S.me.faces.length < 3) { const a = h(`<button class="face add">${I.camera}</button>`); a.onclick = () => addFace().then(draw); r.append(a); }
  };
  draw();
}

// ---------- progress ----------
export async function progress(job, faceUrl) {
  const el = h(`<div class="prog"><div class="orb">${faceUrl ? `<img src="${abs(faceUrl)}" alt="">` : ''}</div><h2>${esc(t('generating'))}</h2><div class="bar"><i></i></div><div class="mut sm q"></div><div class="tip">${esc(t('tip1'))}</div></div>`);
  document.body.append(el); requestAnimationFrame(() => el.classList.add('on'));
  const tips = [t('tip1'), t('tip2'), t('tip3')]; let ti = 0;
  const tipT = setInterval(() => { const tp = $('.tip', el); tp.style.opacity = 0; setTimeout(() => { tp.textContent = tips[++ti % 3]; tp.style.opacity = 1; }, 400); }, 3500);
  let shown = 0;
  try {
    for (let i = 0; i < 400; i++) {
      const r = await api('/api/jobs/' + job.id).catch(e => { if (e.code === 'network') return null; throw e; });
      if (r) {
        const j = r.job; S.me && (S.me.wallet = r.wallet);
        shown = Math.max(shown, j.progress * 100, shown + (j.status === 'running' ? 1.2 : 0)); $('.bar i', el).style.width = Math.min(97, shown) + '%';
        $('.q', el).textContent = j.status === 'queued' && j.ahead ? t('inQueue', { n: j.ahead }) : '';
        if (j.status === 'done') { $('.bar i', el).style.width = '100%'; await sleep(350); return j.media; }
        if (j.status === 'failed' || j.status === 'error') throw Object.assign(new Error(j.error || 'generation_failed'), { code: j.error || 'generation_failed' });
      }
      await sleep(1100);
    }
    throw Object.assign(new Error('timeout'), { code: 'generic' });
  } finally { clearInterval(tipT); el.classList.remove('on'); setTimeout(() => el.remove(), 400); }
}

// ---------- result ----------
export async function showResult(m, opt = {}) {
  refreshMe().catch(() => {});
  prepFile(m.url, m.type);
  const body = h(`<div>
    <div class="res">${m.type === 'video' ? `<video src="${abs(m.url)}" poster="${abs(m.poster)}" playsinline autoplay loop controls></video>` : `<img src="${abs(m.url)}" alt="">`}</div>
    ${m.demo ? `<div class="mut xs" style="text-align:center;margin-top:10px">ⓘ ${esc(t('demoNote'))}</div>` : ''}
    ${m.ai ? `<div class="mut xs" style="text-align:center;margin-top:10px">✦ ${esc(t('aiResultNote', { model: m.model || '' }))}</div>` : ''}
    ${!m.ai && m.composite ? `<div class="mut xs" style="text-align:center;margin-top:10px">ⓘ ${esc(t('compositeNote'))}</div>` : ''}
    ${!m.ai && m.local && !m.composite ? `<div class="mut xs" style="text-align:center;margin-top:10px">ⓘ ${esc(t('localReelNote'))}</div>` : ''}
    <div class="mut xs scopeNote" style="text-align:center">${esc(t('shareScope'))}</div>
    <div class="lbl">${esc(t('shareTo'))}</div><div class="srow"></div>
    <div class="lbl">${esc(t('captionIdeas'))}</div><div class="col caps"><div class="sk" style="height:46px;border-radius:14px"></div></div>
    <div class="lbl">${esc(t('hashtags'))}</div><div class="tags"></div>
    <div class="row" style="margin-top:16px"><button class="btn sp copyAll">${I.copy}<span>${esc(t('copyCaption'))}</span></button><button class="btn sv" aria-label="${esc(t('save'))}">${I.download}</button></div>
  </div>`);
  const foot = h(`<div class="col" style="gap:8px"><button class="btn pri wide post">${esc(t(opt.challenge ? 'postCh' : 'post'))}</button>${opt.challenge ? '' : `<button class="btn ghost wide postCh" style="height:44px;font-size:14px">🏆 ${esc(t('postCh'))}</button>`}</div>`);
  const sh = sheet({ title: '✨ ' + t('ready'), body, foot, full: true });
  confetti(); haptic([10, 30, 10]);
  let caption = '', tags = [];
  const full = () => [caption, tags.join(' ')].filter(Boolean).join('\n\n');
  let postId = null;
  $('.srow', body).replaceWith(shareRow(async () => ({ url: m.url, type: m.type, caption: full(), link: postId ? `${PUBLIC}/p/${postId}` : PUBLIC })));
  try {
    const c = m.captions || await api(`/api/captions?media=${m.id}`);
    const caps = $('.caps', body); caps.innerHTML = ''; tags = c.hashtags || []; caption = (c.captions || [])[0] || '';
    (c.captions || []).forEach((s, i) => { const b = h(`<button class="capIdea ${i ? '' : 'on'}"><span class="check ${i ? '' : 'on'}"></span><span>${esc(s)}</span></button>`); b.onclick = () => { caption = s; $$('.capIdea', caps).forEach(z => { z.classList.toggle('on', z === b); $('.check', z).classList.toggle('on', z === b); }); haptic(); }; caps.append(b); });
    $('.tags', body).innerHTML = tags.map(x => `<span>${esc(x)}</span>`).join('');
  } catch { $('.caps', body).innerHTML = ''; }
  $('.copyAll', body).onclick = async () => { await copyText(full()); toast(t('copied')); };
  $('.sv', body).onclick = async () => { const f = await prepFile(m.url, m.type); if (f) { download(f); toast(t('saved')); } };
  const doPost = async ch => {
    try { const r = await api('/api/posts', { body: { mediaId: m.id, caption: caption + (tags.length ? ' ' + tags.slice(0, 3).join(' ') : ''), challenge: ch } }); postId = r.post.id; toast(t('posted')); confetti(); sh.close(); const { reset, switchTab } = await import('./feed.js'); go('home'); ch ? switchTab('challenge') : reset(r.post); }
    catch (e) { fail(e); }
  };
  $('.post', foot).onclick = () => doPost(!!opt.challenge);
  const pc = $('.postCh', foot); if (pc) pc.onclick = () => doPost(true);
  return sh;
}
