import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { acceptServerUrl } from '../www/device.js';
import { planSegments } from '../www/localexport.js';

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
