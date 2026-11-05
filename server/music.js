// Original royalty-free music library, synthesised by ffmpeg (no licensing needed, safe for TikTok/Reels).
// Each track is rendered once to a cached .m4a and reused. BPM is known, so the Reels maker can cut on the beat.
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import fss from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ffmpegStatic from 'ffmpeg-static';
const FFMPEG = process.env.FFMPEG_PATH || ffmpegStatic || 'ffmpeg';
const DIR = path.join(os.tmpdir(), 'prico-music-v2');
const LEN = 32;

const MAJ = [0, 4, 7], MIN = [0, 3, 7];
// prog: [semitone offset from root, quality]
export const TRACKS = [
  { id: 'pop', name: 'Sunny Pop', bpm: 118, root: 261.63, prog: [[0, MAJ], [7, MAJ], [9, MIN], [5, MAJ]], drums: 2, arp: 1, mood: 'happy' },
  { id: 'disco', name: 'Night Disco', bpm: 124, root: 220, prog: [[0, MIN], [5, MIN], [10, MAJ], [3, MAJ]], drums: 3, arp: 1, mood: 'dance' },
  { id: 'funk', name: 'Cool Strut', bpm: 98, root: 196, prog: [[0, MIN], [0, MIN], [5, MAJ], [7, MIN]], drums: 2, arp: 2, mood: 'cool' },
  { id: 'summer', name: 'Tropical Float', bpm: 104, root: 293.66, prog: [[0, MAJ], [9, MIN], [5, MAJ], [7, MAJ]], drums: 1, arp: 3, mood: 'travel' },
  { id: 'epic', name: 'Epic Trailer', bpm: 90, root: 110, prog: [[0, MIN], [8, MAJ], [3, MAJ], [10, MAJ]], drums: 3, arp: 0, mood: 'epic' },
  { id: 'drama', name: 'Dramatic Zoom', bpm: 80, root: 146.83, prog: [[0, MIN], [0, MIN], [1, MAJ], [7, MAJ]], drums: 1, arp: 0, mood: 'funny' },
  { id: 'toon', name: 'Cartoon Bounce', bpm: 140, root: 392, prog: [[0, MAJ], [5, MAJ], [7, MAJ], [0, MAJ]], drums: 2, arp: 3, mood: 'funny' },
  { id: 'love', name: 'Soft Heart', bpm: 76, root: 261.63, prog: [[0, MAJ], [9, MIN], [5, MAJ], [7, MAJ]], drums: 0, arp: 2, mood: 'love' },
  { id: 'lofi', name: 'Lo-fi Chill', bpm: 82, root: 220, prog: [[0, MIN], [5, MIN], [3, MAJ], [10, MAJ]], drums: 1, arp: 1, mood: 'chill' },
  { id: 'piano', name: 'Old Memories', bpm: 70, root: 261.63, prog: [[0, MAJ], [4, MIN], [5, MAJ], [7, MAJ]], drums: 0, arp: 2, mood: 'nostalgia' },
  { id: 'birthday', name: 'Party Time', bpm: 112, root: 293.66, prog: [[0, MAJ], [7, MAJ], [5, MAJ], [7, MAJ]], drums: 2, arp: 3, mood: 'party' },
  { id: 'jingle', name: 'Snow Bells', bpm: 128, root: 329.63, prog: [[0, MAJ], [5, MAJ], [7, MAJ], [0, MAJ]], drums: 2, arp: 3, mood: 'holiday' },
  { id: 'stadium', name: 'Stadium Anthem', bpm: 128, root: 196, prog: [[0, MAJ], [5, MAJ], [9, MIN], [7, MAJ]], drums: 3, arp: 1, mood: 'sport' },
  { id: 'trap', name: 'Gym Beast', bpm: 140, root: 98, prog: [[0, MIN], [0, MIN], [8, MAJ], [7, MAJ]], drums: 4, arp: 0, mood: 'fitness' },
  { id: 'corporate', name: 'Bright Business', bpm: 110, root: 261.63, prog: [[0, MAJ], [5, MAJ], [9, MIN], [7, MAJ]], drums: 1, arp: 2, mood: 'business' },
  { id: 'food', name: 'Kitchen Groove', bpm: 96, root: 246.94, prog: [[0, MAJ], [2, MIN], [4, MIN], [5, MAJ]], drums: 2, arp: 2, mood: 'food' },
];
export const byId = id => TRACKS.find(t => t.id === id) || TRACKS[0];

