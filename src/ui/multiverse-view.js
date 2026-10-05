// Baraja del multiverso en pantalla: las animaciones de sus eventos (src/engine/multiverse.js).
//   absorb   la pelota gira y se encoge hacia el agujero negro
//   clone    sale una copia del agujero (la pieza se crea si hace falta: puede nacer y perderse en la misma jugada)
//   vanish   una copia se va para siempre (fuera del tablero, un meteorito, sin sitio)
//   gravity  la cruz se tiñe de morado, de fuera adentro, con flechas hacia el centro, y un remolino en él
//   gpull    lo que la gravedad mueve se tiñe de morado (translúcido) mientras va
//   gstuck   lo que no puede moverse (otra pelota o un muro delante) tira hacia el centro, tiembla y se queda
//   clash    dos pelotas atraídas chocan en el centro y se quedan donde estaban
//   meteor   un meteorito cae en diagonal, con su estela, en una casilla (los que no dan a nadie, uno tras otro sin esperar)
//   meteorRock  el que se queda como roca: aparece al caer (hasta entonces el tablero no la enseña)
import { app } from './app.js';
import { wait } from './dom.js';
import { pieceEl, copyPiece, renderBoard, markPlaced } from './board.js';
import { setPos, cellCenterPx, pieceCenterPx } from './geometry.js';
import { DIRS } from '../engine/game.js';
import { REDUCED } from '../fx/juice.js';
import { fxSpawn } from '../fx/particles.js';
import { fxShake, fxGetDomLayer, fxSplashRing } from '../fx/effects.js';
import { sfx } from '../audio/sfx.js';

const SPACE_C = ['#C78BF2', '#7B5CE0', '#FFE1A8', '#FFFFFF'];
const FIRE_C = ['#FFD58A', '#F2B05E', '#E8873A', '#FFFFFF'];
const cellEl = (x, y) => document.querySelector(`#board .cell[data-x="${x}"][data-y="${y}"]`);
// un elemento suelto del efecto sobre el tablero (se quita solo)
function fxEl(cls, px, py, ms) {
  const d = document.createElement('div');
  d.className = cls; d.style.left = px + 'px'; d.style.top = py + 'px';
  fxGetDomLayer().appendChild(d);
  setTimeout(() => d.remove(), ms);
  return d;
}

async function absorb(ev) {
  const el = pieceEl(ev.p);
  if (!el) return;
  const { px, py } = cellCenterPx(ev.x, ev.y);
  sfx('absorb');
  fxEl('bhSuck', px, py, 900);
  setPos(el, ev.x, ev.y, REDUCED ? 0 : 320, 'cubic-bezier(.5,0,.9,.5)');
  if (!REDUCED) await el.firstChild.animate([{ transform: 'none' }, { transform: 'rotate(540deg) scale(.2)', opacity: .4 }], { duration: 360, easing: 'ease-in', fill: 'forwards' }).finished;
  // el estallido: sale la original…
  el.firstChild.getAnimations().forEach(a => a.cancel());
  fxSpawn(px, py, { n: 14, colors: SPACE_C, size: 5, dist: 40, dur: 520 });
  fxSplashRing(px, py, 'warp');
  sfx('split');
  if (!REDUCED) el.firstChild.animate([{ transform: 'scale(.3)' }, { transform: 'scale(1.15)', offset: .7 }, { transform: 'none' }], { duration: 300, easing: 'ease-out' });
  await wait(REDUCED ? 60 : 160);
}

async function clone(ev) {
  const el = pieceEl(ev.p) || copyPiece(ev.p);
  if (!el) return;
  el.style.display = 'flex'; el.style.opacity = 1;
  setPos(el, ev.x, ev.y, 0);
  if (!REDUCED) el.firstChild.animate([{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: .7 }, { transform: 'none' }], { duration: 300, easing: 'ease-out' });
  await wait(REDUCED ? 40 : 110);
}

