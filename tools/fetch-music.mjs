// Replace synth placeholders with Mixkit royalty-free tracks (Mixkit Stock Music Free License —
// commercial social/video OK; attribution not required). Trimmed to ~32s with loudnorm + fades.
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import ffmpegStatic from 'ffmpeg-static';
const FFMPEG = process.env.FFMPEG_PATH || ffmpegStatic || 'ffmpeg';
const OUT = path.resolve('assets/music');
const META = path.resolve('assets/music/SOURCES.json');
const LEN = 32;

// Keep our existing track IDs stable (templates/reels reference them). Map each to a Mixkit asset.
const MAP = [
  { id: 'pop', mix: 5, name: 'Feeling Happy', bpm: 118, mood: 'happy' },
  { id: 'disco', mix: 3, name: 'Dance With Me', bpm: 124, mood: 'dance' },
  { id: 'funk', mix: 623, name: 'Deep Urban', bpm: 98, mood: 'cool' },
  { id: 'summer', mix: 91, name: "Summer's Here", bpm: 104, mood: 'travel' },
  { id: 'epic', mix: 32, name: 'Driving Ambition', bpm: 90, mood: 'epic' },
  { id: 'drama', mix: 614, name: 'Silent Descent', bpm: 80, mood: 'funny' },
  { id: 'toon', mix: 1063, name: 'Fun at the Farm', bpm: 140, mood: 'funny' },
  { id: 'love', mix: 493, name: 'Soft Heartbeats', bpm: 76, mood: 'love' },
  { id: 'lofi', mix: 23, name: 'Lo-fi Dreams', bpm: 82, mood: 'chill' },
  { id: 'piano', mix: 443, name: 'Serene View', bpm: 70, mood: 'nostalgia' },
  { id: 'birthday', mix: 839, name: 'Tears of Joy', bpm: 112, mood: 'party' },
  { id: 'jingle', mix: 801, name: 'Happy Home', bpm: 128, mood: 'holiday' },
  { id: 'stadium', mix: 644, name: 'Game Day', bpm: 128, mood: 'sport' },
  { id: 'trap', mix: 738, name: 'Hip Hop 02', bpm: 140, mood: 'fitness' },
  { id: 'corporate', mix: 250, name: 'Bright Start', bpm: 110, mood: 'business' },
  { id: 'food', mix: 1076, name: 'Smile', bpm: 96, mood: 'food' },
  { id: 'house', mix: 130, name: 'Tech House Vibes', bpm: 122, mood: 'dance' },
  { id: 'phonk', mix: 51, name: 'Night Run', bpm: 132, mood: 'hype' },
  { id: 'kpop', mix: 646, name: 'Neon Pulse', bpm: 126, mood: 'dance' },
  { id: 'afro', mix: 580, name: 'Sun and His Daughter', bpm: 108, mood: 'world' },
  { id: 'latin', mix: 219, name: 'Latin Heat', bpm: 96, mood: 'dance' },
  { id: 'bolly', mix: 21, name: 'Festival Spark', bpm: 116, mood: 'world' },
  { id: 'arab', mix: 87, name: 'Desert Groove', bpm: 100, mood: 'world' },
  { id: 'synth', mix: 132, name: 'Hazy After Hours', bpm: 100, mood: 'cool' },
  { id: 'chillhop', mix: 522, name: 'Rainy Window', bpm: 78, mood: 'chill' },
  { id: 'ambient', mix: 135, name: 'Cloud Drift', bpm: 64, mood: 'chill' },
  { id: 'cinema', mix: 871, name: 'Hero Rising', bpm: 86, mood: 'epic' },
  { id: 'suspense', mix: 671, name: 'Plot Twist', bpm: 72, mood: 'funny' },
  { id: 'meme', mix: 532, name: 'A Happy Child', bpm: 150, mood: 'funny' },
  { id: 'chip', mix: 12, name: 'Pixel Party', bpm: 144, mood: 'funny' },
  { id: 'wedding', mix: 601, name: 'Forever Yours', bpm: 72, mood: 'love' },
  { id: 'rnb', mix: 659, name: 'Velvet Mood', bpm: 88, mood: 'love' },
  { id: 'halloween', mix: 184, name: 'Spooky Night', bpm: 110, mood: 'holiday' },
  { id: 'diwali', mix: 16, name: 'Festival of Lights', bpm: 112, mood: 'holiday' },
  { id: 'xmaspop', mix: 39, name: 'Cozy Christmas', bpm: 100, mood: 'holiday' },
  { id: 'runway', mix: 371, name: 'Cat Walk', bpm: 124, mood: 'cool' },
  { id: 'motiv', mix: 989, name: 'Rise & Grind', bpm: 120, mood: 'sport' },
  { id: 'acoustic', mix: 766, name: 'Road Trip', bpm: 104, mood: 'travel' },
  { id: 'jazz', mix: 765, name: 'Cafe Jazz', bpm: 92, mood: 'chill' },
  { id: 'brainrot', mix: 126, name: 'Brainrot Bounce', bpm: 160, mood: 'funny' },
  // extras beyond the original 40 for variety
  { id: 'travel', mix: 763, name: 'Open Roads', bpm: 102, mood: 'travel' },
  { id: 'sport', mix: 1068, name: 'Final Whistle', bpm: 130, mood: 'sport' },
  { id: 'hype', mix: 706, name: 'Crowd Surge', bpm: 138, mood: 'hype' },
  { id: 'chill', mix: 764, name: 'Soft Waves', bpm: 74, mood: 'chill' },
  { id: 'party', mix: 872, name: 'Weekend Glow', bpm: 120, mood: 'party' },
];

