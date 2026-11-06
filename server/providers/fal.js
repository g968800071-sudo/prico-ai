// Real fal.ai adapter. Runs only when the caller passes a key.
// The key stays in the Authorization header and is stripped from every error.
// There is no demo/composite fallback: a failed or unconfigured call throws.
import { PHOTO_MODEL, VIDEO_MODEL, buildPulidInput, buildWanImageToVideoInput, motionPrompt, stillPrompt } from './contract.js';
import { assertMp4, validateImage } from '../media-validate.js';

export const name = 'fal';
export const etaSec = { photo: 25, video: 120 };
export const photoModel = () => process.env.FAL_PHOTO_MODEL || PHOTO_MODEL;
export const videoModel = () => process.env.FAL_VIDEO_MODEL || VIDEO_MODEL;

export class AiError extends Error {
  constructor(code, http = 502) { super(code); this.code = code; this.http = http; }
}

export function redact(text, secret) {
  let s = String(text ?? '');
  if (secret) s = s.split(secret).join('[redacted]');
  return s.replace(/Key\s+\S+/gi, 'Key [redacted]').slice(0, 240);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function assertHttps(url) {
  let u;
  try { u = new URL(String(url)); } catch { throw new AiError('generation_failed'); }
  if (u.protocol !== 'https:') throw new AiError('generation_failed');
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.local') || h === '0.0.0.0' || h === '::1' || h === 'metadata.google.internal') throw new AiError('generation_failed');
  const ip = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ip) {
    const a = Number(ip[1]), b = Number(ip[2]);
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) throw new AiError('generation_failed');
  }
  return u.toString();
}

async function readBody(res, max) {
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 32 || buf.length > max) throw new AiError('generation_failed');
  return buf;
}

function billing(status, body) {
  return status === 402 || /exhaust|insufficient|payment required|no credits|balance/i.test(body);
}

export async function falUpload(fetchImpl, { key, bytes, mime, fileName = 'frame.jpg' }) {
  if (!key) throw new AiError('ai_unavailable', 503);
  const init = await fetchImpl('https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3', {
    method: 'POST',
    headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_name: fileName, content_type: mime }),
  });
  const raw = await init.text();
  if (!init.ok) {
    if (billing(init.status, raw)) throw new AiError('ai_exhausted', 402);
    if (init.status === 401 || init.status === 403) throw new AiError('ai_unavailable', 503);
    throw new AiError('generation_failed');
  }
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new AiError('generation_failed'); }
  const uploadUrl = assertHttps(parsed.upload_url);
  const fileUrl = assertHttps(parsed.file_url);
  const put = await fetchImpl(uploadUrl, { method: 'PUT', headers: { 'Content-Type': mime }, body: bytes });
  if (!put.ok) throw new AiError('generation_failed');
  return fileUrl;
}

