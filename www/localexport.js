// On-device edit export. Pictures, an imported clip, a crossfade, text and captions.
// A phone encodes H.264 + AAC in an MP4 through the platform. It does not rename a WebM file.
export function planSegments(clips, fade = 0.35) {
  const list = Array.isArray(clips) ? clips : [];
  const segs = [];
  let t = 0;
  for (let i = 0; i < list.length; i++) {
    const span = Math.max(0.6, Math.min(6, Number(list[i].dur) || 2));
    segs.push({ i, start: +t.toFixed(3), dur: +span.toFixed(3) });
    const overlap = i < list.length - 1 ? Math.min(fade, span / 3) : 0;
    t += span - overlap;
  }
  const total = Math.max(0.6, Math.min(20, t));
  return { segments: segs, total: +total.toFixed(3), fade };
}

export function mp4HeaderOk(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  let head = '';
  for (let i = 0; i < Math.min(32, u8.length); i++) head += String.fromCharCode(u8[i]);
  if (u8[0] === 0x1a && u8[1] === 0x45 && u8[2] === 0xdf && u8[3] === 0xa3) return false;
  return head.includes('ftyp');
}

function cover(ctx, source, W, H) {
  const sw = source.videoWidth || source.naturalWidth || source.width || W;
  const sh = source.videoHeight || source.naturalHeight || source.height || H;
  const scale = Math.max(W / sw, H / sh);
  const dw = sw * scale, dh = sh * scale;
  ctx.drawImage(source, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

function active(segments, time, fade) {
  const hits = segments.filter(s => time >= s.start - 0.001 && time < s.start + s.dur);
  if (hits.length < 2) return hits.map(s => ({ ...s, alpha: 1 }));
  const a = hits[0], b = hits[1];
  const u = Math.max(0, Math.min(1, (time - b.start) / Math.max(0.05, fade)));
  return [{ ...a, alpha: 1 - u }, { ...b, alpha: u }];
}

function paint(ctx, sources, plan, time, W, H, texts, captions) {
  ctx.fillStyle = '#07070c';
  ctx.fillRect(0, 0, W, H);
  for (const layer of active(plan.segments, time, plan.fade)) {
    ctx.globalAlpha = layer.alpha;
    cover(ctx, sources[layer.i], W, H);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 6;
  const drawLine = (text, y, px) => {
    ctx.font = `800 ${px}px sans-serif`;
    ctx.strokeText(text, W / 2, y);
    ctx.fillText(text, W / 2, y);
  };
  for (const tx of texts) if (time >= (tx.start || 0) && time <= (tx.end || plan.total) && tx.text) drawLine(String(tx.text).slice(0, 80), H * (tx.y || 0.2), 42);
  for (const cap of captions) if (time >= (cap.start || 0) && time <= (cap.end || plan.total) && cap.text) drawLine(String(cap.text).slice(0, 90), H * 0.78, 34);
}

async function loadSources(clips) {
  const sources = [];
  for (const c of clips) {
    if (c.kind === 'video') {
      const v = document.createElement('video');
      v.src = c.url; v.muted = true; v.playsInline = true; v.preload = 'auto';
      await new Promise((res, rej) => { v.onloadeddata = () => res(); v.onerror = () => rej(Object.assign(new Error('bad_video'), { code: 'bad_video' })); });
      try { await v.play(); v.pause(); } catch {}
      sources.push(v);
    } else {
      const img = new Image();
      img.src = c.url;
      await new Promise((res, rej) => { img.onload = () => res(); img.onerror = () => rej(Object.assign(new Error('bad_image'), { code: 'bad_image' })); });
      sources.push(img);
    }
  }
  return sources;
}

function seekVideo(v, local) {
  const t = Math.max(0, Math.min(local, Math.max(0, (v.duration || local) - 0.04)));
  if (Math.abs((v.currentTime || 0) - t) < 0.08 && v.readyState >= 2) return Promise.resolve();
  return new Promise(res => {
    const done = () => { v.removeEventListener('seeked', done); res(); };
    v.addEventListener('seeked', done);
    try { v.currentTime = t; } catch { done(); }
    setTimeout(done, 700);
  });
}

async function renderPcm(musicUrl, duration) {
  const sampleRate = 44100;
  const channels = 2;
  const length = Math.max(1, Math.ceil(duration * sampleRate));
  const ctx = new OfflineAudioContext(channels, length, sampleRate);
  let music = false;
  if (musicUrl) {
    try {
      const raw = await (await fetch(musicUrl)).arrayBuffer();
      const audio = await ctx.decodeAudioData(raw.slice(0));
      const src = ctx.createBufferSource();
      src.buffer = audio;
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0.45;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start(0);
      music = true;
    } catch { music = false; }
  }
  const rendered = await ctx.startRendering();
  const rate = rendered.sampleRate || sampleRate;
  const pcm = new Int16Array(length * channels);
  for (let c = 0; c < channels; c++) {
    const ch = rendered.getChannelData(Math.min(c, rendered.numberOfChannels - 1));
    for (let i = 0; i < length; i++) {
      const s = Math.max(-1, Math.min(1, ch[i] || 0));
      pcm[i * channels + c] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
  }
  return { pcm, sampleRate: rate, channels, music };
}

function bytesToB64(bytes) {
  let s = '';
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes.buffer || bytes);
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function exportNative({ clips, texts, captions, musicUrl, W, H, plan, sources, onProgress }) {
  const plugin = window.Capacitor?.Plugins?.PricoExport;
  const Filesystem = window.Capacitor?.Plugins?.Filesystem;
  if (!plugin?.mux || !Filesystem) throw Object.assign(new Error('no_mp4'), { code: 'no_mp4' });
  const fps = 8;
  const n = Math.max(1, Math.round(plan.total * fps));
  const dir = 'prico-export-' + Date.now().toString(36);
  await Filesystem.mkdir({ path: dir, directory: 'CACHE', recursive: true });
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false });
  for (let i = 0; i < n; i++) {
    const time = Math.min(plan.total - 0.001, i / fps);
    for (let s = 0; s < sources.length; s++) {
      if (sources[s] instanceof HTMLVideoElement) {
        const seg = plan.segments.find(x => x.i === s);
        await seekVideo(sources[s], Math.max(0, time - (seg?.start || 0)));
      }
    }
    paint(ctx, sources, plan, time, W, H, texts, captions);
    const b64 = canvas.toDataURL('image/jpeg', 0.72).split(',')[1];
    await Filesystem.writeFile({ path: `${dir}/f${String(i).padStart(4, '0')}.jpg`, data: b64, directory: 'CACHE' });
    onProgress(Math.min(0.7, (i + 1) / n * 0.7));
  }
  const audio = await renderPcm(musicUrl, plan.total);
  await Filesystem.writeFile({ path: `${dir}/audio.pcm`, data: bytesToB64(new Uint8Array(audio.pcm.buffer)), directory: 'CACHE' });
  const uri = await Filesystem.getUri({ path: dir, directory: 'CACHE' });
  const muxed = await plugin.mux({ uri: uri.uri, frames: n, width: W, height: H, fps, sampleRate: audio.sampleRate, channels: audio.channels, hasAudio: true });
  const file = await Filesystem.readFile({ path: `${dir}/out.mp4`, directory: 'CACHE' });
  const bytes = b64ToBytes(file.data);
  if (!mp4HeaderOk(bytes) || bytes.length < 800) throw Object.assign(new Error('export_empty'), { code: 'export_empty' });
  try {
    await Filesystem.writeFile({ path: 'prico-export.mp4', data: file.data, directory: 'DOCUMENTS' });
  } catch {}
  for (let i = 0; i < n; i++) Filesystem.deleteFile({ path: `${dir}/f${String(i).padStart(4, '0')}.jpg`, directory: 'CACHE' }).catch(() => {});
  Filesystem.deleteFile({ path: `${dir}/audio.pcm`, directory: 'CACHE' }).catch(() => {});
  onProgress(1);
  return { blob: new Blob([bytes], { type: 'video/mp4' }), mime: 'video/mp4', duration: plan.total, device: true, local: true, ai: false, path: muxed?.path || '', music: audio.music, bytes: bytes.length };
}

export async function exportLocal({ clips, texts = [], captions = [], musicUrl = '', aspect = '9:16', onProgress = () => {} }) {
  if (!clips?.length) throw Object.assign(new Error('need_media'), { code: 'need_media' });
  const sizes = { '9:16': [540, 960], '1:1': [540, 540], '4:5': [540, 676], '16:9': [960, 540] };
  const [W, H] = sizes[aspect] || sizes['9:16'];
  const plan = planSegments(clips);
  const sources = await loadSources(clips);
  const native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  try {
    if (native) return await exportNative({ clips, texts, captions, musicUrl, W, H, plan, sources, onProgress });
    return await exportRecorder({ texts, captions, W, H, plan, sources, musicUrl, onProgress });
  } finally {
    sources.forEach(s => { if (s instanceof HTMLVideoElement) { s.pause(); s.removeAttribute('src'); s.load?.(); } });
  }
}

async function exportRecorder({ texts, captions, W, H, plan, sources, musicUrl, onProgress }) {
  if (typeof MediaRecorder === 'undefined') throw Object.assign(new Error('no_recorder'), { code: 'no_recorder' });
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false });
  const stream = canvas.captureStream(12);
  let audio;
  if (musicUrl) {
    try {
      audio = new Audio(musicUrl);
      audio.loop = true; audio.crossOrigin = 'anonymous';
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const actx = new Ctx();
      const dest = actx.createMediaStreamDestination();
      const node = actx.createMediaElementSource(audio);
      const gain = actx.createGain();
      gain.gain.value = 0.45;
      node.connect(gain); gain.connect(dest);
      dest.stream.getAudioTracks().forEach(track => stream.addTrack(track));
      await actx.resume();
      await audio.play();
    } catch { audio = null; }
  }
  let mime = '';
  for (const m of ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp8', 'video/webm']) {
    if (MediaRecorder.isTypeSupported(m)) { mime = m; break; }
  }
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 1_200_000 } : { videoBitsPerSecond: 1_200_000 });
  const chunks = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise(res => { rec.onstop = () => res(); });
  rec.start(200);
  const t0 = performance.now();
  await new Promise(resolve => {
    const tick = () => {
      const time = (performance.now() - t0) / 1000;
      if (time >= plan.total) return resolve();
      for (const layer of active(plan.segments, time, plan.fade)) {
        const src = sources[layer.i];
        if (src instanceof HTMLVideoElement) {
          const local = Math.max(0, time - layer.start);
          if (Math.abs((src.currentTime || 0) - local) > 0.35) { try { src.currentTime = local; } catch {} }
          if (src.paused) src.play().catch(() => {});
        }
      }
      paint(ctx, sources, plan, time, W, H, texts, captions);
      onProgress(Math.min(0.99, time / plan.total));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  rec.stop();
  await stopped;
  audio?.pause();
  const type = (mime || rec.mimeType || 'video/webm').split(';')[0];
  const blob = new Blob(chunks, { type });
  if (blob.size < 800) throw Object.assign(new Error('export_empty'), { code: 'export_empty' });
  if (type !== 'video/mp4') return { blob, mime: type, duration: plan.total, device: false, local: true, ai: false, mp4: false };
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (!mp4HeaderOk(bytes)) throw Object.assign(new Error('export_empty'), { code: 'export_empty' });
  onProgress(1);
  return { blob, mime: 'video/mp4', duration: plan.total, device: false, local: true, ai: false };
}
