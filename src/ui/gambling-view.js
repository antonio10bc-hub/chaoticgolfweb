// Baraja del Gambling en pantalla: el suelo ajedrezado, las monedas y los dados tal como se ven durante la jugada, y las
// animaciones de sus eventos (src/engine/gambling.js).
//   coinPick  la moneda salta y se queda pegada a la pelota (una chapita dorada) hasta que la lanza
//   coinFlip  una moneda grande da vueltas encima de la pelota y cae: cara (una carita, repite) o cruz (a su salida)
//   goHome    la pelota se va en una nube de fichas (vuelve a su salida por la moneda o por la ruleta)
//   diceRoll  el dado rueda a la casilla de al lado (o da la vuelta en su sitio) y enseña otra cara
//   roulette  la ruleta sale en medio de la pantalla, gira, se para y se iluminan las casillas de ese color
//   goldWin   ¡bote! la casilla dorada estalla en monedas
// Mientras se anima una jugada, el tablero enseña las monedas y los dados de antes (app.gv) y se van actualizando con
// sus eventos; al acabar, el estado real.
import { app } from './app.js';
import { wait } from './dom.js';
import { pieceEl, renderBoard } from './board.js';
import { cellCenterPx, cellStep, pieceCenterPx } from './geometry.js';
import { clone, DIRS } from '../engine/game.js';
import { WHEEL } from '../engine/gambling.js';
import { isDice } from '../content/tiles/index.js';
import { REDUCED } from '../fx/juice.js';
import { fxSpawn } from '../fx/particles.js';
import { fxShake, fxGetDomLayer, fxSplashRing, fxZoomPulse } from '../fx/effects.js';
import { sfx } from '../audio/sfx.js';
import { t } from '../i18n/index.js';

export const GOLD_C = ['#FFE38A', '#F2C14E', '#D9A441', '#FFFFFF', '#B8892B'];
const CHIP_C = ['#C8243A', '#2A2A30', '#F6F0E2', '#F2C14E'];
export const SEG_C = { red: '#C8243A', black: '#24242A', gold: '#E2B23C' };

/* ---------- lo que se ve durante la jugada ---------- */
export const gambleBefore = g => g.S.gamble ? { coins: clone(g.S.gamble.coins), dice: clone(g.S.tiles.filter(isDice)) } : null;
export function gamblePrep(g, events, before) {
  app.gv = null;
  if (!before || !g.S.gamble || events.some(e => e.t === 'rewind' || e.t === 'undo')) return;
  if (events.some(e => e.t === 'coinPick' || e.t === 'diceRoll')) app.gv = before;
}
export function gambleDone() { if (app.gv) { app.gv = null; renderBoard(); } }
// el suelo y lo que hay encima, como se ve ahora: { tileAt, coin, gold }
export function shownGamble(g) {
  const gv = app.gv, G = g.S.gamble;
  return {
    tileAt: (x, y) => {
      if (!gv) return null;
      const d = gv.dice.find(q => q.x === x && q.y === y);
      if (d) return d;
      const real = g.realTileAt(x, y);
      return real && !isDice(real) ? real : null;
    },
    coin: (x, y) => (gv ? gv.coins : G.coins).some(c => c.x === x && c.y === y),
    gold: (x, y) => !!G.gold && G.gold.x === x && G.gold.y === y,
  };
}

/* ---------- dibujos ---------- */
// la moneda del tablero: dorada, con su canto y un brillo que la recorre
export const COIN_SVG = '<svg class="gCoinSvg" viewBox="0 0 40 40" aria-hidden="true"><ellipse cx="20" cy="23" rx="15" ry="14" fill="#9C6A1E"/>' +
  '<circle cx="20" cy="20" r="15" fill="#F2C14E" stroke="#9C6A1E" stroke-width="1.6"/><circle cx="20" cy="20" r="11" fill="none" stroke="#C8962E" stroke-width="1.4"/>' +
  '<path d="M20 12.5l2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5-3.7-3.4 5-.6z" fill="#FFE38A" stroke="#B8892B" stroke-width=".8" stroke-linejoin="round"/>' +
  '<path class="gCoinShine" d="M10 14a11 11 0 0 1 8-6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".8"/></svg>';
