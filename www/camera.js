// PRICO Camera: real-time face effects (big eyes, big head, baby, aging, beauty, cartoon, glitch, VHS, AR masks) + color grades,
// photo capture and video recording on-device; the same effects on gallery photos. Results → post, editor, or save.
import { t } from './i18n.js';
import { S, I, api, h, esc, toast, fail, haptic, upload, download, $, $$ } from './core.js';
import { needAuth } from './app.js';
import * as fx from './fx.js';

const pickMime = () => ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';

export async function openCamera(opt = {}) {
  const el = h(`<div class="cam"><div class="camStage"><div class="camMsg">${esc(t('camStarting'))}</div></div>
    <div class="camTop"><button class="iconBtn x" aria-label="${esc(t('close'))}">${I.close}</button><span class="sp"></span>
      <button class="iconBtn gal" aria-label="${esc(t('camGallery'))}">🖼️</button><button class="iconBtn tmr" aria-label="timer">⏱️</button><button class="iconBtn flip" aria-label="${esc(t('camFlip'))}">🔄</button></div>
    <div class="camHint"></div><div class="camRec"><i></i><span>0:00</span></div><div class="camCount"></div>
    <div class="camBottom"><div class="grRow hscroll"></div><div class="fxRow hscroll"></div>
      <div class="camCtl"><button class="gradeBtn">🎨<span>${esc(t('filters'))}</span></button><button class="shutter" aria-label="shutter"><i></i></button>
      <div class="modeSw"><button data-m="photo">${esc(t('camPhoto'))}</button><button data-m="video">${esc(t('camVideo'))}</button></div></div></div></div>`);
  document.body.append(el); requestAnimationFrame(() => el.classList.add('on'));
  let cam = null, mode = opt.mode || 'video', rec = null, chunks = [], recT = 0, recStart = 0, timer = 0, closed = false;
  const close = () => { if (closed) return; closed = true; try { rec && rec.state !== 'inactive' && rec.stop(); } catch {} cam && cam.stop(); el.classList.remove('on'); setTimeout(() => el.remove(), 300); };
  $('.x', el).onclick = close;
  const setMode = m => { mode = m; $$('.modeSw button', el).forEach(b => b.classList.toggle('on', b.dataset.m === m)); el.classList.toggle('vid', m === 'video'); };
  $$('.modeSw button', el).forEach(b => b.onclick = () => !rec && setMode(b.dataset.m)); setMode(mode);
  const fxRow = $('.fxRow', el), grRow = $('.grRow', el);
  fxRow.innerHTML = fx.EFFECTS.map(([k, e]) => `<button data-k="${k}" class="${k === (opt.effect || 'none') ? 'on' : ''}"><b>${e}</b><span>${esc(t('fx_' + k))}</span></button>`).join('');
  grRow.innerHTML = fx.GRADES.map(k => `<button data-k="${k}" class="${k === 'none' ? 'on' : ''}">${esc(t('flt_' + k))}</button>`).join('');
  const hint = () => { const e = cam?.effect; const need = e && !['none', 'glitch', 'vhs'].includes(e); $('.camHint', el).textContent = need && cam && !cam.faces ? t('camNoFace') : ''; };
  $$('button', fxRow).forEach(b => b.onclick = () => { haptic(5); $$('button', fxRow).forEach(z => z.classList.toggle('on', z === b)); cam && cam.set(b.dataset.k); });
  $$('button', grRow).forEach(b => b.onclick = () => { haptic(5); $$('button', grRow).forEach(z => z.classList.toggle('on', z === b)); cam && cam.set(null, b.dataset.k); });
  $('.gradeBtn', el).onclick = () => el.classList.toggle('grades');
  $('.tmr', el).onclick = () => { timer = timer ? 0 : 3; $('.tmr', el).classList.toggle('on', !!timer); toast(timer ? '⏱️ 3s' : '⏱️ off'); };
  $('.flip', el).onclick = async () => { try { await cam.flip(); } catch (e) { fail(e); } };
  const hintT = setInterval(() => { if (closed) clearInterval(hintT); else hint(); }, 700);
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('nocam');
    cam = await fx.camera({ audio: true, facing: opt.facing || 'user' }).catch(() => fx.camera({ audio: false }));
    if (closed) { cam.stop(); return; }
    cam.set(opt.effect || 'none', 'none');
    const stage = $('.camStage', el); stage.innerHTML = ''; stage.append(cam.canvas);
  } catch (e) {
    console.warn(e); $('.camMsg', el).innerHTML = `${esc(t('camDenied'))}<br><br><button class="btn pri gal2">🖼️ ${esc(t('camGallery'))}</button>`;
    const g = $('.gal2', el); if (g) g.onclick = () => $('.gal', el).click();
  }
  // gallery photo → same effects
  $('.gal', el).onclick = () => {
    const inp = h('<input type="file" accept="image/*" style="display:none">'); document.body.append(inp);
    inp.onchange = async () => { const f = inp.files[0]; inp.remove(); if (!f) return; photoFx(f, cam?.effect || 'bigeyes', cam?.grade || 'none'); }; inp.click();
  };
  const countdown = async () => { if (!timer) return; const c = $('.camCount', el); for (let i = timer; i > 0; i--) { c.textContent = i; c.classList.add('on'); haptic(10); await new Promise(r => setTimeout(r, 900)); } c.classList.remove('on'); };
  $('.shutter', el).onclick = async () => {
    if (!cam) return;
    if (mode === 'photo') { await countdown(); haptic([5, 30, 5]); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 250); cam.canvas.toBlob(b => review(b, 'photo'), 'image/jpeg', 0.92); return; }
    if (rec) { rec.stop(); return; }
    if (!window.MediaRecorder || !cam.canvas.captureStream) return toast(t('camNoRec'), true);
    await countdown();
    const st = cam.canvas.captureStream(30); for (const a of cam.audioTracks()) st.addTrack(a);
    const mime = pickMime(); chunks = [];
    rec = new MediaRecorder(st, mime ? { mimeType: mime, videoBitsPerSecond: 5e6 } : undefined);
    rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    rec.onstop = () => { clearInterval(recT); el.classList.remove('recording'); const type = (rec.mimeType || mime || 'video/webm').split(';')[0]; const b = new Blob(chunks, { type }); rec = null; if (!closed) review(b, 'video', (Date.now() - recStart) / 1000); };
    rec.start(500); recStart = Date.now(); el.classList.add('recording'); haptic(15);
    recT = setInterval(() => { const s = (Date.now() - recStart) / 1000; $('.camRec span', el).textContent = `${s / 60 | 0}:${String(s % 60 | 0).padStart(2, '0')}`; $('.camRec i', el).style.width = Math.min(100, s / 60 * 100) + '%'; if (s >= 60) rec && rec.stop(); }, 250);
  };
  async function photoFx(file, effect, gr) {
    const busy = h(`<div class="camBusy"><div class="spin"></div>${esc(t('camApplying'))}</div>`); el.append(busy);
    try { const r = await fx.photo(file, effect, gr); if (!r.faces && !['none', 'glitch', 'vhs'].includes(effect)) toast(t('camNoFace'), true); r.canvas.toBlob(b => review(b, 'photo'), 'image/jpeg', 0.92); }
    catch (e) { fail(e); } finally { busy.remove(); }
  }
  function review(blob, kind, dur = 0) {
    const url = URL.createObjectURL(blob);
    const rv = h(`<div class="camReview"><div class="rvMedia">${kind === 'video' ? `<video src="${url}" playsinline autoplay loop></video>` : `<img src="${url}" alt="">`}</div>
      <div class="rvBar"><button class="btn ghost again">↺ ${esc(t('camRetake'))}</button><button class="btn ghost save">⬇ ${esc(t('save'))}</button>
      ${kind === 'video' || opt.allowEditPhoto !== false ? `<button class="btn ghost edit">✂️ ${esc(t('edEdit'))}</button>` : ''}<button class="btn pri post">${esc(t('next'))} →</button></div></div>`);
    el.append(rv);
    const ext = kind === 'video' ? (blob.type.includes('mp4') ? 'mp4' : 'webm') : 'jpg';
    const file = new File([blob], `prico-${Date.now()}.${ext}`, { type: blob.type || (kind === 'video' ? 'video/webm' : 'image/jpeg') });
    $('.again', rv).onclick = () => { URL.revokeObjectURL(url); rv.remove(); };
    $('.save', rv).onclick = () => download(file);
    const ed = $('.edit', rv); if (ed) ed.onclick = async () => { close(); const { openEditor } = await import('./editor.js'); openEditor({ files: [file] }); };
    $('.post', rv).onclick = async () => {
      if (opt.onCapture) { close(); return opt.onCapture(file, kind); }
      await needAuth(); const b = $('.post', rv); b.disabled = true; b.innerHTML = '<span class="spin sm"></span>';
      try {
        const { showResult, progress } = await import('./create.js');
        if (kind === 'photo') { const r = await api('/api/media/photo', { body: blob, type: 'image/jpeg' }); close(); showResult(r.media); }
        else {
          const up = await upload(file, p => { b.textContent = Math.round(p * 100) + '%'; });
          const r = await api('/api/edit', { body: { cam: true, project: { aspect: '9:16', clips: [{ up: up.id, in: 0, out: up.duration || dur || 60 }] } } });
          close(); const m = await progress(r.job); showResult(m);
        }
      } catch (e) { fail(e); b.disabled = false; b.textContent = t('next') + ' →'; }
    };
  }
  fx.preload();
  return { close };
}

