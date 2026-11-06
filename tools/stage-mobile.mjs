// Copy the web app into mobile/www for a device install.
// apiBase stays empty unless PRICO_API_BASE is set. The public demo host is never written.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const www = path.join(root, 'mobile/www');
fs.rmSync(www, { recursive: true, force: true });
fs.cpSync(path.join(root, 'www'), www, { recursive: true });
fs.rmSync(path.join(www, 'sw.js'), { force: true });
spawnSync(process.execPath, [path.join(root, 'tools/build-offline-catalog.mjs')], { stdio: 'inherit' });
fs.copyFileSync(path.join(root, 'www/offline/catalog.json'), path.join(www, 'offline/catalog.json'));
fs.mkdirSync(path.join(www, 'offline/music'), { recursive: true });
fs.mkdirSync(path.join(www, 'offline/previews'), { recursive: true });
for (const f of fs.readdirSync(path.join(root, 'assets/music')).filter(f => f.endsWith('.m4a'))) {
  fs.copyFileSync(path.join(root, 'assets/music', f), path.join(www, 'offline/music', f));
}
for (const f of fs.readdirSync(path.join(root, 'assets/previews')).filter(f => f.endsWith('.jpg'))) {
  fs.copyFileSync(path.join(root, 'assets/previews', f), path.join(www, 'offline/previews', f));
}
let apiBase = String(process.env.PRICO_API_BASE || '').trim().replace(/\/$/, '');
if (/prico-ai\.onrender\.com/i.test(apiBase)) {
  console.error('refusing to stage the old public demo host');
  process.exit(1);
}
fs.writeFileSync(path.join(www, 'server.json'), JSON.stringify({ apiBase }) + '\n');
console.log('staged mobile www', 'apiBase=' + (apiBase || '(on this phone)'));
