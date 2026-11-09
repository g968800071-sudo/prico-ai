// Payments. Mode "demo": purchases are simulated (no money moves) so the full flow can be tested.
// To go live: web/PWA → Stripe Checkout (STRIPE_SECRET_KEY); Android app → Google Play Billing (required for
// digital goods in Play apps); iPhone App Store build → Apple In-App Purchase. See README "Payments".
//
// Tiers (EUR):
//   Free  — AI photos with watermark, 3 AI videos to try
//   Plus  — 5.99/mo or 39.99/yr: no watermark, HD, ~20 AI videos/month, all templates
//   Pack  — 10 videos one-time for 2.99 (no subscription)
//   Trial — 7 free days of Plus (once per account); demo sets a trial flag + upgrade UI
export const PRODUCTS = [
  { id: 'plus_month', kind: 'sub', price: 5.99, currency: 'EUR', days: 30, videos: 20, title: { en: 'Plus monthly', ru: 'Plus на месяц', uk: 'Plus на місяць', es: 'Plus mensual', pt: 'Plus mensal', de: 'Plus monatlich', fr: 'Plus mensuel', tr: 'Plus aylık', ar: 'Plus شهري', hi: 'Plus मासिक', id: 'Plus bulanan' } },
  { id: 'plus_year', kind: 'sub', price: 39.99, currency: 'EUR', days: 365, videos: 20, best: true, title: { en: 'Plus yearly', ru: 'Plus на год', uk: 'Plus на рік', es: 'Plus anual', pt: 'Plus anual', de: 'Plus jährlich', fr: 'Plus annuel', tr: 'Plus yıllık', ar: 'Plus سنوي', hi: 'Plus वार्षिक', id: 'Plus tahunan' } },
  { id: 'plus_trial', kind: 'trial', price: 0, currency: 'EUR', days: 7, videos: 20, title: { en: '7-day free trial', ru: '7 дней бесплатно', uk: '7 днів безкоштовно', es: 'Prueba gratis 7 días', pt: 'Teste grátis 7 dias', de: '7 Tage kostenlos', fr: 'Essai gratuit 7 jours', tr: '7 gün ücretsiz', ar: 'تجربة 7 أيام مجانًا', hi: '7 दिन मुफ़्त ट्रायल', id: 'Uji coba gratis 7 hari' } },
  { id: 'pack_10', kind: 'pack', price: 2.99, currency: 'EUR', credits: 10 },
  { id: 'coins_70', kind: 'coins', price: 0.99, currency: 'EUR', coins: 70 },
  { id: 'coins_350', kind: 'coins', price: 4.99, currency: 'EUR', coins: 350 },
  { id: 'coins_1400', kind: 'coins', price: 19.99, currency: 'EUR', coins: 1400, best: true },
  { id: 'coins_3500', kind: 'coins', price: 49.99, currency: 'EUR', coins: 3500 },
];
// End-user payments are postponed. Prices stay visible. Nothing is charged and nothing is granted.
export const mode = () => 'postponed';

export function grant(u, p) {
  if (p.kind === 'sub' || p.kind === 'trial') {
    const days = p.days || 30;
    const base = Math.max(Date.now(), u.plus?.until || 0);
    // Starting a paid plan after a trial (or renewing) always extends from "now or later", keeps the monthly quota.
    u.plus = { ...(u.plus || {}), until: base + days * 86400000, trial: p.kind === 'trial', month: (u.plus?.month) || null, used: u.plus?.used || 0 };
    if (p.kind === 'trial') u.trialUsed = true;
  } else if (p.kind === 'coins') {
    u.coins = (u.coins || 0) + p.coins;
  } else {
    u.credits = (u.credits || 0) + (p.credits || 0);
  }
  (u.purchases ||= []).push({ id: p.id, at: Date.now(), price: p.price, mode: mode() });
}

export async function buy(u, productId) {
  const p = PRODUCTS.find(x => x.id === productId);
  if (!p) throw Object.assign(new Error('bad_product'), { code: 400 });
  // Do not call grant(). A postponed purchase must not look successful.
  void u;
  throw Object.assign(new Error('payments_postponed'), { code: 503 });
}
