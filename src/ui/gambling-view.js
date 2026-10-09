// Baraja del Gambling en pantalla: el suelo ajedrezado, las monedas y los dados tal como se ven durante la jugada, y las
// animaciones de sus eventos (src/engine/gambling.js).
//   coinPick  la moneda salta y se queda pegada a la pelota o al hoyo (una chapita dorada) hasta que la lanza
//   coinFlip  una moneda grande da vueltas en medio de la pantalla y cae: cara (una carita: se vuelve a elegir) o cruz (a la salida)
//   coinDrop  la moneda usada vuela a otra casilla vacía
//   goHome    la pelota se va en una nube de fichas (vuelve a su salida por la moneda o por la ruleta)
//   diceRoll  el dado rueda a la casilla de al lado (o da la vuelta en su sitio) y enseña otra cara
//   diceTurn  al acabar el turno, el dado da una vuelta en su sitio: otro número
//   roulette  la ruleta sale en medio de la pantalla, gira, se para y se iluminan las casillas de ese color
//   goldWin   ¡bote! la casilla dorada estalla en monedas
// Mientras se anima una jugada, el tablero enseña las monedas y los dados de antes (app.gv) y se van actualizando con
// sus eventos; al acabar, el estado real.
import { app } from './app.js';
import { wait } from './dom.js';
import { pieceEl, renderBoard } from './board.js';
import { cellCenterPx, cellStep, pieceCenterPx } from './geometry.js';
import { clone, DIRS, playerTag } from '../engine/game.js';
import { WHEEL } from '../engine/gambling.js';
import { isDice } from '../content/tiles/index.js';
import { REDUCED } from '../fx/juice.js';
import { fxSpawn } from '../fx/particles.js';
import { fxShake, fxGetDomLayer, fxSplashRing, fxZoomPulse } from '../fx/effects.js';
import { sfx } from '../audio/sfx.js';
import { t } from '../i18n/index.js';
import { pColor } from '../art.js';

export const GOLD_C = ['#FFE38A', '#F2C14E', '#D9A441', '#FFFFFF', '#B8892B'];
const CHIP_C = ['#C8243A', '#2A2A30', '#F6F0E2', '#F2C14E'];
export const SEG_C = { red: '#C8243A', black: '#24242A', gold: '#E2B23C' };

