// Text-to-speech voiceover. Default: free, fully local eSpeak-NG (WASM, GPL-3.0, server-side only) + ffmpeg voice styling.
// Pluggable paid provider: set ELEVENLABS_API_KEY (optional ELEVENLABS_VOICE_<STYLE>) to switch to natural neural voices.
import { spawn } from 'node:child_process';
import { FFMPEG } from './render.js';

const LANG = { en: 'en-us', ru: 'ru', uk: 'uk', es: 'es', pt: 'pt-br', de: 'de', fr: 'fr-fr', tr: 'tr', ar: 'ar', hi: 'hi', id: 'id' };
export const VOICES = {
  nova: { emoji: '👩', v: '+f3', p: 55, s: 160, af: 'aecho=0.8:0.5:30:0.12' },
  max: { emoji: '👨', v: '+m3', p: 42, s: 158, af: 'aecho=0.8:0.5:30:0.12' },
  kid: { emoji: '🧒', v: '+f4', p: 80, s: 170, af: 'asetrate=22050*1.18,aresample=22050,atempo=0.92' },
  deep: { emoji: '🧔', v: '+m7', p: 18, s: 145, af: 'asetrate=22050*0.86,aresample=22050,atempo=1.12,bass=g=4' },
  robot: { emoji: '🤖', v: '+m1', p: 50, s: 150, af: "afftfilt=real='hypot(re,im)*sin(0)':imag='hypot(re,im)*cos(0)':win_size=512:overlap=0.75,aecho=0.8:0.7:12:0.4" },
  whisper: { emoji: '🤫', v: '+whisper', p: 50, s: 150, af: 'volume=2.2' },
  hype: { emoji: '📣', v: '+m2', p: 60, s: 190, af: 'acompressor=threshold=0.1:ratio=6,volume=1.3' },
};
export const provider = () => (process.env.ELEVENLABS_API_KEY ? 'elevenlabs' : 'espeak');
export const list = () => ({ provider: provider(), voices: Object.entries(VOICES).map(([id, v]) => ({ id, emoji: v.emoji })) });

let ESpeak = null;
async function espeakWav(text, lang, voice) {
  ESpeak ||= (await import('espeak-ng')).default;
  const vc = VOICES[voice] || VOICES.nova;
  const e = await ESpeak({ arguments: ['-v', (LANG[lang] || 'en-us') + vc.v, '-p', String(vc.p), '-s', String(vc.s), '-w', 'o.wav', text], print: () => {}, printErr: () => {} });
  return Buffer.from(e.FS.readFile('o.wav'));
}
async function eleven(text, voice) {
  const vid = process.env['ELEVENLABS_VOICE_' + voice.toUpperCase()] || process.env.ELEVENLABS_VOICE || '21m00Tcm4TlvDq8ikWAM';
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${vid}`, { method: 'POST', headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }) });
  if (!r.ok) throw new Error('elevenlabs ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}
function ff(input, af) {
  return new Promise((res, rej) => {
    const p = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-af', `${af ? af + ',' : ''}highpass=f=70,loudnorm=I=-16:TP=-1.5,aformat=sample_rates=44100:channel_layouts=mono`, '-c:a', 'aac', '-b:a', '96k', '-f', 'adts', 'pipe:1']);
    const out = []; let err = ''; p.stdout.on('data', d => out.push(d)); p.stderr.on('data', d => err += d);
    p.on('close', c => c ? rej(new Error('tts ffmpeg ' + err.slice(-300))) : res(Buffer.concat(out))); p.on('error', rej);
    p.stdin.on('error', () => {}); p.stdin.end(input);
  });
}
// → { data: AAC (ADTS) buffer, mime, duration }
export async function synth(text, lang = 'en', voice = 'nova') {
  const t = String(text).replace(/\s+/g, ' ').trim().slice(0, 500);
  if (!t) throw Object.assign(new Error('empty'), { code: 400 });
  let raw, af = (VOICES[voice] || VOICES.nova).af;
  if (provider() === 'elevenlabs') { try { raw = await eleven(t, voice); af = voice === 'robot' ? af : ''; } catch (e) { console.error('[tts]', e.message); } }
  if (!raw) raw = await espeakWav(t, lang, voice);
  const data = await ff(raw, af);
  return { data, mime: 'audio/aac', duration: Math.round(data.length / (96000 / 8) * 10) / 10 };
}
