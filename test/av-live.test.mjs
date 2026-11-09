import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function waitHealth(base, child) {
  const t0 = Date.now();
  let err = '';
  while (Date.now() - t0 < 20000) {
    if (child.exitCode != null) throw new Error('server exited ' + child.exitCode + ' ' + err);
    try { const r = await fetch(base + '/api/health'); if (r.ok) return r.json(); } catch (e) { err = e.message; }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('health timeout ' + err);
}
function wsConnect(base, token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(base.replace(/^http/, 'ws') + '/ws?token=' + encodeURIComponent(token));
    const timer = setTimeout(() => reject(new Error('ws timeout')), 8000);
    ws.addEventListener('message', ev => {
      const m = JSON.parse(ev.data);
      if (m.t === 'hello') { clearTimeout(timer); resolve(ws); }
    });
    ws.addEventListener('error', () => reject(new Error('ws error')));
  });
}

test('a real template stays unavailable and LIVE relays synthetic frames plus audio', { timeout: 60000 }, async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prico-live-'));
  const port = 18127;
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: { PATH: process.env.PATH, HOME: process.env.HOME, PORT: String(port), DATA_DIR: dir, SEED: 'off', LOW_MEM: '1', PUBLIC_URL: base },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stop = () => { if (child.exitCode == null) child.kill('SIGTERM'); };
  try {
    const health = await waitHealth(base, child);
    assert.equal(health.ai.available, false);
    const api = async (p, { token, body, method } = {}) => {
      const r = await fetch(base + p, { method: method || (body ? 'POST' : 'GET'), headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
      return { status: r.status, data: await r.json().catch(() => ({})) };
    };
    const stamp = Date.now().toString(36);
    const a = await api('/api/auth/register', { body: { email: `ada-${stamp}@pricoai.test`, password: 'secret123', name: 'Ada Live' } });
    const b = await api('/api/auth/register', { body: { email: `bea-${stamp}@pricoai.test`, password: 'secret123', name: 'Bea Live' } });
    assert.equal(a.status, 200);
    const before = a.data.me.wallet.freeVideos;
    const cat = await api('/api/catalog', { token: a.data.token });
    const tpl = cat.data.templates.find(t => t.kind === 'video' && t.faces === 1 && t.identity === 'single');
    assert.ok(tpl, 'catalog has a single-face video template');
    const jpg = await sharp({ create: { width: 320, height: 320, channels: 3, background: '#336699' } }).jpeg().toBuffer();
    const face = await api('/api/faces', { token: a.data.token, body: { img: 'data:image/jpeg;base64,' + jpg.toString('base64'), consent: true } });
    assert.equal(face.status, 200, JSON.stringify(face.data));
    const gen = await api('/api/generate', { token: a.data.token, body: { templateId: tpl.id, faceIds: [face.data.faces.at(-1).id] } });
    assert.equal(gen.status, 503);
    assert.equal(gen.data.error, 'ai_unavailable');
    assert.equal(gen.data.job, undefined);
    const after = await api('/api/me', { token: a.data.token });
    assert.equal(after.data.wallet.freeVideos, before);
    assert.equal(after.data.wallet.credits, 0);
    const made = await api('/api/lives', { token: a.data.token, body: { title: 'relay' } });
    const id = made.data.live.id;
    const host = await wsConnect(base, a.data.token);
    const viewer = await wsConnect(base, b.data.token);
    const got = { frames: 0, audio: 0 };
    viewer.addEventListener('message', ev => {
      const m = JSON.parse(ev.data);
      if (m.t === 'live:frame') got.frames++;
      if (m.t === 'live:audio') got.audio++;
    });
    host.send(JSON.stringify({ t: 'live:host', live: id }));
    viewer.send(JSON.stringify({ t: 'live:join', live: id }));
    await new Promise(r => setTimeout(r, 200));
    viewer.send(JSON.stringify({ t: 'live:fb' }));
    await new Promise(r => setTimeout(r, 100));
    const jpeg = 'data:image/jpeg;base64,' + jpg.toString('base64');
    for (let i = 0; i < 4; i++) host.send(JSON.stringify({ t: 'live:frame', d: jpeg }));
    const pcm = Buffer.alloc(640);
    for (let i = 0; i < 320; i++) pcm.writeInt16LE(Math.round(Math.sin(i / 5) * 8000), i * 2);
    const audio = pcm.toString('base64');
    for (let i = 0; i < 4; i++) host.send(JSON.stringify({ t: 'live:audio', d: audio, seq: i }));
    await new Promise(r => setTimeout(r, 300));
    const room = await api('/api/lives/' + id, { token: a.data.token });
    assert.ok(got.frames >= 3, 'viewer frames ' + got.frames);
    assert.ok(got.audio >= 3, 'viewer audio ' + got.audio);
    assert.ok(room.data.live.relay.frames >= 3);
    assert.ok(room.data.live.relay.audioBytes > 100);
    host.close(); viewer.close();
  } finally {
    stop();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
