// Pre-render missing template previews into assets/previews (so Render never renders them at runtime).
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { ALL } from '../server/catalog.js';
import { demoPhoto, demoVideo } from '../server/render.js';
const faces = [];
for (let i = 1; i <= 3; i++) faces.push({ img: await fs.readFile(`assets/seed/face${i}.jpg`), cut: await fs.readFile(`assets/seed/cut${i}.png`).catch(() => null) });
const only = process.argv.slice(2);
for (const t of ALL) {
  const out = `assets/previews/${t.id}.jpg`;
  if (only.length ? !only.includes(t.id) : await fs.access(out).then(() => true, () => false)) continue;
  const t0 = Date.now();
  const buf = t.kind === 'video' ? (await demoVideo(t, faces, 'en')).poster : await demoPhoto(t, faces, 'en');
  await fs.writeFile(out, await sharp(buf).resize(360, 640, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer());
  console.log(t.id, Date.now() - t0, 'ms');
}
