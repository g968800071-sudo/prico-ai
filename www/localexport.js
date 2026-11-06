// On-device edit export. Pictures, an imported clip, a crossfade, text and captions.
// A phone encodes H.264 + AAC in an MP4 through the platform. It does not rename a WebM file.
export function planSegments(clips, fade = 0.35, opts = {}) {
  const list = Array.isArray(clips) ? clips : [];
  const maxSpan = opts.maxSpan || 60;
  const maxTotal = opts.maxTotal || 90;
  const segs = [];
  let t = 0;
  for (let i = 0; i < list.length; i++) {
    const span = Math.max(0.6, Math.min(maxSpan, Number(list[i].dur) || 2));
    segs.push({ i, start: +t.toFixed(3), dur: +span.toFixed(3) });
    const overlap = i < list.length - 1 ? Math.min(fade, span / 3) : 0;
    t += span - overlap;
  }
  const total = segs.length ? +Math.max(0.6, Math.min(maxTotal, t)).toFixed(3) : 0;
  return { segments: segs, total, fade };
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
    ctx.lineWidth = Math.max(6, Math.round(px / 8));
    ctx.strokeText(text, W / 2, y);
    ctx.fillText(text, W / 2, y);
  };
  const titlePx = Math.max(42, Math.round(H * 0.055));
  const capPx = Math.max(34, Math.round(H * 0.042));
  for (const tx of texts) if (time >= (tx.start || 0) && time <= (tx.end || plan.total) && tx.text) drawLine(String(tx.text).slice(0, 80), H * (tx.y || 0.18), titlePx);
  for (const cap of captions) if (time >= (cap.start || 0) && time <= (cap.end || plan.total) && cap.text) drawLine(String(cap.text).slice(0, 90), H * 0.78, capPx);
}

