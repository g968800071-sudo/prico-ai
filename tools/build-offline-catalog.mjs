// Writes the on-phone catalog. Music and preview files are copied by tools/stage-mobile.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const raw = JSON.parse(fs.readFileSync(path.join(root, 'server/templates.json'), 'utf8'));
const music = JSON.parse(fs.readFileSync(path.join(root, 'assets/music/SOURCES.json'), 'utf8'));
const stickers = fs.readdirSync(path.join(root, 'www/stickers')).filter(f => f.endsWith('.svg')).map(f => f.slice(0, -4));
const CAT = { happy: 'pop', party: 'pop', dance: 'dance', hype: 'hype', fitness: 'hype', sport: 'hype', cool: 'hype', chill: 'chill', nostalgia: 'chill', food: 'chill', travel: 'chill', business: 'chill', love: 'love', funny: 'funny', epic: 'epic', holiday: 'holiday', world: 'world' };
const niches = [
  ['funny', '😂', 'toon'], ['travel', '✈️', 'summer'], ['food', '🍕', 'food'], ['fitness', '💪', 'trap'],
  ['business', '💼', 'corporate'], ['birthday', '🎂', 'birthday'], ['love', '💖', 'love'], ['vlog', '🎥', 'lofi'],
].map(([id, emoji, musicId]) => ({ id, emoji, music: musicId }));
const templates = raw.templates.filter(t => t.id && t.kind && t.name).map(t => {
  const faces = t.kind === 'video' ? (t.faces || 1) : 1;
  return { id: t.id, kind: t.kind, group: t.group, emoji: t.emoji || '', faces, identity: faces > 1 ? 'unsupported' : 'single', name: t.name, preview: `offline/previews/${t.id}.jpg`, cost: 0, hot: !!t.hot, isNew: !!t.isNew };
});
const out = {
  groups: raw.groups || {},
  templates,
  challenge: raw.challenges?.[0] ? { day: 'device', name: raw.challenges[0].name || { en: 'On this phone' }, tpl: raw.challenges[0].tpl } : null,
  niches,
  music: music.tracks.map(t => ({ id: t.id, name: t.name, bpm: t.bpm, mood: t.mood, cat: CAT[t.mood] || 'pop', url: `offline/music/${t.id}.m4a` })),
  musicCats: ['pop', 'dance', 'hype', 'chill', 'love', 'funny', 'epic', 'holiday', 'world'],
  stickers,
  photoModel: 'fal-ai/flux-pulid',
  videoModel: 'alibaba/wan-3.0-prime/image-to-video',
};
const dest = path.join(root, 'www/offline/catalog.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out));
console.log('offline catalog', templates.length, 'templates', out.music.length, 'tracks');
