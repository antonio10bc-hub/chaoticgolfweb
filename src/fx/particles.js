/* ---------- motor de partículas (canvas) ----------
   Todo es decorativo: nunca toca el estado del juego. Partículas dibujadas en
   canvas con rAF (límite JUICE.particles.max por capa, DPR ≤ 2), RNG decorativo
   propio (no consume el azar del juego) y silenciadas con reduced-motion. */
import { JUICE, REDUCED } from './juice.js';
import { cellCenterPx } from '../ui/geometry.js';

let fxRngState = 0x2f6e2b1;
export const fxRand = () => { fxRngState = (fxRngState * 1103515245 + 12345) & 0x7fffffff; return fxRngState / 0x7fffffff; };

const FXP = { board: [], fixed: [], raf: 0, last: 0, canvas: {}, ctx: {} };
export const fxCount = () => FXP.board.length + FXP.fixed.length;

function fxGetCanvas(fixed) {
  const id = fixed ? 'fxCanvasFixed' : 'fxCanvas';
  let c = FXP.canvas[id];
  if (c && c.isConnected) return c;
  c = document.getElementById(id);
  if (!c) {
    c = document.createElement('canvas');
    c.id = id;
    c.className = fixed ? 'fxCanvasFixed' : 'fxCanvas';
    (fixed ? document.body : document.getElementById('boardArea')).appendChild(c);
  }
  FXP.canvas[id] = c; FXP.ctx[id] = null;
  return c;
}
const fxGetCtx = c => FXP.ctx[c.id] || (FXP.ctx[c.id] = c.getContext('2d'));

function fxSizeCanvas(c, fixed) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = fixed ? window.innerWidth : c.parentElement.offsetWidth;
  const h = fixed ? window.innerHeight : c.parentElement.offsetHeight;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    c.style.width = w + 'px'; c.style.height = h + 'px';
  }
  return dpr;
}

// ráfaga de partículas en coordenadas de píxel dentro de su capa
export function fxSpawn(px, py, { n = 8, colors = ['#fff'], size = 7, dist = 42, up = 0, dur = 480,
                                  gravity = 0, rect = false, fixed = false, angMin = 0, angMax = Math.PI * 2,
                                  shape = null, alpha = 1 } = {}) {
  if (REDUCED) return;
  const list = fixed ? FXP.fixed : FXP.board;
  for (let i = 0; i < n; i++) {
    if (list.length >= JUICE.particles.max) break;
    const ang = angMin + fxRand() * (angMax - angMin);
    const dd = dist * (0.45 + fxRand() * 0.85);
    list.push({
      sx: px, sy: py,
      dx: Math.cos(ang) * dd, dy: Math.sin(ang) * dd - up + gravity,
      size: size * (0.55 + fxRand() * 0.9),
      color: colors[(fxRand() * colors.length) | 0],
      shape: shape || (rect ? 'rect' : 'circ'),
      vr: (fxRand() - .5) * 360,
      age: 0, ttl: dur * (0.7 + fxRand() * 0.6),
      alpha,
    });
  }
  fxKick();
}
export const fxBurstCell = (x, y, opts) => { const { px, py } = cellCenterPx(x, y); fxSpawn(px, py, opts); };

