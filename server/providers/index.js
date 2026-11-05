import * as demo from './demo.js';
import * as fal from './fal.js';
export function current() {
  if ((process.env.AI_PROVIDER || '').toLowerCase() === 'fal' && process.env.FAL_KEY) return fal;
  return demo;
}
export { demo };