async function loadSources(clips) {
  const sources = [];
  for (const c of clips) {
    if (c.kind === 'video') {
      const v = document.createElement('video');
      v.src = c.url; v.muted = true; v.playsInline = true; v.preload = 'auto';
      await new Promise((res, rej) => { v.onloadeddata = () => res(); v.onerror = () => rej(Object.assign(new Error('bad_video'), { code: 'bad_video', detail: (v.error && (v.error.message || v.error.code)) || 'element' })); });
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

async function loadMusicBytes(url) {
  const rel = String(url || '').replace(/^\//, '');
  const plugin = window.Capacitor?.Plugins?.PricoExport;
  if (plugin?.readAsset && rel && !/^[a-z][a-z0-9+.-]*:/i.test(rel)) {
    const r = await plugin.readAsset({ path: rel });
    if (!r?.data) throw Object.assign(new Error('music_unreadable'), { code: 'music_unreadable' });
    return b64ToBytes(r.data);
  }
  const res = await fetch(url);
  if (!res.ok) throw Object.assign(new Error('music_unreadable'), { code: 'music_unreadable', detail: 'fetch ' + res.status });
  return new Uint8Array(await res.arrayBuffer());
}

async function renderPcm(musicUrl, duration) {
  const sampleRate = 44100;
  const channels = 2;
  const length = Math.max(1, Math.ceil(duration * sampleRate));
  let decoded = null;
  let music = 'none';
  if (musicUrl) {
    const raw = await loadMusicBytes(musicUrl);
    const copy = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
    const probe = new OfflineAudioContext(channels, sampleRate, sampleRate);
    decoded = await probe.decodeAudioData(copy);
    music = /offline\/music\//.test(musicUrl) ? 'library' : 'file';
  }
  const pcm = new Int16Array(length * channels);
  const slice = sampleRate * 10;
  for (let offset = 0; offset < length; offset += slice) {
    const count = Math.min(slice, length - offset);
    const ctx = new OfflineAudioContext(channels, count, sampleRate);
    if (decoded) {
      const src = ctx.createBufferSource();
      src.buffer = decoded;
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0.55;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start(0, (offset / sampleRate) % decoded.duration);
    }
    const rendered = await ctx.startRendering();
    for (let c = 0; c < channels; c++) {
      const ch = rendered.getChannelData(Math.min(c, rendered.numberOfChannels - 1));
      for (let i = 0; i < count; i++) {
        const s = Math.max(-1, Math.min(1, ch[i] || 0));
        pcm[(offset + i) * channels + c] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
    }
  }
  return { pcm, sampleRate, channels, music };
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

function buildKeys(clips, plan, texts, captions, fps) {
  const n = Math.max(1, Math.round(plan.total * fps));
  const keys = [];
  let run = null;
  const flush = () => { if (run) keys.push(run); run = null; };
  for (let i = 0; i < n; i++) {
    const time = Math.min(plan.total - 0.0001, i / fps);
    const layers = active(plan.segments, time, plan.fade);
    const moving = layers.some(l => clips[l.i]?.kind === 'video' && l.alpha > 0.02);
    const cap = (captions.find(c => time >= (c.start || 0) && time <= (c.end ?? plan.total) && c.text) || {}).text || '';
    const title = texts.filter(t => time >= (t.start || 0) && time <= (t.end ?? plan.total) && t.text).map(t => t.text).join('|');
    const layerSig = layers.map(l => l.i + ':' + (moving ? 'v' : l.alpha.toFixed(2))).join(',');
    const sig = layerSig + '#' + cap + '#' + title;
    if (!run || moving || sig !== run.sig) { flush(); run = { time, repeat: 1, sig }; }
    else run.repeat++;
  }
  flush();
  return { n, keys };
}

async function exportReelIOS({ clips, texts, captions, musicUrl, W, H, plan, onProgress, fps, outName }) {
  const plugin = window.Capacitor.Plugins.PricoExport;
  const Filesystem = window.Capacitor.Plugins.Filesystem;
  if (!Filesystem) throw Object.assign(new Error('no_mp4'), { code: 'no_mp4' });
  const t0 = performance.now();
  const folder = 'prico-reel-' + Date.now().toString(36);
  await Filesystem.mkdir({ path: folder, directory: 'CACHE', recursive: true });
  const dirUri = await Filesystem.getUri({ path: folder, directory: 'CACHE' });
  const copy = await Filesystem.getUri({ path: outName || 'prico-export.mp4', directory: 'DOCUMENTS' });
  const cachePath = dirUri.uri.replace(/^file:\/\//, '');
  const built = [];
  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    const seg = plan.segments[i];
    if (c.kind === 'video' && c.url && !/^[a-z]+:/i.test(c.url)) {
      built.push({ kind: 'video', file: String(c.url).replace(/^\//, ''), bundle: true, start: seg.start, dur: seg.dur });
    } else if (c.kind === 'video') {
      const buf = new Uint8Array(await (await fetch(c.url)).arrayBuffer());
      await Filesystem.writeFile({ path: `${folder}/clip${i}.mp4`, data: bytesToB64(buf), directory: 'CACHE' });
      built.push({ kind: 'video', file: `clip${i}.mp4`, bundle: false, start: seg.start, dur: seg.dur });
    } else {
      const img = new Image();
      img.src = c.url;
      await new Promise((res, rej) => { img.onload = () => res(); img.onerror = () => rej(Object.assign(new Error('bad_image'), { code: 'bad_image' })); });
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.fillStyle = '#07070c';
      ctx.fillRect(0, 0, W, H);
      cover(ctx, img, W, H);
      await Filesystem.writeFile({ path: `${folder}/still${i}.jpg`, data: canvas.toDataURL('image/jpeg', 0.85).split(',')[1], directory: 'CACHE' });
      built.push({ kind: 'image', file: `still${i}.jpg`, bundle: false, start: seg.start, dur: seg.dur });
    }
  }
  onProgress(0.05);
  const project = JSON.stringify({
    width: W, height: H, fps, fade: plan.fade, total: plan.total,
    music: String(musicUrl || '').replace(/^\//, ''),
    cache: cachePath,
    clips: built,
    texts, captions,
  });
  const muxed = await plugin.exportReel({ project, copyTo: copy.uri });
  if (!muxed?.header || !String(muxed.header).includes('66747970') || !(muxed.bytes > 800)) throw Object.assign(new Error('export_empty'), { code: 'export_empty' });
  onProgress(1);
  const wallMs = Math.round(performance.now() - t0);
  const playSrc = window.Capacitor.convertFileSrc ? window.Capacitor.convertFileSrc(muxed.path) : '';
  return { mime: 'video/mp4', duration: plan.total, device: true, local: true, ai: false, path: muxed.path || '', copyUri: copy.uri, music: /offline\/music\//.test(musicUrl || '') ? 'library' : 'file', bytes: muxed.bytes, width: muxed.width || W, height: muxed.height || H, fps, frames: muxed.frames, header: muxed.header, playSrc, plan, wallMs, elapsedMs: muxed.elapsedMs, engine: muxed.engine || 'avfoundation' };
}

async function exportNative({ clips, texts, captions, musicUrl, W, H, plan, sources, onProgress, fps, outName }) {
  const plugin = window.Capacitor?.Plugins?.PricoExport;
  const Filesystem = window.Capacitor?.Plugins?.Filesystem;
  if (!plugin?.begin || !plugin?.frame || !plugin?.finish || !Filesystem) throw Object.assign(new Error('no_mp4'), { code: 'no_mp4' });
  const audio = await renderPcm(musicUrl, plan.total);
  if (musicUrl && audio.music === 'none') throw Object.assign(new Error('music_unreadable'), { code: 'music_unreadable' });
  const dir = 'prico-export-' + Date.now().toString(36);
  await Filesystem.mkdir({ path: dir, directory: 'CACHE', recursive: true });
  const uri = await Filesystem.getUri({ path: dir, directory: 'CACHE' });
  const copy = await Filesystem.getUri({ path: outName || 'prico-export.mp4', directory: 'DOCUMENTS' });
  await plugin.begin({ uri: uri.uri, width: W, height: H, fps, sampleRate: audio.sampleRate, channels: audio.channels, hasAudio: true });
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false });
  const built = buildKeys(clips, plan, texts, captions, fps);
  let drawn = 0;
  for (const key of built.keys) {
    for (let s = 0; s < sources.length; s++) {
      if (sources[s] instanceof HTMLVideoElement) {
        const seg = plan.segments.find(x => x.i === s);
        const span = Math.max(0, key.time - (seg?.start || 0));
        const dur = sources[s].duration || span || 1;
        await seekVideo(sources[s], span % dur);
      }
    }
    paint(ctx, sources, plan, key.time, W, H, texts, captions);
    const b64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
    await Filesystem.writeFile({ path: `${dir}/frame.jpg`, data: b64, directory: 'CACHE' });
    await plugin.frame({ uri: uri.uri, repeat: key.repeat });
    drawn += key.repeat;
    onProgress(Math.min(0.8, drawn / built.n * 0.8));
  }
  const pcm = new Uint8Array(audio.pcm.buffer);
  const step = 350000;
  for (let off = 0; off < pcm.length; off += step) {
    await plugin.audio({ uri: uri.uri, data: bytesToB64(pcm.subarray(off, off + step)) });
  }
  const muxed = await plugin.finish({ uri: uri.uri, copyTo: copy.uri });
  if (!muxed?.header || !String(muxed.header).includes('66747970') || !(muxed.bytes > 800)) throw Object.assign(new Error('export_empty'), { code: 'export_empty' });
  onProgress(1);
  const playSrc = window.Capacitor.convertFileSrc ? window.Capacitor.convertFileSrc(muxed.path) : '';
  return { mime: 'video/mp4', duration: plan.total, device: true, local: true, ai: false, path: muxed.path || '', copyUri: copy.uri, music: audio.music, bytes: muxed.bytes, width: muxed.width || W, height: muxed.height || H, fps, frames: muxed.frames || built.n, header: muxed.header, playSrc, plan };
}

export async function exportLocal({ clips, texts = [], captions = [], musicUrl = '', aspect = '9:16', onProgress = () => {}, fps = 30, width, height, fade = 0.35, maxSpan, maxTotal, outName } = {}) {
  if (!clips?.length) throw Object.assign(new Error('need_media'), { code: 'need_media' });
  const sizes = { '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350], '16:9': [1920, 1080] };
  const pair = sizes[aspect] || sizes['9:16'];
  const W = width || pair[0];
  const H = height || pair[1];
  const plan = planSegments(clips, fade, { maxSpan, maxTotal });
  const native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const ios = window.Capacitor?.getPlatform?.() === 'ios';
  if (native && ios && window.Capacitor?.Plugins?.PricoExport?.exportReel) {
    return await exportReelIOS({ clips, texts, captions, musicUrl, W, H, plan, onProgress, fps, outName });
  }
  const sources = await loadSources(clips);
  try {
    if (native) return await exportNative({ clips, texts, captions, musicUrl, W, H, plan, sources, onProgress, fps, outName });
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
