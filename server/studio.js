// Photo Studio (Remini/Lensa-style tools): HD enhance, background swap, greeting cards.
// Free mode runs fully on the server with sharp. Set AI_PROVIDER=fal + FAL_KEY to switch Enhance to a real
// face-restoration / upscale model (FAL_ENHANCE_MODEL, default fal-ai/codeformer ≈ $0.002–0.01 per image).
import sharp from 'sharp';
import { watermark, demoPhoto } from './render.js';
sharp.concurrency(1); sharp.cache({ memory: 32, items: 20 });

export const BG_SCENES = ['beach', 'paris', 'nyc', 'tokyo', 'dubai', 'space', 'moon', 'neon', 'sakura', 'castle', 'redcarpet', 'runway', 'ocean', 'snowglobe', 'disco', 'office', 'stadium', 'pool', 'berlin', 'ghibli', 'comic', 'vintage'];
export const CARDS = { birthday: 'birthday', newyear: 'newyear', love: 'love', christmas: 'christmas', diwali: 'diwali', ramadan: 'ramadan', lunar: 'lunar', halloween: 'halloween', wedding: 'wedding', cake: 'cake' };
const MAXPX = 2048;

async function mark(img, opts = {}) {
  if (opts.noWm) return sharp(img).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
  const m = await sharp(img).metadata();
  const wm = await watermark(Math.max(0.8, Math.min(2.2, m.width / 600)));
  return sharp(img).composite([{ input: wm.png, left: Math.max(0, m.width - wm.w - Math.round(m.width * .03)), top: Math.max(0, m.height - wm.h - Math.round(m.width * .035)) }]).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
}

// Free HD enhance: upscale to ~2K (Lanczos), denoise, local contrast (CLAHE), gentle skin-friendly clarity and colour.
async function enhanceFree(buf) {
  const base = sharp(buf, { limitInputPixels: 40e6 }).rotate();
  const m = await base.metadata();
  const w0 = m.autoOrient?.width || m.width, h0 = m.autoOrient?.height || m.height;
  const k = Math.min(MAXPX / Math.max(w0, h0), 3);
  const w = Math.round(w0 * k), h = Math.round(h0 * k);
  const small = Math.max(w0, h0) < 900;
  let p = sharp(buf, { limitInputPixels: 40e6 }).rotate();
  if (small) p = p.median(3);
  const up = await p.resize(w, h, { kernel: 'lanczos3', fit: 'fill' }).toColourspace('srgb').png().toBuffer();
  return sharp(up)
    .clahe({ width: Math.max(8, Math.round(w / 12)), height: Math.max(8, Math.round(h / 12)), maxSlope: 2 })
    .modulate({ brightness: 1.02, saturation: 1.12 })
    .linear(1.04, -4)
    .sharpen({ sigma: small ? 1.4 : 1.0, m1: 0.6, m2: 2.2 })
    .jpeg({ quality: 94 }).toBuffer();
}
async function enhanceFal(buf) {
  const key = process.env.FAL_KEY; const model = process.env.FAL_ENHANCE_MODEL || 'fal-ai/codeformer';
  const small = await sharp(buf).rotate().resize(1280, 1280, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer();
  const h = { Authorization: `Key ${key}`, 'Content-Type': 'application/json' };
  const r = await fetch(`https://fal.run/${model}`, { method: 'POST', headers: h, body: JSON.stringify({ image_url: `data:image/jpeg;base64,${small.toString('base64')}`, fidelity: 0.6, upscaling: 2, face_upscale: true }) });
  if (!r.ok) throw new Error('fal enhance ' + r.status);
  const j = await r.json(); const url = j.image?.url || j.images?.[0]?.url; if (!url) throw new Error('fal enhance: no image');
  return Buffer.from(await (await fetch(url)).arrayBuffer());
}
export const enhanceMode = () => ((process.env.AI_PROVIDER || '').toLowerCase() === 'fal' && process.env.FAL_KEY ? 'ai' : 'free');
export async function enhance(buf, opts = {}) {
  let out;
  if (enhanceMode() === 'ai') { try { out = await enhanceFal(buf); } catch (e) { console.warn('[studio]', e.message); } }
  out ||= await enhanceFree(buf);
  return mark(out, opts);
}
// Background swap / "you anywhere": the person cut-out (made on-device) placed into a scene.
export async function bgSwap(cut, scene, lang, opts = {}) {
  if (!BG_SCENES.includes(scene)) throw Object.assign(new Error('bad_scene'), { code: 400 });
  return demoPhoto({ scene, filter: 'clean' }, [{ img: cut, cut }], lang, opts);
}
// Greeting card with your photo and your own text.
export async function card(cut, img, kind, text, lang, opts = {}) {
  const scene = CARDS[kind]; if (!scene) throw Object.assign(new Error('bad_scene'), { code: 400 });
  return demoPhoto({ scene, filter: 'clean', title: { en: text } }, [{ img: img || cut, cut }], lang, opts);
}
