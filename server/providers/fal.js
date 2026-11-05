// REAL provider: fal.ai (https://fal.ai). Set AI_PROVIDER=fal and FAL_KEY=<key> on the Render service.
// Photo:  FAL_PHOTO_MODEL (default fal-ai/flux-pulid, identity-preserving, ≈ $0.033 per 1 MP image)
// Video:  still from the photo model, then FAL_VIDEO_MODEL image-to-video
//         (default fal-ai/kling-video/v2.5-turbo/pro/image-to-video, ≈ $0.35 per 5 s clip;
//          cheaper: minimax/h3-max-turbo/image-to-video ≈ $0.125 per 5 s).
import { brandImage, brandVideo, textPng } from '../render.js';
import sharp from 'sharp';
import { loc } from '../catalog.js';
export const name = 'fal';
const KEY = () => process.env.FAL_KEY;
const PHOTO_MODEL = () => process.env.FAL_PHOTO_MODEL || 'fal-ai/flux-pulid';
const VIDEO_MODEL = () => process.env.FAL_VIDEO_MODEL || 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video';
export const etaSec = { photo: 15, video: 90 };

async function falRun(model, input, timeoutMs = 300000) {
  const h = { Authorization: `Key ${KEY()}`, 'Content-Type': 'application/json' };
  const sub = await fetch(`https://queue.fal.run/${model}`, { method: 'POST', headers: h, body: JSON.stringify(input) });
  if (!sub.ok) throw new Error(`fal submit ${sub.status}: ${(await sub.text()).slice(0, 300)}`);
  const { status_url, response_url } = await sub.json();
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    await new Promise(r => setTimeout(r, 2000));
    const st = await (await fetch(status_url, { headers: h })).json();
    if (st.status === 'COMPLETED') { const r = await fetch(response_url, { headers: h }); if (!r.ok) throw new Error('fal result ' + r.status); return r.json(); }
    if (st.status === 'FAILED' || st.error) throw new Error('fal failed: ' + JSON.stringify(st).slice(0, 300));
  }
  throw new Error('fal timeout');
}
const dataUri = (buf, mime = 'image/jpeg') => `data:${mime};base64,${buf.toString('base64')}`;
const dl = async url => Buffer.from(await (await fetch(url)).arrayBuffer());

async function still(tpl, faces, prompt) {
  const p = [tpl.prompt, prompt].filter(Boolean).join(', ') + ', vertical 9:16, high quality, safe for work';
  const r = await falRun(PHOTO_MODEL(), { prompt: p, reference_image_url: dataUri(faces[0].img), image_size: { width: 768, height: 1344 }, num_inference_steps: 20, enable_safety_checker: true });
  const url = r.images?.[0]?.url; if (!url) throw new Error('no image');
  return dl(url);
}
export async function photo(tpl, faces, opts) {
  let img = await still(tpl, faces, opts.prompt);
  if (tpl.title) {
    const t = await textPng(loc(tpl.title, opts.lang), 64);
    img = await sharp(img).resize(720, 1280, { fit: 'cover' }).composite([{ input: t.png, left: Math.round((720 - t.w) / 2), top: 120 }]).jpeg().toBuffer();
  }
  return { mime: 'image/jpeg', data: await brandImage(img, { noWm: !!opts.noWm, hd: !!opts.hd }) };
}
export async function video(tpl, faces, opts) {
  const s = await still(tpl, faces, opts.prompt);
  const r = await falRun(VIDEO_MODEL(), { prompt: [tpl.prompt, opts.prompt].filter(Boolean).join(', '), image_url: dataUri(s), duration: '5', aspect_ratio: '9:16' }, 600000);
  const url = r.video?.url; if (!url) throw new Error('no video');
  const v = await brandVideo(await dl(url), { noWm: !!opts.noWm, hd: !!opts.hd });
  return { mime: 'video/mp4', data: v.mp4, poster: v.poster };
}
