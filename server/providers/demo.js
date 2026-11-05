// DEMO provider: no paid AI. Composites the user's on-device cut-out into high-quality scene art
// (sharp) and animates it with ffmpeg + original music. Lets the whole product flow be tested end to end for free.
import { demoPhoto, demoVideo } from '../render.js';
export const name = 'demo';
export async function photo(tpl, faces, opts) { return { mime: 'image/jpeg', data: await demoPhoto(tpl, faces, opts.lang, opts) }; }
export async function video(tpl, faces, opts) { const r = await demoVideo(tpl, faces, opts.lang, opts); return { mime: 'video/mp4', data: r.mp4, poster: r.poster }; }
export const etaSec = { photo: 4, video: 14 };
