// El fondo de los menús: un mapa de curvas de nivel, como las de un libro de distancias de golf, en una baldosa que
// empalma consigo misma. El relieve es una suma de ondas con números de onda enteros (así es periódico: lo de un borde
// sigue en el de enfrente), se corta a alturas fijas con marching squares y las líneas se suavizan con curvas. Una de
// cada cuatro, la curva maestra, un poco más marcada. Se genera una vez al arrancar (unos milisegundos): no pesa en la
// descarga. (styles/screens.css la pinta en #scene::before; bg-debug.js la cambia en directo)
const WAVES = [[1, 0, 1], [0, 1, 1], [1, 1, .8], [1, -1, .8], [2, 1, .45], [1, 2, .45], [2, -1, .4], [-1, 2, .4], [3, 1, .2], [1, -3, .2], [3, 2, .12], [2, 3, .12]];
const CELLS = 80, LEVELS = 11;
// (los cortes de cada casilla según qué esquinas quedan por encima: arriba, derecha, abajo, izquierda)
const CASES = { 1: ['LT'], 2: ['TR'], 3: ['LR'], 4: ['RB'], 5: ['LT', 'RB'], 6: ['TB'], 7: ['LB'], 8: ['BL'], 9: ['BT'], 10: ['TR', 'BL'], 11: ['BR'], 12: ['RL'], 13: ['RT'], 14: ['TL'] };

export function topoTile({ size = 640, alpha = .05, color = '#F1F1DC', seed = 7 } = {}) {
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const W = WAVES.map(([k, l, a]) => ({ k, l, a, p: rnd() * Math.PI * 2 }));
  const step = size / CELLS, g = [];
  let lo = Infinity, hi = -Infinity;
  for (let j = 0; j <= CELLS; j++) {
    g[j] = [];
    for (let i = 0; i <= CELLS; i++) {
      const v = W.reduce((t, w) => t + w.a * Math.sin(2 * Math.PI * (w.k * i + w.l * j) / CELLS + w.p), 0);
      g[j][i] = v; lo = Math.min(lo, v); hi = Math.max(hi, v);
    }
  }
  const r1 = n => Math.round(n * 10) / 10, reg = [], idx = [];
  for (let L = 1; L <= LEVELS; L++) {
    const z = lo + (hi - lo) * L / (LEVELS + 1), segs = [];
    for (let j = 0; j < CELLS; j++) for (let i = 0; i < CELLS; i++) {
      const c = (g[j][i] > z) | (g[j][i + 1] > z) << 1 | (g[j + 1][i + 1] > z) << 2 | (g[j + 1][i] > z) << 3;
      if (!c || c === 15) continue;
      const at = (i1, j1, i2, j2) => { const a = g[j1][i1], t = (z - a) / (g[j2][i2] - a); return [(i1 + (i2 - i1) * t) * step, (j1 + (j2 - j1) * t) * step]; };
      const edge = { T: () => at(i, j, i + 1, j), R: () => at(i + 1, j, i + 1, j + 1), B: () => at(i, j + 1, i + 1, j + 1), L: () => at(i, j, i, j + 1) };
      CASES[c].forEach(([a, b]) => segs.push([edge[a](), edge[b]()]));
    }
    // empalmar los trocitos en líneas largas
    const key = p => r1(p[0]) + ',' + r1(p[1]), ends = new Map(), used = new Set();
    segs.forEach((sg, n) => sg.forEach((p, e) => { const k = key(p); if (!ends.has(k)) ends.set(k, []); ends.get(k).push([n, e]); }));
    let d = '';
    for (let n = 0; n < segs.length; n++) {
      if (used.has(n)) continue;
      used.add(n);
      const line = [...segs[n]];
      for (const back of [false, true]) for (;;) {
        const end = back ? line[0] : line[line.length - 1], next = (ends.get(key(end)) || []).find(([m]) => !used.has(m));
        if (!next) break;
        used.add(next[0]);
        const p = segs[next[0]][1 - next[1]];
        if (back) line.unshift(p); else line.push(p);
      }
      if (line.length < 3) continue;
      d += `M${r1(line[0][0])} ${r1(line[0][1])}`;
      for (let q = 1; q < line.length - 1; q++) d += `Q${r1(line[q][0])} ${r1(line[q][1])} ${r1((line[q][0] + line[q + 1][0]) / 2)} ${r1((line[q][1] + line[q + 1][1]) / 2)}`;
      d += `L${r1(line[line.length - 1][0])} ${r1(line[line.length - 1][1])}`;
    }
    (L % 4 ? reg : idx).push(d);
  }
  // (las copias de alrededor: el trazo que cae justo en el borde no se corta a medias)
  const copies = [-1, 0, 1].flatMap(a => [-1, 0, 1].map(b => a || b ? `<use href='#t' x='${a * size}' y='${b * size}'/>` : '')).join('');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'><g id='t' fill='none' stroke='${color}' stroke-linecap='round'>` +
    `<path stroke-opacity='${alpha}' stroke-width='1.4' d='${reg.join('')}'/><path stroke-opacity='${+(alpha * 1.6).toFixed(3)}' stroke-width='2.2' d='${idx.join('')}'/></g>${copies}</svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}
