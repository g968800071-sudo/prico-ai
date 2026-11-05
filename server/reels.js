import fss from 'node:fs';
// AI Reels maker — fully local (ffmpeg), no paid AI needed.
// Input: user photos/clips (or just an idea + saved faces) → 9:16 720x1280 MP4 with
// best-moment selection (scene-change energy), beat-synced cuts, niche transitions, Ken Burns on photos,
// blur-fill for horizontal media, subtitle/hook captions, stickers/text overlay, original music, watermark.
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { FFMPEG, ffTune, textPng, watermark, overlayPng, demoPhoto } from './render.js';
import { trackFile, byId as trackById } from './music.js';
import { byId as tplById } from './catalog.js';
import { suggest, NICHES } from './captions.js';

const RW = 720, RH = 1280, FPS = 30;
const TRANS = {
  funny: ['zoomin', 'pixelize', 'squeezeh', 'radial', 'hblur'],
  travel: ['slideleft', 'circleopen', 'smoothleft', 'fadeblack', 'wipeleft'],
  food: ['smoothup', 'circlecrop', 'fade', 'slideup'],
  fitness: ['wipeleft', 'slideup', 'hblur', 'zoomin', 'wiperight'],
  business: ['fade', 'wiperight', 'slideleft', 'smoothleft'],
  birthday: ['circleopen', 'radial', 'fadewhite', 'diagtl', 'zoomin'],
  love: ['fade', 'dissolve', 'circleopen', 'smoothright'],
  vlog: ['smoothleft', 'fade', 'slideright', 'circleopen'],
};
const BEATS = { funny: 2, travel: 4, food: 4, fitness: 2, business: 4, birthday: 4, love: 4, vlog: 4 };
const NICHE_TPLS = { funny: ['p_meme', 'p_muscle', 'p_figure', 'p_baby'], travel: ['p_paris', 'p_beach', 'p_nyc', 'p_moon'], fitness: ['p_muscle', 'p_hero', 'p_meme'], business: ['p_business', 'p_avatar', 'p_nyc'], birthday: ['c_birthday', 'p_doll', 'c_love'], love: ['c_love', 'p_ghibli', 'p_paris'], vlog: ['p_ghibli', 'p_cyber', 'p_beach', 'p_anime'], food: ['p_paris', 'p_beach'] };
const HOOK = { en: { funny: 'Wait for it… 😂', travel: 'Save this for your next trip ✈️', food: 'You NEED to try this 🍕', fitness: 'No excuses 💪', business: 'Here is how we do it 💼', birthday: 'Best day ever 🎂', love: 'Us ❤️', vlog: 'A day in my life ✨' },
  ru: { funny: 'Жди конца… 😂', travel: 'Сохрани для поездки ✈️', food: 'Это надо попробовать 🍕', fitness: 'Без отговорок 💪', business: 'Вот как мы это делаем 💼', birthday: 'Лучший день 🎂', love: 'Мы ❤️', vlog: 'Мой день ✨' },
  uk: { funny: 'Чекай кінця… 😂', travel: 'Збережи для подорожі ✈️', food: 'Це треба спробувати 🍕', fitness: 'Без відмовок 💪', business: 'Ось як ми це робимо 💼', birthday: 'Найкращий день 🎂', love: 'Ми ❤️', vlog: 'Мій день ✨' } };

