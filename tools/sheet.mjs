import sharp from 'sharp';
const [out, ...fs] = process.argv.slice(2);
const ims = await Promise.all(fs.map(f => sharp(f).resize(240, 427, { fit: 'cover' }).toBuffer()));
await sharp({ create: { width: 240 * fs.length, height: 427, channels: 3, background: '#000' } }).composite(ims.map((b, i) => ({ input: b, left: i * 240, top: 0 }))).jpeg().toFile(out);