// las dos caras de la moneda grande: cara (una carita) y cruz (una cruz)
const FACE = side => `<svg viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="27" fill="${side === 'heads' ? '#F2C14E' : '#E2B23C'}" stroke="#9C6A1E" stroke-width="2.4"/>` +
  `<circle cx="30" cy="30" r="21" fill="none" stroke="#C8962E" stroke-width="1.6"/>` +
  (side === 'heads'
    ? '<circle cx="23" cy="26" r="2.6" fill="#7A4E14"/><circle cx="37" cy="26" r="2.6" fill="#7A4E14"/><path d="M21 34q9 8 18 0" fill="none" stroke="#7A4E14" stroke-width="2.8" stroke-linecap="round"/>'
    : '<path d="M30 17v26M19 30h22" stroke="#7A4E14" stroke-width="5" stroke-linecap="round"/>') + '</svg>';
// la ruleta: 9 franjas (4 rojas, 4 negras y la dorada) con sus números, el centro de madera y la flecha arriba
export function wheelSVG(size = 200) {
  const c = 100, R = 92, r = 60, n = WHEEL.length, a = i => (i / n) * Math.PI * 2 - Math.PI / 2;
  const pt = (ang, rad) => `${(c + Math.cos(ang) * rad).toFixed(2)} ${(c + Math.sin(ang) * rad).toFixed(2)}`;
  const segs = WHEEL.map((col, i) => `<path d="M${pt(a(i), r)}L${pt(a(i), R)}A${R} ${R} 0 0 1 ${pt(a(i + 1), R)}L${pt(a(i + 1), r)}A${r} ${r} 0 0 0 ${pt(a(i), r)}Z" fill="${SEG_C[col]}" stroke="#E9D9A8" stroke-width="1.6"/>` +
    (col === 'gold' ? `<path transform="translate(${pt(a(i + .5), 76)}) rotate(${(i + .5) * 360 / n})" d="M0 -8l2.3 4.8 5.3.7-3.9 3.6 1 5.2L0 3.8l-4.7 2.5 1-5.2-3.9-3.6 5.3-.7z" fill="#FFF6D6"/>` : '') +
    `<text x="${pt(a(i + .5), 76).split(' ')[0]}" y="${pt(a(i + .5), 76).split(' ')[1]}" transform="rotate(${(i + .5) * 360 / n} ${pt(a(i + .5), 76)})" text-anchor="middle" dominant-baseline="central" class="rlNum">${col === 'gold' ? '' : i + 1}</text>`).join('');
  return `<svg class="rlSvg" viewBox="0 0 200 200" width="${size}" height="${size}" aria-hidden="true">` +
    `<circle cx="100" cy="100" r="99" fill="#5A2E1A"/><circle cx="100" cy="100" r="96" fill="none" stroke="#E2B23C" stroke-width="3"/>` +
    `<g class="rlRot">${segs}<circle cx="100" cy="100" r="${r}" fill="#7A4424" stroke="#E2B23C" stroke-width="2"/>` +
    `<circle cx="100" cy="100" r="44" fill="#1F6B48"/><circle cx="100" cy="100" r="44" fill="none" stroke="#5A2E1A" stroke-width="3"/>` +
    [0, 1, 2, 3].map(k => `<path d="M100 100L${100 + Math.cos(k * Math.PI / 2) * 30} ${100 + Math.sin(k * Math.PI / 2) * 30}" stroke="#E2B23C" stroke-width="4" stroke-linecap="round"/>`).join('') +
    `<circle cx="100" cy="100" r="9" fill="#E2B23C" stroke="#9C6A1E" stroke-width="2"/></g>` +
    `<path d="M100 18L92 2H108Z" fill="#F6F0E2" stroke="#2A2226" stroke-width="2" stroke-linejoin="round"/></svg>`;
}

/* ---------- animaciones ---------- */
const cellEl = (x, y) => document.querySelector(`#board .cell[data-x="${x}"][data-y="${y}"]`);
function fxEl(cls, px, py, ms) {
  const d = document.createElement('div');
  d.className = cls; d.style.left = px + 'px'; d.style.top = py + 'px';
  fxGetDomLayer().appendChild(d);
  if (ms) setTimeout(() => d.remove(), ms);
  return d;
}

