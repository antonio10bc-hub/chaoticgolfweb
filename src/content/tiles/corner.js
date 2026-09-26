// Esquina (baraja de minigolf): un triángulo de madera. Si la pelota llega por uno de sus dos lados
// abiertos, la cara inclinada la desvía 90°; si llega por la espalda, rebota como en un bloque.
// No cuenta como casilla. `rot` (0-3): dónde está el ángulo recto (0 arriba-izq, 1 arriba-der,
// 2 abajo-der, 3 abajo-izq); se elige al colocarla.
import { WOOD } from './wood.js';
// cuña maciza como el bloque: cara superior biselada con vetas paralelas a la cara inclinada, canto
// frontal en sombra, banda clara en la cara que desvía y clavijas en las puntas
const X0 = 7, X1 = 93, Y0 = 8, Y1 = 120, DEPTH = 13;
// [ángulo recto, punta horizontal, punta vertical] según rot
const TRI = [
  [[X0, Y0], [X1, Y0], [X0, Y1]],
  [[X1, Y0], [X0, Y0], [X1, Y1]],
  [[X1, Y1], [X0, Y1], [X1, Y0]],
  [[X0, Y1], [X1, Y1], [X0, Y0]],
];
const f1 = n => Math.round(n * 10) / 10;
const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
// polígono con las puntas redondeadas (r px en cada vértice)
function roundPoly(p, r) {
  const n = p.length, seg = [];
  for (let i = 0; i < n; i++) {
    const v = p[i], a = p[(i + n - 1) % n], b = p[(i + 1) % n];
    const cut = (q) => { const d = Math.hypot(q[0] - v[0], q[1] - v[1]), k = Math.min(r, d / 2) / d; return [v[0] + (q[0] - v[0]) * k, v[1] + (q[1] - v[1]) * k]; };
    const s = cut(a), e = cut(b);
    seg.push(`${i ? 'L' : 'M'}${f1(s[0])} ${f1(s[1])}Q${f1(v[0])} ${f1(v[1])} ${f1(e[0])} ${f1(e[1])}`);
  }
  return seg.join('') + 'Z';
}
// envolvente convexa (la cuña con su grosor)
function hull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length > 1 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const shift = (p, dx, dy) => p.map(([x, y]) => [x + dx, y + dy]);

function pic(r) {
  const t = TRI[r], [R, A, B] = t;
  const c = [(R[0] + A[0] + B[0]) / 3, (R[1] + A[1] + B[1]) / 3];
  const inner = t.map(v => lerp(v, c, .2));                  // bisel
  const [iR, iA, iB] = inner;
  const body = hull([...t, ...shift(t, 0, DEPTH)]);
  // vetas paralelas a la cara inclinada, apenas onduladas y sin tocar los bordes
  const veins = [.36, .58, .8].map(k => {
    const p = lerp(lerp(iR, iA, k), lerp(iR, iB, k), .1), q = lerp(lerp(iR, iA, k), lerp(iR, iB, k), .9);
    const m = lerp(p, q, .5), n = [(q[1] - p[1]) * .035, (p[0] - q[0]) * .035];
    return `M${f1(p[0])} ${f1(p[1])}Q${f1(m[0] + n[0])} ${f1(m[1] + n[1])} ${f1(q[0])} ${f1(q[1])}`;
  }).join('');
  // banda de la cara que desvía, un poco hacia dentro del canto
  const hA = lerp(A, c, .1), hB = lerp(B, c, .1);
  const band = `M${f1(lerp(hA, hB, .06)[0])} ${f1(lerp(hA, hB, .06)[1])}L${f1(lerp(hA, hB, .94)[0])} ${f1(lerp(hA, hB, .94)[1])}`;
  // brillo en los lados que miran a la luz (arriba e izquierda)
  const lit = inner.map((v, i) => [v, inner[(i + 1) % 3]]).filter(([a, b]) => {
    if (Math.abs(a[1] - b[1]) < .5) return a[1] < c[1]; // lado horizontal: el de arriba
    if (Math.abs(a[0] - b[0]) < .5) return a[0] < c[0]; // lado vertical: el de la izquierda
    return false;
  }).map(([a, b]) => { const p = lerp(a, b, .12), q = lerp(a, b, .8); return `M${f1(p[0])} ${f1(p[1])}L${f1(q[0])} ${f1(q[1])}`; }).join('');
  const knot = lerp(lerp(iR, iA, .5), lerp(iR, iB, .5), .35);
  const pegs = [lerp(iR, c, .25), lerp(iA, c, .42), lerp(iB, c, .42)];
  return '<svg class="tilePic woodPic" viewBox="0 0 100 140" aria-hidden="true">' +
    `<path d="${roundPoly(shift(body, 5, 7), 10)}" fill="rgba(40,25,10,.32)"/>` +                                   // sombra
    `<path d="${roundPoly(body, 10)}" fill="#8A5A2E" stroke="${WOOD.dark}" stroke-width="2" stroke-linejoin="round"/>` + // canto
    `<path d="${roundPoly(t, 10)}" fill="${WOOD.mid}" stroke="${WOOD.dark}" stroke-width="2" stroke-linejoin="round"/>` + // cara superior
    `<path d="${roundPoly(inner, 6)}" fill="#DDAE72"/>` +                                                             // bisel
    `<path d="${veins}" fill="none" stroke="rgba(122,82,48,.32)" stroke-width="1.5" stroke-linecap="round"/>` +
    `<ellipse cx="${f1(knot[0])}" cy="${f1(knot[1])}" rx="4.5" ry="3" fill="none" stroke="rgba(122,82,48,.42)" stroke-width="1.4"/>` +
    `<path d="${lit}" stroke="rgba(255,255,255,.5)" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
    `<path d="${band}" stroke="${WOOD.dark}" stroke-width="6.5" stroke-linecap="round" opacity=".55"/>` +              // cara que desvía
    `<path d="${band}" stroke="#F6E2BE" stroke-width="3.6" stroke-linecap="round"/>` +
    pegs.map(([x, y]) => `<circle cx="${f1(x)}" cy="${f1(y)}" r="2.2" fill="${WOOD.dark}" opacity=".55"/><circle cx="${f1(x - .6)}" cy="${f1(y - .6)}" r=".8" fill="#F6E2BE" opacity=".6"/>`).join('') +
    '</svg>';
}
const PICS = [0, 1, 2, 3].map(pic);

export default {
  type: 'corner',
  corner: true,
  device: true,
  rotates: true,
  cellClass: 'wood',
  picFor: (tile = {}) => PICS[(tile.rot || 0) % 4],
  tileClass: 'tile-corner',
  dust: 'sand',
  placeSound: 'wood',
};
