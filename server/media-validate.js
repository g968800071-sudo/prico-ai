// Server-side media checks. Rejects anything sharp cannot decode as a real still image.
import sharp from 'sharp';

const MIN_SIDE = 64;
const MAX_SIDE = 8000;
const MAX_BYTES = 15 * 1024 * 1024;

function kindOf(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export function assertMp4(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 1024 || buf.length > 80 * 1024 * 1024) return false;
  return buf.subarray(0, 32).toString('latin1').includes('ftyp');
}

export async function validateImage(buf) {
  const mime = kindOf(buf);
  if (!mime) return { ok: false, reason: 'type' };
  if (buf.length > MAX_BYTES) return { ok: false, reason: 'size' };
  try {
    const meta = await sharp(buf, { limitInputPixels: 40e6 }).rotate().metadata();
    const w = meta.width || 0, h = meta.height || 0;
    if (w < MIN_SIDE || h < MIN_SIDE || w > MAX_SIDE || h > MAX_SIDE) return { ok: false, reason: 'dimensions' };
    const data = await sharp(buf, { limitInputPixels: 40e6 }).rotate().jpeg({ quality: 90 }).toBuffer();
    if (!kindOf(data)) return { ok: false, reason: 'decode' };
    return { ok: true, mime: 'image/jpeg', width: w, height: h, data };
  } catch {
    return { ok: false, reason: 'decode' };
  }
}
