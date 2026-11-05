// v1.1 feature e2e: + sheet, FX camera, editor export, Photo Studio, chat, LIVE. Usage: URL=... node tools/e2e2.mjs iphone|android
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire('/workspace/tanchiki/')('playwright-core');
const URL_ = process.env.URL || 'http://localhost:8099';
const DEV = { iphone: { viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' },
  android: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36' } };
const name = process.argv[2] || 'iphone'; const SH = process.env.SHOTS || 'shots2'; fs.mkdirSync(SH, { recursive: true });
const T = +(process.env.GEN_TIMEOUT || 180000);
const api = async (path, tok, body) => { const r = await fetch(URL_ + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); return r.json(); };
const A = await api('/api/auth/register', null, { email: `e2e${Date.now()}@pricoai.test`, password: 'secret123', name: 'Mia ' + name });
const Bo = await api('/api/auth/register', null, { email: `e2eb${Date.now()}@pricoai.test`, password: 'secret123', name: 'Leo Friend' });
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const ctx = await b.newContext({ ...DEV[name], locale: 'en-US', permissions: ['camera', 'microphone'] });
await ctx.addInitScript(([tok]) => { localStorage.setItem('prico.tok', tok); localStorage.setItem('prico.onb', '1'); }, [A.token]);
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => m.type() === 'error' && errs.push('CONSOLE ' + m.text()));
const shot = async n => { await p.waitForTimeout(800); await p.screenshot({ path: `${SH}/${name}-${n}.png` }); console.log('shot', n); };
const step = async (n, fn) => { try { await fn(); console.log('OK', n); } catch (e) { console.log('FAIL', n, e.message.split('\n')[0]); errs.push('STEP ' + n + ': ' + e.message.split('\n')[0]); await shot('fail-' + n).catch(() => {}); } };
const closeAll = async () => { for (let i = 0; i < 4; i++) { await p.keyboard.press('Escape').catch(() => {}); } await p.goto(URL_ + '/?r=' + Date.now() + '#/home', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500); };
await p.goto(URL_, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
await step('feed', async () => { await shot('01-feed'); });
await step('plus', async () => { await p.locator('#tabs button[data-r=plus]').click(); await p.waitForSelector('.plusGrid'); await shot('02-plus'); });
await step('camera', async () => {
  await p.locator('.plusGrid [data-k=cam]').click(); await p.waitForSelector('.cam', { timeout: 15000 }); await p.waitForTimeout(6000);
  const fxb = p.locator('.cam .fxRail button, .cam [data-k=bigeyes]').nth(2); if (await fxb.count()) await fxb.click();
  await p.waitForTimeout(1500); await shot('03-camera');
  const ph = p.locator('.cam button:has-text("Photo")'); if (await ph.count()) await ph.first().click(); await p.waitForTimeout(500);
  await p.locator('.cam .shut, .cam .shutter').first().click(); await p.waitForTimeout(2500); await shot('04-camera-review');
}); await closeAll();
await step('studio', async () => {
  await p.locator('#tabs button[data-r=plus]').click(); await p.locator('.plusGrid [data-k=studio]').click(); await p.waitForSelector('.studio');
  const fc = p.waitForEvent('filechooser'); await p.locator('.stPick').click(); (await fc).setFiles('assets/seed/face2.jpg');
  await p.waitForSelector('.cmp', { timeout: 60000 }); await shot('05-studio-enhance');
  await p.locator('.stTabs [data-k=anywhere]').click(); const fc2 = p.waitForEvent('filechooser'); await p.locator('.stPick').click(); (await fc2).setFiles('assets/seed/face1.jpg');
  await p.waitForSelector('.scGrid button', { timeout: 60000 }); await p.locator('.scGrid button[data-s=paris]').click(); await p.waitForSelector('.stOut', { timeout: 60000 }); await shot('06-studio-anywhere');
}); await closeAll();
await step('editor', async () => {
  await p.locator('#tabs button[data-r=plus]').click(); await p.locator('.plusGrid [data-k=edit]').click();
  await p.waitForTimeout(1500);
  const np = p.locator('.sheet.on button:has-text("New project")'); if (await np.count()) await np.first().click();
  const fc = p.waitForEvent('filechooser', { timeout: 15000 }).catch(() => null);
  const add = p.locator('.addFirst').first(); if (await add.count()) await add.click();
  const ch = await fc; if (ch) await ch.setFiles(['/tmp/live.webm', 'assets/seed/face2.jpg']);
  await p.waitForTimeout(5000); await shot('07-editor');
  const tx = p.locator('.edTools button[data-k=text]').first(); if (await tx.count()) { await tx.click(); await p.waitForTimeout(1200); const ta = p.locator('.sheet.on textarea, .sheet.on input').first(); if (await ta.count()) { await ta.fill('POV: Monday 😂'); const ok = p.locator('.sheet.on .btn.pri').last(); if (await ok.count()) await ok.click(); } await p.waitForTimeout(1200); await shot('08-editor-text'); }
}); await closeAll();
await step('chat', async () => {
  const c = await api('/api/convs', Bo.token, { users: [A.me.handle] }); await api(`/api/convs/${c.conv?.id || c.id}/messages`, Bo.token, { type: 'text', text: 'Hey Mia! Loved your last video 😍' });
  await p.goto(URL_ + '/#/inbox'); await p.waitForTimeout(2500); await shot('09-inbox');
  await p.locator('#v-inbox .conv').first().click(); await p.waitForSelector('.chat', { timeout: 10000 });
  await p.locator('.chat .ci').first().fill('Thanks Leo! Going LIVE tonight 🔴'); await p.keyboard.press('Enter'); await p.waitForTimeout(1500); await shot('10-chat');
}); await closeAll();
await step('live', async () => {
  await p.goto(URL_ + '/#/live'); await p.waitForTimeout(2500); await shot('11-live-list');
  await p.locator('#v-live .go').first().click(); await p.waitForTimeout(6000); await shot('12-live-prep');
  await p.locator('.start').last().click(); await p.waitForTimeout(5000); await shot('13-live-host');
});
console.log('ERRORS', JSON.stringify(errs.filter(e => !/favicon|net::ERR_ABORTED|ERR_FILE_NOT_FOUND/.test(e)), null, 1));
await b.close();
