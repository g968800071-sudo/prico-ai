// Pre-renders template thumbnails (assets/previews) and showcase feed media (assets/seedmedia).
import fs from 'fs/promises'; import sharp from 'sharp';
import { demoPhoto, demoVideo } from '../server/render.js';
import { ALL, byId } from '../server/catalog.js';
import { render as reel } from '../server/reels.js';
const only = process.argv[2] ? process.argv[2].split(',') : null;
const faces = []; for (let i = 1; i <= 3; i++) faces.push({ img: await fs.readFile(`assets/seed/face${i}.jpg`), cut: await fs.readFile(`assets/seed/cut${i}.png`) });
await fs.mkdir('assets/previews', { recursive: true }); await fs.mkdir('assets/seedmedia', { recursive: true });
const SEED = ['v_flamingo', 'v_viggle', 'v_entrance', 'v_zombie', 'v_elf', 'v_hug', 'v_trio', 'v_tank', 'm_inflate', 'v_oldphoto', 'p_meme', 'p_figure', 'p_ghibli', 'p_paris', 'p_hero', 'p_doll', 'p_muscle', 'p_baby'];
const rot = n => faces.slice(n % 3).concat(faces.slice(0, n % 3));
let k = 0;
for (const t of ALL) {
  if (only && !only.includes(t.id)) continue;
  const fs3 = rot(k++); const t0 = Date.now();
  if (t.kind === 'video') {
    const v = await demoVideo(t, fs3, 'en');
    await fs.writeFile(`assets/previews/${t.id}.jpg`, await sharp(v.poster).resize(360, 640).jpeg({ quality: 82, mozjpeg: true }).toBuffer());
    if (SEED.includes(t.id)) { await fs.writeFile(`assets/seedmedia/${t.id}.mp4`, v.mp4); await fs.writeFile(`assets/seedmedia/${t.id}.jpg`, await sharp(v.poster).jpeg({ quality: 80, mozjpeg: true }).toBuffer()); }
  } else {
    const p = await demoPhoto(t, fs3, 'en');
    await fs.writeFile(`assets/previews/${t.id}.jpg`, await sharp(p).resize(360, 640).jpeg({ quality: 82, mozjpeg: true }).toBuffer());
    if (SEED.includes(t.id)) await fs.writeFile(`assets/seedmedia/${t.id}.jpg`, await sharp(p).jpeg({ quality: 84, mozjpeg: true }).toBuffer());
  }
  console.log(t.id, Date.now() - t0);
}
if (!only || only.includes('reels')) {
  const it = ['v_flamingo', 'p_paris', 'p_beach', 'v_viggle'];
  await sharp(await demoPhoto(byId('p_beach'), [faces[1]], 'en', { raw: true })).jpeg().toFile('/tmp/prico-beach.jpg');
  const items = [{ kind: 'video', path: 'assets/seedmedia/v_flamingo.mp4' }, { kind: 'image', path: 'assets/seedmedia/p_paris.jpg' }, { kind: 'image', path: '/tmp/prico-beach.jpg' }, { kind: 'video', path: 'assets/seedmedia/v_viggle.mp4' }];
  const r = await reel({ items, niche: 'travel', idea: 'Summer 2026 recap. Pool day with my flamingo. Paris at sunset. Beach mode on. Dance till morning', lang: 'en' });
  await fs.writeFile('assets/seedmedia/reel_travel.mp4', r.mp4); await fs.writeFile('assets/seedmedia/reel_travel.jpg', r.poster);
  const r2 = await reel({ items: [], faces, niche: 'funny', idea: 'Me pretending to be productive. Monday vs Friday', lang: 'en' });
  await fs.writeFile('assets/seedmedia/reel_funny.mp4', r2.mp4); await fs.writeFile('assets/seedmedia/reel_funny.jpg', r2.poster);
  console.log('reels ok');
}
