// PRICO AI UI strings. English is bundled; other languages load on demand. Missing keys fall back to English.
import en from './i18n/en.js';
export const LANGS = [['en', 'English'], ['es', 'Español'], ['pt', 'Português'], ['de', 'Deutsch'], ['fr', 'Français'], ['tr', 'Türkçe'],
  ['ru', 'Русский'], ['uk', 'Українська'], ['ar', 'العربية'], ['hi', 'हिन्दी'], ['id', 'Bahasa Indonesia']];
const CODES = LANGS.map(l => l[0]);
let cur = 'en', dict = en;
export function detect() {
  const saved = localStorage.getItem('prico.lang'); if (saved && CODES.includes(saved)) return saved;
  for (const l of navigator.languages || [navigator.language || 'en']) { const b = String(l).slice(0, 2).toLowerCase(); if (CODES.includes(b)) return b; }
  return 'en';
}
export async function setLang(l) {
  cur = CODES.includes(l) ? l : 'en';
  dict = cur === 'en' ? en : (await import(`./i18n/${cur}.js`).catch(() => ({ default: en }))).default;
  document.documentElement.lang = cur; document.documentElement.dir = cur === 'ar' ? 'rtl' : 'ltr';
}
export const lang = () => cur;
export function t(k, v) { let s = dict[k] ?? en[k] ?? k; if (v) for (const [a, b] of Object.entries(v)) s = s.split('{' + a + '}').join(b); return s; }