async function coinPick(ev) {
  if (app.gv) { app.gv.coins = app.gv.coins.filter(c => c.x !== ev.x || c.y !== ev.y); renderBoard(); }
  const { px, py } = cellCenterPx(ev.x, ev.y), w = cellStep().w;
  const c = fxEl('gCoinFly', px, py, 700); c.innerHTML = COIN_SVG; c.style.setProperty('--s', Math.round(w * .5) + 'px');
  fxSpawn(px, py, { n: 7, colors: GOLD_C, size: 4, dist: 20, dur: 380, gravity: -4 });
  sfx('coin');
  const el = pieceEl(ev.p);
  if (el && !el.querySelector('.coinBadge')) el.insertAdjacentHTML('beforeend', `<i class="coinBadge" aria-hidden="true">${COIN_SVG}</i>`);
  await wait(REDUCED ? 30 : 90);
}

async function coinFlip(ev) {
  const el = pieceEl(ev.p);
  el?.querySelectorAll('.coinBadge').forEach(b => b.remove());
  const at = el ? pieceCenterPx(el) : cellCenterPx(ev.x, ev.y), w = cellStep().w, heads = ev.side === 'heads';
  const box = fxEl('gFlip' + (heads ? ' heads' : ' tails'), at.px, at.py - w * .55);
  box.style.setProperty('--s', Math.round(Math.max(34, w * .8)) + 'px');
  box.innerHTML = `<div class="gFlipCoin"><i class="f">${FACE(heads ? 'heads' : 'tails')}</i><i class="b">${FACE(heads ? 'tails' : 'heads')}</i></div>` +
    `<b class="gFlipTxt">${t(heads ? 'gamble.heads' : 'gamble.tails')}</b>`;
  sfx('coinFlip');
  const coin = box.firstChild;
  if (!REDUCED) await coin.animate([{ transform: 'translateY(0) rotateY(0)' }, { transform: 'translateY(-60%) rotateY(900deg)', offset: .55 },
    { transform: 'translateY(0) rotateY(1800deg)' }], { duration: 760, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'forwards' }).finished;
  box.classList.add('landed');
  sfx(heads ? 'coinHeads' : 'coinTails');
  fxSpawn(at.px, at.py - w * .55, { n: 10, colors: heads ? GOLD_C : ['#C8243A', '#2A2A30', '#F2C14E'], size: 5, dist: 26, dur: 420 });
  await wait(REDUCED ? 450 : 520);
  box.classList.add('out');
  setTimeout(() => box.remove(), 260);
}

async function goHome(ev) {
  const el = pieceEl(ev.p);
  if (!el) return;
  const c = pieceCenterPx(el);
  el.querySelectorAll('.coinBadge').forEach(b => b.remove());
  fxSpawn(c.px, c.py, { n: 14, colors: ev.why === 'roulette' ? CHIP_C : ['#F2C14E', '#C8243A', '#F6F0E2'], size: 6, dist: 34, dur: 460, rect: true });
  sfx('chips');
  if (!REDUCED) await el.firstChild.animate([{ transform: 'none', opacity: 1 }, { transform: 'scale(1.25) rotate(-25deg)', opacity: .8, offset: .3 },
    { transform: 'scale(.1) rotate(200deg)', opacity: 0 }], { duration: 360, easing: 'ease-in', fill: 'forwards' }).finished;
  el.style.opacity = 0;
  el.firstChild.getAnimations().forEach(a => a.cancel());
  await wait(60);
}

