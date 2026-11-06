// Generation provider. Demo compositing is never selected here.
import { createProvider } from './fal.js';
import { PHOTO_MODEL, VIDEO_MODEL } from './contract.js';

export function status(env = process.env) {
  const provider = String(env.AI_PROVIDER || '').toLowerCase();
  const key = typeof env.FAL_KEY === 'string' ? env.FAL_KEY.trim() : '';
  const photoModel = env.FAL_PHOTO_MODEL || PHOTO_MODEL;
  const videoModel = env.FAL_VIDEO_MODEL || VIDEO_MODEL;
  const supported = photoModel === PHOTO_MODEL && videoModel === VIDEO_MODEL;
  const base = { photoModel, videoModel };
  if (provider === 'fal' && key && supported) return { available: true, provider: 'fal', reason: null, ...base };
  let reason = 'provider_off';
  if (provider === 'fal' && !key) reason = 'missing_key';
  else if (provider === 'fal' && key && !supported) reason = 'model_unverified';
  return { available: false, provider: 'unconfigured', reason, ...base };
}

export function current(env = process.env) {
  if (!status(env).available) return null;
  return createProvider({ env });
}
