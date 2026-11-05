// PRICO Editor — CapCut-style multi-clip editor. Free export (no paywall), auto-saved drafts (IndexedDB), undo/redo.
// Timeline: trim / split / reorder / speed / volume / filters / transitions; animated text in 6 fonts, stickers, picture-in-picture,
// music library with volume + fades, voiceover recording (with live auto-captions), multi-language TTS, captions, aspect ratios.
// Final 720p MP4 is rendered by ffmpeg on the server (POST /api/edit).
import { t, lang } from './i18n.js';
import { S, I, api, h, esc, abs, toast, fail, sheet, haptic, upload, $, $$ } from './core.js';
import { needAuth } from './app.js';
import { CSS as FCSS } from './fx.js';

const XD = 0.4, FONTS = { classic: 'PricoDisplay', bold: 'PricoRusso', lobster: 'PricoLobster', pacifico: 'PricoPacifico', script: 'PricoMarck', pixel: 'PricoPixel' };
const FILTERS = ['none', 'vivid', 'warm', 'cool', 'bw', 'vintage', 'film', 'cyber', 'fade', 'drama', 'glow'];
const TRANS = [['none', '⏸'], ['fade', '🌫️'], ['dissolve', '✨'], ['slideleft', '⬅️'], ['slideup', '⬆️'], ['smoothleft', '〰️'], ['zoomin', '🔍'], ['circleopen', '⭕'], ['wipeleft', '🧹'], ['pixelize', '👾'], ['radial', '🌀'], ['fadewhite', '⚪'], ['fadeblack', '⚫'], ['hblur', '💨']];
const ANIMS = [['none', '—'], ['pop', '💥'], ['fade', '🌫️'], ['slide', '➡️'], ['bounce', '🏀'], ['type', '⌨️']];
const COLORS = ['#ffffff', '#ffe14d', '#ff4d8d', '#4dd7ff', '#7cff6b', '#ff8a3d', '#b07cff', '#111111'];
const ASPECTS = { '9:16': 9 / 16, '1:1': 1, '4:5': 4 / 5, '16:9': 16 / 9 };
const SPEEDS = [0.25, 0.5, 1, 1.5, 2, 3, 4];
const uid = () => Math.random().toString(36).slice(2, 10);
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${Math.floor((s % 1) * 10)}`;

// ---------- IndexedDB (drafts + media blobs survive reloads) ----------
let dbP = null;
function idb() { if (!dbP) dbP = new Promise((res, rej) => { const r = indexedDB.open('prico-ed', 1); r.onupgradeneeded = () => { r.result.createObjectStore('media', { keyPath: 'lid' }); r.result.createObjectStore('drafts', { keyPath: 'id' }); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); return dbP; }
async function tx(store, mode, fn) { const d = await idb(); return new Promise((res, rej) => { const x = d.transaction(store, mode); const s = x.objectStore(store); const r = fn(s); x.oncomplete = () => res(r && r.result); x.onerror = () => rej(x.error); }); }
const idbPut = (st, v) => tx(st, 'readwrite', s => s.put(v)).catch(e => console.warn('idb', e));
const idbGet = (st, k) => tx(st, 'readonly', s => s.get(k)).catch(() => null);
const idbAll = st => tx(st, 'readonly', s => s.getAll()).catch(() => []);
const idbDel = (st, k) => tx(st, 'readwrite', s => s.delete(k)).catch(() => {});
export async function listDrafts() { return (await idbAll('drafts')).sort((a, b) => b.updated - a.updated); }

function probeMedia(blob, kind) {
  return new Promise(res => {
    const url = URL.createObjectURL(blob);
    if (kind === 'image') { const i = new Image(); i.onload = () => res({ url, w: i.naturalWidth, h: i.naturalHeight, dur: 3, thumb: url }); i.onerror = () => res({ url, w: 720, h: 1280, dur: 3 }); i.src = url; return; }
    const el = document.createElement(kind === 'audio' ? 'audio' : 'video'); el.preload = 'metadata'; el.muted = true; el.playsInline = true; el.src = url;
    const done = thumb => res({ url, w: el.videoWidth || 720, h: el.videoHeight || 1280, dur: isFinite(el.duration) && el.duration > 0 ? el.duration : 5, thumb });
    el.onloadedmetadata = () => {
      if (el.duration === Infinity) { el.currentTime = 1e6; el.ontimeupdate = () => { el.ontimeupdate = null; el.currentTime = 0; done(); }; return; }
      if (kind === 'audio') return done();
      el.currentTime = Math.min(0.5, el.duration / 3 || 0);
      el.onseeked = () => { try { const c = document.createElement('canvas'); c.width = 90; c.height = Math.round(90 * el.videoHeight / el.videoWidth) || 160; c.getContext('2d').drawImage(el, 0, 0, c.width, c.height); done(c.toDataURL('image/jpeg', .6)); } catch { done(); } };
    };
    el.onerror = () => res({ url, w: 720, h: 1280, dur: 5 });
    setTimeout(() => res({ url, w: 720, h: 1280, dur: 5 }), 8000);
  });
}

export async function openEditor(opt = {}) {
  await needAuth();
  let draftId = opt.draft || null, P, media = new Map();
  const blank = () => ({ aspect: '9:16', clips: [], texts: [], stickers: [], pip: null, music: null, voices: [], captions: [], capStyle: { color: '#ffffff', hl: '#ffe14d', font: 'classic', y: 0.74, bg: false }, origVol: 1 });
  if (!draftId && !opt.files?.length) {
    const ds = await listDrafts();
    if (ds.length) { const pick = await chooseDraft(ds); if (pick === null) return; draftId = pick; }
  }
  if (draftId) { const d = await idbGet('drafts', draftId); P = d ? d.project : blank(); if (!d) draftId = null;
    for (const c of [...P.clips, ...P.voices, ...(P.pip ? [P.pip] : [])]) if (!media.has(c.lid)) { const m = await idbGet('media', c.lid); if (m) media.set(m.lid, { ...m, ...(await probeMedia(m.blob, m.kind)) }); }
    P.clips = P.clips.filter(c => media.has(c.lid)); P.voices = P.voices.filter(v => media.has(v.lid)); if (P.pip && !media.has(P.pip.lid)) P.pip = null;
  } else P = blank();
  draftId ||= 'd' + Date.now();
  const hist = [JSON.stringify(P)]; let hi = 0;
  let sel = null; // {type:'clip'|'text'|'sticker'|'voice'|'music'|'pip'|'cap', i}
  let T = 0, playing = false, pps = 46, raf = 0, lastFrame = 0, closed = false, curClip = -1;

  const el = h(`<div class="ed"><div class="edTop"><button class="iconBtn x">${I.close}</button><button class="chip asp">9:16</button><span class="sp"></span>
    <button class="iconBtn undo" aria-label="undo">↶</button><button class="iconBtn redo" aria-label="redo">↷</button><button class="btn pri sm exp">${esc(t('edExport'))}</button></div>
    <div class="edStageWrap"><div class="edStage"><video class="pv" playsinline muted preload="auto"></video><img class="pi" alt=""><video class="pip" playsinline muted></video><div class="ovl"></div><div class="emptyHint"></div></div></div>
    <div class="edCtl"><span class="tm">0:00.0</span><button class="iconBtn play">${I.play}</button><span class="tm dur">0:00.0</span></div>
    <div class="edTl"><div class="ph"></div><div class="tlScroll"><div class="tlIn"></div></div></div>
    <div class="edTools hscroll"></div></div>`);
  document.body.append(el); requestAnimationFrame(() => el.classList.add('on'));
  const stage = $('.edStage', el), pv = $('.pv', el), pi = $('.pi', el), pipV = $('.pip', el), ovl = $('.ovl', el), tl = $('.tlScroll', el), tlIn = $('.tlIn', el), tools = $('.edTools', el);
  const music = new Audio(); music.preload = 'auto'; const voiceEls = new Map();
  pv.muted = false;

  // ---------- model helpers ----------
  const cdur = c => (c.out - c.in) / c.speed;
  const starts = () => { const s = []; let a = 0; P.clips.forEach((c, i) => { if (i && c.trans !== 'none') a -= XD; s.push(a); a += cdur(c); }); return s; };
  const total = () => { const s = starts(); return P.clips.length ? s[s.length - 1] + cdur(P.clips[P.clips.length - 1]) : 0; };
  const clipAt = tt => { const s = starts(); for (let i = P.clips.length - 1; i >= 0; i--) if (tt >= s[i]) return i; return 0; };
  let saveT;
  function commit(redraw = true) {
    const js = JSON.stringify(P); if (js !== hist[hi]) { hist.splice(hi + 1); hist.push(js); if (hist.length > 60) hist.shift(); hi = hist.length - 1; }
    clearTimeout(saveT); saveT = setTimeout(saveDraft, 600);
    if (redraw) draw();
  }
  async function saveDraft() { if (!P.clips.length) return; await idbPut('drafts', { id: draftId, updated: Date.now(), project: P, thumb: media.get(P.clips[0].lid)?.thumb || null, dur: total() }); }
  const undo = () => { if (hi > 0) { P = JSON.parse(hist[--hi]); sel = null; draw(); saveDraft(); } };
  const redo = () => { if (hi < hist.length - 1) { P = JSON.parse(hist[++hi]); sel = null; draw(); saveDraft(); } };

  async function addMedia(files, where = 'clips') {
    const out = [];
    for (const f of files) {
      const kind = f.type.startsWith('video/') ? 'video' : f.type.startsWith('image/') ? 'image' : f.type.startsWith('audio/') ? 'audio' : null; if (!kind) continue;
      const lid = uid(); const info = await probeMedia(f, kind);
      const m = { lid, kind, blob: f, name: f.name || kind, ...info, up: null }; media.set(lid, m);
      idbPut('media', { lid, kind, blob: f, name: m.name, thumb: info.thumb || null });
      out.push(m);
      if (where === 'clips') P.clips.push({ lid, in: 0, out: kind === 'image' ? 3 : Math.min(info.dur, 180), speed: 1, filter: 'none', trans: P.clips.length ? 'fade' : 'none', vol: 1, flip: false, rot: 0 });
    }
    return out;
  }
  const pickFiles = (accept, multiple = true) => new Promise(res => { const i = h(`<input type="file" accept="${accept}" ${multiple ? 'multiple' : ''} style="display:none">`); document.body.append(i); i.onchange = () => { res([...i.files]); i.remove(); }; i.click(); });

  // ---------- stage / preview ----------
  function layoutStage() {
    const wrap = $('.edStageWrap', el), r = ASPECTS[P.aspect]; const W = wrap.clientWidth - 16, H = wrap.clientHeight - 8;
    let w = W, hh = W / r; if (hh > H) { hh = H; w = H * r; }
    stage.style.width = w + 'px'; stage.style.height = hh + 'px'; $('.asp', el).textContent = P.aspect;
  }
  const SW = () => stage.clientWidth || 1, SH = () => stage.clientHeight || 1;
  function showFrame(force) {
    if (!P.clips.length) { pv.style.display = pi.style.display = 'none'; $('.emptyHint', el).innerHTML = `<button class="btn pri addFirst">➕ ${esc(t('edAddMedia'))}</button>`; $('.addFirst', el).onclick = addClips; renderOverlay(); return; }
    $('.emptyHint', el).innerHTML = '';
    const i = clipAt(T), c = P.clips[i], m = media.get(c.lid), s = starts()[i];
    const local = c.in + (T - s) * c.speed;
    const f = FCSS[c.filter] || ''; const tr = `${c.flip ? 'scaleX(-1) ' : ''}rotate(${c.rot}deg)`;
    if (m.kind === 'image') { pv.pause(); pv.style.display = 'none'; pi.style.display = ''; if (pi.dataset.lid !== c.lid) { pi.src = m.url; pi.dataset.lid = c.lid; } pi.style.filter = f; pi.style.transform = tr + ` scale(${1 + 0.15 * Math.min(1, (T - s) / Math.max(.1, cdur(c)))})`; }
    else {
      pi.style.display = 'none'; pv.style.display = ''; pv.style.filter = f; pv.style.transform = tr;
      if (pv.dataset.lid !== c.lid) { pv.src = m.url; pv.dataset.lid = c.lid; pv.currentTime = local; force = true; }
      pv.playbackRate = c.speed; pv.volume = Math.min(1, c.vol * P.origVol);
      if (force || Math.abs(pv.currentTime - local) > 0.35) { try { pv.currentTime = local; } catch {} }
      if (playing && pv.paused) pv.play().catch(() => {}); if (!playing && !pv.paused) pv.pause();
    }
    curClip = i;
    // PiP
    if (P.pip && T >= P.pip.start && T <= P.pip.end) {
      const pm = media.get(P.pip.lid); pipV.style.display = ''; if (pipV.dataset.lid !== P.pip.lid) { if (pm.kind === 'image') pipV.poster = pm.url, pipV.removeAttribute('src'); else pipV.src = pm.url; pipV.dataset.lid = P.pip.lid; }
      const w = P.pip.w * SW(); Object.assign(pipV.style, { width: w + 'px', height: w + 'px', left: (P.pip.x * SW() - w / 2) + 'px', top: (P.pip.y * SH() - w / 2) + 'px' });
      if (pm.kind === 'video') { const lt = T - P.pip.start; if (Math.abs(pipV.currentTime - lt) > .4) pipV.currentTime = lt; if (playing && pipV.paused) pipV.play().catch(() => {}); if (!playing) pipV.pause(); }
    } else { pipV.style.display = 'none'; pipV.pause(); }
    renderOverlay();
  }
  function renderOverlay() {
    const sw = SW();
    const want = [];
    P.texts.forEach((x, i) => { if (T >= x.start && T <= x.end) want.push(['text', i, x]); });
    P.stickers.forEach((x, i) => { if (T >= x.start && T <= x.end) want.push(['sticker', i, x]); });
    P.captions.forEach((x, i) => { if (T >= x.start && T <= x.end) want.push(['cap', i, x]); });
    const keep = new Set();
    for (const [type, i, x] of want) {
      const k = type + i; keep.add(k); let n = ovl.querySelector(`[data-k="${k}"]`);
      const sig = JSON.stringify(x) + sw + JSON.stringify(P.capStyle);
      if (!n || n.dataset.sig !== sig) {
        n?.remove();
        if (type === 'sticker') n = h(`<img class="ovSt" src="stickers/${x.c}.svg" alt="">`), Object.assign(n.style, { width: x.s * sw + 'px', transform: `translate(-50%,-50%) rotate(${x.r || 0}deg)` });
        else if (type === 'text') { n = h(`<div class="ovTx anim-${x.anim}"></div>`); n.textContent = x.text; Object.assign(n.style, { fontFamily: FONTS[x.font] || FONTS.classic, fontSize: x.size * sw / 720 + 'px', color: x.color, background: x.bg ? 'rgba(0,0,0,.78)' : '', padding: x.bg ? '.15em .45em' : '', borderRadius: '.3em', textShadow: x.bg ? 'none' : '' }); }
        else { n = h(`<div class="ovTx ovCap anim-pop"></div>`); n.textContent = x.text; Object.assign(n.style, { fontFamily: FONTS[P.capStyle.font] || FONTS.classic, fontSize: 46 * sw / 720 + 'px', color: i % 2 ? P.capStyle.hl : P.capStyle.color, background: P.capStyle.bg ? 'rgba(0,0,0,.78)' : '' }); }
        n.dataset.k = k; n.dataset.sig = sig; ovl.append(n);
        if (type !== 'cap') dragify(n, type, i);
      }
      const y = type === 'cap' ? P.capStyle.y : x.y, xx = type === 'cap' ? .5 : x.x;
      n.style.left = xx * 100 + '%'; n.style.top = y * 100 + '%';
      n.classList.toggle('sel', !!sel && sel.type === type && sel.i === i);
    }
    for (const n of [...ovl.children]) if (!keep.has(n.dataset.k)) n.remove();
  }
  function dragify(n, type, i) {
    let sx, sy, ox, oy, moved = false;
    n.onpointerdown = e => { e.preventDefault(); n.setPointerCapture(e.pointerId); const o = (type === 'text' ? P.texts : P.stickers)[i]; sx = e.clientX; sy = e.clientY; ox = o.x; oy = o.y; moved = false; };
    n.onpointermove = e => { if (sx == null) return; const o = (type === 'text' ? P.texts : P.stickers)[i]; const dx = (e.clientX - sx) / SW(), dy = (e.clientY - sy) / SH(); if (Math.abs(dx) + Math.abs(dy) > .01) moved = true; o.x = Math.min(1, Math.max(0, ox + dx)); o.y = Math.min(1, Math.max(0, oy + dy)); n.style.left = o.x * 100 + '%'; n.style.top = o.y * 100 + '%'; };
    n.onpointerup = () => { sx = null; if (moved) commit(false); select({ type, i }); };
  }

  // ---------- playback ----------
  function syncAudio(force) {
    const tot = total();
    if (P.music) {
      const want = abs(`/api/music/${P.music.id}.m4a`); if (music.dataset.id !== P.music.id) { music.src = want; music.dataset.id = P.music.id; music.loop = true; force = true; }
      let v = P.music.vol; if (T < P.music.fadeIn) v *= T / Math.max(.01, P.music.fadeIn); if (T > tot - P.music.fadeOut) v *= Math.max(0, (tot - T) / Math.max(.01, P.music.fadeOut));
      music.volume = Math.min(1, Math.max(0, v));
      const mt = (P.music.offset + T) % (music.duration || 32);
      if (force || Math.abs(music.currentTime - mt) > .3) { try { music.currentTime = mt; } catch {} }
      if (playing && music.paused) music.play().catch(() => {}); if (!playing) music.pause();
    } else music.pause();
    P.voices.forEach((v, i) => {
      const m = media.get(v.lid); if (!m) return; let a = voiceEls.get(v.lid); if (!a) { a = new Audio(m.url); voiceEls.set(v.lid, a); }
      const lt = T - v.start, on = lt >= 0 && lt < m.dur; a.volume = Math.min(1, v.vol);
      if (on && playing) { if (a.paused || force) { a.currentTime = lt; a.play().catch(() => {}); } } else if (!a.paused) a.pause();
    });
  }
  function tick(ts) {
    if (!playing) return; raf = requestAnimationFrame(tick);
    const dt = lastFrame ? (ts - lastFrame) / 1000 : 0; lastFrame = ts;
    const i = clipAt(T), c = P.clips[i], m = c && media.get(c.lid);
    if (m && m.kind === 'video' && !pv.paused && pv.dataset.lid === c.lid && pv.readyState >= 2) { const s = starts()[i]; const nt = s + (pv.currentTime - c.in) / c.speed; T = Math.abs(nt - T) < .5 ? Math.max(T, nt) : T + dt; if (pv.currentTime >= c.out - 0.03) T = Math.max(T, s + cdur(c) + 0.001); }
    else T += dt;
    if (T >= total()) { T = total(); pause(); }
    showFrame(); syncAudio(); updTime(); tl.scrollLeft = T * pps;
  }
  function play() { if (!P.clips.length) return; if (T >= total() - .05) T = 0; playing = true; lastFrame = 0; $('.play', el).innerHTML = I.pause || '⏸'; showFrame(true); syncAudio(true); raf = requestAnimationFrame(tick); }
  function pause() { playing = false; cancelAnimationFrame(raf); $('.play', el).innerHTML = I.play; pv.pause(); pipV.pause(); music.pause(); voiceEls.forEach(a => a.pause()); }
  $('.play', el).onclick = () => playing ? pause() : play();
  const updTime = () => { $('.tm', el).textContent = fmtT(T); $('.dur', el).textContent = fmtT(total()); };
  tl.addEventListener('scroll', () => { if (playing) return; T = Math.min(total(), Math.max(0, tl.scrollLeft / pps)); updTime(); showFrame(); }, { passive: true });

  // ---------- timeline ----------
  function drawTimeline() {
    const s = starts(), tot = total(), pad = tl.clientWidth / 2;
    tlIn.style.padding = `0 ${pad}px`; tlIn.style.width = (tot * pps + pad * 2) + 'px';
    let html = `<div class="tRow clips">`;
    P.clips.forEach((c, i) => { const m = media.get(c.lid); html += `${i ? `<button class="trBtn ${c.trans !== 'none' ? 'on' : ''}" data-tr="${i}" style="left:${s[i] * pps + pad - 11}px">${TRANS.find(x => x[0] === c.trans)?.[1] || '⏸'}</button>` : ''}<div class="tClip ${sel?.type === 'clip' && sel.i === i ? 'sel' : ''}" data-i="${i}" style="left:${s[i] * pps + pad}px;width:${Math.max(18, cdur(c) * pps - 2)}px;background-image:url('${m?.thumb || ''}')"><span>${c.speed !== 1 ? c.speed + '×' : ''} ${c.filter !== 'none' ? '🎨' : ''} ${c.vol === 0 ? '🔇' : ''}</span></div>`; });
    html += `</div>`;
    const bar = (type, i, a, b, label, cls) => `<div class="tBar ${cls} ${sel?.type === type && sel.i === i ? 'sel' : ''}" data-type="${type}" data-i="${i}" style="left:${a * pps + pad}px;width:${Math.max(16, (b - a) * pps)}px">${esc(label)}</div>`;
    html += `<div class="tRow">${P.texts.map((x, i) => bar('text', i, x.start, x.end, '🔤 ' + x.text, 'tx')).join('')}${P.stickers.map((x, i) => bar('sticker', i, x.start, x.end, '😀', 'st')).join('')}${P.pip ? bar('pip', 0, P.pip.start, P.pip.end, '🖼️ PiP', 'pp') : ''}</div>`;
    html += `<div class="tRow">${P.music ? bar('music', 0, 0, tot, '🎵 ' + (S.cat?.music?.find(m => m.id === P.music.id)?.name || P.music.id), 'mu') : ''}${P.voices.map((v, i) => bar('voice', i, v.start, v.start + (media.get(v.lid)?.dur || 1), (v.tts ? '🗣️ ' : '🎙️ ') + (v.text || ''), 'vo')).join('')}</div>`;
    html += `<div class="tRow">${P.captions.map((x, i) => bar('cap', i, x.start, x.end, x.text, 'cp')).join('')}</div>`;
    tlIn.innerHTML = html;
    $$('.tClip', tlIn).forEach(n => n.onclick = () => select({ type: 'clip', i: +n.dataset.i }));
    $$('.trBtn', tlIn).forEach(n => n.onclick = () => pickTransition(+n.dataset.tr));
    $$('.tBar', tlIn).forEach(n => n.onclick = () => select({ type: n.dataset.type, i: +n.dataset.i }));
    if (!playing) tl.scrollLeft = T * pps;
  }
  function select(s) { sel = s && (sel?.type === s.type && sel?.i === s.i && s.type !== 'text' && s.type !== 'sticker' ? null : s); haptic(4); draw(); }
  function draw() { layoutStage(); T = Math.min(T, total()); drawTimeline(); drawTools(); showFrame(true); updTime(); $('.undo', el).disabled = hi <= 0; $('.redo', el).disabled = hi >= hist.length - 1; }

  // ---------- tools ----------
  const tb = (k, ic, label) => `<button data-k="${k}"><b>${ic}</b><span>${esc(label)}</span></button>`;
  function drawTools() {
    let html = '';
    if (!sel) html = tb('add', '➕', t('edAddMedia')) + tb('text', '🔤', t('edText')) + tb('sticker', '😀', t('edStickers')) + tb('music', '🎵', t('edMusic')) + tb('rec', '🎙️', t('edVoice')) + tb('tts', '🗣️', t('edTts')) + tb('caps', '💬', t('edCaptions')) + tb('pip', '🖼️', t('edPip')) + tb('aspect', '▭', t('edCanvas')) + tb('ovol', P.origVol ? '🔊' : '🔇', t('edOrigSound'));
    else if (sel.type === 'clip') html = tb('back', '‹', t('back')) + tb('split', '✂️', t('edSplit')) + tb('trim', '↔️', t('edTrim')) + tb('speed', '⏩', t('edSpeed')) + tb('vol', '🔊', t('edVolume')) + tb('filter', '🎨', t('filters')) + tb('trans', '🌀', t('edTransition')) + tb('rot', '⟳', t('edRotate')) + tb('flip', '⇋', t('edFlip')) + tb('dup', '⧉', t('edDuplicate')) + tb('left', '◀', t('edMoveL')) + tb('right', '▶', t('edMoveR')) + tb('del', '🗑️', t('delete'));
    else if (sel.type === 'text') html = tb('back', '‹', t('back')) + tb('tedit', '✏️', t('edEdit')) + tb('timing', '⏱️', t('edTiming')) + tb('tdup', '⧉', t('edDuplicate')) + tb('del', '🗑️', t('delete'));
    else if (sel.type === 'sticker') html = tb('back', '‹', t('back')) + tb('ssize', '⤢', t('edSize')) + tb('timing', '⏱️', t('edTiming')) + tb('del', '🗑️', t('delete'));
    else if (sel.type === 'voice') html = tb('back', '‹', t('back')) + tb('vvol', '🔊', t('edVolume')) + tb('vhere', '📍', t('edMoveHere')) + tb('del', '🗑️', t('delete'));
    else if (sel.type === 'music') html = tb('back', '‹', t('back')) + tb('music', '🔁', t('edReplace')) + tb('mvol', '🔊', t('edVolume')) + tb('del', '🗑️', t('delete'));
    else if (sel.type === 'pip') html = tb('back', '‹', t('back')) + tb('psize', '⤢', t('edSize')) + tb('timing', '⏱️', t('edTiming')) + tb('del', '🗑️', t('delete'));
    else if (sel.type === 'cap') html = tb('back', '‹', t('back')) + tb('cedit', '✏️', t('edEdit')) + tb('cstyle', '🎨', t('edStyle')) + tb('timing', '⏱️', t('edTiming')) + tb('del', '🗑️', t('delete')) + tb('cclear', '🧹', t('edClearCaps'));
    tools.innerHTML = html;
    $$('button', tools).forEach(b => b.onclick = () => { haptic(5); act(b.dataset.k); });
  }
  const cur = () => sel && ({ clip: P.clips, text: P.texts, sticker: P.stickers, voice: P.voices, cap: P.captions }[sel.type] || [])[sel.i];
  async function act(k) {
    const c = cur();
    switch (k) {
      case 'back': sel = null; draw(); break;
      case 'add': await addClips(); break;
      case 'text': { const x = { text: t('edYourText'), start: T, end: Math.min(Math.max(total(), T + 0.5), T + 3), x: .5, y: .4, size: 64, color: '#ffffff', font: 'classic', anim: 'pop', bg: false }; if (x.end <= x.start) x.end = x.start + 3; P.texts.push(x); sel = { type: 'text', i: P.texts.length - 1 }; commit(); editText(); break; }
      case 'sticker': pickSticker(); break;
      case 'music': pickMusic(); break;
      case 'rec': recordVoice(); break;
      case 'tts': ttsSheet(); break;
      case 'caps': captionsSheet(); break;
      case 'pip': { const f = await pickFiles('image/*,video/*', false); if (!f.length) break; const [m] = await addMedia(f, 'none'); P.pip = { lid: m.lid, start: T, end: Math.min(total(), T + Math.min(m.kind === 'video' ? m.dur : 4, 8)) || T + 4, x: .72, y: .24, w: .36 }; if (P.pip.end <= P.pip.start) P.pip.end = P.pip.start + 3; sel = { type: 'pip', i: 0 }; commit(); break; }
      case 'aspect': chips(t('edCanvas'), Object.keys(ASPECTS).map(a => [a, a]), P.aspect, v => { P.aspect = v; commit(); }); break;
      case 'ovol': P.origVol = P.origVol ? 0 : 1; commit(); toast(P.origVol ? '🔊' : '🔇'); break;
      case 'split': { const s = starts()[sel.i]; const local = c.in + (T - s) * c.speed; if (local <= c.in + .15 || local >= c.out - .15) return toast(t('edSplitHint'), true); const b = { ...c, in: local, trans: 'none' }; c.out = local; P.clips.splice(sel.i + 1, 0, b); commit(); toast('✂️'); break; }
      case 'trim': trimSheet(c); break;
      case 'speed': chips(t('edSpeed'), SPEEDS.map(s => [s, s + '×']), c.speed, v => { c.speed = +v; commit(); }); break;
      case 'vol': slider(t('edVolume'), 0, 2, .05, c.vol, v => { c.vol = v; }, () => commit()); break;
      case 'filter': chips(t('filters'), FILTERS.map(f => [f, t('flt_' + f)]), c.filter, v => { c.filter = v; commit(); }, f => `<i class="fprev" style="filter:${FCSS[f] || 'none'};background-image:url('${media.get(c.lid)?.thumb || ''}')"></i>`, true); break;
      case 'trans': if (sel.i === 0) toast(t('edTransFirst')); else pickTransition(sel.i); break;
      case 'rot': c.rot = (c.rot + 90) % 360; commit(); break;
      case 'flip': c.flip = !c.flip; commit(); break;
      case 'dup': P.clips.splice(sel.i + 1, 0, { ...c, trans: 'none' }); commit(); break;
      case 'left': if (sel.i > 0) { [P.clips[sel.i - 1], P.clips[sel.i]] = [P.clips[sel.i], P.clips[sel.i - 1]]; sel.i--; commit(); } break;
      case 'right': if (sel.i < P.clips.length - 1) { [P.clips[sel.i + 1], P.clips[sel.i]] = [P.clips[sel.i], P.clips[sel.i + 1]]; sel.i++; commit(); } break;
      case 'del': if (sel.type === 'music') P.music = null; else if (sel.type === 'pip') P.pip = null; else ({ clip: P.clips, text: P.texts, sticker: P.stickers, voice: P.voices, cap: P.captions }[sel.type]).splice(sel.i, 1); sel = null; commit(); break;
      case 'tedit': editText(); break;
      case 'tdup': P.texts.push({ ...c, y: Math.min(.95, c.y + .08) }); sel = { type: 'text', i: P.texts.length - 1 }; commit(); break;
      case 'timing': timingSheet(sel.type === 'pip' ? P.pip : c); break;
      case 'ssize': slider(t('edSize'), .05, .7, .01, c.s, v => { c.s = v; renderOverlay(); }, () => commit()); break;
      case 'psize': slider(t('edSize'), .15, .8, .01, P.pip.w, v => { P.pip.w = v; showFrame(); }, () => commit()); break;
      case 'vvol': slider(t('edVolume'), 0, 3, .05, c.vol, v => { c.vol = v; }, () => commit()); break;
      case 'vhere': c.start = T; commit(); break;
      case 'mvol': musicSheet(); break;
      case 'cedit': { const v = prompt(t('edEdit'), c.text); if (v != null) { c.text = v.slice(0, 90); commit(); } break; }
      case 'cstyle': capStyleSheet(); break;
      case 'cclear': P.captions = []; sel = null; commit(); break;
    }
  }
  async function addClips() { const f = await pickFiles('image/*,video/*'); if (!f.length) return; const busy = toastBusy(); await addMedia(f); busy(); commit(); }
  const toastBusy = () => { const b = h(`<div class="edBusy"><span class="spin"></span></div>`); el.append(b); return () => b.remove(); };

  // generic sheets
  function chips(title, items, val, onPick, prev, grid) {
    const body = h(`<div class="${grid ? 'chipGrid' : 'chipRow'}">${items.map(([v, l]) => `<button class="chip2 ${String(v) === String(val) ? 'on' : ''}" data-v="${v}">${prev ? prev(v) : ''}<span>${esc(l)}</span></button>`).join('')}</div>`);
    const sh = sheet({ title, body, cls: 'edSheet' });
    $$('button', body).forEach(b => b.onclick = () => { onPick(b.dataset.v); $$('button', body).forEach(z => z.classList.toggle('on', z === b)); if (!grid) sh.close(); });
  }
  function slider(title, min, max, step, val, onInput, onDone) {
    const body = h(`<div class="col"><input type="range" min="${min}" max="${max}" step="${step}" value="${val}" class="rng"><div class="mut sm vv" style="text-align:center">${Math.round(val * 100)}%</div></div>`);
    sheet({ title, body, cls: 'edSheet', onClose: onDone });
    $('.rng', body).oninput = e => { const v = +e.target.value; onInput(v); $('.vv', body).textContent = Math.round(v * 100) + '%'; };
  }
  function pickTransition(i) { const c = P.clips[i]; chips(t('edTransition'), TRANS.map(([k, e]) => [k, e + ' ' + t('tr_' + k)]), c.trans, v => { c.trans = v; commit(); }, null, true); }
  function trimSheet(c) {
    const m = media.get(c.lid); const max = m.kind === 'image' ? 30 : m.dur;
    const body = h(`<div class="col"><div class="lbl">${esc(t('edStart'))} <b class="a"></b></div><input type="range" class="rng ri" min="0" max="${max}" step="0.05" value="${c.in}"><div class="lbl">${esc(t('edEnd'))} <b class="b"></b></div><input type="range" class="rng ro" min="0.2" max="${max}" step="0.05" value="${c.out}"></div>`);
    const upd = () => { $('.a', body).textContent = fmtT(c.in); $('.b', body).textContent = fmtT(c.out) + ` (${fmtT(cdur(c))})`; };
    sheet({ title: t('edTrim'), body, cls: 'edSheet', onClose: () => commit() }); upd();
    $('.ri', body).oninput = e => { c.in = Math.min(+e.target.value, c.out - .2); if (m.kind === 'image') c.in = 0; upd(); T = starts()[P.clips.indexOf(c)]; showFrame(true); };
    $('.ro', body).oninput = e => { c.out = Math.max(+e.target.value, c.in + .2); upd(); const s = starts()[P.clips.indexOf(c)]; T = s + cdur(c) - .05; showFrame(true); };
  }
  function timingSheet(o) {
    const tot = Math.max(total(), .5);
    const body = h(`<div class="col"><div class="lbl">${esc(t('edStart'))} <b class="a"></b></div><input type="range" class="rng ri" min="0" max="${tot}" step="0.05" value="${o.start}"><div class="lbl">${esc(t('edEnd'))} <b class="b"></b></div><input type="range" class="rng ro" min="0" max="${tot}" step="0.05" value="${o.end}"><button class="btn sm hereA">📍 ${esc(t('edStartHere'))}</button></div>`);
    const upd = () => { $('.a', body).textContent = fmtT(o.start); $('.b', body).textContent = fmtT(o.end); $('.ri', body).value = o.start; $('.ro', body).value = o.end; };
    sheet({ title: t('edTiming'), body, cls: 'edSheet', onClose: () => commit() }); upd();
    $('.ri', body).oninput = e => { o.start = Math.min(+e.target.value, o.end - .2); upd(); };
    $('.ro', body).oninput = e => { o.end = Math.max(+e.target.value, o.start + .2); upd(); };
    $('.hereA', body).onclick = () => { const d = o.end - o.start; o.start = T; o.end = Math.min(tot, T + d); upd(); };
  }
  function editText() {
    const x = cur(); if (!x) return;
    const body = h(`<div class="col"><textarea class="field tt" maxlength="140" rows="2"></textarea>
      <div class="lbl">${esc(t('edFont'))}</div><div class="chipRow fonts">${Object.entries(FONTS).map(([k, f]) => `<button class="chip2 ${x.font === k ? 'on' : ''}" data-v="${k}" style="font-family:${f}">Aa ${k}</button>`).join('')}</div>
      <div class="lbl">${esc(t('edColor'))}</div><div class="chipRow cols">${COLORS.map(c => `<button class="sw ${x.color === c ? 'on' : ''}" data-v="${c}" style="background:${c}"></button>`).join('')}<button class="chip2 bgT ${x.bg ? 'on' : ''}">▣ ${esc(t('edBg'))}</button></div>
      <div class="lbl">${esc(t('edAnim'))}</div><div class="chipRow anims">${ANIMS.map(([k, e]) => `<button class="chip2 ${x.anim === k ? 'on' : ''}" data-v="${k}">${e} ${esc(t('an_' + k))}</button>`).join('')}</div>
      <div class="lbl">${esc(t('edSize'))}</div><input type="range" class="rng sz" min="20" max="140" step="1" value="${x.size}"></div>`);
    $('.tt', body).value = x.text;
    const sh = sheet({ title: t('edText'), body, cls: 'edSheet', onClose: () => { if (!x.text.trim()) { P.texts.splice(P.texts.indexOf(x), 1); sel = null; } commit(); } });
    const live = () => renderOverlay();
    $('.tt', body).oninput = e => { x.text = e.target.value; live(); };
    $$('.fonts button', body).forEach(b => b.onclick = () => { x.font = b.dataset.v; $$('.fonts button', body).forEach(z => z.classList.toggle('on', z === b)); live(); });
    $$('.cols .sw', body).forEach(b => b.onclick = () => { x.color = b.dataset.v; $$('.cols .sw', body).forEach(z => z.classList.toggle('on', z === b)); live(); });
    $('.bgT', body).onclick = e => { x.bg = !x.bg; e.currentTarget.classList.toggle('on', x.bg); live(); };
    $$('.anims button', body).forEach(b => b.onclick = () => { x.anim = b.dataset.v; $$('.anims button', body).forEach(z => z.classList.toggle('on', z === b)); live(); });
    $('.sz', body).oninput = e => { x.size = +e.target.value; live(); };
    setTimeout(() => { const ta = $('.tt', body); ta.focus(); ta.select(); }, 350);
  }
  function pickSticker() {
    const list = S.cat?.stickers || [];
    const body = h(`<div class="stGrid">${list.map(c => `<button data-c="${c}"><img src="stickers/${c}.svg" alt="" loading="lazy"></button>`).join('')}</div>`);
    const sh = sheet({ title: t('edStickers'), body, full: true, cls: 'edSheet' });
    $$('button', body).forEach(b => b.onclick = () => { P.stickers.push({ c: b.dataset.c, start: T, end: Math.min(Math.max(total(), T + 1), T + 3), x: .5, y: .5, s: .22, r: 0 }); sel = { type: 'sticker', i: P.stickers.length - 1 }; sh.close(); commit(); });
  }
  function pickMusic() {
    const tracks = S.cat?.music || [], cats = S.cat?.musicCats || [];
    let cat = 'all'; const prev = new Audio(); let playingId = null;
    const body = h(`<div><div class="chipRow mcats"><button class="chip2 on" data-c="all">${esc(t('all'))}</button>${cats.map(c => `<button class="chip2" data-c="${c}">${esc(t('mc_' + c))}</button>`).join('')}</div><div class="col mlist" style="margin-top:10px"></div><div class="mut xs" style="margin-top:10px;text-align:center">♪ ${esc(t('musicFree'))}</div></div>`);
    const sh = sheet({ title: '🎵 ' + t('edMusic'), body, full: true, cls: 'edSheet', onClose: () => prev.pause() });
    const list = () => { $('.mlist', body).innerHTML = tracks.filter(m => cat === 'all' || m.cat === cat).map(m => `<div class="mItem ${P.music?.id === m.id ? 'on' : ''}"><button class="mPlay" data-id="${m.id}">▶</button><div class="sp"><b>${esc(m.name)}</b><div class="mut xs">${esc(t('mc_' + m.cat))} · ${m.bpm} BPM</div></div><button class="btn sm pri use" data-id="${m.id}">${esc(t('edUse'))}</button></div>`).join('');
      $$('.mPlay', body).forEach(b => b.onclick = () => { if (playingId === b.dataset.id) { prev.pause(); playingId = null; b.textContent = '▶'; return; } $$('.mPlay', body).forEach(z => z.textContent = '▶'); prev.src = abs(`/api/music/${b.dataset.id}.m4a`); prev.play().catch(() => {}); playingId = b.dataset.id; b.textContent = '⏸'; });
      $$('.use', body).forEach(b => b.onclick = () => { P.music = { id: b.dataset.id, vol: P.music?.vol ?? .7, fadeIn: P.music?.fadeIn ?? .5, fadeOut: P.music?.fadeOut ?? 1.5, offset: 0 }; prev.pause(); sh.close(); commit(); toast('🎵 ' + tracks.find(x => x.id === b.dataset.id)?.name); }); };
    $$('.mcats button', body).forEach(b => b.onclick = () => { cat = b.dataset.c; $$('.mcats button', body).forEach(z => z.classList.toggle('on', z === b)); list(); });
    list();
  }
  function musicSheet() {
    const m = P.music; if (!m) return;
    const body = h(`<div class="col"><div class="lbl">${esc(t('edVolume'))}</div><input type="range" class="rng v" min="0" max="2" step="0.05" value="${m.vol}"><div class="lbl">${esc(t('edFadeIn'))} <b class="fi"></b></div><input type="range" class="rng i" min="0" max="5" step="0.1" value="${m.fadeIn}"><div class="lbl">${esc(t('edFadeOut'))} <b class="fo"></b></div><input type="range" class="rng o" min="0" max="5" step="0.1" value="${m.fadeOut}"></div>`);
    const upd = () => { $('.fi', body).textContent = m.fadeIn.toFixed(1) + 's'; $('.fo', body).textContent = m.fadeOut.toFixed(1) + 's'; };
    sheet({ title: '🎵 ' + t('edMusic'), body, cls: 'edSheet', onClose: () => commit() }); upd();
    $('.v', body).oninput = e => { m.vol = +e.target.value; syncAudio(); }; $('.i', body).oninput = e => { m.fadeIn = +e.target.value; upd(); }; $('.o', body).oninput = e => { m.fadeOut = +e.target.value; upd(); };
  }
  function capStyleSheet() {
    const cs = P.capStyle;
    const body = h(`<div class="col"><div class="lbl">${esc(t('edFont'))}</div><div class="chipRow fonts">${Object.entries(FONTS).map(([k, f]) => `<button class="chip2 ${cs.font === k ? 'on' : ''}" data-v="${k}" style="font-family:${f}">Aa</button>`).join('')}</div>
      <div class="lbl">${esc(t('edColor'))}</div><div class="chipRow cols">${COLORS.map(c => `<button class="sw ${cs.color === c ? 'on' : ''}" data-v="${c}" style="background:${c}"></button>`).join('')}</div>
      <div class="lbl">${esc(t('edHighlight'))}</div><div class="chipRow hls">${COLORS.map(c => `<button class="sw ${cs.hl === c ? 'on' : ''}" data-v="${c}" style="background:${c}"></button>`).join('')}</div>
      <button class="chip2 bgT ${cs.bg ? 'on' : ''}">▣ ${esc(t('edBg'))}</button><div class="lbl">${esc(t('edPosition'))}</div><input type="range" class="rng y" min="0.1" max="0.92" step="0.01" value="${cs.y}"></div>`);
    sheet({ title: t('edStyle'), body, cls: 'edSheet', onClose: () => commit() });
    const grp = (s, k) => $$(s + ' button', body).forEach(b => b.onclick = () => { cs[k] = b.dataset.v; $$(s + ' button', body).forEach(z => z.classList.toggle('on', z === b)); renderOverlay(); });
    grp('.fonts', 'font'); grp('.cols', 'color'); grp('.hls', 'hl');
    $('.bgT', body).onclick = e => { cs.bg = !cs.bg; e.currentTarget.classList.toggle('on', cs.bg); renderOverlay(); };
    $('.y', body).oninput = e => { cs.y = +e.target.value; renderOverlay(); };
  }
  // words → timed caption chunks
  function autoCaps(text, start, dur) {
    const words = String(text).split(/\s+/).filter(Boolean); if (!words.length) return [];
    const chunks = []; for (let i = 0; i < words.length; i += 4) chunks.push(words.slice(i, i + 4).join(' '));
    const per = dur / words.length; let a = start; return chunks.map(c => { const n = c.split(' ').length; const o = { text: c, start: +a.toFixed(2), end: +(a + per * n).toFixed(2) }; a += per * n; return o; });
  }
  function captionsSheet() {
    const hasVoice = P.voices.some(v => v.text);
    const body = h(`<div class="col"><p class="mut sm" style="margin:0">${esc(t('capsHint'))}</p>
      ${hasVoice ? `<button class="btn pri fromVoice">🎙️ ${esc(t('capsFromVoice'))}</button>` : ''}
      <textarea class="field scr" rows="4" maxlength="1500" placeholder="${esc(t('capsScript'))}"></textarea><button class="btn ${hasVoice ? '' : 'pri'} fromScript">⚡ ${esc(t('capsAutoTime'))}</button>
      <button class="btn ghost styl">🎨 ${esc(t('edStyle'))}</button></div>`);
    const sh = sheet({ title: '💬 ' + t('edCaptions'), body, cls: 'edSheet' });
    const fv = $('.fromVoice', body); if (fv) fv.onclick = () => { P.captions = P.voices.filter(v => v.text).flatMap(v => v.segs?.length ? v.segs.map(s => ({ text: s.text, start: +(v.start + s.start).toFixed(2), end: +(v.start + s.end).toFixed(2) })).flatMap(s => autoCaps(s.text, s.start, s.end - s.start)) : autoCaps(v.text, v.start, media.get(v.lid)?.dur || 2)); sh.close(); commit(); toast('💬 ' + P.captions.length); };
    $('.fromScript', body).onclick = () => { const s = $('.scr', body).value.trim(); if (!s) return; const tot = total() || 5; P.captions = autoCaps(s, 0.2, Math.max(1, tot - .4)); sh.close(); commit(); toast('💬 ' + P.captions.length); };
    $('.styl', body).onclick = () => { sh.close(); capStyleSheet(); };
  }
  async function recordVoice() {
    let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch { return toast(t('micDenied'), true); }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const body = h(`<div class="col" style="align-items:center"><div class="recBig"><button class="recBtn"><i></i></button></div><div class="tm recT">0:00</div><div class="mut sm live" style="min-height:40px;text-align:center"></div>
      <label class="row sm"><input type="checkbox" class="ac" ${SR ? 'checked' : 'disabled'}> ${esc(t('capsAutoVoice'))}${SR ? '' : ' (—)'}</label><div class="mut xs">${esc(t('recHint'))}</div></div>`);
    let rec = null, chunks = [], t0 = 0, iv, recog = null, segs = [], lastEnd = 0, interim = '';
    const sh = sheet({ title: '🎙️ ' + t('edVoice'), body, cls: 'edSheet', onClose: () => { try { rec && rec.state !== 'inactive' && rec.stop(); } catch {} try { recog && recog.stop(); } catch {} stream.getTracks().forEach(x => x.stop()); pause(); } });
    $('.recBtn', body).onclick = () => {
      if (rec) { rec.stop(); return; }
      const mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'].find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
      rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); chunks = []; segs = []; lastEnd = 0;
      rec.ondataavailable = e => e.data.size && chunks.push(e.data);
      const at = T;
      rec.onstop = async () => {
        clearInterval(iv); try { recog && recog.stop(); } catch {}
        const blob = new Blob(chunks, { type: (rec.mimeType || mime || 'audio/webm').split(';')[0] }); rec = null; $('.recBtn', body).classList.remove('on');
        const f = new File([blob], `voice-${Date.now()}.${blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'}`, { type: blob.type });
        const [m] = await addMedia([f], 'none'); const text = segs.map(s => s.text).join(' ').trim();
        P.voices.push({ lid: m.lid, start: at, vol: 1, text, segs });
        if ($('.ac', body).checked && segs.length) P.captions.push(...segs.flatMap(s => autoCaps(s.text, at + s.start, Math.max(.4, s.end - s.start))));
        sh.close(); commit(); toast('🎙️ ✓' + (segs.length ? ' · 💬' : ''));
      };
      rec.start(250); t0 = Date.now(); $('.recBtn', body).classList.add('on'); haptic(15);
      if (P.clips.length) { play(); }
      iv = setInterval(() => { const s = (Date.now() - t0) / 1000; $('.recT', body).textContent = `${s / 60 | 0}:${String(s % 60 | 0).padStart(2, '0')}`; if (s > 120) rec && rec.stop(); }, 200);
      if (SR && $('.ac', body).checked) {
        try {
          recog = new SR(); recog.lang = ({ en: 'en-US', ru: 'ru-RU', uk: 'uk-UA', es: 'es-ES', pt: 'pt-BR', de: 'de-DE', fr: 'fr-FR', tr: 'tr-TR', ar: 'ar-SA', hi: 'hi-IN', id: 'id-ID' })[lang()] || 'en-US';
          recog.continuous = true; recog.interimResults = true;
          recog.onresult = e => { interim = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) { const now = (Date.now() - t0) / 1000; const txt = r[0].transcript.trim(); if (txt) { const st = Math.max(lastEnd, now - Math.max(0.8, txt.split(/\s+/).length * 0.38)); segs.push({ text: txt, start: +st.toFixed(2), end: +now.toFixed(2) }); lastEnd = now; } } else interim += r[0].transcript; } $('.live', body).textContent = (segs.map(s => s.text).join(' ') + ' ' + interim).slice(-140); };
          recog.onerror = () => {}; recog.onend = () => { if (rec) try { recog.start(); } catch {} };
          recog.start();
        } catch {}
      }
    };
  }
  function ttsSheet() {
    const voices = [['nova', '👩'], ['max', '👨'], ['kid', '🧒'], ['deep', '🧔'], ['robot', '🤖'], ['whisper', '🤫'], ['hype', '📣']];
    const L = [['en', 'English'], ['es', 'Español'], ['pt', 'Português'], ['de', 'Deutsch'], ['fr', 'Français'], ['tr', 'Türkçe'], ['ru', 'Русский'], ['uk', 'Українська'], ['ar', 'العربية'], ['hi', 'हिन्दी'], ['id', 'Indonesia']];
    let voice = 'nova', lg = lang(), last = null;
    const body = h(`<div class="col"><textarea class="field tx" rows="3" maxlength="500" placeholder="${esc(t('ttsPh'))}"></textarea>
      <div class="lbl">${esc(t('ttsVoice'))}</div><div class="chipRow vs">${voices.map(([k, e]) => `<button class="chip2 ${k === voice ? 'on' : ''}" data-v="${k}">${e} ${esc(t('v_' + k))}</button>`).join('')}</div>
      <div class="lbl">${esc(t('language'))}</div><select class="field lg">${L.map(([k, n]) => `<option value="${k}" ${k === lg ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <label class="row sm"><input type="checkbox" class="ac" checked> ${esc(t('capsAutoVoice'))}</label>
      <div class="row"><button class="btn prevB" style="flex:1">▶ ${esc(t('ttsPreview'))}</button><button class="btn pri addB" style="flex:2">➕ ${esc(t('edAdd'))}</button></div><div class="mut xs">${esc(t('ttsFree'))}</div></div>`);
    const sh = sheet({ title: '🗣️ ' + t('edTts'), body, cls: 'edSheet' });
    $$('.vs button', body).forEach(b => b.onclick = () => { voice = b.dataset.v; last = null; $$('.vs button', body).forEach(z => z.classList.toggle('on', z === b)); });
    $('.lg', body).onchange = e => { lg = e.target.value; last = null; };
    $('.tx', body).oninput = () => { last = null; };
    const gen = async () => { const text = $('.tx', body).value.trim(); if (!text) throw Object.assign(new Error('empty'), { code: 'empty' }); if (last && last.text === text) return last; const r = await api('/api/tts', { body: { text, voice, lang: lg } }); const blob = await (await fetch(abs(r.url), { headers: { Authorization: 'Bearer ' + S.tok } })).blob(); last = { ...r, blob, text }; return last; };
    const prevA = new Audio();
    $('.prevB', body).onclick = async e => { const b = e.currentTarget; b.disabled = true; try { const r = await gen(); prevA.src = URL.createObjectURL(r.blob); prevA.play().catch(() => {}); } catch (er) { fail(er); } b.disabled = false; };
    $('.addB', body).onclick = async e => {
      const b = e.currentTarget; b.disabled = true;
      try { const r = await gen(); const f = new File([r.blob], `tts-${Date.now()}.aac`, { type: 'audio/aac' }); const [m] = await addMedia([f], 'none'); m.dur = r.duration || m.dur; m.up = r.id; m.upAt = Date.now();
        P.voices.push({ lid: m.lid, start: T, vol: 1, text: r.text, tts: true });
        if ($('.ac', body).checked) P.captions.push(...autoCaps(r.text, T, m.dur));
        prevA.pause(); sh.close(); commit(); toast('🗣️ ✓');
      } catch (er) { fail(er); b.disabled = false; }
    };
  }

  // ---------- export ----------
  async function exportVideo() {
    if (!P.clips.length) return toast(t('edAddMedia'), true);
    pause(); await saveDraft();
    const body = h(`<div class="col" style="align-items:center;text-align:center"><div class="spin"></div><div class="st mut sm">${esc(t('edUploading'))}</div><div class="bar" style="width:100%"><i style="width:0"></i></div><div class="mut xs">${esc(t('edFreeExport'))}</div></div>`);
    const sh = sheet({ title: '🎬 ' + t('edExport'), body, cls: 'edSheet' });
    try {
      const used = [...new Set([...P.clips.map(c => c.lid), ...P.voices.map(v => v.lid), ...(P.pip ? [P.pip.lid] : [])])];
      let n = 0;
      for (const lid of used) {
        const m = media.get(lid);
        if (!m.up || Date.now() - (m.upAt || 0) > 2 * 3600e3) {
          const f = m.blob instanceof File ? m.blob : new File([m.blob], m.name || 'media', { type: m.blob.type });
          const r = await upload(f, p => { $('.bar i', body).style.width = ((n + p) / used.length * 100) + '%'; }); m.up = r.id; m.upAt = Date.now(); if (r.duration && m.kind !== 'image') m.dur = r.duration;
        }
        n++; $('.bar i', body).style.width = (n / used.length * 100) + '%';
      }
      const up = lid => media.get(lid).up;
      const proj = { ...P, clips: P.clips.map(c => ({ ...c, up: up(c.lid) })), voices: P.voices.map(v => ({ up: up(v.lid), start: v.start, vol: v.vol })), pip: P.pip ? { ...P.pip, up: up(P.pip.lid) } : null };
      const r = await api('/api/edit', { body: { project: proj } });
      sh.close();
      const { progress, showResult } = await import('./create.js');
      const m = await progress(r.job); showResult(m);
    } catch (e) { sh.close(); fail(e); }
  }

  // ---------- wire up ----------
  const close = () => { if (closed) return; closed = true; pause(); saveDraft(); el.classList.remove('on'); setTimeout(() => el.remove(), 300); window.removeEventListener('resize', draw); };
  $('.x', el).onclick = close; $('.undo', el).onclick = undo; $('.redo', el).onclick = redo; $('.exp', el).onclick = exportVideo;
  $('.asp', el).onclick = () => act('aspect');
  window.addEventListener('resize', draw);
  let pinch = null;
  tl.addEventListener('touchstart', e => { if (e.touches.length === 2) pinch = { d: Math.abs(e.touches[0].clientX - e.touches[1].clientX), p: pps }; }, { passive: true });
  tl.addEventListener('touchmove', e => { if (pinch && e.touches.length === 2) { pps = Math.max(12, Math.min(160, pinch.p * Math.abs(e.touches[0].clientX - e.touches[1].clientX) / Math.max(1, pinch.d))); drawTimeline(); } }, { passive: true });
  tl.addEventListener('touchend', () => { pinch = null; });
  if (opt.files?.length) { const b = toastBusy(); await addMedia(opt.files); b(); hist[0] = JSON.stringify(P); commit(false); }
  requestAnimationFrame(draw);
  return { close, get project() { return P; } };
}

function chooseDraft(ds) {
  return new Promise(res => {
    let done = false;
    const body = h(`<div class="col"><button class="btn pri new">➕ ${esc(t('edNewProject'))}</button><div class="lbl">${esc(t('edDrafts'))}</div><div class="draftGrid">${ds.slice(0, 12).map(d => `<div class="draft" data-id="${d.id}"><div class="th" style="background-image:url('${d.thumb || ''}')"></div><div class="mut xs">${new Date(d.updated).toLocaleString()} · ${fmtT(d.dur || 0)}</div><button class="iconBtn del" data-id="${d.id}">🗑️</button></div>`).join('')}</div></div>`);
    const sh = sheet({ title: '✂️ ' + t('edTitle'), body, cls: 'edSheet', onClose: () => { if (!done) res(null); } });
    $('.new', body).onclick = () => { done = true; sh.close(); res(undefined); };
    $$('.draft', body).forEach(n => n.onclick = e => { if (e.target.closest('.del')) return; done = true; sh.close(); res(n.dataset.id); });
    $$('.del', body).forEach(b => b.onclick = async () => { await idbDel('drafts', b.dataset.id); b.closest('.draft').remove(); });
  });
}
