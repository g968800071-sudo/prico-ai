// Pure server-capability check. Safe to import from Node tests and the browser.
// An old backend (health.provider === "demo", payments === "demo", no capabilities)
// must not be treated as the 1.2 safeguards.
export const CONTRACT = 2;

export function assessServer(health) {
  const c = health && health.capabilities;
  const contract = Number(c && c.contract) || 0;
  return {
    contract,
    generationSafe: contract >= CONTRACT && c.generation === 'unavailable-or-real',
    paymentsSafe: contract >= CONTRACT && c.payments === 'postponed',
  };
}