// el dado rueda: se dibuja ya en su casilla nueva (con su cara nueva) y vuelca desde la de antes
async function diceRoll(ev) {
  const d = app.gv?.dice.find(q => q.id === ev.id);
  if (d) Object.assign(d, { x: ev.x, y: ev.y }, ev.face);
  renderBoard();
  const cell = cellEl(ev.x, ev.y), pic = cell?.querySelector('.cardOnCell');
  sfx('diceRoll');
  if (pic && !REDUCED) {
    const { dx, dy } = DIRS[ev.dir];
    cell.style.zIndex = 3;
    const from = ev.moved ? `translate(${-dx * 100}%, ${-dy * 100}%) rotate(${dx ? dx * -90 : 0}deg) scale(${dy ? .7 : 1}, ${dy ? 1.2 : 1})` : `rotate(${dx ? dx * -60 : 0}deg) scale(${dy ? .6 : 1.1}, 1)`;
    await pic.animate([{ transform: from }, { transform: 'translateY(-8%) scale(1.06)', offset: .7 }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.3,.7,.4,1)' }).finished;
    cell.style.zIndex = '';
  }
  const { px, py } = cellCenterPx(ev.x, ev.y);
  fxSpawn(px, py, { n: 6, colors: ['#F6F0E2', '#CFC3AE', '#1F6B48'], size: 4, dist: 18, dur: 320, gravity: 10 });
  await wait(REDUCED ? 40 : 80);
}
// el número del dado al chocar: sale de él y sube
export function diceNumber(x, y, n) {
  const { px, py } = cellCenterPx(x, y);
  const el = fxEl('gDiceNum', px, py - cellStep().h * .3, 900);
  el.textContent = '×' + n;
}

// la ruleta, en medio de la pantalla: gira y se para en la franja `seg`
async function roulette(ev) {
  const ov = document.createElement('div');
  ov.className = 'rlOverlay';
  ov.innerHTML = `<div class="rlBox">${wheelSVG(220)}<b class="rlRes"></b></div>`;
  document.body.appendChild(ov);
  const rot = ov.querySelector('.rlRot'), res = ov.querySelector('.rlRes'), n = WHEEL.length;
  const final = 360 * 5 - (ev.seg + .5) * 360 / n + (Math.random() - .5) * (360 / n) * .6;
  requestAnimationFrame(() => ov.classList.add('in'));
  sfx('rouletteStart');
  if (!REDUCED) {
    const ms = 2300, ticks = [];
    for (let k = 1; k <= 22; k++) ticks.push(ms * (1 - Math.pow(1 - k / 23, 2.2))); // (las bolitas: cada vez más despacio)
    ticks.forEach(tm => setTimeout(() => sfx('rouletteTick'), tm));
    await rot.animate([{ transform: 'rotate(0deg)' }, { transform: `rotate(${final}deg)` }], { duration: ms, easing: 'cubic-bezier(.1,.55,.12,1)', fill: 'forwards' }).finished;
  } else rot.style.transform = `rotate(${final}deg)`;
  res.textContent = t('gamble.res.' + ev.res);
  res.style.setProperty('--rc', SEG_C[ev.res]);
  ov.classList.add('done', 'r-' + ev.res);
  sfx(ev.res === 'gold' ? 'jackpot' : 'rouletteStop');
  // las casillas de ese color se iluminan (o la dorada)
  const cls = ev.res === 'gold' ? '.gGold' : ev.res === 'red' ? '.gRed' : '.gBlack';
  document.querySelectorAll('#board .cell' + cls).forEach(c => { c.classList.remove('rlHit'); void c.offsetWidth; c.classList.add('rlHit'); setTimeout(() => c.classList.remove('rlHit'), 1600); });
  await wait(REDUCED ? 500 : 850);
  ov.classList.add('out');
  setTimeout(() => ov.remove(), 320);
  await wait(REDUCED ? 60 : 180);
}

async function goldWin(ev) {
  const { px, py } = cellCenterPx(ev.x, ev.y);
  const cell = cellEl(ev.x, ev.y);
  cell?.classList.add('jackpot');
  fxShake(); fxZoomPulse();
  sfx('jackpot');
  fxSplashRing(px, py, 'gold');
  for (let k = 0; k < (REDUCED ? 1 : 4); k++) setTimeout(() => fxSpawn(px, py, { n: 18, colors: GOLD_C, size: 7, dist: 70, up: 40, dur: 750, rect: true }), k * 160);
  const el = pieceEl(ev.p);
  el?.firstChild.classList.add('hitFlash');
  setTimeout(() => el?.firstChild.classList.remove('hitFlash'), 600);
  await wait(REDUCED ? 300 : 900);
}

export const GAMBLING_PLAY = { coinPick, coinFlip, goHome, diceRoll, roulette, goldWin };