// Photo FX (no camera): pick photo → choose effect/filter with live preview → result
export async function openPhotoFx(file) {
  if (!file) { const inp = h('<input type="file" accept="image/*" style="display:none">'); document.body.append(inp); file = await new Promise(r => { inp.onchange = () => r(inp.files[0]); inp.click(); }); inp.remove(); if (!file) return; }
  const { sheet } = await import('./core.js');
  const body = h(`<div><div class="pfxStage"><div class="spin"></div></div><div class="lbl">${esc(t('effects'))}</div><div class="fxRow hscroll light"></div><div class="lbl">${esc(t('filters'))}</div><div class="grRow hscroll light" style="display:flex"></div></div>`);
  const foot = h(`<div class="row"><button class="btn save" style="flex:1">⬇ ${esc(t('save'))}</button><button class="btn pri post" style="flex:2">${esc(t('next'))} →</button></div>`);
  const sh = sheet({ title: '🪄 ' + t('photoFx'), body, foot, full: true });
  let eff = 'bigeyes', gr = 'none', out = null, busy = false, again = false;
  $('.fxRow', body).innerHTML = fx.EFFECTS.filter(([k]) => k !== 'none').map(([k, e]) => `<button data-k="${k}" class="${k === eff ? 'on' : ''}"><b>${e}</b><span>${esc(t('fx_' + k))}</span></button>`).join('');
  $('.grRow', body).innerHTML = fx.GRADES.map(k => `<button data-k="${k}" class="${k === gr ? 'on' : ''}">${esc(t('flt_' + k))}</button>`).join('');
  const render = async () => { if (busy) { again = true; return; } busy = true; try { const r = await fx.photo(file, eff, gr); out = r.canvas; const st = $('.pfxStage', body); st.innerHTML = ''; st.append(out); if (!r.faces && !['glitch', 'vhs'].includes(eff)) st.append(h(`<div class="mut xs pfxNo">${esc(t('camNoFace'))}</div>`)); } catch (e) { fail(e); } busy = false; if (again) { again = false; render(); } };
  $$('.fxRow button', body).forEach(b => b.onclick = () => { $$('.fxRow button', body).forEach(z => z.classList.toggle('on', z === b)); eff = b.dataset.k; render(); });
  $$('.grRow button', body).forEach(b => b.onclick = () => { $$('.grRow button', body).forEach(z => z.classList.toggle('on', z === b)); gr = b.dataset.k; render(); });
  render();
  const blob = () => new Promise(r => out.toBlob(r, 'image/jpeg', 0.92));
  $('.save', foot).onclick = async () => out && download(new File([await blob()], `prico-fx-${Date.now()}.jpg`, { type: 'image/jpeg' }));
  $('.post', foot).onclick = async () => {
    if (!out) return; await needAuth(); const b = $('.post', foot); b.disabled = true;
    try { const r = await api('/api/media/photo', { body: await blob(), type: 'image/jpeg' }); sh.close(); const { showResult } = await import('./create.js'); showResult(r.media); } catch (e) { fail(e); b.disabled = false; }
  };
}