async function vanish(ev) {
  const el = pieceEl(ev.p);
  if (!el) return;
  const c = pieceCenterPx(el);
  if (ev.why !== 'fall') { // (si se ha caído, ya ha salido del tablero; si no, se deshace donde está)
    fxSpawn(c.px, c.py, { n: 12, colors: ev.why === 'meteor' ? FIRE_C : SPACE_C, size: 5, dist: 30, dur: 480, gravity: -6 });
    if (!REDUCED) await el.firstChild.animate([{ transform: 'none', opacity: 1 }, { transform: 'scale(1.4)', opacity: 0, filter: 'blur(3px)' }], { duration: 320, easing: 'ease-out', fill: 'forwards' }).finished;
  }
  sfx('vanish');
  el.remove();
}

// flecha (chevron) hacia el centro: dibujada hacia la derecha y girada
const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l8 8-8 8" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ROT = { right: 0, down: 90, left: 180, up: -90 };
async function gravity(ev) {
  const { px, py } = cellCenterPx(ev.x, ev.y);
  sfx('gravity');
  const glow = (x, y, cls, delay) => { const c = cellEl(x, y); if (!c) return;
    c.classList.remove('gravCell', 'gravCenter'); void c.offsetWidth; c.style.setProperty('--gd', delay + 'ms'); c.classList.add(cls);
    setTimeout(() => c.classList.remove(cls), 1500 + delay); };
  glow(ev.x, ev.y, 'gravCenter', 0);
  // la cruz, de fuera adentro: cada casilla se tiñe y su flecha avanza hacia el centro
  for (const [dx, dy, toward] of [[0, -1, 'down'], [0, 1, 'up'], [-1, 0, 'right'], [1, 0, 'left']]) for (let k = ev.r; k >= 1; k--) {
    const x = ev.x + dx * k, y = ev.y + dy * k, delay = (ev.r - k) * 110;
    if (!cellEl(x, y)) continue;
    glow(x, y, 'gravCell', delay);
    if (REDUCED) continue;
    const c = cellCenterPx(x, y);
    setTimeout(() => { const a = fxEl('gravArrow', c.px, c.py, 1000); a.innerHTML = ARROW; a.style.setProperty('--rot', ROT[toward] + 'deg'); }, delay);
  }
  if (!REDUCED) { fxEl('gravVortex', px, py, 1300); for (let i = 0; i < 2; i++) setTimeout(() => fxEl('gravRing', px, py, 900), 140 + i * 220); }
  await wait(REDUCED ? 120 : 640);
}
// lo que atrae se tiñe de morado mientras va hacia el centro
async function gpull(ev) {
  const el = pieceEl(ev.p);
  if (!el) return;
  el.classList.remove('gravTint'); void el.offsetWidth; el.classList.add('gravTint');
  clearTimeout(el._gt); el._gt = setTimeout(() => el.classList.remove('gravTint'), 1700);
}
// no puede moverse: tira hacia el centro, tiembla contra lo que tiene delante y se queda
async function gstuck(ev) {
  const el = pieceEl(ev.p);
  if (!el) return;
  const d = DIRS[ev.dir], inner = el.firstChild, k = ev.p.startsWith('hole') ? .7 : 1;
  el.classList.remove('gravTint'); void el.offsetWidth; el.classList.add('gravTint');
  clearTimeout(el._gt); el._gt = setTimeout(() => el.classList.remove('gravTint'), 1100);
  if (!REDUCED) inner.animate([{ transform: 'none' }, { transform: `translate(${d.dx * 18 * k}%, ${d.dy * 14 * k}%)` }, { transform: `translate(${d.dx * 10 * k}%, ${d.dy * 8 * k}%)` },
    { transform: `translate(${d.dx * 16 * k}%, ${d.dy * 12 * k}%)` }, { transform: `translate(${d.dx * 9 * k}%, ${d.dy * 7 * k}%)` }, { transform: 'none' }], { duration: 560, easing: 'ease-in-out' });
  // el tope: un destello morado en el borde con lo que le cierra el paso
  const a = pieceCenterPx(el), b = cellCenterPx(ev.x, ev.y), mx = (a.px + b.px) / 2, my = (a.py + b.py) / 2;
  setTimeout(() => { const st = fxEl('gravBlock', mx, my, 700); st.style.setProperty('--rot', (ev.dir === 'up' || ev.dir === 'down' ? 0 : 90) + 'deg');
    fxSpawn(mx, my, { n: 5, colors: SPACE_C, size: 4, dist: 14, dur: 300 }); }, REDUCED ? 0 : 120);
  if (!app.stuckSfx) { sfx('gstuck'); app.stuckSfx = true; setTimeout(() => { app.stuckSfx = false; }, 250); }
  await wait(REDUCED ? 60 : 300);
}