function fxKick() { if (!FXP.raf) { FXP.last = 0; FXP.raf = requestAnimationFrame(fxTick); } }
function fxTick(ts) {
  const dt = FXP.last ? Math.min(50, ts - FXP.last) : 16;
  FXP.last = ts; FXP.raf = 0;
  fxDrawLayer(false, dt); fxDrawLayer(true, dt);
  if (FXP.board.length || FXP.fixed.length) FXP.raf = requestAnimationFrame(fxTick);
}
function fxDrawLayer(fixed, dt) {
  const list = fixed ? FXP.fixed : FXP.board;
  const c = fxGetCanvas(fixed);
  if (!list.length) { if (c.width) { c.width = 0; c.height = 0; } return; }
  const dpr = fxSizeCanvas(c, fixed);
  const ctx = fxGetCtx(c);
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, c.width / dpr, c.height / dpr);
  // compacta la lista in situ (sin splice) conservando el orden de dibujado (de atrás hacia delante)
  let keep = list.length;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.age += dt;
    if (p.age >= p.ttl) { p.dead = true; keep--; continue; }
    const pr = p.age / p.ttl, q = 1 - pr, e = 1 - q * q * q;   // easeOutCubic
    if (p.shape === 'wind') { drawWind(ctx, p, pr, dpr); continue; }
    const x = p.sx + p.dx * e, y = p.sy + p.dy * e;
    ctx.globalAlpha = q * p.alpha;
    ctx.fillStyle = p.color;
    // translate + rotate en una sola matriz
    const a = p.vr * pr * Math.PI / 180, cs = Math.cos(a) * dpr, sn = Math.sin(a) * dpr;
    ctx.setTransform(cs, sn, -sn, cs, x * dpr, y * dpr);
    const s = p.shape === 'circ' ? p.size * (1 - 0.65 * pr) : p.size;
    if (p.shape === 'rect') ctx.fillRect(-s / 2, -s / 2, s, s);
    else if (p.shape === 'leaf') { ctx.beginPath(); ctx.ellipse(0, 0, s * 0.72, s * 0.36, 0, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, Math.PI * 2); ctx.fill(); }
  }
  if (keep !== list.length) {
    let j = 0;
    for (let i = 0; i < list.length; i++) if (!list[i].dead) list[j++] = list[i];
    list.length = j;
  }
  ctx.globalAlpha = 1;
}

/* ráfaga de viento: una estela que se va trazando, avanza ondulando y acaba en un remolino pequeño (la cola,
   desvanecida con un degradado); al final la cola se recoge hacia el remolino y se apaga. Va recta, sin el
   frenado de las demás partículas; p.vr da la variedad (el signo: remolino hacia arriba o hacia abajo). */
const WIND_N = 44, WIND_TAIL = .56;
function windPt(t, R, L, s, flip, turns) {
  if (t <= WIND_TAIL) { const u = t / WIND_TAIL; return [-L * (1 - u), flip * Math.sin(u * Math.PI * 1.5) * s * .2 * (1 - u)]; }
  const u = (t - WIND_TAIL) / (1 - WIND_TAIL), phi = u * Math.PI * 2 * turns, r = R * (1 - .7 * u);
  return [r * Math.sin(phi), flip * (r * Math.cos(phi) - R)];
}
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
function drawWind(ctx, p, pr, dpr) {
  const s = p.size, R = s * .5, L = s * 3.6, flip = p.vr < 0 ? -1 : 1;
  const x = p.sx + p.dx * pr, y = p.sy + p.dy * pr + Math.sin(pr * Math.PI * 2 + p.vr) * s * .45;
  const head = Math.atan2(p.dy, p.dx) + Math.sin(pr * Math.PI * 3 + p.vr) * .07;
  const cs = Math.cos(head) * dpr, sn = Math.sin(head) * dpr;
  ctx.setTransform(cs, sn, -sn, cs, x * dpr, y * dpr);
  // se traza en el primer cuarto de su vida y se recoge en el último 40 %
  const i1 = Math.round(WIND_N * Math.min(1, pr / .26)), i0 = Math.round(WIND_N * .82 * Math.max(0, (pr - .6) / .4));
  if (i1 - i0 < 2) return;
  const turns = 1.05 + .3 * Math.min(1, pr / .5); // el remolino se cierra un poco al avanzar
  ctx.beginPath();
  for (let i = i0; i <= i1; i++) { const [qx, qy] = windPt(i / WIND_N, R, L, s, flip, turns); i === i0 ? ctx.moveTo(qx, qy) : ctx.lineTo(qx, qy); }
  const g = ctx.createLinearGradient(-L, 0, R * .4, 0);
  g.addColorStop(0, rgba(p.color, 0)); g.addColorStop(.55, rgba(p.color, .55)); g.addColorStop(1, rgba(p.color, 1));
  ctx.globalAlpha = p.alpha * Math.min(1, pr / .12, (1 - pr) / .2);
  ctx.strokeStyle = g; ctx.lineWidth = Math.max(1.3, s * .16); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.stroke();
}