function expr(tr) {
  const b = 60 / tr.bpm, bar = 4 * b;
  const ci = `mod(floor(t/${bar}),4)`;
  const f = (semi, oct = 1) => (tr.root * Math.pow(2, semi / 12) * oct).toFixed(2);
  const pick = (k, oct) => `if(eq(${ci},0),${f(tr.prog[0][0] + tr.prog[0][1][k], oct)},if(eq(${ci},1),${f(tr.prog[1][0] + tr.prog[1][1][k], oct)},if(eq(${ci},2),${f(tr.prog[2][0] + tr.prog[2][1][k], oct)},${f(tr.prog[3][0] + tr.prog[3][1][k], oct)})))`;
  const parts = [];
  // warm pad (chord, slight detune)
  for (let k = 0; k < 3; k++) parts.push(`0.045*sin(2*PI*${pick(k, 1)}*t)+0.03*sin(2*PI*${pick(k, 1)}*1.004*t)`);
  // bass on beats
  parts.push(`0.17*sin(2*PI*${pick(0, 0.25)}*t)*(0.35+0.65*exp(-5*mod(t,${b})))`);
  // arpeggio
  if (tr.arp) {
    const step = tr.arp >= 3 ? b / 4 : b / 2;
    const idx = `mod(floor(t/${step}),${tr.arp === 2 ? 4 : 3})`;
    const note = `if(eq(${idx},0),${pick(0, 2)},if(eq(${idx},1),${pick(1, 2)},if(eq(${idx},2),${pick(2, 2)},${pick(1, 2)})))`;
    parts.push(`0.075*sin(2*PI*${note}*t)*exp(-${tr.arp >= 3 ? 14 : 9}*mod(t,${step}))`);
  }
  if (tr.drums) {
    parts.push(`0.42*sin(2*PI*48*t*(1+3*exp(-35*mod(t,${b}))))*exp(-${tr.drums >= 4 ? 6 : 10}*mod(t,${b}))`); // kick
    if (tr.drums >= 2) parts.push(`0.06*(random(0)*2-1)*exp(-40*mod(t+${b / 2},${b}))`); // offbeat hat
    if (tr.drums >= 3) parts.push(`0.12*(random(1)*2-1)*exp(-18*mod(t+${b},${2 * b}))`); // snare on 2/4
    if (tr.drums >= 4) parts.push(`0.035*(random(2)*2-1)*exp(-60*mod(t,${b / 4}))`); // fast hats
  }
  return parts.join('+');
}

const pending = new Map();
const BUNDLED = path.join(path.dirname(new URL(import.meta.url).pathname), '../assets/music');
export async function trackFile(id) {
  const tr = byId(id);
  const bundled = path.join(BUNDLED, tr.id + '.m4a'); if (fss.existsSync(bundled)) return bundled; // pre-rendered (tools: node -e "...trackFile")
  const out = path.join(DIR, tr.id + '.m4a');
  if (fss.existsSync(out)) return out;
  if (pending.has(out)) return pending.get(out);
  const p = (async () => {
    await fs.mkdir(DIR, { recursive: true });
    const tmp = out + '.tmp.m4a';
    await new Promise((res, rej) => {
      const pr = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `aevalsrc='${expr(tr)}':s=44100:d=${LEN}`,
        '-af', 'highpass=f=30,lowpass=f=9000,acompressor=threshold=0.25:ratio=3,volume=1.4,aformat=channel_layouts=stereo', '-c:a', 'aac', '-b:a', '128k', tmp]);
      let e = ''; pr.stderr.on('data', d => e += d); pr.on('close', c => c ? rej(new Error('music ' + e.slice(-300))) : res());
    });
    await fs.rename(tmp, out); return out;
  })().finally(() => pending.delete(out));
  pending.set(out, p); return p;
}
export const list = () => TRACKS.map(({ id, name, bpm, mood }) => ({ id, name, bpm, mood, url: `/api/music/${id}.m4a` }));