export async function falQueue(fetchImpl, { key, model, input, timeoutMs = 300000, pollMs = 10, sleepImpl = sleep, now = Date.now }) {
  if (!key) throw new AiError('ai_unavailable', 503);
  if (JSON.stringify(input).includes(key)) throw new AiError('generation_failed');
  const auth = { Authorization: `Key ${key}` };
  let sub;
  try {
    sub = await fetchImpl(`https://queue.fal.run/${model}`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  } catch { throw new AiError('ai_unavailable', 503); }
  const subText = await sub.text();
  if (!sub.ok) {
    if (billing(sub.status, subText)) throw new AiError('ai_exhausted', 402);
    if (sub.status === 401 || sub.status === 403) throw new AiError('ai_unavailable', 503);
    throw new AiError('generation_failed');
  }
  let queued;
  try { queued = JSON.parse(subText); } catch { throw new AiError('generation_failed'); }
  const statusUrl = assertHttps(queued.status_url);
  const responseUrl = assertHttps(queued.response_url);
  const t0 = now();
  while (now() - t0 < timeoutMs) {
    await sleepImpl(pollMs);
    const stRes = await fetchImpl(statusUrl, { headers: auth });
    const stText = await stRes.text();
    let st = {};
    try { st = JSON.parse(stText); } catch { st = {}; }
    if (st.status === 'COMPLETED') {
      const r = await fetchImpl(responseUrl, { headers: auth });
      if (!r.ok) throw new AiError('generation_failed');
      return r.json();
    }
    if (st.status === 'FAILED' || st.error) throw new AiError('generation_failed');
  }
  throw new AiError('generation_failed');
}

async function download(fetchImpl, url, max) {
  const res = await fetchImpl(assertHttps(url));
  if (!res.ok) throw new AiError('generation_failed');
  return readBody(res, max);
}

async function uploadStill(fetchImpl, key, image) {
  const checked = await validateImage(image);
  if (!checked.ok) throw new AiError('invalid_media', 422);
  const url = await falUpload(fetchImpl, { key, bytes: checked.data, mime: 'image/jpeg', fileName: 'start.jpg' });
  return { url, jpeg: checked.data };
}

export async function generatePhoto({ fetch: fetchImpl, key, model = PHOTO_MODEL, image, prompt, queue = falQueue }) {
  if (model !== PHOTO_MODEL) throw new AiError('ai_unavailable', 503);
  const { url } = await uploadStill(fetchImpl, key, image);
  const input = buildPulidInput({ prompt, referenceImageUrl: url });
  const result = await queue(fetchImpl, { key, model, input });
  const outUrl = result?.images?.[0]?.url;
  if (!outUrl) throw new AiError('generation_failed');
  const data = await download(fetchImpl, outUrl, 20 * 1024 * 1024);
  const checked = await validateImage(data);
  if (!checked.ok) throw new AiError('generation_failed');
  return { mime: 'image/jpeg', data: checked.data, model };
}

export async function generateVideo({ fetch: fetchImpl, key, photoModel: pModel = PHOTO_MODEL, videoModel: vModel = VIDEO_MODEL, image, promptStill, promptMotion, decorateStill, queue = falQueue }) {
  if (pModel !== PHOTO_MODEL || vModel !== VIDEO_MODEL) throw new AiError('ai_unavailable', 503);
  const still = await generatePhoto({ fetch: fetchImpl, key, model: pModel, image, prompt: promptStill, queue });
  let frame = still.data;
  let startUrl;
  if (decorateStill) {
    const next = await decorateStill(frame);
    const checked = await validateImage(next);
    if (!checked.ok) throw new AiError('invalid_media', 422);
    frame = checked.data;
    startUrl = await falUpload(fetchImpl, { key, bytes: frame, mime: 'image/jpeg', fileName: 'motion.jpg' });
  } else {
    startUrl = await falUpload(fetchImpl, { key, bytes: frame, mime: 'image/jpeg', fileName: 'motion.jpg' });
  }
  const input = buildWanImageToVideoInput({
    startImageUrl: startUrl,
    prompt: promptMotion,
    duration: 5,
    resolution: '1080p',
    aspectRatio: '9:16',
    audio: false,
    enableSafetyChecker: true,
  });
  const result = await queue(fetchImpl, { key, model: vModel, input });
  const videoUrl = result?.video?.url;
  if (!videoUrl) throw new AiError('generation_failed');
  const mp4 = await download(fetchImpl, videoUrl, 80 * 1024 * 1024);
  if (!assertMp4(mp4)) throw new AiError('generation_failed');
  return { mime: 'video/mp4', data: mp4, model: vModel, still: frame };
}

export function createProvider({ env = process.env, fetch: fetchImpl = globalThis.fetch } = {}) {
  const key = () => env.FAL_KEY || '';
  return {
    name: 'fal',
    etaSec,
    photoModel: () => env.FAL_PHOTO_MODEL || PHOTO_MODEL,
    videoModel: () => env.FAL_VIDEO_MODEL || VIDEO_MODEL,
    photo(tpl, faces, opts = {}) {
      return generatePhoto({ fetch: fetchImpl, key: key(), model: env.FAL_PHOTO_MODEL || PHOTO_MODEL, image: faces?.[0]?.img, prompt: stillPrompt(tpl, opts.prompt) });
    },
    video(tpl, faces, opts = {}) {
      return generateVideo({
        fetch: fetchImpl, key: key(),
        photoModel: env.FAL_PHOTO_MODEL || PHOTO_MODEL,
        videoModel: env.FAL_VIDEO_MODEL || VIDEO_MODEL,
        image: faces?.[0]?.img,
        promptStill: stillPrompt(tpl, opts.prompt),
        promptMotion: motionPrompt(tpl, opts.prompt),
        decorateStill: opts.decorateStill,
      });
    },
  };
}

const provider = createProvider();
export const photo = (...a) => provider.photo(...a);
export const video = (...a) => provider.video(...a);