async function clash(ev) {
  const el = pieceEl(ev.p);
  if (!el) return;
  const d = DIRS[ev.dir], inner = el.firstChild;
  inner.style.transition = 'transform 110ms ease-out';
  inner.style.transform = `translate(${d.dx * 30}%, ${d.dy * 24}%)`;
  await wait(110);
  const { px, py } = cellCenterPx(ev.x, ev.y);
  fxSpawn(px, py, { n: 8, colors: ['#ffffff', '#ffe9a8', '#C78BF2'], size: 5, dist: 26, dur: 360 });
  if (!app.clashSfx) { sfx('knock'); fxShake(); app.clashSfx = true; setTimeout(() => { app.clashSfx = false; }, 300); }
  inner.style.transform = '';
  await wait(160);
  inner.style.transition = '';
}

let meteorSfxAt = 0;
const FALL_MS = 260;
// el meteorito baja en diagonal (de arriba a la izquierda, con un poco de variación) y la estela va detrás, inclinada
// en la dirección de la caída
function fallFx(px, py, big) {
  const ang = 32 + Math.random() * 10, rad = ang * Math.PI / 180, dist = big ? 120 : 96;
  const m = fxEl('meteorFall' + (big ? ' big' : ''), px, py, FALL_MS + 400);
  m.style.setProperty('--fx', -Math.sin(rad) * dist + 'px'); m.style.setProperty('--fy', -Math.cos(rad) * dist + 'px');
  m.style.setProperty('--ang', -ang + 'deg'); m.style.setProperty('--ms', FALL_MS + 'ms');
  m.innerHTML = '<i class="mTail"></i><i class="mHead"></i>';
}
async function meteor(ev) {
  const { px, py } = cellCenterPx(ev.x, ev.y);
  if (!REDUCED) fallFx(px, py, !!ev.hit);
  if (ev.hit) await wait(REDUCED ? 0 : FALL_MS); // (los que no dan a nadie caen seguidos, sin esperar a que lleguen)
  setTimeout(() => {
    fxEl('meteorCrater', px, py, 1300);
    fxSpawn(px, py, { n: ev.hit ? 14 : 6, colors: FIRE_C, size: ev.hit ? 6 : 4, dist: ev.hit ? 34 : 20, dur: 420, gravity: 14 });
    const now = Date.now();
    if (ev.hit || now - meteorSfxAt > 140) { sfx('meteor'); meteorSfxAt = now; }
  }, ev.hit || REDUCED ? 0 : FALL_MS - 20);
  if (ev.hit) { fxShake(); const el = pieceEl(ev.hit); el?.firstChild.classList.add('hitFlash'); setTimeout(() => el?.firstChild.classList.remove('hitFlash'), 300); await wait(120); }
  else await wait(REDUCED ? 8 : 32);
}
// la roca: aparece cuando llega su meteorito (el anterior evento), con polvo y una sacudida
async function meteorRock(ev) {
  await wait(REDUCED ? 0 : FALL_MS - 30);
  app.rocksHidden?.delete(ev.x + ',' + ev.y);
  markPlaced(ev.x, ev.y);
  renderBoard();
  const { px, py } = cellCenterPx(ev.x, ev.y);
  fxSpawn(px, py, { n: 16, colors: ['#7A6A70', '#4A3E46', '#F2913A', '#FFD58A'], size: 6, dist: 38, dur: 520, gravity: 18 });
  fxShake();
  await wait(REDUCED ? 30 : 160);
}

export const MULTIVERSE_PLAY = { absorb, clone, vanish, gravity, gpull, gstuck, clash, meteor, meteorRock };
