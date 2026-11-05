// PRICO AI template catalog — data-driven. Source of truth: server/templates.json
// (generated from tools/templates.src.mjs). New trends can be shipped WITHOUT a code deploy:
//   * set TEMPLATES_URL to a JSON file with the same shape (fetched at boot and every 30 min), or
//   * POST /api/admin/templates with header X-Admin-Token: $ADMIN_TOKEN.
// Each template: { id, kind: photo|video, group, emoji, scene, filter?, motion?, music?, faces?, title?{lang}, name{lang}, prompt, hot?, isNew? }
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const DIR = path.dirname(fileURLToPath(import.meta.url));
export const LANGS = ['en', 'ru', 'uk', 'es', 'pt', 'de', 'fr', 'tr', 'ar', 'hi', 'id'];

let data = JSON.parse(fs.readFileSync(path.join(DIR, 'templates.json'), 'utf8'));
export let ALL = [], PHOTO = [], VIDEO = [], GROUPS = {}, CHALLENGES = [];
const SCENES = new Set(fs.readdirSync(path.join(DIR, '../assets/bg')).map(f => f.replace(/\.jpg$/, '')));
export function load(d) {
  if (!d || !Array.isArray(d.templates)) throw new Error('bad templates json');
  const tpls = d.templates.filter(t => t.id && t.kind && t.name && (SCENES.has(t.scene) || (t.scene = 'space')));
  data = d; ALL = tpls; PHOTO = tpls.filter(t => t.kind === 'photo'); VIDEO = tpls.filter(t => t.kind === 'video');
  GROUPS = d.groups || {}; CHALLENGES = (d.challenges || []).filter(c => tpls.some(t => t.id === c.tpl));
  return tpls.length;
}
load(data);
export const byId = id => ALL.find(t => t.id === id);
export const loc = (obj, lang) => obj ? (obj[lang] || obj.en || obj.ru || Object.values(obj)[0]) : '';
export const raw = () => data;

export async function refreshRemote() {
  const u = process.env.TEMPLATES_URL; if (!u) return;
  try { const r = await fetch(u); if (r.ok) console.log('[templates] remote', load(await r.json())); } catch (e) { console.warn('[templates] remote failed', e.message); }
}
if (process.env.TEMPLATES_URL) { refreshRemote(); setInterval(refreshRemote, 30 * 60000).unref(); }

export function todayChallenge(d = new Date()) {
  const day = d.toISOString().slice(0, 10);
  const n = Math.floor(Date.parse(day) / 86400000);
  return { day, ...CHALLENGES[n % CHALLENGES.length] };
}
