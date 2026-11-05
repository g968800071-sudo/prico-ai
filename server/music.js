// Royalty-free music library for Reels/editor. Tracks live in assets/music/*.m4a
// (Mixkit Stock Music Free License — commercial social/video OK; see assets/music/SOURCES.json).
// Synth fallback remains only if a bundled file is missing (local/dev).
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import fss from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegStatic from 'ffmpeg-static';
const FFMPEG = process.env.FFMPEG_PATH || ffmpegStatic || 'ffmpeg';
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const BUNDLED = path.join(ROOT, '../assets/music');
const DIR = path.join(os.tmpdir(), 'prico-music-v3');
const LEN = 32;

const sources = JSON.parse(fss.readFileSync(path.join(BUNDLED, 'SOURCES.json'), 'utf8'));
export const TRACKS = sources.tracks.map(({ id, name, bpm, mood }) => ({ id, name, bpm, mood }));
export const byId = id => TRACKS.find(t => t.id === id) || TRACKS[0];

const CAT = { happy: 'pop', party: 'pop', dance: 'dance', hype: 'hype', fitness: 'hype', sport: 'hype', cool: 'hype', chill: 'chill', nostalgia: 'chill', food: 'chill', travel: 'chill', business: 'chill', love: 'love', funny: 'funny', epic: 'epic', holiday: 'holiday', world: 'world' };
export const CATS = ['pop', 'dance', 'hype', 'chill', 'love', 'funny', 'epic', 'holiday', 'world'];
export const list = () => TRACKS.map(({ id, name, bpm, mood }) => ({ id, name, bpm, mood, cat: CAT[mood] || 'pop', url: `/api/music/${id}.m4a` }));

const pending = new Map();
export async function trackFile(id) {
  const tr = byId(id);
  const bundled = path.join(BUNDLED, tr.id + '.m4a');
  if (fss.existsSync(bundled)) return bundled;
  // Dev fallback: simple tone so missing files don't crash jobs
  const out = path.join(DIR, tr.id + '.m4a');
  if (fss.existsSync(out)) return out;
  if (pending.has(out)) return pending.get(out);
  const p = (async () => {
    await fs.mkdir(DIR, { recursive: true });
    const tmp = out + '.tmp.m4a';
    const hz = (tr.bpm || 120) * 2;
    await new Promise((res, rej) => {
      const pr = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `sine=f=${hz}:d=${LEN}`, '-af', 'volume=0.2', '-c:a', 'aac', '-b:a', '96k', tmp]);
      let e = ''; pr.stderr.on('data', d => e += d); pr.on('close', c => c ? rej(new Error('music ' + e.slice(-200))) : res());
    });
    await fs.rename(tmp, out); return out;
  })().finally(() => pending.delete(out));
  pending.set(out, p); return p;
}
