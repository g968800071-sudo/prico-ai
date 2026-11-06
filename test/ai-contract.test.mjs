import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { PHOTO_MODEL, VIDEO_MODEL, buildPulidInput, buildWanImageToVideoInput } from '../server/providers/contract.js';
import { AiError, falQueue, generatePhoto, generateVideo, redact } from '../server/providers/fal.js';
import { status } from '../server/providers/index.js';
import { assertMp4, validateImage } from '../server/media-validate.js';
import * as payments from '../server/payments.js';

const SECRET = 'super-secret-key-xyz';
const jpeg = () => sharp({ create: { width: 320, height: 480, channels: 3, background: '#336699' } }).jpeg().toBuffer();

test('Wan image-to-video input matches the verified schema', () => {
  const input = buildWanImageToVideoInput({
    startImageUrl: 'https://v3.fal.media/files/start.jpg',
    prompt: 'a person waves',
    duration: 5,
    resolution: '1080p',
    aspectRatio: '9:16',
    audio: false,
  });
  assert.deepEqual(input, {
    start_image_url: 'https://v3.fal.media/files/start.jpg',
    prompt: 'a person waves',
    duration: 5,
    resolution: '1080p',
    aspect_ratio: '9:16',
    audio: false,
    enable_safety_checker: true,
  });
  assert.equal(typeof input.duration, 'number');
  assert.equal(VIDEO_MODEL, 'alibaba/wan-3.0-prime/image-to-video');
});

test('Wan builder rejects a string duration, bad size, http URL, and safety off', () => {
  const ok = { startImageUrl: 'https://v3.fal.media/files/start.jpg' };
  assert.throws(() => buildWanImageToVideoInput({ ...ok, duration: '5' }));
  assert.throws(() => buildWanImageToVideoInput({ ...ok, duration: 1 }));
  assert.throws(() => buildWanImageToVideoInput({ ...ok, duration: 31 }));
  assert.throws(() => buildWanImageToVideoInput({ ...ok, resolution: '4k' }));
  assert.throws(() => buildWanImageToVideoInput({ ...ok, aspectRatio: '21:9' }));
  assert.throws(() => buildWanImageToVideoInput({ ...ok, audio: 'false' }));
  assert.throws(() => buildWanImageToVideoInput({ ...ok, enableSafetyChecker: false }));
  assert.throws(() => buildWanImageToVideoInput({ startImageUrl: 'http://cdn.example/a.jpg' }));
});

test('PuLID input keeps safety on and a 9:16 still size', () => {
  const input = buildPulidInput({ prompt: 'portrait', referenceImageUrl: 'https://v3.fal.media/files/face.jpg' });
  assert.equal(input.prompt, 'portrait');
  assert.equal(input.reference_image_url, 'https://v3.fal.media/files/face.jpg');
  assert.deepEqual(input.image_size, { width: 768, height: 1365 });
  assert.equal(input.num_inference_steps, 20);
  assert.equal(input.id_weight, 1);
  assert.equal(input.enable_safety_checker, true);
  assert.equal(PHOTO_MODEL, 'fal-ai/flux-pulid');
  assert.throws(() => buildPulidInput({ prompt: '', referenceImageUrl: 'https://v3.fal.media/files/face.jpg' }));
  assert.throws(() => buildPulidInput({ prompt: 'x', referenceImageUrl: 'https://v3.fal.media/files/face.jpg', enableSafetyChecker: false }));
});

