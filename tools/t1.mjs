import { demoPhoto, demoVideo } from '../server/render.js';
import { byId, ALL } from '../server/catalog.js';
import fs from 'fs';
fs.mkdirSync('/tmp/prico/out', { recursive: true });
const f = [1,2,3].map(i => ({ img: fs.readFileSync(`assets/seed/face${i}.jpg`), cut: fs.readFileSync(`assets/seed/cut${i}.png`) }));
const ids = process.argv[2] ? process.argv[2].split(',') : ALL.map(t => t.id);
for (const id of ids) { const t = byId(id); const t0 = Date.now();
  if (t.kind === 'photo') fs.writeFileSync(`/tmp/prico/out/${id}.jpg`, await demoPhoto(t, f));
  else { const r = await demoVideo(t, f); fs.writeFileSync(`/tmp/prico/out/${id}.mp4`, r.mp4); fs.writeFileSync(`/tmp/prico/out/${id}.jpg`, r.poster); }
  console.log(id, Date.now() - t0); }
