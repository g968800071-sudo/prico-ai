// On-phone mode. An empty server address stays on the device. The old public demo host is refused.
import { assessServer } from './capabilities.js';

export function acceptServerUrl(raw) {
  const url = String(raw || '').trim().replace(/\/$/, '');
  if (!/^https?:\/\/[^/\s]+(?::\d+)?$/.test(url)) return { ok: false, reason: 'bad_url' };
  if (/prico-ai\.onrender\.com/i.test(url)) return { ok: false, reason: 'blocked_host' };
  return { ok: true, url };
}

export async function loadOfflineCatalog(language = 'en') {
  const r = await fetch('offline/catalog.json', { cache: 'no-store' });
  if (!r.ok) throw Object.assign(new Error('offline_catalog'), { code: 'offline_catalog' });
  const raw = await r.json();
  const name = v => !v || typeof v === 'string' ? (v || '') : (v[language] || v.en || Object.values(v)[0] || '');
  return {
    groups: Object.fromEntries(Object.entries(raw.groups || {}).map(([k, v]) => [k, name(v)])),
    templates: (raw.templates || []).map(t => ({ ...t, name: name(t.name) })),
    challenge: raw.challenge ? { ...raw.challenge, name: name(raw.challenge.name) } : null,
    niches: raw.niches || [],
    music: raw.music || [],
    musicCats: raw.musicCats || [],
    stickers: raw.stickers || [],
    provider: 'device',
    ai: { available: false, reason: 'device', photoModel: raw.photoModel, videoModel: raw.videoModel },
    device: true,
  };
}

export async function probeServer(url) {
  const gate = acceptServerUrl(url);
  if (!gate.ok) return gate;
  let health;
  try {
    const r = await fetch(gate.url + '/api/health', { cache: 'no-store' });
    health = await r.json();
    if (!r.ok) return { ok: false, reason: 'unreachable' };
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
  const cap = assessServer(health);
  if (!cap.generationSafe || !cap.paymentsSafe) return { ok: false, reason: 'unsafe_server', health };
  return { ok: true, url: gate.url, health };
}
