// On-device person cut-out (MediaPipe selfie segmenter, self-hosted). Returns a PNG Blob with alpha, or null.
let segP = null;
const BASE = new URL('./vendor/mp/', import.meta.url).href;
function load() {
  if (!segP) segP = (async () => {
    const v = await import(BASE + 'vision_bundle.mjs');
    const fileset = { wasmLoaderPath: BASE + 'vision_wasm_internal.js', wasmBinaryPath: BASE + 'vision_wasm_internal.wasm' };
    return v.ImageSegmenter.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: BASE + 'selfie_segmenter.tflite', delegate: 'CPU' },
      runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false,
    });
  })().catch(e => { segP = null; throw e; });
  return segP;
}
export function warmup() { load().catch(() => {}); }
export async function cutout(canvas) {
  const seg = await load();
  const res = seg.segment(canvas);
  const m = res.confidenceMasks[0];
  const mw = m.width, mh = m.height, data = m.getAsFloat32Array();
  const mc = document.createElement('canvas'); mc.width = mw; mc.height = mh;
  const mctx = mc.getContext('2d'); const id = mctx.createImageData(mw, mh);
  let fg = 0;
  for (let i = 0; i < data.length; i++) {
    const a = Math.max(0, Math.min(1, (data[i] - 0.25) / 0.5));
    if (a > 0.5) fg++;
    id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = 255; id.data[i * 4 + 3] = a * 255;
  }
  mctx.putImageData(id, 0, 0);
  m.close?.();
  if (fg < data.length * 0.06) return null; // no person found
  const out = document.createElement('canvas'); out.width = canvas.width; out.height = canvas.height;
  const o = out.getContext('2d');
  o.imageSmoothingEnabled = true; o.imageSmoothingQuality = 'high';
  o.drawImage(mc, 0, 0, out.width, out.height);
  o.globalCompositeOperation = 'source-in';
  o.drawImage(canvas, 0, 0);
  return new Promise(r => out.toBlob(r, 'image/png'));
}
