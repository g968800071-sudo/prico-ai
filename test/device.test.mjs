import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { acceptServerUrl } from '../www/device.js';
import { planSegments, mp4HeaderOk } from '../www/localexport.js';

test('the old public demo host is refused and an empty address stays empty', () => {
  assert.equal(acceptServerUrl('https://prico-ai.onrender.com').ok, false);
  assert.equal(acceptServerUrl('https://prico-ai.onrender.com').reason, 'blocked_host');
  assert.equal(acceptServerUrl('').ok, false);
  assert.equal(acceptServerUrl('http://10.0.2.2:18181').ok, true);
  const staged = JSON.parse(fs.readFileSync(new URL('../www/server.json', import.meta.url), 'utf8'));
  assert.equal(staged.apiBase, '');
});

test('on-device edit plan keeps every clip and caps the length', () => {
  const plan = planSegments([{ dur: 3 }, { dur: 3 }, { dur: 3 }], 0.3);
  assert.equal(plan.segments.length, 3);
  assert.ok(plan.total < 9);
  assert.ok(plan.total > 4);
  assert.equal(planSegments([]).segments.length, 0);
});

test('an MP4 header is not a WebM file with a new extension', () => {
  const mp4 = Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
  const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x66, 0x74, 0x79, 0x70]);
  assert.equal(mp4HeaderOk(mp4), true);
  assert.equal(mp4HeaderOk(webm), false);
  assert.equal(mp4HeaderOk(Buffer.from('not a media file')), false);
});