function run(args) {
  return new Promise((res, rej) => {
    const p = spawn(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let e = ''; p.stderr.on('data', d => e += d);
    p.on('close', c => c ? rej(new Error(e.slice(-400))) : res());
  });
}

async function fetchOne(t) {
  const url = `https://assets.mixkit.co/music/${t.mix}/${t.mix}.mp3`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://mixkit.co/' } });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${t.id} (${t.mix})`);
  const cd = r.headers.get('content-disposition') || '';
  const fn = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(cd)?.[1];
  if (fn) {
    const pretty = decodeURIComponent(fn).replace(/^mixkit-/, '').replace(new RegExp(`-${t.mix}\\.mp3$`), '').replace(/-/g, ' ');
    if (pretty && pretty.length > 2) t.name = pretty.replace(/\b\w/g, c => c.toUpperCase());
  }
  const buf = Buffer.from(await r.arrayBuffer());
  const raw = path.join('/tmp/mx', t.id + '.mp3');
  await fs.writeFile(raw, buf);
  const out = path.join(OUT, t.id + '.m4a');
  const tmp = out + '.tmp.m4a';
  // start a few seconds in when track has a long intro; fade in/out; loudnorm for consistent preview levels
  await run(['-y', '-loglevel', 'error', '-ss', '4', '-t', String(LEN), '-i', raw,
    '-af', `afade=t=in:d=0.6,afade=t=out:st=${LEN - 1.2}:d=1.2,loudnorm=I=-14:TP=-1.5:LRA=11,aformat=sample_rates=44100:channel_layouts=stereo`,
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', tmp]);
  await fs.rename(tmp, out);
  const st = await fs.stat(out);
  console.log('OK', t.id.padEnd(12), t.name.padEnd(28), (st.size / 1024 | 0) + 'KB', 'mix=' + t.mix);
  return { ...t, bytes: st.size, source: url, license: 'Mixkit Stock Music Free License', page: `https://mixkit.co/free-stock-music/download/${t.mix}/` };
}

await fs.mkdir(OUT, { recursive: true });
await fs.mkdir('/tmp/mx', { recursive: true });
const sources = [];
const fail = [];
for (const t of MAP) {
  try { sources.push(await fetchOne(t)); }
  catch (e) { console.error('FAIL', t.id, e.message); fail.push(t); }
}
// retry fails with alternates from catalog if any
if (fail.length) {
  const cat = JSON.parse(await fs.readFile('/tmp/mx/catalog.json', 'utf8').catch(() => '[]'));
  const used = new Set(sources.map(s => s.mix));
  for (const t of fail) {
    const alt = cat.find(x => x.cat === (t.mood === 'party' ? 'funny' : t.mood === 'travel' ? 'chill' : t.mood === 'sport' || t.mood === 'fitness' ? 'hype' : t.mood === 'business' || t.mood === 'nostalgia' || t.mood === 'food' ? 'chill' : t.mood === 'holiday' ? 'love' : t.mood) && !used.has(+x.mixId));
    if (!alt) { console.error('NO ALT', t.id); continue; }
    t.mix = +alt.mixId;
    try { sources.push(await fetchOne(t)); used.add(t.mix); }
    catch (e) { console.error('FAIL2', t.id, e.message); }
  }
}
await fs.writeFile(META, JSON.stringify({ generated: new Date().toISOString(), license: 'Mixkit Stock Music Free License (https://mixkit.co/license/#musicFree). Attribution not required. Not for CD/DVD/games/TV-radio broadcast.', tracks: sources }, null, 2));
console.log('DONE', sources.length, '/', MAP.length);