test('provider status never echoes the key and stays unavailable without one', () => {
  const on = status({ AI_PROVIDER: 'fal', FAL_KEY: SECRET });
  assert.equal(on.available, true);
  assert.equal(on.videoModel, VIDEO_MODEL);
  assert.equal(JSON.stringify(on).includes(SECRET), false);
  assert.equal(status({}).available, false);
  assert.equal(status({}).reason, 'provider_off');
  assert.equal(status({ AI_PROVIDER: 'fal' }).reason, 'missing_key');
  assert.equal(status({ AI_PROVIDER: 'fal', FAL_KEY: SECRET, FAL_VIDEO_MODEL: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video' }).reason, 'model_unverified');
  assert.equal(status({ AI_PROVIDER: 'demo', FAL_KEY: SECRET }).available, false);
});

test('payments are postponed and do not grant anything', async () => {
  const u = { credits: 1, freeVideos: 3, coins: 0, purchases: [], trialUsed: false };
  await assert.rejects(() => payments.buy(u, 'plus_month'), (e) => e.message === 'payments_postponed' && e.code === 503);
  await assert.rejects(() => payments.buy(u, 'plus_year'), (e) => e.message === 'payments_postponed');
  await assert.rejects(() => payments.buy(u, 'coins_70'), (e) => e.message === 'payments_postponed');
  await assert.rejects(() => payments.buy(u, 'plus_trial'), (e) => e.message === 'payments_postponed');
  assert.equal(payments.mode(), 'postponed');
  assert.equal(u.credits, 1);
  assert.equal(u.coins, 0);
  assert.equal(u.trialUsed, false);
  assert.equal(u.purchases.length, 0);
  assert.equal(u.plus, undefined);
});

test('image validation accepts a jpeg and rejects text', async () => {
  const ok = await validateImage(await jpeg());
  assert.equal(ok.ok, true);
  assert.equal(ok.mime, 'image/jpeg');
  const bad = await validateImage(Buffer.from('not an image'));
  assert.equal(bad.ok, false);
  const tiny = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#000' } }).jpeg().toBuffer();
  assert.equal((await validateImage(tiny)).ok, false);
  const mp4 = Buffer.alloc(1200);
  mp4.write('ftyp', 4);
  assert.equal(assertMp4(mp4), true);
  assert.equal(assertMp4(Buffer.from('ftyp')), false);
});

test('missing key does not call the network', async () => {
  let calls = 0;
  const fetch = async () => { calls++; throw new Error('should not fetch'); };
  const image = await jpeg();
  await assert.rejects(() => generatePhoto({ fetch, key: '', image, prompt: 'portrait' }), (e) => e instanceof AiError && e.code === 'ai_unavailable');
  assert.equal(calls, 0);
});

test('invalid media is rejected before upload', async () => {
  let calls = 0;
  const fetch = async () => { calls++; };
  await assert.rejects(() => generatePhoto({ fetch, key: SECRET, image: Buffer.from('hello'), prompt: 'portrait' }), (e) => e.code === 'invalid_media');
  assert.equal(calls, 0);
});

test('billing failure is ai_exhausted and the key is redacted', async () => {
  const fetch = async (url) => {
    assert.equal(String(url).includes(SECRET), false);
    return { ok: false, status: 402, text: async () => `Exhausted balance ${SECRET}` };
  };
  const image = await jpeg();
  await assert.rejects(() => generatePhoto({ fetch, key: SECRET, image, prompt: 'portrait' }), (e) => e.code === 'ai_exhausted' && e.message === 'ai_exhausted');
  assert.equal(redact(`Key ${SECRET} Exhausted`, SECRET).includes(SECRET), false);
});

function mockFal(jpegBytes, seen) {
  const mp4 = Buffer.alloc(1500);
  mp4.write('ftypisom', 4);
  return async (url, opt = {}) => {
    const u = String(url);
    seen.urls.push(u);
    if (opt.headers?.Authorization) seen.auth.add(opt.headers.Authorization);
    if (opt.body && u.includes('wan-3.0-prime')) seen.wan = JSON.parse(opt.body);
    if (opt.body && u.includes('flux-pulid')) seen.photo = JSON.parse(opt.body);
    const json = (obj, status = 200) => ({ ok: status < 300, status, text: async () => JSON.stringify(obj), json: async () => obj, arrayBuffer: async () => Buffer.from(JSON.stringify(obj)) });
    if (u.includes('/storage/upload/initiate')) return json({ upload_url: 'https://v3.fal.media/upload/put', file_url: 'https://v3.fal.media/files/start.jpg' });
    if (u.includes('/upload/put')) return { ok: true, status: 200, text: async () => '', json: async () => ({}), arrayBuffer: async () => Buffer.alloc(0) };
    if (u.includes('fal-ai/flux-pulid')) return json({ status_url: 'https://queue.fal.run/status/photo', response_url: 'https://queue.fal.run/response/photo' });
    if (u.includes('wan-3.0-prime')) return json({ status_url: 'https://queue.fal.run/status/video', response_url: 'https://queue.fal.run/response/video' });
    if (u.endsWith('/status/photo') || u.endsWith('/status/video')) return json({ status: 'COMPLETED' });
    if (u.endsWith('/response/photo')) return json({ images: [{ url: 'https://v3.fal.media/files/out.jpg' }] });
    if (u.endsWith('/response/video')) return json({ video: { url: 'https://v3.fal.media/files/out.mp4' }, duration: 5, seed: 1 });
    if (u.endsWith('/out.jpg')) return { ok: true, status: 200, text: async () => '', arrayBuffer: async () => jpegBytes };
    if (u.endsWith('/out.mp4')) return { ok: true, status: 200, text: async () => '', arrayBuffer: async () => mp4 };
    if (u.includes('169.254.169.254')) { seen.ssrf = true; return { ok: true, status: 200, arrayBuffer: async () => jpegBytes, text: async () => '' }; }
    throw new Error('unexpected ' + u);
  };
}

test('mocked photo and video jobs send the verified contract and not the key', async () => {
  const image = await jpeg();
  const seen = { urls: [], auth: new Set() };
  const fetch = mockFal(image, seen);
  const photo = await generatePhoto({ fetch, key: SECRET, image, prompt: 'portrait of me' });
  assert.equal(photo.mime, 'image/jpeg');
  assert.equal(photo.model, PHOTO_MODEL);
  assert.equal(seen.photo.reference_image_url, 'https://v3.fal.media/files/start.jpg');
  assert.equal(seen.photo.enable_safety_checker, true);
  assert.equal(JSON.stringify(seen.photo).includes(SECRET), false);
  const video = await generateVideo({ fetch, key: SECRET, image, promptStill: 'portrait of me', promptMotion: 'waves hello' });
  assert.equal(video.mime, 'video/mp4');
  assert.equal(video.model, VIDEO_MODEL);
  assert.equal(seen.wan.duration, 5);
  assert.equal(typeof seen.wan.duration, 'number');
  assert.equal(seen.wan.resolution, '1080p');
  assert.equal(seen.wan.aspect_ratio, '9:16');
  assert.equal(seen.wan.audio, false);
  assert.equal(seen.wan.enable_safety_checker, true);
  assert.equal(seen.wan.start_image_url.startsWith('https://'), true);
  assert.equal(JSON.stringify(seen.wan).includes(SECRET), false);
  assert.deepEqual([...seen.auth], [`Key ${SECRET}`]);
  assert.equal(assertMp4(video.data), true);
});

test('a private result URL is not fetched', async () => {
  const seen = { ssrf: false };
  const fetch = async (url) => {
    const u = String(url);
    if (u.includes('initiate')) return { ok: true, status: 200, text: async () => JSON.stringify({ upload_url: 'https://v3.fal.media/upload/put', file_url: 'https://v3.fal.media/files/start.jpg' }) };
    if (u.includes('/upload/put')) return { ok: true, status: 200, text: async () => '' };
    if (u.includes('flux-pulid')) return { ok: true, status: 200, text: async () => JSON.stringify({ status_url: 'https://queue.fal.run/status/photo', response_url: 'https://queue.fal.run/response/photo' }) };
    if (u.endsWith('/status/photo')) return { ok: true, status: 200, text: async () => JSON.stringify({ status: 'COMPLETED' }) };
    if (u.endsWith('/response/photo')) return { ok: true, status: 200, json: async () => ({ images: [{ url: 'http://169.254.169.254/latest' }] }), text: async () => '' };
    seen.ssrf = true;
    throw new Error('fetched ' + u);
  };
  const image = await jpeg();
  await assert.rejects(() => generatePhoto({ fetch, key: SECRET, image, prompt: 'portrait' }), (e) => e.code === 'generation_failed');
  assert.equal(seen.ssrf, false);
});

test('queue timeout becomes generation_failed without the response body', async () => {
  let n = 0;
  const fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify(n++ === 0 ? { status_url: 'https://queue.fal.run/status/x', response_url: 'https://queue.fal.run/response/x' } : { status: 'IN_PROGRESS' }) });
  await assert.rejects(() => falQueue(fetch, { key: SECRET, model: VIDEO_MODEL, input: { prompt: 'x' }, timeoutMs: 5, pollMs: 1, sleepImpl: async () => {} }), (e) => e.code === 'generation_failed' && e.message === 'generation_failed');
});
