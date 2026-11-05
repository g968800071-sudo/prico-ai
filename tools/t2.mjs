import { render } from '../server/reels.js';
import fs from 'fs'; import sharp from 'sharp';
await sharp('assets/bg/beach.jpg').resize(1280, 720, { fit: 'cover' }).toFile('/tmp/prico/land.jpg');
const items = [
  { kind: 'video', path: '/tmp/prico/out/v_flamingo.mp4' }, { kind: 'image', path: '/tmp/prico/land.jpg' },
  { kind: 'video', path: '/tmp/prico/out/v_dance.mp4' }, { kind: 'image', path: 'assets/bg/paris.jpg' },
];
const t0 = Date.now();
const r = await render({ items, niche: process.argv[2] || 'travel', idea: 'Summer trip with friends. Best pool ever, then Paris at night! Who wants to join?', lang: 'en', overlay: { stickers: [{ c: '1f525', x: .85, y: .25, s: .16 }] } });
fs.writeFileSync('/tmp/prico/reel.mp4', r.mp4); fs.writeFileSync('/tmp/prico/reel.jpg', r.poster);
console.log(Date.now() - t0, 'ms', r.duration, r.segments, r.mp4.length, r.captions);
const f = [1].map(i => ({ img: fs.readFileSync('assets/seed/face1.jpg'), cut: fs.readFileSync('assets/seed/cut1.png') }));
const t1 = Date.now(); const r2 = await render({ items: [], niche: 'funny', lang: 'ru', faces: f });
fs.writeFileSync('/tmp/prico/reel2.mp4', r2.mp4); console.log(Date.now() - t1, r2.duration, r2.segments);
