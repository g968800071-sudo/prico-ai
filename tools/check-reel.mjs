// Confirm an export is a portrait H.264/AAC MP4 whose audio matches a library track, not a sine fixture.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import ffmpeg from 'ffmpeg-static';

const file = process.argv[2];
const music = arg('--music');
const minDuration = Number(arg('--min-duration') || 1);
const minWidth = Number(arg('--min-width') || 720);
const minHeight = Number(arg('--min-height') || 1280);
const minFps = Number(arg('--min-fps') || 24);
if (!file || !music) { console.error('usage: node tools/check-reel.mjs <mp4> --music <m4a>'); process.exit(2); }

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : '';
}
function pcm(path, seconds) {
  const run = spawnSync(ffmpeg, ['-v', 'error', '-i', path, '-ac', '1', '-ar', '16000', '-t', String(seconds), '-f', 'f32le', '-'], { maxBuffer: 20_000_000 });
  if (!run.stdout?.length) throw new Error('no audio in ' + path);
  const n = run.stdout.length / 4;
  const xs = new Float32Array(n);
  for (let i = 0; i < n; i++) xs[i] = run.stdout.readFloatLE(i * 4);
  return xs;
}
function bands(xs) {
  const sr = 16000;
  const n = Math.min(xs.length, 16000);
  const freqs = [];
  for (let f = 80; f <= 4000; f *= 1.25) freqs.push(f);
  const mag = freqs.map(freq => {
    let re = 0, im = 0;
    for (let i = 0; i < n; i += 2) {
      const ang = 2 * Math.PI * freq * i / sr;
      re += xs[i] * Math.cos(ang);
      im -= xs[i] * Math.sin(ang);
    }
    return Math.hypot(re, im);
  });
  const sum = mag.reduce((a, b) => a + b, 0) || 1;
  return mag.map(v => v / sum);
}
function toneShare(xs, freq) {
  const sr = 16000;
  const n = Math.min(xs.length, 16000);
  let re = 0, im = 0, energy = 0;
  for (let i = 0; i < n; i += 2) {
    const ang = 2 * Math.PI * freq * i / sr;
    re += xs[i] * Math.cos(ang);
    im -= xs[i] * Math.sin(ang);
    energy += xs[i] * xs[i];
  }
  return energy ? Math.hypot(re, im) / Math.sqrt(energy * (n / 2)) : 0;
}
function cosine(a, b) {
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
  return dot / Math.sqrt(aa * bb || 1);
}
function probe() {
  const run = spawnSync(ffmpeg, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  const text = `${run.stdout || ''}\n${run.stderr || ''}`;
  const video = /Stream #\d+:\d+.*Video:\s*([^\s,]+).*?(\d{2,5})x(\d{2,5}).*?(\d+(?:\.\d+)?) fps/.exec(text);
  const audio = /Stream #\d+:\d+.*Audio:\s*([^\s,]+)/.exec(text);
  const duration = /Duration:\s*([0-9:.]+)/.exec(text)?.[1] || '';
  const head = fs.readFileSync(file).subarray(0, 32).toString('latin1');
  const [hh, mm, ss] = duration.split(':').map(Number);
  return {
    bytes: fs.statSync(file).size,
    container: head.includes('ftyp') ? 'mp4' : 'unknown',
    videoCodec: video?.[1] || '',
    width: video ? Number(video[2]) : 0,
    height: video ? Number(video[3]) : 0,
    fps: video ? Number(video[4]) : 0,
    audioCodec: audio?.[1] || '',
    duration,
    seconds: (hh || 0) * 3600 + (mm || 0) * 60 + (ss || 0),
  };
}
function frameAt(t) {
  const run = spawnSync(ffmpeg, ['-v', 'error', '-ss', String(t), '-i', file, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 20_000_000 });
  return run.stdout;
}
function center(buf, w, h) {
  const x0 = Math.floor(w * 0.45), x1 = Math.floor(w * 0.55), y0 = Math.floor(h * 0.45), y1 = Math.floor(h * 0.55);
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * w + x) * 3; r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; n++;
  }
  return [r / n, g / n, b / n];
}
function lumaStd(buf, w, h, y0f, y1f) {
  const y0 = Math.floor(h * y0f), y1 = Math.floor(h * y1f);
  let sum = 0, sum2 = 0, n = 0;
  for (let y = y0; y < y1; y += 2) for (let x = 0; x < w; x += 4) {
    const i = (y * w + x) * 3;
    const yv = 0.3 * buf[i] + 0.59 * buf[i + 1] + 0.11 * buf[i + 2];
    sum += yv; sum2 += yv * yv; n++;
  }
  const mean = sum / n;
  return Math.sqrt(Math.max(0, sum2 / n - mean * mean));
}
function visual(info) {
  const a = frameAt(0.2), b = frameAt(0.8);
  let diff = 0, count = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i + 2 < n; i += 30) { diff += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); count++; }
  const red = center(frameAt(16), info.width, info.height);
  const green = center(frameAt(32), info.width, info.height);
  const blue = center(frameAt(50), info.width, info.height);
  const cap = lumaStd(frameAt(16), info.width, info.height, 0.7, 0.9);
  const title = lumaStd(frameAt(2), info.width, info.height, 0.1, 0.28);
  const hue = (rgb, name) => {
    const [r, g, b] = rgb;
    if (name === 'red') return r > 180 && r > g + 40 && r > b + 40;
    if (name === 'green') return g > 150 && g > r + 40 && g > b + 20;
    return b > 180 && b > r + 40 && b > g + 20;
  };
  const videoDiff = count ? diff / count : 0;
  return {
    videoDiff: Math.round(videoDiff),
    red: red.map(v => Math.round(v)),
    green: green.map(v => Math.round(v)),
    blue: blue.map(v => Math.round(v)),
    captionStd: +cap.toFixed(1),
    titleStd: +title.toFixed(1),
    ok: videoDiff > 8 && hue(red, 'red') && hue(green, 'green') && hue(blue, 'blue') && cap > 8 && title > 8,
  };
}
const info = probe();
const exp = pcm(file, Math.min(8, Math.max(1, info.seconds)));
const src = pcm(music, Math.min(8, Math.max(1, info.seconds)));
const similarity = cosine(bands(exp), bands(src));
const sine440 = toneShare(exp, 440);
const sine523 = toneShare(exp, 523);
const picture = process.argv.includes('--reel') ? visual(info) : null;
const report = { ...info, music: music, similarity: +similarity.toFixed(3), sine440: +sine440.toFixed(3), sine523: +sine523.toFixed(3), picture };
const ok = info.container === 'mp4' && /h264|avc1/i.test(info.videoCodec) && /aac/i.test(info.audioCodec)
  && info.width >= minWidth && info.height >= minHeight && info.fps >= minFps && info.seconds >= minDuration
  && similarity >= 0.35 && sine440 < 0.45 && sine523 < 0.45 && (!picture || picture.ok);
report.ok = ok;
console.log(JSON.stringify(report, null, 2));
process.exit(ok ? 0 : 1);
