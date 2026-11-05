// Content safety: blocks sexual/nudity content, anything sexual involving minors, extreme violence & hate in prompts,
// captions and comments (RU/UK/EN). Real providers additionally run their own safety checker (enabled).
const BAD = [
  /\bnud(e|ity|es)\b/i, /\bnaked\b/i, /\bnsfw\b/i, /\bporn/i, /\bsex(y|ual)?\b/i, /\berotic/i, /\btopless\b/i, /\blingerie\b/i, /\bbikini\b/i, /\bundress/i, /\bstrip(per|tease)?\b/i, /\bhentai\b/i, /\bfetish/i, /\bboobs?\b/i, /\bonlyfans\b/i,
  /голы[йеаx]/i, /гола[яу]/i, /обнаж/i, /\bню\b/i, /порн/i, /секс/i, /эроти/i, /еротик/i, /интим/i, /раздет/i, /роздяг/i, /без\s*одежд/i, /без\s*одяг/i, /стрипт/i, /сиськ/i, /грудь\s*голая/i, /купальник/i, /белье|білизн/i, /хентай/i,
  /\b(child|kid|minor|teen|underage|loli|shota)\w*\b.*\b(sex|nude|naked|kiss|bed)/i, /(ребен|ребён|дет|дитин|школьниц|школярк|малолет|неповнолiт|неповнолiт|несовершеннолет)\w*.*(секс|гол|обнаж|раздет|интим|поцел)/i,
  /(sex|nude|naked).*\b(child|kid|minor|teen|underage)/i, /(секс|гол|обнаж|раздет|интим).*(ребен|ребён|дет|дитин|школьниц|малолет|несовершеннолет)/i,
  /\b(gore|behead|decapitat|suicide|self[- ]?harm)\w*/i, /(расчлен|обезглав|самоубий|суицид|самогубств|кров[ьи]\s*кишк)/i,
  /\b(nazi|hitler|swastika|isis)\b/i, /(нацис|гитлер|свастик|игил)/i,
];
export function check(text) {
  const t = String(text || '').normalize('NFKC').replace(/[0@]/g, 'o').replace(/[1!]/g, 'i').replace(/3/g, 'e');
  for (const re of BAD) if (re.test(t)) return { ok: false, reason: 'unsafe' };
  return { ok: true };
}
