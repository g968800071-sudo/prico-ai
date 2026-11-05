// PRICO Photo Studio (Remini/Lensa-style): HD Enhance with before/after, "You anywhere" background swap
// (on-device person cut-out → server composite), greeting Cards with your photo + text, and AI Avatars (templates).
import { t } from './i18n.js';
import { S, api, h, esc, toast, fail, haptic, download, abs, sheet, $, $$ } from './core.js';
import { needAuth, go } from './app.js';

let meta = null;
const pick = () => new Promise(r => { const inp = h('<input type="file" accept="image/*" style="display:none">'); document.body.append(inp); inp.onchange = () => { r(inp.files[0] || null); inp.remove(); }; inp.click(); });
async function toCanvas(file, max = 1600) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(async () => { const im = new Image(); im.src = URL.createObjectURL(file); await im.decode(); return im; });
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); return c;
}
const dataUrl = (c, type = 'image/jpeg', q = 0.92) => c.toDataURL(type, q);
const blobUrl = b => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
async function cutOf(canvas) { const seg = await import('./seg.js'); const b = await seg.cutout(canvas); return b ? blobUrl(b) : null; }

export async function openStudio(tab = 'enhance') {
  await needAuth();
  meta ||= await api('/api/studio').catch(() => ({ scenes: [], cards: [], enhance: 'free' }));
  const tabs = [['enhance', '✨', 'stEnhance'], ['anywhere', '🌍', 'stAnywhere'], ['cards', '💌', 'stCards'], ['avatars', '🧑‍🎨', 'stAvatars']];
  const body = h(`<div class="studio"><div class="seg stTabs">${tabs.map(([k, e, n]) => `<button data-k="${k}">${e} ${esc(t(n))}</button>`).join('')}</div><div class="stBody"></div></div>`);
  const foot = h(`<div class="row stFoot" style="display:none"><button class="btn save" style="flex:1">⬇ ${esc(t('save'))}</button><button class="btn pri post" style="flex:2">${esc(t('next'))} →</button></div>`);
  const sh = sheet({ title: '📷 ' + t('stTitle'), body, foot, full: true });
  const B = $('.stBody', body);
  let result = null; // { media }
  const setResult = m => { result = m; foot.style.display = m ? '' : 'none'; };
  $('.save', foot).onclick = async () => { if (!result) return; const r = await fetch(abs(result.url)); download(new File([await r.blob()], `prico-studio-${Date.now()}.jpg`, { type: 'image/jpeg' })); };
  $('.post', foot).onclick = async () => { if (!result) return; sh.close(); const { showResult } = await import('./create.js'); showResult(result); };
  const run = async (payload, stage) => {
    stage.innerHTML = `<div class="stWork"><div class="spin"></div><div class="mut sm">${esc(t('stWorking'))}</div></div>`;
    const r = await api('/api/studio', { body: payload }); haptic(12); setResult(r.media); return r.media;
  };
  const picker = (hint) => `<button class="stPick"><b>🖼️</b><div>${esc(t('stPick'))}</div><div class="mut xs">${esc(hint)}</div></button>`;

  const views = {
    async enhance() {
      B.innerHTML = `<div class="stHint">${esc(t('stEnhanceD'))} <span class="badge ${meta.enhance === 'ai' ? 'hot' : 'new'}">${meta.enhance === 'ai' ? 'AI' : t('free')}</span></div><div class="stStage">${picker(t('stEnhanceHint'))}</div>`;
      const st = $('.stStage', B);
      $('.stPick', B).onclick = async () => {
        const f = await pick(); if (!f) return; let c; try { c = await toCanvas(f, 1600); } catch { return toast(t('e_bad_image')); }
        const before = dataUrl(c);
        try {
          const m = await run({ op: 'enhance', img: before }, st);
          st.innerHTML = `<div class="cmp"><img class="aft" src="${abs(m.url)}" alt=""><div class="bef"><img src="${before}" alt=""></div><div class="bar"></div><span class="tg l">${esc(t('stBefore'))}</span><span class="tg r">${esc(t('stAfter'))}</span><input type="range" min="0" max="100" value="50" aria-label="${esc(t('stBefore'))}"></div><button class="btn sm again">↺ ${esc(t('stAnother'))}</button>`;
          const cmp = $('.cmp', st), rg = $('input', cmp);
          const upd = () => { cmp.style.setProperty('--x', rg.value + '%'); }; rg.oninput = upd; upd();
          $('.again', st).onclick = () => { setResult(null); views.enhance(); };
        } catch (e) { fail(e); views.enhance(); }
      };
    },
    async anywhere() {
      B.innerHTML = `<div class="stHint">${esc(t('stAnywhereD'))}</div><div class="stStage">${picker(t('stPersonHint'))}</div>`;
      const st = $('.stStage', B);
      $('.stPick', B).onclick = async () => {
        const f = await pick(); if (!f) return; const c = await toCanvas(f, 1280).catch(() => null); if (!c) return toast(t('e_bad_image'));
        st.innerHTML = `<div class="stWork"><div class="spin"></div><div class="mut sm">${esc(t('stCutting'))}</div></div>`;
        let cut = null; try { cut = await cutOf(c); } catch (e) { console.warn(e); }
        if (!cut) { toast(t('e_no_face')); return views.anywhere(); }
        st.innerHTML = `<div class="stRes"></div><div class="lbl">${esc(t('stPickPlace'))}</div><div class="scGrid">${meta.scenes.map(s => `<button data-s="${s}"><img loading="lazy" src="${abs('/api/studio/bg/' + s + '.jpg')}" alt=""><span>${esc(t('sc_' + s))}</span></button>`).join('')}</div>`;
        const res = $('.stRes', st);
        res.innerHTML = `<img class="cutPrev" src="${cut}" alt="">`;
        $$('.scGrid button', st).forEach(b => b.onclick = async () => {
          $$('.scGrid button', st).forEach(x => x.classList.toggle('on', x === b));
          try { const m = await run({ op: 'bg', cut, scene: b.dataset.s }, res); res.innerHTML = `<img class="stOut" src="${abs(m.url)}" alt="">`; } catch (e) { fail(e); }
        });
      };
    },
    async cards() {
      const kinds = meta.cards;
      B.innerHTML = `<div class="stHint">${esc(t('stCardsD'))}</div><div class="scGrid cards">${kinds.map((k, i) => `<button data-s="${k}" class="${i ? '' : 'on'}"><img loading="lazy" src="${abs('/api/studio/bg/' + k + '.jpg')}" alt=""><span>${esc(t('cd_' + k))}</span></button>`).join('')}</div>
        <input class="inp cTxt" maxlength="60" placeholder="${esc(t('stCardPh'))}" value="${esc(t('cdt_' + kinds[0]))}"><div class="row" style="gap:8px;margin-top:10px">${S.me?.faces?.length ? `<button class="btn useFace" style="flex:1">🙂 ${esc(t('stUseFace'))}</button>` : ''}<button class="btn pri usePhoto" style="flex:1">🖼️ ${esc(t('stPick'))}</button></div><div class="stStage" style="margin-top:12px"></div>`;
      let kind = kinds[0]; const txt = $('.cTxt', B), st = $('.stStage', B);
      $$('.scGrid button', B).forEach(b => b.onclick = () => { $$('.scGrid button', B).forEach(x => x.classList.toggle('on', x === b)); const old = t('cdt_' + kind); kind = b.dataset.s; if (!txt.value || txt.value === old) txt.value = t('cdt_' + kind); });
      const make = async (cut, img) => { try { const m = await run({ op: 'card', kind, text: txt.value.trim(), cut, img }, st); st.innerHTML = `<img class="stOut" src="${abs(m.url)}" alt="">`; } catch (e) { fail(e); st.innerHTML = ''; } };
      $('.usePhoto', B).onclick = async () => { const f = await pick(); if (!f) return; const c = await toCanvas(f, 1280).catch(() => null); if (!c) return toast(t('e_bad_image')); st.innerHTML = `<div class="stWork"><div class="spin"></div></div>`; let cut = null; try { cut = await cutOf(c); } catch {} make(cut, dataUrl(c)); };
      const uf = $('.useFace', B); if (uf) uf.onclick = async () => {
        const f = S.me.faces[0]; const get = async u => u ? blobUrl(await (await fetch(abs(u), { headers: S.tok ? { Authorization: 'Bearer ' + S.tok } : {} })).blob()) : null;
        st.innerHTML = `<div class="stWork"><div class="spin"></div></div>`;
        try { const u = await get(f.url); make(f.cut ? u : null, u); } catch (e) { fail(e); }
      };
    },
    async avatars() {
      sh.close(); const c = await import('./create.js'); c.showGroup && c.showGroup('avatar'); go('create');
    },
  };
  const show = k => { $$('.stTabs button', body).forEach(b => b.classList.toggle('on', b.dataset.k === k)); setResult(null); views[k](); };
  $$('.stTabs button', body).forEach(b => b.onclick = () => { haptic(6); show(b.dataset.k); });
  show(tab);
}
