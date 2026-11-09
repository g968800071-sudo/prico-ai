// Verified against the fal catalog on 2026-11-06. No live generation was run.
// Video: alibaba/wan-3.0-prime/image-to-video
//   required: start_image_url (string)
//   duration: integer 2–30, default 5 (not a string)
//   resolution: 480p | 720p | 1080p, default 1080p
//   aspect_ratio: adaptive | 16:9 | 4:3 | 1:1 | 3:4 | 9:16, default adaptive
//   audio: boolean, default true — this app sends false
//   enable_safety_checker: boolean, default true
//   prompt: string | null, max 20000
// Photo: fal-ai/flux-pulid
//   required: prompt, reference_image_url
//   image_size: {width,height} each 1–14142, or a named enum
//   num_inference_steps: integer 1–50
//   id_weight: number 0–1
//   enable_safety_checker: boolean, default true

export const VERIFIED_AT = '2026-11-06';
export const VIDEO_MODEL = 'alibaba/wan-3.0-prime/image-to-video';
export const PHOTO_MODEL = 'fal-ai/flux-pulid';
export const RESOLUTIONS = ['480p', '720p', '1080p'];
export const ASPECTS = ['adaptive', '16:9', '4:3', '1:1', '3:4', '9:16'];

export class ContractError extends Error {
  constructor(message) { super(message); this.code = 'invalid_media'; }
}

const httpsUrl = (value, label) => {
  let u;
  try { u = new URL(String(value || '')); } catch { throw new ContractError(label); }
  if (u.protocol !== 'https:') throw new ContractError(label);
  return u.toString();
};

export function buildWanImageToVideoInput({ startImageUrl, prompt = '', duration = 5, resolution = '1080p', aspectRatio = '9:16', audio = false, enableSafetyChecker = true } = {}) {
  const start_image_url = httpsUrl(startImageUrl, 'start_image_url');
  if (!Number.isInteger(duration) || duration < 2 || duration > 30) throw new ContractError('duration');
  if (!RESOLUTIONS.includes(resolution)) throw new ContractError('resolution');
  if (!ASPECTS.includes(aspectRatio)) throw new ContractError('aspect_ratio');
  if (typeof audio !== 'boolean') throw new ContractError('audio');
  if (enableSafetyChecker !== true) throw new ContractError('safety');
  const text = String(prompt || '').slice(0, 20000);
  return {
    start_image_url,
    prompt: text || null,
    duration,
    resolution,
    aspect_ratio: aspectRatio,
    audio,
    enable_safety_checker: true,
  };
}

export function buildPulidInput({ prompt, referenceImageUrl, width = 768, height = 1365, steps = 20, idWeight = 1, enableSafetyChecker = true } = {}) {
  const reference_image_url = httpsUrl(referenceImageUrl, 'reference_image_url');
  const text = String(prompt || '').trim().slice(0, 4000);
  if (!text) throw new ContractError('prompt');
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 14142 || height > 14142) throw new ContractError('image_size');
  if (!Number.isInteger(steps) || steps < 1 || steps > 50) throw new ContractError('steps');
  if (typeof idWeight !== 'number' || idWeight < 0 || idWeight > 1) throw new ContractError('id_weight');
  if (enableSafetyChecker !== true) throw new ContractError('safety');
  return {
    prompt: text,
    reference_image_url,
    image_size: { width, height },
    num_inference_steps: steps,
    id_weight: idWeight,
    enable_safety_checker: true,
  };
}

export function stillPrompt(tpl, userPrompt) {
  return [tpl?.prompt, userPrompt, 'vertical portrait, high quality, safe for work'].filter(Boolean).join(', ').slice(0, 4000);
}
export function motionPrompt(tpl, userPrompt) {
  return [tpl?.prompt, userPrompt, 'vertical 9:16, natural motion, safe for work'].filter(Boolean).join(', ').slice(0, 4000);
}
