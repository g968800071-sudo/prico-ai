// PRICO Editor export — renders a client project (multi-clip timeline) to MP4 with ffmpeg, in low-memory passes:
// 1) normalise every clip (trim, speed, crop/aspect, filter, volume)  2) join with per-cut transitions (≤4 inputs/pass)
// 3) one overlay + audio pass: animated texts, stickers, picture-in-picture, captions, music (volume/fades), voiceovers, watermark.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { textPng, watermark, stickerPng } from './render.js';
import { run, probe } from './reels.js';
import { trackFile } from './music.js';

const FPS = 30;
export const ASPECTS = { '9:16': [720, 1280], '1:1': [720, 720], '4:5': [720, 900], '16:9': [1280, 720] };
export const FILTERS = {
  none: '', vivid: 'eq=saturation=1.45:contrast=1.08', warm: 'colorbalance=rs=0.09:gs=0.02:bs=-0.09,eq=saturation=1.1', cool: 'colorbalance=rs=-0.07:bs=0.1',
  bw: 'hue=s=0,eq=contrast=1.15', vintage: 'curves=preset=vintage', film: 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131,eq=contrast=1.05',
  cyber: 'hue=h=-25:s=1.6,eq=contrast=1.15', fade: 'eq=contrast=0.85:brightness=0.05:saturation=0.75', drama: 'eq=contrast=1.35:saturation=0.85,vignette=PI/4',
  glow: 'eq=brightness=0.06:saturation=1.2,unsharp=5:5:-0.6',
};
export const TRANS = ['none', 'fade', 'dissolve', 'slideleft', 'slideup', 'smoothleft', 'zoomin', 'circleopen', 'wipeleft', 'pixelize', 'radial', 'fadewhite', 'fadeblack', 'hblur'];
export const ANIMS = ['none', 'fade', 'pop', 'slide', 'bounce', 'type'];
const XD = 0.4;
const num = (v, a, b, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };
const atempo = s => { const o = []; let x = s; while (x > 2) { o.push('atempo=2'); x /= 2; } while (x < 0.5) { o.push('atempo=0.5'); x /= 0.5; } o.push(`atempo=${x.toFixed(4)}`); return o.join(','); };