function run(args, timeoutMs = 300000, wantErr = false) {
  return new Promise((res, rej) => {
    if (process.env.FF_DEBUG) { const a = ffTune(args); fss.appendFileSync(process.env.FF_DEBUG, JSON.stringify(a) + '\n'); const o = a[a.length - 1]; if (o.endsWith('.mp4')) fss.cpSync(path.dirname(o), '/tmp/ffdbg-reel', { recursive: true }); }
    const p = spawn(FFMPEG, ffTune(args), { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = ''; p.stderr.on('data', d => { err += d; if (!wantErr && err.length > 40000) err = err.slice(-20000); });
    const to = setTimeout(() => { p.kill('SIGKILL'); rej(new Error('ffmpeg timeout')); }, timeoutMs);
    p.on('close', c => { clearTimeout(to); (c === 0 || wantErr) ? res(err) : rej(new Error('ffmpeg: ' + err.slice(-900))); });
    p.on('error', e => { clearTimeout(to); rej(e); });
  });
}

export async function probe(file) {
  const e = await run(['-hide_banner', '-i', file], 20000, true);
  const d = /Duration: (\d+):(\d+):([\d.]+)/.exec(e);
  const v = /Stream.*Video:.* (\d{2,5})x(\d{2,5})/.exec(e);
  const rot = /rotation of (-?\d+)|displaymatrix: rotation of (-?[\d.]+)/.exec(e);
  let w = v ? +v[1] : 0, h = v ? +v[2] : 0;
  if (rot && Math.abs(Math.round(+(rot[1] || rot[2]))) % 180 === 90) [w, h] = [h, w];
  return { duration: d ? (+d[1]) * 3600 + (+d[2]) * 60 + (+d[3]) : 0, w, h, audio: /Stream.*Audio/.test(e), video: !!v };
}

// Scene-change energy per 0.25 s; returns non-overlapping best windows.
async function bestWindows(file, dur, len, count) {
  if (dur <= len + 0.3) return [0];
  let scores = [];
  try {
    const e = await run(['-hide_banner', '-t', '90', '-i', file, '-an', '-vf', "fps=4,scale=96:-2,select='gte(scene,0)',metadata=print:key=lavfi.scene_score", '-f', 'null', '-'], 60000, true);
    const re = /pts_time:([\d.]+)[\s\S]*?lavfi\.scene_score=([\d.]+)/g; let m;
    while ((m = re.exec(e))) scores.push([+m[1], +m[2]]);
  } catch {}
  const maxT = Math.min(dur, 90) - len;
  const cand = [];
  for (let s = Math.min(0.3, maxT); s <= maxT; s += 0.25) {
    const inWin = scores.filter(([t]) => t >= s && t < s + len);
    const energy = inWin.reduce((a, [, v]) => a + Math.min(v, 0.5), 0) / Math.max(1, inWin.length);
    const centre = 1 - Math.abs((s + len / 2) / dur - 0.45) * 0.3; // mild bias to the middle
    cand.push([s, energy * centre + 0.0001 * Math.random()]);
  }
  cand.sort((a, b) => b[1] - a[1]);
  const out = [];
  for (const [s] of cand) { if (out.every(o => Math.abs(o - s) >= len)) out.push(s); if (out.length >= count) break; }
  out.sort((a, b) => a - b);
  return out.length ? out : [0];
}

// Photo → 1080x1920 (cover for portrait, blur-fill for landscape/square)
async function prepStill(file, out) {
  const img = sharp(file).rotate();
  const m = await img.metadata();
  const w = (m.orientation >= 5 ? m.height : m.width) || 1, h = (m.orientation >= 5 ? m.width : m.height) || 1;
  if (w / h <= 0.7) { await img.resize(1080, 1920, { fit: 'cover', position: 'attention' }).jpeg({ quality: 90 }).toFile(out); return; }
  const bgb = await sharp(file).rotate().resize(1080, 1920, { fit: 'cover' }).blur(40).modulate({ brightness: 0.7 }).toBuffer();
  const fg = await sharp(file).rotate().resize(1080, 1920, { fit: 'inside' }).toBuffer();
  const fm = await sharp(fg).metadata();
  await sharp(bgb).composite([{ input: fg, left: Math.round((1080 - fm.width) / 2), top: Math.round((1920 - fm.height) / 2) }]).jpeg({ quality: 90 }).toFile(out);
}

const KB = [ // Ken Burns variants (zoompan)
  { z: `'min(1+0.0016*on,1.16)'`, x: `'iw/2-(iw/zoom/2)'`, y: `'ih/2-(ih/zoom/2)'` },
  { z: `'max(1.16-0.0016*on,1)'`, x: `'iw/2-(iw/zoom/2)'`, y: `'ih/2-(ih/zoom/2)'` },
  { z: `'1.12'`, x: `'(iw-iw/zoom)*on/DUR'`, y: `'ih/2-(ih/zoom/2)'` },
  { z: `'min(1+0.0012*on,1.12)'`, x: `'iw/2-(iw/zoom/2)'`, y: `'(ih-ih/zoom)*(1-on/DUR)'` },
];

export async function render(opts) {
  const { items = [], niche: nicheIn = 'funny', idea = '', musicId, lang = 'en', faces = [], overlay, subtitles = true, lines: userLines } = opts;
  const niche = NICHES[nicheIn] ? nicheIn : 'funny';
  const track = trackById(musicId || NICHES[niche].music);
  const beat = 60 / track.bpm;
  let L = beat * (BEATS[niche] || 4); while (L < 1.3) L *= 2; while (L > 3.2) L /= 2;
  const xd = Math.min(0.5, beat / 2);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'reel-'));
  try {
    // 1) source list
    let src = [];
    for (const it of items.slice(0, 12)) src.push({ ...it, info: it.kind === 'video' ? await probe(it.path) : null });
    if (!src.length) {
      if (!faces.length) throw Object.assign(new Error('need_media'), { code: 400 });
      const ids = NICHE_TPLS[niche] || NICHE_TPLS.funny;
      for (let i = 0; i < ids.length; i++) {
        const t = tplById(ids[i]); if (!t) continue;
        const f = path.join(dir, `gen${i}.jpg`);
        await fs.writeFile(f, await demoPhoto({ ...t, title: null }, [faces[i % faces.length]], lang, { raw: true }));
        src.push({ kind: 'image', path: f });
      }
    }
    // 2) plan segments (target ≈ 12–20 s)
    const target = Math.max(src.length, Math.min(12, Math.ceil(14 / L)));
    const vids = src.filter(s => s.kind === 'video');
    const extraPerVid = vids.length ? Math.ceil(Math.max(0, target - src.length) / vids.length) : 0;
    const segs = [];
    let ki = 0;
    for (const s of src) {
      if (s.kind === 'video') {
        const n = 1 + Math.min(extraPerVid, Math.floor(s.info.duration / (L + xd)) - 1);
        const wins = await bestWindows(s.path, s.info.duration, L + xd, Math.max(1, n));
        for (const w of wins) segs.push({ ...s, start: w });
      } else segs.push({ ...s, kb: ki++ });
    }
    while (segs.length < Math.min(target, src.length * 2) && src.every(s => s.kind === 'image')) segs.push({ ...src[segs.length % src.length], kb: ki++ });
    // 3) render normalised segments
    const S = L + xd;
    const frames = Math.round(S * FPS);
    for (let i = 0; i < segs.length; i++) {
      const sg = segs[i], out = path.join(dir, `s${i}.mp4`);
      const enc = ['-an', '-r', String(FPS), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p', '-t', S.toFixed(3), out];
      if (sg.kind === 'image') {
        const still = path.join(dir, `st${i}.jpg`); await prepStill(sg.path, still);
        const k = KB[sg.kb % KB.length];
        const zp = `zoompan=z=${k.z}:x=${k.x.replace('DUR', frames)}:y=${k.y.replace('DUR', frames)}:d=${frames}:s=${RW}x${RH}:fps=${FPS}`;
        await run(['-y', '-loglevel', 'error', '-i', still, '-vf', `${zp},format=yuv420p`, '-frames:v', String(frames), ...enc]);
      } else {
        const wide = sg.info.w / Math.max(1, sg.info.h) > 0.7;
        const vf = wide
          ? `split[a][b];[a]scale=${RW}:${RH}:force_original_aspect_ratio=increase,crop=${RW}:${RH},boxblur=20:2,eq=brightness=-0.08[bg];[b]scale=${RW}:${RH}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,fps=${FPS},tpad=stop_mode=clone:stop_duration=${S.toFixed(2)},setsar=1`
          : `scale=${RW}:${RH}:force_original_aspect_ratio=increase,crop=${RW}:${RH},fps=${FPS},tpad=stop_mode=clone:stop_duration=${S.toFixed(2)},setsar=1`;
        await run(['-y', '-loglevel', 'error', '-ss', sg.start.toFixed(2), '-i', sg.path, '-filter_complex', vf, ...enc]);
      }
    }
    const n = segs.length;
    const total = n * L + xd;
    // 4) captions
    const sug = suggest({ lang, niche, idea });
    const hook = (idea && String(idea).split(/[\n.!?]/)[0].trim().slice(0, 60)) || (HOOK[lang] || HOOK.en)[niche] || sug.captions[2];
    let subs = Array.isArray(userLines) ? userLines.filter(Boolean).map(String) : [];
    if (!subs.length && idea) subs = String(idea).split(/[\n.!?;,]+/).map(s => s.trim()).filter(Boolean).slice(1);
    subs = subs.flatMap(s => { const w = s.split(/\s+/); const o = []; for (let i = 0; i < w.length; i += 6) o.push(w.slice(i, i + 6).join(' ')); return o; }).slice(0, n);
    const pngs = [];
    const hk = await textPng(hook, 54, '#ffffff', 640, true);
    await fs.writeFile(path.join(dir, 'hook.png'), hk.png); pngs.push({ f: 'hook.png', a: 0.15, b: Math.min(total - 0.2, Math.max(2.4, L * 1.5)), y: `H*0.11`, h: hk.h });
    if (subtitles) for (let i = 0; i < subs.length; i++) {
      const t = await textPng(subs[i], 44, i % 2 ? '#ffe14d' : '#ffffff', 620, true);
      await fs.writeFile(path.join(dir, `sub${i}.png`), t.png);
      const a = Math.max(pngs[0].b, (i + 1) * L) + 0.05; const b = Math.min(total, a + L * 1.0);
      if (a < total - 0.3) pngs.push({ f: `sub${i}.png`, a, b, y: `H*0.70` });
    }
    const ovPng = overlay ? await overlayPng(overlay, RW, RH) : null;
    if (ovPng) await fs.writeFile(path.join(dir, 'ov.png'), ovPng);
    await fs.writeFile(path.join(dir, 'wm.png'), (await watermark(1.25)).png);
    // 5) assemble
    const tr = TRANS[niche] || TRANS.funny;
    // Join segments with beat-synced transitions in small groups (≤4 inputs per ffmpeg pass keeps RAM < 250 MB on free hosting).
    let files = [...Array(n).keys()].map(i => ({ f: path.join(dir, `s${i}.mp4`), d: S })), gen = 0, ti = 0;
    const G = +(process.env.REEL_GROUP || 4);
    while (files.length > 1) {
      const next = [];
      for (let g = 0; g < files.length; g += G) {
        const grp = files.slice(g, g + G);
        if (grp.length === 1) { next.push(grp[0]); continue; }
        const o = path.join(dir, `j${gen}_${g}.mp4`), a = ['-y', '-loglevel', 'error'];
        grp.forEach(x => a.push('-i', x.f));
        let f = '', lst = '0:v', off = 0;
        for (let i = 1; i < grp.length; i++) { off += grp[i - 1].d - xd; f += `[${lst}][${i}:v]xfade=transition=${tr[ti++ % tr.length]}:duration=${xd.toFixed(3)}:offset=${off.toFixed(3)}[x${i}];`; lst = `x${i}`; }
        const d = grp.reduce((t, x) => t + x.d, 0) - xd * (grp.length - 1);
        a.push('-filter_complex', f.replace(/;$/, ''), '-map', `[${lst}]`, '-an', '-r', String(FPS), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-pix_fmt', 'yuv420p', o);
        await run(a, 600000); next.push({ f: o, d });
      }
      files = next; gen++;
    }
    const args = ['-y', '-loglevel', 'error', '-i', files[0].f];
    let idx = 1; const pIdx = [];
    for (const p of pngs) { args.push('-i', path.join(dir, p.f)); pIdx.push(idx++); }
    let oIdx = -1; if (ovPng) { args.push('-i', path.join(dir, 'ov.png')); oIdx = idx++; }
    args.push('-i', path.join(dir, 'wm.png')); const wIdx = idx++;
    args.push('-stream_loop', '-1', '-i', await trackFile(track.id)); const aIdx = idx++;
    let fg = '', last = '0:v';
    // beat pulse: tiny zoom punch on every cut
    fg += `[${last}]scale=w='trunc(${RW}*(1+0.035*exp(-9*mod(t,${L.toFixed(4)})))/2)*2':h=-2:eval=frame,crop=${RW}:${RH}[bp];`; last = 'bp';
    pngs.forEach((p, k) => {
      const y = `${p.y}+if(lt(t-${p.a.toFixed(2)},0.18),36*(1-(t-${p.a.toFixed(2)})/0.18),0)`;
      fg += `[${pIdx[k]}:v]format=rgba,fade=t=in:st=${p.a.toFixed(2)}:d=0.15:alpha=1,fade=t=out:st=${Math.max(p.a, p.b - 0.15).toFixed(2)}:d=0.15:alpha=1[t${k}];[${last}][t${k}]overlay=x='(W-w)/2':y='${y}':enable='between(t,${p.a.toFixed(2)},${p.b.toFixed(2)})'[o${k}];`;
      last = `o${k}`;
    });
    if (oIdx >= 0) { fg += `[${last}][${oIdx}:v]overlay=0:0[ov];`; last = 'ov'; }
    fg += `[${last}][${wIdx}:v]overlay=x=W-w-22:y=H-h-26,fade=t=out:st=${(total - 0.45).toFixed(2)}:d=0.45,format=yuv420p[v];`;
    fg += `[${aIdx}:a]atrim=0:${total.toFixed(2)},asetpts=N/SR/TB,afade=t=in:d=0.2,afade=t=out:st=${(total - 1).toFixed(2)}:d=1[a]`;
    // stills: decode once, repeat in-graph (looped image inputs buffer hundreds of MB)
    const NF = Math.ceil(total * FPS) + 2; let pre = '';
    fg = fg.replace(/\[(\d+):v\]/g, (m, k) => { if (+k < 1 || +k >= aIdx) return m; pre += `[${k}:v]loop=loop=${NF - 1}:size=1,setpts=N/${FPS}/TB[L${k}];`; return `[L${k}]`; });
    fg = pre + fg;
    const out = path.join(dir, 'reel.mp4');
    args.push('-filter_complex', fg, '-map', '[v]', '-map', '[a]', '-t', total.toFixed(2), '-r', String(FPS), '-c:v', 'libx264', '-preset', process.env.X264_PRESET || 'veryfast', '-crf', '23',
      '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-threads', '2', out);
    await run(args, 600000);
    await run(['-y', '-loglevel', 'error', '-ss', Math.min(1.2, total / 3).toFixed(2), '-i', out, '-frames:v', '1', '-q:v', '3', path.join(dir, 'poster.jpg')]);
    return { mp4: await fs.readFile(out), poster: await fs.readFile(path.join(dir, 'poster.jpg')), duration: total, segments: n, music: track.id, captions: sug };
  } finally { fs.rm(dir, { recursive: true, force: true }).catch(() => {}); }
}