/* ---------- lo que se ve durante la jugada ---------- */
export const gambleBefore = g => g.S.gamble ? { coins: clone(g.S.gamble.coins), dice: clone(g.S.tiles.filter(isDice)) } : null;
export function gamblePrep(g, events, before) {
  app.gv = null;
  if (!before || !g.S.gamble || events.some(e => e.t === 'rewind' || e.t === 'undo')) return;
  if (events.some(e => ['coinPick', 'coinDrop', 'diceRoll', 'diceTurn'].includes(e.t))) app.gv = before;
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
// la casilla dorada: una ruleta pequeña (sus franjas, rojas y negras, en tonos de oro, y la dorada brillando) — caer en ella
// la hace girar
export const GOLD_ICON = '<svg class="gGoldSvg" viewBox="-12 -12 24 24" aria-hidden="true"><circle r="11.4" fill="#8A5E18"/><g class="gGoldRot">' +
  WHEEL.map((c, i) => { const a0 = (i / WHEEL.length) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / WHEEL.length) * Math.PI * 2 - Math.PI / 2, P = (a, r) => `${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;
    return `<path d="M0 0L${P(a0, 10)}A10 10 0 0 1 ${P(a1, 10)}Z" fill="${{ red: '#B5373F', black: '#3A2A1E', gold: '#FFF1B0' }[c]}" stroke="#F2C14E" stroke-width=".6"/>`; }).join('') +
  '<circle r="4" fill="#C9962E" stroke="#FFE38A" stroke-width=".9"/><path d="M-2.6 0H2.6M0 -2.6V2.6" stroke="#FFF1B0" stroke-width="1.1" stroke-linecap="round"/></g>' +
  '<path d="M0 -13.6L-1.8 -10.8H1.8Z" fill="#FFF6D6"/></svg>';
// las dos caras de la moneda grande: cara (una carita) y cruz (una cruz)
const FACE = side => `<svg viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="27" fill="${side === 'heads' ? '#F2C14E' : '#E2B23C'}" stroke="#9C6A1E" stroke-width="2.4"/>` +
  `<circle cx="30" cy="30" r="21" fill="none" stroke="#C8962E" stroke-width="1.6"/>` +
  (side === 'heads'
    ? '<circle cx="23" cy="26" r="2.6" fill="#7A4E14"/><circle cx="37" cy="26" r="2.6" fill="#7A4E14"/><path d="M21 34q9 8 18 0" fill="none" stroke="#7A4E14" stroke-width="2.8" stroke-linecap="round"/>'
    : '<path d="M22 22l16 16M38 22L22 38" stroke="#7A4E14" stroke-width="5" stroke-linecap="round"/>') + '</svg>'; // (cruz: en aspa, ✕)
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

// la moneda se lanza en grande, en medio de la pantalla (como la ruleta): da vueltas y cae de una cara
async function coinFlip(ev) {
  const el = pieceEl(ev.p);
  el?.querySelectorAll('.coinBadge').forEach(b => b.remove());
  const heads = ev.side === 'heads', who = ev.p.startsWith('hole') ? '' : `<i class="gFlipWho" style="--pc:${pColor(+ev.p.slice(1))}">${playerTag(+ev.p.slice(1))}</i>`;
  const ov = document.createElement('div');
  ov.className = 'gFlipOv ' + (heads ? 'heads' : 'tails');
  ov.innerHTML = `<div class="gFlipBox">${who}<div class="gFlipCoin"><i class="f">${FACE(heads ? 'heads' : 'tails')}</i><i class="b">${FACE(heads ? 'tails' : 'heads')}</i></div>` +
    `<b class="gFlipTxt">${t(heads ? 'gamble.heads' : 'gamble.tails')}</b></div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('in'));
  sfx('coinFlip');
  const coin = ov.querySelector('.gFlipCoin');
  if (!REDUCED) await coin.animate([{ transform: 'translateY(0) rotateY(0)' }, { transform: 'translateY(-35%) rotateY(1080deg)', offset: .55 },
    { transform: 'translateY(0) rotateY(2160deg)' }], { duration: 1000, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'forwards' }).finished;
  ov.classList.add('landed');
  sfx(heads ? 'coinHeads' : 'coinTails');
  const r = coin.getBoundingClientRect();
  fxSpawnFixed(r.left + r.width / 2, r.top + r.height / 2, heads);
  await wait(REDUCED ? 500 : 750);
  ov.classList.add('out');
  setTimeout(() => ov.remove(), 280);
  await wait(REDUCED ? 40 : 160);
}
// (destellos alrededor de la moneda grande: piezas DOM sueltas, fuera del tablero)
function fxSpawnFixed(x, y, heads) {
  if (REDUCED) return;
  const cols = heads ? GOLD_C : ['#C8243A', '#2A2A30', '#F2C14E'];
  for (let k = 0; k < 14; k++) {
    const d = document.createElement('i'), a = k / 14 * Math.PI * 2, dist = 70 + Math.random() * 40;
    d.className = 'gSpark'; d.style.left = x + 'px'; d.style.top = y + 'px'; d.style.background = cols[k % cols.length];
    d.style.setProperty('--dx', Math.cos(a) * dist + 'px'); d.style.setProperty('--dy', Math.sin(a) * dist + 'px');
    document.body.appendChild(d); setTimeout(() => d.remove(), 700);
  }
}
// la moneda usada vuela a su casilla nueva y se posa
async function coinDrop(ev) {
  const a = cellCenterPx(ev.x0, ev.y0), b = cellCenterPx(ev.x, ev.y), w = cellStep().w;
  const c = fxEl('gCoinMove', a.px, a.py, 900); c.innerHTML = COIN_SVG; c.style.setProperty('--s', Math.round(w * .56) + 'px');
  c.style.setProperty('--dx', (b.px - a.px) + 'px'); c.style.setProperty('--dy', (b.py - a.py) + 'px');
  if (!REDUCED) await wait(560);
  if (app.gv) { app.gv.coins.push({ x: ev.x, y: ev.y }); renderBoard(); }
  c.remove();
  sfx('coin');
  fxSpawn(b.px, b.py, { n: 6, colors: GOLD_C, size: 4, dist: 18, dur: 340 });
  await wait(REDUCED ? 20 : 60);
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

// el dado rueda: se dibuja ya en su casilla nueva (con su cara nueva) y vuelca desde la de antes. Sin esperar: a la vez
// que la pelota (o el hoyo) rebota, para que se vea que el choque mueve a los dos
function diceRoll(ev) {
  const d = app.gv?.dice.find(q => q.id === ev.id);
  if (d) Object.assign(d, { x: ev.x, y: ev.y }, ev.face);
  renderBoard();
  const cell = cellEl(ev.x, ev.y), pic = cell?.querySelector('.cardOnCell');
  sfx('diceRoll');
  if (ev.via) { // (ha cruzado un portal: entra por uno y sale por el otro, girando)
    const a = cellCenterPx(ev.via.x, ev.via.y), b = cellCenterPx(ev.via.ox, ev.via.oy);
    fxSplashRing(a.px, a.py, 'warp'); setTimeout(() => fxSplashRing(b.px, b.py, 'warp'), 120);
    sfx('portal');
    if (pic && !REDUCED) pic.animate([{ transform: 'scale(.15) rotate(-240deg)', opacity: 0 }, { transform: 'scale(1.12)', opacity: 1, offset: .7 }, { transform: 'none' }], { duration: 360, easing: 'ease-out' });
    return;
  }
  if (pic && !REDUCED) {
    const { dx, dy } = DIRS[ev.dir];
    cell.style.zIndex = 3;
    const from = ev.moved ? `translate(${-dx * 100}%, ${-dy * 100}%) rotate(${dx ? dx * -90 : 0}deg) scale(${dy ? .7 : 1}, ${dy ? 1.2 : 1})` : `rotate(${dx ? dx * -60 : 0}deg) scale(${dy ? .6 : 1.1}, 1)`;
    pic.animate([{ transform: from }, { transform: 'translateY(-8%) scale(1.06)', offset: .7 }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.3,.7,.4,1)' })
      .finished.then(() => { cell.style.zIndex = ''; }, () => { cell.style.zIndex = ''; });
  }
  const { px, py } = cellCenterPx(ev.x, ev.y);
  setTimeout(() => fxSpawn(px, py, { n: 6, colors: ['#F6F0E2', '#CFC3AE', '#1F6B48'], size: 4, dist: 18, dur: 320, gravity: 10 }), REDUCED ? 0 : 220);
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

// al acabar el turno, cada dado da una vuelta en su sitio y enseña otro número
async function diceTurn(ev) {
  const d = app.gv?.dice.find(q => q.id === ev.id);
  if (d) Object.assign(d, ev.face);
  renderBoard();
  const pic = cellEl(ev.x, ev.y)?.querySelector('.cardOnCell');
  if (!app.diceSfx) { sfx('diceRoll'); app.diceSfx = true; setTimeout(() => { app.diceSfx = false; }, 200); }
  if (pic && !REDUCED) {
    const { dx, dy } = DIRS[ev.dir];
    await pic.animate([{ transform: `rotate(${dx * 70}deg) scale(${dy ? .6 : 1}, ${dx ? .8 : 1})` }, { transform: 'translateY(-10%) scale(1.08)', offset: .65 }, { transform: 'none' }],
      { duration: 320, easing: 'cubic-bezier(.3,.7,.4,1)' }).finished;
  }
}

export const GAMBLING_PLAY = { coinPick, coinFlip, coinDrop, goHome, diceRoll, diceTurn, roulette, goldWin };