// Validates and clamps an untrusted project. resolve(uploadId) → {kind, path} | null
export function clean(p, resolve, isSafe, stickers, musicIds) {
  if (!p || typeof p !== 'object') throw Object.assign(new Error('bad_project'), { code: 400 });
  const aspect = ASPECTS[p.aspect] ? p.aspect : '9:16';
  const clips = [];
  for (const c of (Array.isArray(p.clips) ? p.clips : []).slice(0, 20)) {
    const up = resolve(c.up); if (!up || up.kind === 'audio') continue;
    const len = up.kind === 'video' ? up.duration || 0 : 30;
    const inn = up.kind === 'video' ? num(c.in, 0, Math.max(0, len - 0.3), 0) : 0;
    const out = up.kind === 'video' ? num(c.out, inn + 0.3, len || inn + 0.3, len || 5) : num(c.out ?? c.dur, 0.5, 30, 3);
    clips.push({ ...up, in: inn, out, speed: num(c.speed, 0.25, 4, 1), filter: FILTERS[c.filter] !== undefined ? c.filter : 'none', trans: TRANS.includes(c.trans) ? c.trans : 'none',
      vol: num(c.vol, 0, 2, 1), flip: !!c.flip, rot: [0, 90, 180, 270].includes(+c.rot) ? +c.rot : 0, zoom: num(c.zoom, 1, 3, 1), kb: c.kb !== false });
  }
  if (!clips.length) throw Object.assign(new Error('need_media'), { code: 400 });
  const durs = clips.map(c => (c.out - c.in) / c.speed);
  const total = durs.reduce((a, d, i) => a + d - (i && clips[i].trans !== 'none' ? XD : 0), 0);
  if (total > 180) throw Object.assign(new Error('too_long'), { code: 400 });
  const txt = s => { const t = String(s || '').slice(0, 140); if (t && !isSafe(t)) throw Object.assign(new Error('unsafe_text'), { code: 422 }); return t; };
  const col = c => /^#[0-9a-f]{6}$/i.test(c || '') ? c : '#ffffff';
  const span = o => { const st = num(o.start, 0, total, 0); return { start: st, end: num(o.end, st + 0.2, total, total) }; };
  const texts = (Array.isArray(p.texts) ? p.texts : []).slice(0, 12).map(t => ({ text: txt(t.text), ...span(t), x: num(t.x, 0, 1, .5), y: num(t.y, 0, 1, .5), size: num(t.size, 16, 140, 56), color: col(t.color),
    font: String(t.font || 'classic').slice(0, 12), anim: ANIMS.includes(t.anim) ? t.anim : 'pop', bg: t.bg ? col(t.bgColor || '#000000') : null, stroke: t.stroke !== false })).filter(t => t.text);
  const sts = (Array.isArray(p.stickers) ? p.stickers : []).slice(0, 12).filter(s => stickers.includes(s.c)).map(s => ({ c: s.c, ...span(s), x: num(s.x, 0, 1, .5), y: num(s.y, 0, 1, .5), s: num(s.s, .05, .7, .2), r: num(s.r, -180, 180, 0) }));
  let pip = null;
  if (p.pip && resolve(p.pip.up)) { const up = resolve(p.pip.up); if (up.kind !== 'audio') pip = { ...up, ...span(p.pip), x: num(p.pip.x, 0, 1, .72), y: num(p.pip.y, 0, 1, .22), w: num(p.pip.w, .15, .8, .36), round: p.pip.round !== false, in: num(p.pip.in, 0, 600, 0) }; }
  const music = p.music && musicIds.includes(p.music.id) ? { id: p.music.id, vol: num(p.music.vol, 0, 2, .7), fadeIn: num(p.music.fadeIn, 0, 10, .5), fadeOut: num(p.music.fadeOut, 0, 10, 1.5), offset: num(p.music.offset, 0, 30, 0) } : null;
  const voices = (Array.isArray(p.voices) ? p.voices : []).slice(0, 12).map(v => ({ src: resolve(v.up), start: num(v.start, 0, total, 0), vol: num(v.vol, 0, 3, 1) })).filter(v => v.src && v.src.kind === 'audio');
  const captions = (Array.isArray(p.captions) ? p.captions : []).slice(0, 80).map(c => ({ text: txt(c.text).slice(0, 90), ...span(c) })).filter(c => c.text);
  const capStyle = { color: col(p.capStyle?.color || '#ffffff'), hl: col(p.capStyle?.hl || '#ffe14d'), font: String(p.capStyle?.font || 'classic').slice(0, 12), y: num(p.capStyle?.y, 0.1, 0.95, 0.74), bg: !!p.capStyle?.bg };
  return { aspect, clips, texts, stickers: sts, pip, music, voices, captions, capStyle, origVol: num(p.origVol, 0, 2, 1), total };
}

function coverVf(info, W, H, c) {
  let pre = '';
  if (c.rot === 90) pre += 'transpose=1,'; else if (c.rot === 270) pre += 'transpose=2,'; else if (c.rot === 180) pre += 'hflip,vflip,';
  if (c.flip) pre += 'hflip,';
  let w = info.w || W, h = info.h || H; if (c.rot % 180) [w, h] = [h, w];
  const zoom = c.zoom > 1 ? `scale=iw*${c.zoom}:ih*${c.zoom},crop=iw/${c.zoom}:ih/${c.zoom},` : '';
  const mismatch = Math.abs(Math.log((w / h) / (W / H))) > 0.25;
  if (!mismatch) return `${pre}${zoom}scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`;
  return `${pre}${zoom}split[a][b];[a]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=20:2,eq=brightness=-0.08[bg];[b]scale=${W}:${H}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1`;
}

