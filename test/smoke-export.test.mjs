import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ART = '/opt/cursor/artifacts';

async function waitHealth(base, child) {
  const t0 = Date.now();
  let err = '';
  while (Date.now() - t0 < 20000) {
    if (child.exitCode != null) throw new Error('server exited ' + child.exitCode + ' ' + err);
    try {
      const r = await fetch(base + '/api/health');
      if (r.ok) return r.json();
    } catch (e) { err = e.message; }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('health timeout ' + err);
}

test('create, edit, export, and social smoke without paid calls', { timeout: 180000 }, async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prico-smoke-'));
  const port = 18123;
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      PORT: String(port),
      DATA_DIR: dir,
      SEED: 'off',
      LOW_MEM: '1',
      PUBLIC_URL: base,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', d => { log += d; });
  child.stderr.on('data', d => { log += d; });
  const stop = () => { if (child.exitCode == null) child.kill('SIGTERM'); };
  try {
    const health = await waitHealth(base, child);
    assert.equal(health.ok, true);
    assert.equal(health.payments, 'postponed');
    assert.equal(health.ai.available, false);
    assert.equal(health.ai.reason, 'provider_off');
    assert.equal(health.capabilities.contract, 2);
    assert.equal(health.capabilities.generation, 'unavailable-or-real');
    assert.equal(health.capabilities.payments, 'postponed');
    assert.equal(health.ai.videoModel, 'alibaba/wan-3.0-prime/image-to-video');
    assert.equal(JSON.stringify(health).includes('FAL_KEY'), false);
    assert.equal(log.includes('postgres'), false);

    const api = async (p, { token, body, method, type, raw } = {}) => {
      const r = await fetch(base + p, {
        method: method || (body || raw ? 'POST' : 'GET'),
        headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(raw ? { 'Content-Type': type } : body ? { 'Content-Type': 'application/json' } : {}) },
        body: raw || (body ? JSON.stringify(body) : undefined),
      });
      const data = await r.json().catch(() => ({}));
      return { status: r.status, data };
    };
    const reg = async (name) => {
      const out = await api('/api/auth/register', { body: { email: `${name}-${Date.now()}@pricoai.test`, password: 'secret123', name } });
      assert.equal(out.status, 200, JSON.stringify(out.data));
      return out.data;
    };
    const a = await reg('Ada');
    const b = await reg('Bea');
    assert.equal(a.me.wallet.freeVideos, 3);

    const jpg = await sharp({ create: { width: 640, height: 960, channels: 3, background: '#224466' } }).jpeg().toBuffer();
    const face = await api('/api/faces', { token: a.token, body: { img: 'data:image/jpeg;base64,' + jpg.toString('base64'), consent: true } });
    assert.equal(face.status, 200, JSON.stringify(face.data));
    const cat = await api('/api/catalog', { token: a.token });
    const tpl = cat.data.templates.find(t => t.kind === 'video');
    const gen = await api('/api/generate', { token: a.token, body: { templateId: tpl.id, faceIds: [face.data.faces.at(-1).id] } });
    assert.equal(gen.status, tpl.faces > 1 ? 422 : 503);
    assert.equal(gen.data.error, tpl.faces > 1 ? 'multi_face_unsupported' : 'ai_unavailable');
    const single = cat.data.templates.find(t => t.identity === 'single' && t.faces === 1);
    const gen1 = await api('/api/generate', { token: a.token, body: { templateId: single.id, faceIds: [face.data.faces.at(-1).id, face.data.faces.at(-1).id] } });
    assert.equal(gen1.status, 503);
    assert.equal(gen1.data.error, 'ai_unavailable');
    const multi = cat.data.templates.find(t => t.identity === 'unsupported' && t.faces > 1);
    assert.ok(multi, 'catalog should mark multi-identity templates unsupported');
    const face2 = await api('/api/faces', { token: a.token, body: { img: 'data:image/jpeg;base64,' + jpg.toString('base64'), consent: true } });
    const ids = face2.data.faces.map(f => f.id);
    const genN = await api('/api/generate', { token: a.token, body: { templateId: multi.id, faceIds: ids } });
    assert.equal(genN.status, 422);
    assert.equal(genN.data.error, 'multi_face_unsupported');
    const me = await api('/api/me', { token: a.token });
    assert.equal(me.data.wallet.freeVideos, 3);
    assert.equal(me.data.wallet.credits, 0);

    const buy = await api('/api/shop/buy', { token: a.token, body: { productId: 'plus_month' } });
    assert.equal(buy.status, 503);
    assert.equal(buy.data.error, 'payments_postponed');
    const shop = await api('/api/shop', { token: a.token });
    assert.equal(shop.data.mode, 'postponed');
    assert.equal(shop.data.products.find(p => p.id === 'plus_month').price, 5.99);
    assert.equal(shop.data.products.find(p => p.id === 'plus_year').price, 39.99);
    const me2 = await api('/api/me', { token: a.token });
    assert.equal(me2.data.wallet.plus, false);

    const up = await api('/api/uploads', { token: a.token, raw: jpg, type: 'image/jpeg' });
    assert.equal(up.status, 200, JSON.stringify(up.data));
    const meta = await api('/api/editor/meta', { token: a.token });
    const musicId = meta.data.music[0].id;
    const project = {
      aspect: '9:16',
      clips: [
        { up: up.data.id, out: 1, kb: false, filter: 'vivid', trans: 'none' },
        { up: up.data.id, out: 1, kb: false, filter: 'warm', trans: 'fade' },
      ],
      texts: [{ text: 'PRICO edit', start: 0.1, end: 1.6, x: 0.5, y: 0.22, size: 64, color: '#ffffff', font: 'bold', anim: 'pop' }],
      captions: [{ text: 'local export', start: 0.2, end: 1.5 }],
      music: { id: musicId, vol: 0.35 },
    };
    const ed = await api('/api/edit', { token: a.token, body: { project } });
    assert.equal(ed.status, 200, JSON.stringify(ed.data));
    let job;
    for (let i = 0; i < 90; i++) {
      await new Promise(r => setTimeout(r, 1000));
      job = (await api('/api/jobs/' + ed.data.job.id, { token: a.token })).data.job;
      if (job.status === 'done' || job.status === 'error') break;
    }
    assert.equal(job.status, 'done', JSON.stringify(job));
    assert.equal(job.media.ai, false);
    assert.equal(job.media.local, true);
    assert.equal(job.media.type, 'video');
    const media = await fetch(base + job.media.url);
    const mp4 = Buffer.from(await media.arrayBuffer());
    assert.ok(mp4.length > 2000);
    assert.ok(mp4.subarray(0, 32).toString('latin1').includes('ftyp'));
    await fs.mkdir(ART, { recursive: true });
    await fs.writeFile(path.join(ART, 'prico-edit-smoke.mp4'), mp4);
    const poster = Buffer.from(await (await fetch(base + job.media.poster)).arrayBuffer());
    await fs.writeFile(path.join(ART, 'prico-edit-smoke.jpg'), poster);
    await fs.writeFile(path.join(ART, 'prico-smoke-report.json'), JSON.stringify({
      health: { ai: health.ai, payments: health.payments, version: health.version },
      generate: gen.data,
      buy: buy.data,
      edit: { status: job.status, duration: job.media.duration, local: job.media.local, ai: job.media.ai, bytes: mp4.length },
    }, null, 2));

    const post = await api('/api/posts', { token: a.token, body: { mediaId: job.media.id, caption: 'local edit smoke' } });
    assert.equal(post.status, 200, JSON.stringify(post.data));
    const like = await api('/api/posts/' + post.data.post.id + '/like', { token: b.token, body: {} });
    assert.equal(like.data.liked, true);
    assert.equal(like.data.likes, 1);
    const comment = await api('/api/posts/' + post.data.post.id + '/comments', { token: b.token, body: { text: 'nice cut' } });
    assert.equal(comment.status, 200);
    const follow = await api('/api/users/' + a.me.handle + '/follow', { token: b.token, body: {} });
    assert.equal(follow.data.user.isFollowing, true);
    const conv = await api('/api/convs', { token: a.token, body: { users: [b.me.handle] } });
    const msg = await api('/api/convs/' + conv.data.conv.id + '/messages', { token: a.token, body: { type: 'text', text: 'hello from smoke' } });
    assert.equal(msg.status, 200);
    const inbox = await api('/api/inbox', { token: b.token });
    assert.equal(inbox.data.items[0].last.text, 'hello from smoke');
    const live = await api('/api/lives', { token: a.token, body: { title: 'smoke live' } });
    assert.equal(live.status, 200);
    assert.ok(live.data.live.id);
    const end = await api('/api/lives/' + live.data.live.id + '/end', { token: a.token, body: {} });
    assert.equal(end.status, 200);
  } finally {
    stop();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
