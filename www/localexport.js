// On-device edit export. Draws imported pictures and clips, a crossfade, text and captions.
// It does not call a model and it does not paste a face cutout onto a scene.
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

export function pickRecorderMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const m of ['video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm;codecs=vp8', 'video/webm']) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}

export async function exportLocal({ clips, texts = [], captions = [], musicUrl = '', aspect = '9:16', onProgress = () => {} }) {
  if (!clips?.length) throw Object.assign(new Error('need_media'), { code: 'need_media' });
  const mime = pickRecorderMime();
  if (!mime || typeof document === 'undefined') throw Object.assign(new Error('no_recorder'), { code: 'no_recorder' });
  const sizes = { '9:16': [540, 960], '1:1': [540, 540], '4:5': [540, 675], '16:9': [960, 540] };
  const [W, H] = sizes[aspect] || sizes['9:16'];
  const plan = planSegments(clips);
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false });
  const sources = [];
  for (const c of clips) {
    if (c.kind === 'video') {
      const v = document.createElement('video');
      v.src = c.url; v.muted = true; v.playsInline = true; v.preload = 'auto';
      await new Promise((res, rej) => { v.onloadeddata = () => res(); v.onerror = () => rej(Object.assign(new Error('bad_video'), { code: 'bad_video' })); });
      sources.push(v);
    } else {
      const img = new Image();
      img.src = c.url;
      await new Promise((res, rej) => { img.onload = () => res(); img.onerror = () => rej(Object.assign(new Error('bad_image'), { code: 'bad_image' })); });
      sources.push(img);
    }
  }
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
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1_800_000 });
  const chunks = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise(res => { rec.onstop = () => res(); });
  rec.start(200);
  const t0 = performance.now();
  await new Promise(resolve => {
    const tick = () => {
      const time = (performance.now() - t0) / 1000;
      if (time >= plan.total) return resolve();
      ctx.fillStyle = '#07070c';
      ctx.fillRect(0, 0, W, H);
      for (const layer of active(plan.segments, time, plan.fade)) {
        const src = sources[layer.i];
        if (src instanceof HTMLVideoElement) {
          const local = Math.min(src.duration || 1, time - layer.start);
          if (Math.abs(src.currentTime - local) > 0.35) { try { src.currentTime = local; } catch {} }
          if (src.paused) src.play().catch(() => {});
        }
        ctx.globalAlpha = layer.alpha;
        cover(ctx, src, W, H);
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
      onProgress(Math.min(0.99, time / plan.total));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  rec.stop();
  await stopped;
  audio?.pause();
  sources.forEach(s => { if (s instanceof HTMLVideoElement) { s.pause(); s.removeAttribute('src'); } });
  const type = mime.split(';')[0];
  const blob = new Blob(chunks, { type });
  if (blob.size < 800) throw Object.assign(new Error('export_empty'), { code: 'export_empty' });
  onProgress(1);
  return { blob, mime: type, duration: plan.total, device: true, local: true, ai: false };
}
