// Showcase content so a fresh install has a lively feed. Idempotent (db.meta.seedV).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import * as store from './store.js';
import { todayChallenge } from './catalog.js';
const { db, id, save } = store;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEED_V = 2;

const USERS = [
  { key: 'prico', name: 'PRICO AI', handle: 'pricoai', bio: 'Official ✨ Make yourself the star', face: 1, official: true },
  { key: 'mila', name: 'Mila Wave', handle: 'mila.wave', bio: 'memes & summer vibes 🦩', face: 2 },
  { key: 'dan', name: 'Dan Funny', handle: 'dan_fun', bio: 'daily dumb ideas 😂', face: 1 },
  { key: 'sofia', name: 'Sofia Travels', handle: 'sofia.travel', bio: '✈️ 32 countries', face: 3 },
  { key: 'kenji', name: 'Kenji', handle: 'kenji.toon', bio: 'anime everything', face: 2 },
  { key: 'amara', name: 'Amara', handle: 'amara.fit', bio: 'gym → reels → repeat 💪', face: 3 },
];
const POSTS = [
  ['mila', 'v_flamingo', 'pool day with my new friend 🦩☀️ #summer #fyp', 412, 1],
  ['dan', 'v_entrance', 'how I walk in after fixing one bug 😎 #funny #pov', 655],
  ['prico', 'reel_travel', 'Made with the Reels maker in 10 seconds ✨ #reels #travel', 820],
  ['kenji', 'p_ghibli', 'studio vibes 🌿 #ghibli #anime', 377],
  ['amara', 'p_muscle', 'when the pre-workout kicks in 💪😂 #gym', 290, 1],
  ['dan', 'p_meme', 'me on monday 💀 #meme', 540],
  ['sofia', 'p_paris', 'Paris, finally 🗼 #travel', 233],
  ['mila', 'v_viggle', 'dance trend but make it me 🪩 #dance #trend', 701, 1],
  ['kenji', 'p_figure', 'my action figure dropped 📦 #actionfigure', 466],
  ['prico', 'v_tank', 'я танкист в PRICOPBUM 💥 #tank #pricopbum', 388],
  ['sofia', 'v_hug', 'best friends forever 🤗 #friends', 310],
  ['dan', 'v_zombie', 'me after 3 hours of sleep 🧟 #funny', 598, 1],
  ['amara', 'reel_funny', 'productivity era 📈😂 #reels #funny', 444],
  ['kenji', 'v_elf', 'elf squad 🎄 #christmas', 257],
  ['mila', 'p_doll', 'boxed and ready 💖 #doll #trend', 351],
  ['prico', 'v_oldphoto', 'bring old photos to life 📜 #oldphoto', 205],
  ['sofia', 'm_inflate', 'when someone says "just one more pizza" 🎈 #meme', 488],
  ['amara', 'p_hero', 'superhero mode on 🦸 #hero', 199],
  ['dan', 'v_trio', 'us in the parking lot at 2am 😂 #friends', 372],
  ['kenji', 'p_baby', 'baby me 👶 #baby #ai', 266],
];
const COMMENTS = ['😂😂😂', 'how did you make this?!', 'need this for my profile', 'the face is so real lol', '🔥🔥', 'tutorial pls', 'I did it too!!', 'LMAO', 'this app is crazy', '❤️'];

export async function seed() {
  if (process.env.SEED === 'off' || db.meta.seedV === SEED_V) return;
  const t0 = Date.now();
  const uids = {};
  for (const s of USERS) {
    let u = Object.values(db.users).find(x => x.handle === s.handle);
    if (!u) {
      const face = await fs.readFile(path.join(ROOT, `assets/seed/face${s.face}.jpg`));
      const av = await sharp(face).resize(256, 256, { fit: 'cover', position: 'attention' }).modulate({ hue: (s.key.charCodeAt(0) * 37) % 60 - 30 }).jpeg({ quality: 82 }).toBuffer();
      u = { id: id(8), email: null, pw: null, name: s.name, handle: s.handle, bio: s.bio, lang: 'en', createdAt: Date.now() - 30 * 864e5, freeVideos: 0, credits: 0, faces: [], seed: true, official: !!s.official, avatar: await store.putBlob(av, 'image/jpeg'), onboarded: true };
      db.users[u.id] = u;
    }
    uids[s.key] = u.id;
  }
  const keys = Object.keys(uids);
  for (const a of keys) for (const b of keys) if (a !== b && (a.length + b.length) % 3 !== 0) db.follows[uids[a] + ':' + uids[b]] = Date.now();
  const day = todayChallenge().day;
  for (let i = 0; i < POSTS.length; i++) {
    const [uk, file, caption, likes, ch] = POSTS[i];
    if (Object.values(db.posts).some(p => p.seedKey === file)) continue;
    const isVid = await fs.access(path.join(ROOT, `assets/seedmedia/${file}.mp4`)).then(() => true, () => false);
    let blob, poster;
    try {
      if (isVid) { blob = await store.putBlob(await fs.readFile(path.join(ROOT, `assets/seedmedia/${file}.mp4`)), 'video/mp4'); poster = await store.putBlob(await fs.readFile(path.join(ROOT, `assets/seedmedia/${file}.jpg`)), 'image/jpeg'); }
      else blob = await store.putBlob(await fs.readFile(path.join(ROOT, `assets/seedmedia/${file}.jpg`)), 'image/jpeg');
    } catch { continue; }
    const mid = id(10), pid = id(9), uid = uids[uk];
    const reel = file.startsWith('reel_');
    db.media[mid] = { id: mid, uid, type: isVid ? 'video' : 'photo', blob, poster, tpl: reel ? null : file, reel, niche: reel ? file.slice(5) : null, createdAt: Date.now() - i * 3.1e6, post: pid };
    db.posts[pid] = { id: pid, uid, media: mid, tpl: reel ? null : file, reel, caption, createdAt: Date.now() - i * 3.1e6 - 6e5, likes, comments: 0, shares: Math.round(likes / 7), challenge: ch ? day : null, evergreen: !!ch, seedKey: file };
    for (let c = 0; c < 3; c++) {
      const cid = id(9); const by = uids[keys[(i + c + 1) % keys.length]];
      db.comments[cid] = { id: cid, post: pid, uid: by, text: COMMENTS[(i * 3 + c) % COMMENTS.length], createdAt: Date.now() - i * 3e6 + c * 6e4 };
      db.posts[pid].comments++;
    }
  }
  db.meta.seedV = SEED_V; save();
  console.log('[seed] done in', Date.now() - t0, 'ms');
}
