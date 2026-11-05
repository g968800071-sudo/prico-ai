import fs from 'node:fs';
const B = process.env.URL || 'http://localhost:8099';
const j = async (path, { tok, body, method, type } = {}) => { const r = await fetch(B + path, { method: method || (body ? 'POST' : 'GET'), headers: { ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(body && !type ? { 'Content-Type': 'application/json' } : type ? { 'Content-Type': type } : {}) }, body: body ? (type ? body : JSON.stringify(body)) : undefined }); const x = await r.json().catch(() => ({})); if (!r.ok) throw new Error(path + ' ' + r.status + ' ' + JSON.stringify(x)); return x; };
const reg = async n => j('/api/auth/register', { body: { email: `${n}${Date.now()}@pricoai.test`, password: 'secret123', name: n } });
const A = await reg('alice'), Bo = await reg('bob');
console.log('users', A.me.handle, Bo.me.handle);
const meta = await j('/api/editor/meta', { tok: A.token }); console.log('meta keys', Object.keys(meta));
const up = await j('/api/uploads', { tok: A.token, body: fs.readFileSync(process.env.WEBM || '/tmp/live.webm'), type: 'video/webm' }); console.log('webm upload', up);
const tts = await j('/api/tts', { tok: A.token, body: { text: 'Hello from PRICO AI', voice: 'nova', lang: 'en' } }); console.log('tts', JSON.stringify(tts).slice(0, 200));
const proj = { aspect: '9:16', clips: [{ up: up.id, in: 0, out: Math.min(3, up.duration || 3) }], texts: [{ text: 'Smoke test', start: 0, end: 2, x: .5, y: .3, size: 1, color: '#fff', font: 'bold', anim: 'pop' }], stickers: [], music: { id: meta.music?.[0]?.id || meta.tracks?.[0]?.id, vol: .5 }, voices: tts.id ? [{ up: tts.id, start: 0, vol: 1 }] : [], captions: [{ text: 'Hello from', start: 0, end: 1 }, { text: 'PRICO AI', start: 1, end: 2 }] };
const ed = await j('/api/edit', { tok: A.token, body: { project: proj } }); console.log('edit job', ed);
let st; const t0 = Date.now();
for (let i = 0; i < 300; i++) { await new Promise(r => setTimeout(r, 2000)); st = (await j('/api/jobs/' + (ed.id || ed.job?.id), { tok: A.token })).job; if (st.status === 'done' || st.status === 'error') break; }
console.log('edit result', st.status, st.error || '', ((Date.now() - t0) / 1000) + 's', JSON.stringify(st).slice(0, 300));
const c = await j('/api/convs', { tok: A.token, body: { users: [Bo.me.handle] } }); const cid = c.id || c.conv?.id; console.log('conv', cid);
await j(`/api/convs/${cid}/messages`, { tok: A.token, body: { type: 'text', text: 'hi bob 👋' } });
const bb = await j('/api/badges', { tok: Bo.token }); console.log('bob badges', bb);
const inbox = await j('/api/inbox', { tok: Bo.token }); console.log('bob inbox', inbox.items.length, inbox.items[0]?.last?.text || JSON.stringify(inbox.items[0]).slice(0, 200));
const L = await j('/api/lives', { tok: A.token, body: { title: 'Smoke LIVE' } }); console.log('live', JSON.stringify(L).slice(0, 150));
const lid = L.id || L.live?.id;
try { await j(`/api/lives/${lid}/gift`, { tok: Bo.token, body: { gift: 'rose', count: 1 } }); console.log('gift ok?!'); } catch (e) { console.log('gift (expected no_coins)', e.message.slice(0, 120)); }
const shop = await j('/api/shop', { tok: Bo.token }); const cp = (shop.products || shop.items || []).find(p => /coins/.test(p.id)); console.log('coin product', cp?.id);
if (cp) { await j('/api/shop/buy', { tok: Bo.token, body: { product: cp.id, id: cp.id } }).then(x => console.log('buy', JSON.stringify(x).slice(0, 150))).catch(e => console.log('buy err', e.message)); await j(`/api/lives/${lid}/gift`, { tok: Bo.token, body: { gift: 'rose', count: 5 } }).then(x => console.log('gift', JSON.stringify(x).slice(0, 150))).catch(e => console.log('gift err', e.message)); }
await j(`/api/lives/${lid}/end`, { tok: A.token, body: {} }).then(x => console.log('end', JSON.stringify(x).slice(0, 200)));
