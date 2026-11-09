import test from 'node:test';
import assert from 'node:assert/strict';
import { assessServer } from '../www/capabilities.js';
import { createProvider } from '../server/providers/fal.js';
import sharp from 'sharp';

const OLD_PRODUCTION = { ok: true, version: '1.1.0', provider: 'demo', payments: 'demo', store: 'postgres' };

test('an old demo health document is not treated as the safe contract', () => {
  const cap = assessServer(OLD_PRODUCTION);
  assert.equal(cap.generationSafe, false);
  assert.equal(cap.paymentsSafe, false);
  assert.equal(assessServer(null).generationSafe, false);
});

test('the current health contract allows the gated calls', () => {
  const cap = assessServer({ capabilities: { contract: 2, generation: 'unavailable-or-real', payments: 'postponed' }, ai: { available: false } });
  assert.equal(cap.generationSafe, true);
  assert.equal(cap.paymentsSafe, true);
  assert.equal(assessServer({ capabilities: { contract: 1, generation: 'unavailable-or-real', payments: 'postponed' } }).generationSafe, false);
});

test('two identity photos are refused before any provider request', async () => {
  let calls = 0;
  const img = await sharp({ create: { width: 320, height: 480, channels: 3, background: '#224466' } }).jpeg().toBuffer();
  const prov = createProvider({ env: { FAL_KEY: 'secret-value', AI_PROVIDER: 'fal' }, fetch: async () => { calls++; throw new Error('network'); } });
  await assert.rejects(() => prov.photo({ prompt: 'two people' }, [{ img }, { img }], {}), (e) => e.code === 'multi_face_unsupported');
  await assert.rejects(() => prov.video({ prompt: 'two people' }, [{ img }, { img }], {}), (e) => e.code === 'multi_face_unsupported');
  assert.equal(calls, 0);
  assert.equal(String(prov.photo).includes('secret-value'), false);
});
