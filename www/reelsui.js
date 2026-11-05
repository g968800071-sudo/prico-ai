// AI Reels maker: pick photos/clips (or none → selfies), niche, music, idea/subtitles → beat-synced 9:16 MP4.
import { t } from './i18n.js';
import { S, I, api, h, esc, abs, toast, fail, haptic, upload, $, $$ } from './core.js';
import { needAuth, walletChip, openShop } from './app.js';
import { progress, showResult, addFace } from './create.js';

let root, items = [], niche = 'funny', musicId = null, subs = true, idea = '', audio;
export function mountReels(el) {
  root = el;
  el.innerHTML = `<div class="pad">
    <div class="hdr"><h1>${esc(t('tabReels'))}</h1><span class="sp"></span><span class="walSlot"></span></div>
    <div class="reelHero"><h2>${esc(t('reelsTitle'))}</h2><div class="mut sm" style="margin-top:6px;max-width:85%">${esc(t('reelsSub'))}</div>
      <div class="tray" style="margin-top:14px"></div><div class="mut xs hint">${esc(t('orIdea'))}</div></div>
    <div class="lbl">${esc(t('style'))}</div><div class="nicheGrid"></div>
    <div class="lbl">${esc(t('music'))}</div><div class="music"></div>
    <div class="lbl">${esc(t('idea'))}</div><textarea class="field idea" maxlength="300" placeholder="${esc(t('ideaPh'))}"></textarea>
    <button class="row subsT" style="margin-top:14px;width:100%;padding:12px 14px;background:var(--card);border-radius:14px"><span>💬</span><span class="sp" style="text-align:start;font-weight:650">${esc(t('subtitles'))}</span><span class="toggle ${subs ? 'on' : ''}"></span></button>
    <button class="btn pri wide mk" style="margin-top:18px">${I.sparkle}<span>${esc(t('makeReel'))}</span></button>
    <div class="mut xs" style="text-align:center;margin-top:10px">MP4 · 9:16 · 1080×1920 · ♫ royalty-free</div>
  </div>`;
  $('.walSlot', el).replaceWith(walletChip());
  drawTray(); drawNiches(); drawMusic();
  const ta = $('.idea', el); ta.value = idea; ta.oninput = () => idea = ta.value;
  $('.subsT', el).onclick = () => { subs = !subs; $('.subsT .toggle', el).classList.toggle('on', subs); haptic(); };
  $('.mk', el).onclick = make;
}
export function stopAudio() { if (audio) { audio.pause(); audio = null; $$('.music button', root || document).forEach(b => $('i', b).innerHTML = '▶'); } }
function drawTray() {
  const tr = $('.tray', root); tr.innerHTML = '';
  items.forEach((it, i) => {
    const e = h(`<div class="it">${it.kind === 'video' ? `<video src="${it.url}#t=0.5" muted playsinline preload="metadata"></video>` : `<img src="${it.url}" alt="">`}<button class="x">×</button>${it.kind === 'video' ? `<span class="d">${it.dur ? Math.round(it.dur) + 's' : '▶'}</span>` : ''}</div>`);
    $('.x', e).onclick = () => { URL.revokeObjectURL(it.url); items.splice(i, 1); drawTray(); };
    if (it.kind === 'video') { const v = $('video', e); v.onloadedmetadata = () => { it.dur = v.duration; $('.d', e).textContent = Math.round(v.duration) + 's'; }; }
    tr.append(e);
  });
  if (items.length < 12) { const a = h(`<button class="add">${I.plus}<span>${esc(t('addMedia'))}</span></button>`); a.onclick = pick; tr.append(a); }
  $('.hint', root).style.display = items.length ? 'none' : '';
}
function pick() {
  const inp = h('<input type="file" accept="image/*,video/*" multiple style="display:none">'); document.body.append(inp);
  inp.onchange = () => { for (const f of inp.files) { if (items.length >= 12) { toast(t('maxMedia')); break; } const kind = f.type.startsWith('video') ? 'video' : f.type.startsWith('image') ? 'image' : null; if (!kind) continue; if (f.size > (kind === 'video' ? 60e6 : 15e6)) { toast(t('e_too_large'), true); continue; } items.push({ file: f, kind, url: URL.createObjectURL(f) }); } inp.remove(); haptic(); drawTray(); };
  inp.click();
}
function drawNiches() {
  const g = $('.nicheGrid', root);
  g.innerHTML = S.cat.niches.map(n => `<button data-n="${n.id}" class="${n.id === niche ? 'on' : ''}"><span>${n.emoji}</span>${esc(t('n_' + n.id))}</button>`).join('');
  $$('button', g).forEach(b => b.onclick = () => { niche = b.dataset.n; musicId = null; $$('button', g).forEach(z => z.classList.toggle('on', z === b)); haptic(); drawMusic(); });
}
function drawMusic() {
  const m = $('.music', root); const nm = S.cat.niches.find(n => n.id === niche)?.music;
  const list = [...S.cat.music].sort((a, b) => (b.id === nm) - (a.id === nm));
  if (!musicId) musicId = nm || list[0].id;
  m.innerHTML = list.map(x => `<button data-m="${x.id}" class="${x.id === musicId ? 'on' : ''}"><i>▶</i>${esc(x.name)}</button>`).join('');
  $$('button', m).forEach(b => b.onclick = () => {
    const id = b.dataset.m; const playing = audio && audio._id === id;
    stopAudio(); musicId = id; $$('button', m).forEach(z => z.classList.toggle('on', z === b)); haptic();
    if (playing) return;
    audio = new Audio(abs(S.cat.music.find(x => x.id === id).url)); audio._id = id; audio.volume = .8; audio.play().catch(() => {});
    $('i', b).innerHTML = '<span class="eq"><b></b><b></b><b></b></span>'; audio.onended = stopAudio;
  });
}
async function make() {
  await needAuth(); stopAudio();
  if (!items.length && !S.me.faces.length) { toast(t('needMedia')); const f = await addFace(); if (!f) return; }
  const btn = $('.mk', root); btn.disabled = true;
  try {
    const ids = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.uploaded) { ids.push(it.uploaded); continue; }
      $('span', btn).textContent = t('uploading', { n: i + 1, m: items.length });
      const r = await upload(it.file, p => { $('span', btn).textContent = t('uploading', { n: i + 1, m: items.length }) + ' ' + Math.round(p * 100) + '%'; });
      it.uploaded = r.id; ids.push(r.id);
    }
    $('span', btn).textContent = t('makeReel');
    const lines = idea.split(/(?<=[.!?…])\s+|\n+/).map(s => s.trim()).filter(Boolean).slice(0, 12);
    const r = await api('/api/reels', { body: { uploads: ids, niche, musicId, idea, lines, subtitles: subs } });
    const face = S.me.faces[0];
    const media = await progress(r.job, face && face.url);
    if (media) { items.forEach(it => it.uploaded = null); showResult(media, {}); }
  } catch (e) { if (e.code === 'reel_limit') openShop(); if (e.code === 'not_found') items.forEach(it => it.uploaded = null); fail(e); }
  finally { btn.disabled = false; $('span', btn).textContent = t('makeReel'); }
}
