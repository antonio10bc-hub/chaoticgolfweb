// Utilidades compartidas por el generador del oráculo y los tests.
import { createHash } from 'node:crypto';

// RNG determinista (LCG) usado como Math.random del juego original y como rand del motor en los tests
export function mkRng(s) {
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// JSON con claves ordenadas: el orden de las propiedades no afecta a la comparación
export function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  const keys = Object.keys(v).filter(k => v[k] !== undefined).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
}

export const hash = s => createHash('sha1').update(s).digest('hex').slice(0, 16);

// estado canónico comparable: S completo + acción pendiente (la pelota se reduce a su jugador)
export function canonical(S, pending) {
  // aiStyles (personalidad de los bots) es metadato de la IA, no de las reglas: fuera
  if (S && S.aiStyles !== undefined) { S = { ...S }; delete S.aiStyles; }
  const pd = pending ? { ...pending, ball: pending.ball ? pending.ball.player : undefined } : null;
  return stableStringify({ S, pending: pd });
}
