// Caption + hashtag suggestions for TikTok / Reels / Shorts. Local & free; pluggable LLM later (see README).
import { byId, loc } from './catalog.js';
const P = {
  en: ['POV: {t} {e}', 'Nobody: … Me: {t} {e}', 'Wait for the end 😂', 'Made this in 10 seconds with PRICO AI ✨', 'Tag a friend who needs this {e}', 'Rate it 1–10 👇'],
  ru: ['POV: {t} {e}', 'Никто: … Я: {t} {e}', 'Досмотри до конца 😂', 'Сделал(а) за 10 секунд в PRICO AI ✨', 'Отметь друга, которому это нужно {e}', 'Оцени от 1 до 10 👇'],
  uk: ['POV: {t} {e}', 'Ніхто: … Я: {t} {e}', 'Дивись до кінця 😂', 'Зроблено за 10 секунд у PRICO AI ✨', 'Познач друга, якому це треба {e}', 'Оціни від 1 до 10 👇'],
  es: ['POV: {t} {e}', 'Nadie: … Yo: {t} {e}', 'Espera al final 😂', 'Hecho en 10 segundos con PRICO AI ✨', 'Etiqueta a un amigo {e}', 'Califícalo del 1 al 10 👇'],
  pt: ['POV: {t} {e}', 'Ninguém: … Eu: {t} {e}', 'Espera até o final 😂', 'Feito em 10 segundos no PRICO AI ✨', 'Marca um amigo {e}', 'Nota de 1 a 10 👇'],
  de: ['POV: {t} {e}', 'Niemand: … Ich: {t} {e}', 'Warte aufs Ende 😂', 'In 10 Sekunden mit PRICO AI gemacht ✨', 'Markiere einen Freund {e}', 'Bewerte 1–10 👇'],
  fr: ['POV : {t} {e}', 'Personne : … Moi : {t} {e}', 'Attends la fin 😂', 'Fait en 10 secondes avec PRICO AI ✨', 'Identifie un ami {e}', 'Note de 1 à 10 👇'],
  tr: ['POV: {t} {e}', 'Kimse: … Ben: {t} {e}', 'Sonuna kadar izle 😂', 'PRICO AI ile 10 saniyede yaptım ✨', 'Bir arkadaşını etiketle {e}', '1–10 arası puan ver 👇'],
  ar: ['POV: {t} {e}', 'لا أحد: … أنا: {t} {e}', 'انتظر النهاية 😂', 'صنعته في 10 ثوانٍ مع PRICO AI ✨', 'منشن صديقك {e}', 'قيّمه من 1 إلى 10 👇'],
  hi: ['POV: {t} {e}', 'कोई नहीं: … मैं: {t} {e}', 'आखिर तक देखो 😂', 'PRICO AI से 10 सेकंड में बनाया ✨', 'दोस्त को टैग करो {e}', '1–10 में रेट करो 👇'],
  id: ['POV: {t} {e}', 'Gak ada yang nanya: … Aku: {t} {e}', 'Tunggu sampai akhir 😂', 'Dibuat 10 detik pakai PRICO AI ✨', 'Tag temanmu {e}', 'Nilai 1–10 👇'],
};
const LOCAL_TAGS = { en: ['#fyp', '#foryou'], ru: ['#рекомендации', '#тренды'], uk: ['#рек', '#українськийтікток'], es: ['#parati', '#viral'], pt: ['#fyp', '#viral'], de: ['#fürdich', '#fyp'], fr: ['#pourtoi', '#fyp'], tr: ['#keşfet', '#fyp'], ar: ['#اكسبلور', '#fyp'], hi: ['#trending', '#viral'], id: ['#fyp', '#fypシ'] };
export const NICHES = {
  funny: { emoji: '😂', tags: ['#funny', '#meme', '#comedy', '#lol'], music: 'toon', words: { en: 'me trying to be normal', ru: 'я пытаюсь быть нормальным', uk: 'я намагаюся бути нормальним' } },
  travel: { emoji: '✈️', tags: ['#travel', '#wanderlust', '#travelvlog', '#explore'], music: 'summer', words: { en: 'my trip in 15 seconds', ru: 'моя поездка за 15 секунд', uk: 'моя подорож за 15 секунд' } },
  food: { emoji: '🍕', tags: ['#food', '#foodie', '#recipe', '#yummy'], music: 'food', words: { en: 'the best thing I ate this week', ru: 'самое вкусное за неделю', uk: 'найсмачніше за тиждень' } },
  fitness: { emoji: '💪', tags: ['#fitness', '#gym', '#workout', '#motivation'], music: 'trap', words: { en: 'day 1 vs day 100', ru: 'день 1 vs день 100', uk: 'день 1 vs день 100' } },
  business: { emoji: '💼', tags: ['#business', '#smallbusiness', '#entrepreneur', '#marketing'], music: 'corporate', words: { en: 'how we do it', ru: 'как мы это делаем', uk: 'як ми це робимо' } },
  birthday: { emoji: '🎂', tags: ['#birthday', '#happybirthday', '#party', '#celebration'], music: 'birthday', words: { en: 'best birthday ever', ru: 'лучший день рождения', uk: 'найкращий день народження' } },
  love: { emoji: '💖', tags: ['#love', '#couple', '#bestfriends', '#memories'], music: 'love', words: { en: 'us', ru: 'мы', uk: 'ми' } },
  vlog: { emoji: '🎥', tags: ['#vlog', '#dayinmylife', '#aesthetic', '#reels'], music: 'lofi', words: { en: 'a day in my life', ru: 'один мой день', uk: 'один мій день' } },
};
const TPL_NICHE = { funny: 'funny', viral: 'funny', avatar: 'vlog', toys: 'funny', transform: 'funny', place: 'travel', friends: 'love', greeting: 'birthday', movie: 'funny' };

export function suggest({ lang = 'en', templateId, niche, idea }) {
  const L = P[lang] ? lang : 'en';
  const t = templateId && byId(templateId);
  const n = NICHES[niche] || NICHES[t ? TPL_NICHE[t.group] : 'funny'] || NICHES.funny;
  const short = s => { s = String(s).split(/[\n.!?]/)[0].trim(); if (s.length <= 48) return s; return s.slice(0, 48).replace(/\s+\S*$/, '') + '…'; };
  const topic = (idea && short(idea)) || (t ? loc(t.name, L) : (n.words[L] || n.words.en));
  const e = t?.emoji || n.emoji;
  const caps = P[L].map(p => p.replace('{t}', topic).replace('{e}', e));
  const pick = [caps[0], caps[1], caps[2], caps[3]];
  const tags = [...new Set([...LOCAL_TAGS[L], ...n.tags, '#ai', '#aivideo', '#pricoai', t ? '#' + loc(t.name, 'en').toLowerCase().replace(/[^a-z0-9]/g, '') : '#reels', '#tiktok', '#reels', '#shorts'])].slice(0, 12);
  return { captions: pick, hashtags: tags };
}
