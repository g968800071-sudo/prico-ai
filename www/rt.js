// Realtime client: one WebSocket per session (guests too, for watching LIVE), auto-reconnect with backoff, tiny event bus.
// Server events use the `t` key (msg, read, notif, typing, live:*, rtc).
import { S, BASE } from './core.js';
const subs = new Map(); let ws = null, tries = 0, timer = 0, want = false, queue = [], tokUsed = null;
export const badges = { msgs: 0, notifs: 0 };
export let cid = null;
export function on(type, fn) { if (!subs.has(type)) subs.set(type, new Set()); subs.get(type).add(fn); return () => subs.get(type)?.delete(fn); }
function emit(type, m) { (subs.get(type) || []).forEach(f => { try { f(m); } catch (e) { console.warn(e); } }); }
export function send(m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); else { queue.push(m); connect(); } }
export const ready = () => !!ws && ws.readyState === 1;
export function connect() {
  want = true;
  if (ws && tokUsed !== S.tok) { try { ws.onclose = null; ws.close(); } catch {} ws = null; }
  if (ws && ws.readyState <= 1) return;
  const base = BASE || location.origin; tokUsed = S.tok;
  try { ws = new WebSocket(base.replace(/^http/, 'ws') + '/ws?token=' + encodeURIComponent(S.tok || '')); } catch { return retry(); }
  ws.onopen = () => { tries = 0; const q = queue; queue = []; q.forEach(send); };
  ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } if (m.t === 'hello') { cid = m.cid; emit('open', m); } if (m.badges) { Object.assign(badges, m.badges); emit('badges', badges); } emit(m.t, m); };
  ws.onclose = () => { ws = null; cid = null; emit('close', {}); if (want) retry(); };
  ws.onerror = () => {};
}
function retry() { clearTimeout(timer); timer = setTimeout(connect, Math.min(15000, 600 * 2 ** tries++)); }
export function reconnect() { if (ws) { try { ws.onclose = null; ws.close(); } catch {} ws = null; } connect(); }
setInterval(() => { if (ws && ws.readyState === 1) ws.send('{"t":"ping"}'); }, 25000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && want && !ws) connect(); });
