import { createRequire } from 'module'; import fs from 'fs';
const { chromium } = createRequire('/workspace/tanchiki/')('playwright-core');
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await b.newPage(); p.on('console', m => console.log('[c]', m.text()));
await p.goto('http://localhost:8766/segtest.html'); await p.waitForFunction('window.ready');
const files = process.argv.slice(2);
for (const f of files) { const d = await p.evaluate(s => run(s), '/' + f.split('/').pop()); if (!d) { console.log('none', f); continue; } fs.writeFileSync(f.replace(/face(\d)\.jpg$/, 'cut$1.png'), Buffer.from(d.split(',')[1], 'base64')); console.log('ok', f); }
await b.close();
