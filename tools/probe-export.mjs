// Read a file with the bundled ffmpeg and print container, codecs, size, and duration.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import ffmpeg from 'ffmpeg-static';

const file = process.argv[2];
if (!file) { console.error('usage: node tools/probe-export.mjs <file>'); process.exit(2); }
const st = fs.statSync(file);
const run = spawnSync(ffmpeg, ['-hide_banner', '-i', file], { encoding: 'utf8' });
const text = `${run.stdout || ''}\n${run.stderr || ''}`;
const duration = /Duration:\s*([0-9:.]+)/.exec(text)?.[1] || '';
const video = /Stream #\d+:\d+.*Video:\s*([^\s,]+).*?(\d{2,5})x(\d{2,5})/.exec(text);
const audio = /Stream #\d+:\d+.*Audio:\s*([^\s,]+)/.exec(text);
const head = fs.readFileSync(file).subarray(0, 32).toString('latin1');
const report = {
  file,
  bytes: st.size,
  container: head.includes('ftyp') ? 'mp4' : head.startsWith('\u001aE\u00df\u00a3') ? 'webm' : 'unknown',
  duration,
  videoCodec: video?.[1] || '',
  width: video ? Number(video[2]) : 0,
  height: video ? Number(video[3]) : 0,
  audioCodec: audio?.[1] || '',
  ffmpeg: text.split('\n').filter(l => /Duration:|Stream #/.test(l)).map(l => l.trim()),
};
const ok = report.container === 'mp4' && /h264|avc1/i.test(report.videoCodec) && /aac/i.test(report.audioCodec) && report.width >= 2 && report.height >= 2 && report.bytes > 800 && duration && duration !== '00:00:00.00';
report.ok = ok;
console.log(JSON.stringify(report, null, 2));
process.exit(ok ? 0 : 1);