export async function render(pr, onProgress = () => {}, opts = {}) {
  const [W, H] = ASPECTS[pr.aspect];
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'edit-'));
  try {
    // 1) normalise clips
    const segs = [];
    for (let i = 0; i < pr.clips.length; i++) {
      const c = pr.clips[i], out = path.join(dir, `c${i}.mp4`);
      const d = (c.out - c.in) / c.speed;
      const flt = FILTERS[c.filter] ? ',' + FILTERS[c.filter] : '';
      const enc = ['-r', String(FPS), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2', '-t', d.toFixed(3), out];
      if (c.kind === 'image') {
        const still = path.join(dir, `st${i}.jpg`);
        await sharp(c.path).rotate().resize(W * 1.5 | 0, H * 1.5 | 0, { fit: 'inside', withoutEnlargement: false }).jpeg({ quality: 90 }).toFile(still);
        const m = await sharp(still).metadata(); const frames = Math.ceil(d * FPS);
        const kb = c.kb ? `,scale=${W * 2}:-2,zoompan=z='min(1+0.0015*on,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS}` : '';
        const base = coverVf({ w: m.width, h: m.height }, W, H, c);
        await run(['-y', '-loglevel', 'error', '-i', still, '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-filter_complex', `[0:v]${base}${kb}${flt},fps=${FPS},tpad=stop_mode=clone:stop_duration=${d.toFixed(2)},format=yuv420p[v]`, '-map', '[v]', '-map', '1:a', '-frames:v', String(frames), ...enc]);
      } else {
        const info = await probe(c.path);
        const vf = `[0:v]${coverVf(info, W, H, c)},setpts=(PTS-STARTPTS)/${c.speed}${flt},fps=${FPS},tpad=stop_mode=clone:stop_duration=1,format=yuv420p[v]`;
        const af = info.audio ? `[0:a]asetpts=PTS-STARTPTS,${atempo(c.speed)},volume=${(c.vol * pr.origVol).toFixed(2)},aresample=44100,apad[a]` : `anullsrc=r=44100:cl=stereo[a]`;
        await run(['-y', '-loglevel', 'error', '-ss', c.in.toFixed(3), '-t', (c.out - c.in).toFixed(3), '-i', c.path, '-filter_complex', `${vf};${af}`, '-map', '[v]', '-map', '[a]', ...enc]);
      }
      segs.push({ f: out, d, tin: i ? c.trans : 'none' });
      onProgress(0.1 + 0.5 * (i + 1) / pr.clips.length);
    }
    // 2) join with transitions (groups of ≤4)
    let files = segs, gen = 0;
    while (files.length > 1) {
      const next = [];
      for (let g = 0; g < files.length; g += 4) {
        const grp = files.slice(g, g + 4);
        if (grp.length === 1) { next.push(grp[0]); continue; }
        const o = path.join(dir, `j${gen}_${g}.mp4`), a = ['-y', '-loglevel', 'error'];
        grp.forEach(x => a.push('-i', x.f));
        let f = '', lv = '0:v', la = '0:a', off = 0, d = grp[0].d;
        for (let i = 1; i < grp.length; i++) {
          const t = grp[i].tin, x = t === 'none' ? 0.04 : Math.min(XD, grp[i - 1].d / 2, grp[i].d / 2);
          off = d - x;
          f += `[${lv}][${i}:v]xfade=transition=${t === 'none' ? 'fade' : t}:duration=${x.toFixed(3)}:offset=${off.toFixed(3)}[v${i}];[${la}][${i}:a]acrossfade=d=${x.toFixed(3)}[a${i}];`;
          lv = `v${i}`; la = `a${i}`; d = off + grp[i].d;
        }
        a.push('-filter_complex', f.replace(/;$/, ''), '-map', `[${lv}]`, '-map', `[${la}]`, '-r', String(FPS), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', o);
        await run(a, 600000); next.push({ f: o, d, tin: grp[0].tin });
      }
      files = next; gen++;
    }
    const total = files[0].d;
    onProgress(0.7);
    // 3) overlays + audio
    const args = ['-y', '-loglevel', 'error', '-i', files[0].f]; let idx = 1;
    const still = []; // {idx, kind, ...}
    for (const [k, t] of pr.texts.entries()) {
      const px = Math.round(t.size * W / 720);
      const png = await textPng(t.text, px, t.color, Math.round(W * 0.9), t.stroke && !t.bg, t.font, t.bg);
      const f = path.join(dir, `t${k}.png`); await fs.writeFile(f, png.png); args.push('-i', f);
      still.push({ idx: idx++, kind: 'text', ...t, w: png.w, h: png.h });
    }
    for (const [k, s] of pr.stickers.entries()) {
      const img = await stickerPng(s.c, Math.round(s.s * W), s.r); if (!img) continue;
      const f = path.join(dir, `k${k}.png`); await fs.writeFile(f, img); args.push('-i', f);
      const m = await sharp(img).metadata(); still.push({ idx: idx++, kind: 'sticker', ...s, anim: 'pop', w: m.width, h: m.height });
    }
    for (const [k, c] of pr.captions.entries()) {
      const px = Math.round(46 * W / 720);
      const png = await textPng(c.text, px, k % 2 ? pr.capStyle.hl : pr.capStyle.color, Math.round(W * 0.86), !pr.capStyle.bg, pr.capStyle.font, pr.capStyle.bg ? '#000000' : null);
      const f = path.join(dir, `cap${k}.png`); await fs.writeFile(f, png.png); args.push('-i', f);
      still.push({ idx: idx++, kind: 'cap', ...c, x: .5, y: pr.capStyle.y, anim: 'pop', w: png.w, h: png.h });
    }
    let pipIdx = -1;
    if (pr.pip) {
      const pw = Math.round(pr.pip.w * W / 2) * 2;
      const pf = path.join(dir, 'pip.mp4'); const pd = Math.max(0.3, pr.pip.end - pr.pip.start);
      const round = pr.pip.round ? `,format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lt(hypot(X-W/2,Y-H/2),min(W,H)/2-2),255,0)'` : '';
      if (pr.pip.kind === 'image') await run(['-y', '-loglevel', 'error', '-loop', '1', '-t', pd.toFixed(2), '-i', pr.pip.path, '-vf', `scale=${pw}:${pw}:force_original_aspect_ratio=increase,crop=${pw}:${pw},fps=${FPS}`, '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', pf]);
      else await run(['-y', '-loglevel', 'error', '-ss', pr.pip.in.toFixed(2), '-t', pd.toFixed(2), '-i', pr.pip.path, '-an', '-vf', `scale=${pw}:${pw}:force_original_aspect_ratio=increase,crop=${pw}:${pw},fps=${FPS},tpad=stop_mode=clone:stop_duration=${pd.toFixed(2)}`, '-t', pd.toFixed(2), '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', pf]);
      args.push('-itsoffset', pr.pip.start.toFixed(2), '-i', pf); pipIdx = idx++;
      pr.pip._w = pw; pr.pip._round = round;
    }
    await fs.writeFile(path.join(dir, 'wm.png'), opts.noWm
      ? await (await import('sharp')).default({ create: { width: 2, height: 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer()
      : (await watermark(W / 720 * 1.15)).png); args.push('-i', path.join(dir, 'wm.png')); const wIdx = idx++;
    let mIdx = -1; if (pr.music) { args.push('-stream_loop', '-1', '-i', await trackFile(pr.music.id)); mIdx = idx++; }
    const vIdx = [];
    for (const v of pr.voices) { args.push('-i', v.src.path); vIdx.push(idx++); }
    // graph
    const NF = Math.ceil(total * FPS) + 2; let fg = '', last = '0:v';
    for (const s of [...still, { idx: wIdx, kind: 'wm' }]) fg += `[${s.idx}:v]loop=loop=${NF - 1}:size=1,setpts=N/${FPS}/TB,format=rgba[L${s.idx}];`;
    still.forEach((s, k) => {
      const a = s.start.toFixed(2), b = s.end.toFixed(2), cx = `${(s.x * W).toFixed(0)}-w/2`, cy = `${(s.y * H).toFixed(0)}-h/2`;
      let src = `[L${s.idx}]`, x = cx, y = cy;
      const fade = `fade=t=in:st=${a}:d=0.2:alpha=1,fade=t=out:st=${Math.max(s.start, s.end - 0.2).toFixed(2)}:d=0.2:alpha=1`;
      if (s.anim === 'fade') { fg += `${src}${fade}[A${k}];`; src = `[A${k}]`; }
      else if (s.anim === 'slide') { fg += `${src}${fade}[A${k}];`; src = `[A${k}]`; x = `${cx}-if(lt(t-${a},0.35),(1-(t-${a})/0.35)*${W},0)`; }
      else if (s.anim === 'bounce') { y = `${cy}-abs(sin((t-${a})*7))*${(H * 0.03).toFixed(0)}*exp(-(t-${a})*1.2)`; }
      else if (s.anim === 'pop') { fg += `${src}fade=t=in:st=${a}:d=0.12:alpha=1[A${k}];`; src = `[A${k}]`; y = `${cy}+${(H * 0.05).toFixed(0)}*exp(-(t-${a})*7)*cos((t-${a})*16)`; }
      else if (s.anim === 'type') { const P = `min(1,max(0,(t-${a})/0.9))`; fg += `${src}pad=w=${s.w * 2}:h=${s.h}:x=${s.w}:y=0:color=0x00000000,crop=w=${s.w}:h=${s.h}:x='${s.w}*${P}':y=0[A${k}];`; src = `[A${k}]`; x = `${(s.x * W - s.w / 2).toFixed(0)}-${s.w}*(1-${P})`; }
      fg += `[${last}]${src}overlay=x='${x}':y='${y}':eval=frame:enable='between(t,${a},${b})'[o${k}];`; last = `o${k}`;
    });
    if (pipIdx >= 0) {
      const p = pr.pip, bw = p._w + 8;
      fg += `[${pipIdx}:v]setpts=PTS${p._round}[pp];[${last}][pp]overlay=x='${(p.x * W - bw / 2).toFixed(0)}+4':y='${(p.y * H - bw / 2).toFixed(0)}+4':enable='between(t,${p.start.toFixed(2)},${p.end.toFixed(2)})':eof_action=pass[op];`; last = 'op';
    }
    fg += `[${last}][L${wIdx}]overlay=x=W-w-20:y=H-h-24,format=yuv420p[v];`;
    const mix = ['[0:a]'];
    if (mIdx >= 0) { const m = pr.music; fg += `[${mIdx}:a]atrim=${m.offset}:${(m.offset + total).toFixed(2)},asetpts=N/SR/TB,volume=${m.vol},afade=t=in:d=${Math.max(0.01, m.fadeIn)},afade=t=out:st=${Math.max(0, total - m.fadeOut).toFixed(2)}:d=${Math.max(0.01, m.fadeOut)},aresample=44100,aformat=channel_layouts=stereo[mu];`; mix.push('[mu]'); }
    pr.voices.forEach((v, k) => { const ms = Math.round(v.start * 1000); fg += `[${vIdx[k]}:a]aresample=44100,aformat=channel_layouts=stereo,volume=${v.vol},adelay=${ms}|${ms}[vo${k}];`; mix.push(`[vo${k}]`); });
    fg += mix.length > 1 ? `${mix.join('')}amix=inputs=${mix.length}:duration=first:normalize=0,alimiter=limit=0.95[a]` : `[0:a]anull[a]`;
    const out = path.join(dir, 'out.mp4');
    args.push('-filter_complex', fg, '-map', '[v]', '-map', '[a]', '-t', total.toFixed(2), '-r', String(FPS), '-c:v', 'libx264', '-preset', process.env.X264_PRESET || 'veryfast', '-crf', '22',
      '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-threads', '2', out);
    await run(args, 900000);
    onProgress(0.95);
    await run(['-y', '-loglevel', 'error', '-ss', Math.min(1, total / 3).toFixed(2), '-i', out, '-frames:v', '1', '-q:v', '3', path.join(dir, 'poster.jpg')]);
    return { mp4: await fs.readFile(out), poster: await fs.readFile(path.join(dir, 'poster.jpg')), duration: total };
  } finally { fs.rm(dir, { recursive: true, force: true }).catch(() => {}); }
}
