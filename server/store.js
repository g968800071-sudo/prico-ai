// Persistence: one JSON document (users, posts, ...) + binary blobs.
// Backend: Postgres when DATABASE_URL is set (survives restarts on Render free), else local ./data folder.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA = process.env.DATA_DIR || path.resolve('data');
let pg = null;
export const db = { users: {}, sessions: {}, faces: {}, media: {}, posts: {}, comments: {}, likes: {}, follows: {}, reports: [], meta: {} };
const blobCache = new Map(); let cacheBytes = 0; const CACHE_MAX = 64 * 1024 * 1024;

export const id = (n = 10) => crypto.randomBytes(n).toString('base64url').replace(/[-_]/g, '').slice(0, n + 2);

export async function init() {
  if (process.env.DATABASE_URL) {
    const { default: pgmod } = await import('pg');
    pg = new pgmod.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === 'off' ? false : { rejectUnauthorized: false }, max: 4 });
    await pg.query('create table if not exists prico_doc (k text primary key, v jsonb not null)');
    await pg.query('create table if not exists prico_blob (id text primary key, mime text not null, data bytea not null, created timestamptz default now())');
    const r = await pg.query("select v from prico_doc where k='db'");
    if (r.rows[0]) Object.assign(db, r.rows[0].v);
    console.log('[store] postgres, users:', Object.keys(db.users).length);
  } else {
    await fs.mkdir(path.join(DATA, 'blobs'), { recursive: true });
    try { Object.assign(db, JSON.parse(await fs.readFile(path.join(DATA, 'db.json'), 'utf8'))); } catch {}
    console.log('[store] local files at', DATA, 'users:', Object.keys(db.users).length);
  }
  for (const k of ['users', 'sessions', 'faces', 'media', 'posts', 'comments', 'likes', 'follows', 'meta']) db[k] ||= {};
  db.reports ||= [];
}

let saveT = null, saving = Promise.resolve();
export function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => { saving = saving.then(flush).catch(e => console.error('[store] save', e.message)); }, 400);
}
async function flush() {
  const json = JSON.stringify(db);
  if (pg) await pg.query("insert into prico_doc(k,v) values('db',$1) on conflict (k) do update set v=excluded.v", [json]);
  else { const f = path.join(DATA, 'db.json'); await fs.writeFile(f + '.tmp', json); await fs.rename(f + '.tmp', f); }
}
export async function flushNow() { clearTimeout(saveT); await saving; await flush(); }

function cachePut(k, v) {
  blobCache.set(k, v); cacheBytes += v.data.length;
  while (cacheBytes > CACHE_MAX) { const [fk, fv] = blobCache.entries().next().value; blobCache.delete(fk); cacheBytes -= fv.data.length; }
}
export async function putBlob(data, mime) {
  const bid = id(14);
  if (pg) await pg.query('insert into prico_blob(id,mime,data) values($1,$2,$3)', [bid, mime, data]);
  else { await fs.writeFile(path.join(DATA, 'blobs', bid), data); await fs.writeFile(path.join(DATA, 'blobs', bid + '.mime'), mime); }
  cachePut(bid, { mime, data });
  return bid;
}
export async function getBlob(bid) {
  if (!/^[A-Za-z0-9]{4,40}$/.test(bid)) return null;
  if (blobCache.has(bid)) { const v = blobCache.get(bid); blobCache.delete(bid); blobCache.set(bid, v); return v; }
  let v = null;
  if (pg) { const r = await pg.query('select mime,data from prico_blob where id=$1', [bid]); if (r.rows[0]) v = { mime: r.rows[0].mime, data: r.rows[0].data }; }
  else { try { v = { data: await fs.readFile(path.join(DATA, 'blobs', bid)), mime: await fs.readFile(path.join(DATA, 'blobs', bid + '.mime'), 'utf8') }; } catch {} }
  if (v) cachePut(bid, v);
  return v;
}
export async function delBlob(bid) {
  blobCache.delete(bid);
  if (pg) await pg.query('delete from prico_blob where id=$1', [bid]);
  else { await fs.rm(path.join(DATA, 'blobs', bid), { force: true }); await fs.rm(path.join(DATA, 'blobs', bid + '.mime'), { force: true }); }
}
export const backend = () => (pg ? 'postgres' : 'local-files');
