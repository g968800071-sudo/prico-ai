// Payments. Mode "demo": purchases are simulated (no money moves) so the full flow can be tested.
// To go live: web/PWA → Stripe Checkout (STRIPE_SECRET_KEY); Android app → Google Play Billing (required for
// digital goods in Play apps); iPhone App Store build → Apple In-App Purchase. See README "Payments".
export const PRODUCTS = [
  { id: 'plus_month', kind: 'sub', price: 6.99, currency: 'EUR', videos: 40, title: { ru: 'PRICO AI Plus', uk: 'PRICO AI Plus', en: 'PRICO AI Plus' }, best: true },
  { id: 'pack_10', kind: 'pack', price: 4.99, currency: 'EUR', credits: 10 },
  { id: 'pack_30', kind: 'pack', price: 11.99, currency: 'EUR', credits: 30 },
  { id: 'pack_100', kind: 'pack', price: 29.99, currency: 'EUR', credits: 100 },
  { id: 'coins_70', kind: 'coins', price: 0.99, currency: 'EUR', coins: 70 },
  { id: 'coins_350', kind: 'coins', price: 4.99, currency: 'EUR', coins: 350 },
  { id: 'coins_1400', kind: 'coins', price: 19.99, currency: 'EUR', coins: 1400, best: true },
  { id: 'coins_3500', kind: 'coins', price: 49.99, currency: 'EUR', coins: 3500 },
];
export const mode = () => (process.env.PAYMENTS_MODE === 'stripe' && process.env.STRIPE_SECRET_KEY ? 'stripe' : 'demo');
export function grant(u, p) {
  if (p.kind === 'sub') { const base = Math.max(Date.now(), u.plus?.until || 0); u.plus = { ...(u.plus || {}), until: base + 30 * 86400000 }; }
  else if (p.kind === 'coins') u.coins = (u.coins || 0) + p.coins;
  else u.credits = (u.credits || 0) + p.credits;
  (u.purchases ||= []).push({ id: p.id, at: Date.now(), price: p.price, mode: mode() });
}
export async function buy(u, productId) {
  const p = PRODUCTS.find(x => x.id === productId); if (!p) throw Object.assign(new Error('bad_product'), { code: 400 });
  if (mode() === 'demo') { grant(u, p); return { ok: true, demo: true, product: p }; }
  // Stripe hook (not active until keys are configured): create a Checkout Session and return its URL.
  throw Object.assign(new Error('payments_not_configured'), { code: 501 });
}
