// RNG con semilla (mulberry32). El estado es un entero de 32 bits: serializable,
// así una partida se puede reproducir exactamente conociendo su semilla.
export function mulberry32(state) {
  let s = state >>> 0;
  const next = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let r = Math.imul(s ^ (s >>> 15), 1 | s);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  next.getState = () => s;
  return next;
}

export const randomSeed = () =>
  (typeof crypto !== 'undefined' && crypto.getRandomValues)
    ? crypto.getRandomValues(new Uint32Array(1))[0]
    : (Math.random() * 2 ** 32) >>> 0;

// Fisher-Yates con el RNG dado
export function shuffle(a, rand) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
