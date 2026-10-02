// Vista de la baraja de las estaciones (src/engine/seasons.js tiene las reglas):
//   · la estación en pantalla: #gameScreen[data-season] (fondo, césped y decorado de styles/seasons.css) y su indicador
//     (#seasonChip: las cuatro, con la de ahora resaltada, en el orden en que llegan);
//   · el viento: una capa SVG (#windSvg, entre las casillas y las piezas) con su ruta, tenue mientras avisa y con
//     ráfagas que la recorren cuando sopla;
//   · la bola de nieve: una pieza móvil más (debajo de las pelotas, que se quedan "dentro");
//   · la reproducción de sus eventos (crunch, grow, snow, season…; la llama src/ui/animations.js).
// Lo que cambia en el campo durante una jugada (hojas que se rompen, fuego que crece, el cambio de estación) se enseña
// a su tiempo: app.sv guarda lo que se ve (las piezas, la estación y el viento de antes) y cada evento lo pone al día.
import { app } from './app.js';
import { $, wait } from './dom.js';
import { cellCenterPx, cellStep, setPos, pieceCenterPx } from './geometry.js';
import { fxSplashRing } from '../fx/effects.js';
import { fxSpawn } from '../fx/particles.js';
import { REDUCED } from '../fx/juice.js';
import { sfx } from '../audio/sfx.js';
import { t } from '../i18n/index.js';
import { SEASONS, windExitOf } from '../engine/seasons.js';
import { seasonIcon, SNOWBALL } from './season-art.js';
import { renderBoard, markPlaced } from './board.js';

const LEAF_C = ['#C9692E', '#D9A441', '#B4552A', '#E8873A'];
const PETAL_C = ['#F4A9C4', '#FBD3E0', '#FFFFFF'];
const FIRE_C = ['#FFD23F', '#E8873A', '#D9603A', '#FFF0A8'];
const ASH_C = ['#5A5048', '#8A7E72', '#3E3630', '#C9BFB2'];
const SNOW_C = ['#FFFFFF', '#E3EEF4', '#CFE4EE'];
const WATER_C = ['#BFE8F5', '#8CC2D3', '#FFFFFF'];
const WIND_C = ['#FFFFFF', '#E6F4FA', '#D8EEF8']; // (el trazo de las ráfagas necesita colores en hexadecimal)
export const SNOW_MS = 150;
const clone = o => JSON.parse(JSON.stringify(o));

/* ---------- lo que se ve mientras se reproduce la jugada ---------- */
// antes de la jugada (controller.js): las piezas, la estación y el viento que se ven ahora
export const seasonBefore = g => g.S.season ? { tiles: clone(g.S.tiles), now: g.S.season.now, wind: clone(g.S.season.wind ?? null) } : null;
// tras la jugada: qué hay que ir enseñando a su tiempo
export function seasonPrep(g, events, before) {
  app.sv = null;
  if (!before || !g.S.season || events.some(e => e.t === 'rewind' || e.t === 'undo')) return;
  const has = k => events.some(e => e.t === k);
  const sv = { tiles: null, season: null, wind: undefined, snowHidden: has('snowIn') };
  if (has('grow') || has('crunch') || has('season')) {
    sv.tiles = before.tiles;
    for (const e of events) if (e.t === 'tilePlaced') { const tl = g.realTileAt(e.x, e.y); if (tl) sv.tiles.push({ ...tl }); }
  }
  if (has('season')) sv.season = before.now;
  if (has('wind') || has('season')) sv.wind = before.wind;
  if (sv.tiles || sv.season || sv.wind !== undefined || sv.snowHidden) app.sv = sv;
}
// la casilla (x,y) tal como se ve ahora (board.js)
export const shownTile = (g, x, y) => app.sv?.tiles ? app.sv.tiles.find(tl => tl.x === x && tl.y === y) : g.realTileAt(x, y);
export function seasonDone() { if (app.sv) { app.sv = null; renderBoard(); } }

/* ---------- la estación en pantalla ---------- */
const shownSeason = g => app.sv?.season || g.S.season?.now;
const shownWind = g => app.sv && app.sv.wind !== undefined ? app.sv.wind : g.S.season?.wind;
export function renderSeason(g) {
  const scr = $('gameScreen'), S = g?.S;
  if (!S?.season) {
    if (scr?.dataset.season) delete scr.dataset.season;
    if ($('seasonChip')) { $('seasonChip').remove(); requestAnimationFrame(() => window.dispatchEvent(new Event('resize'))); }
    $('windSvg')?.remove(); windKey = '';
    return;
  }
  const now = shownSeason(g);
  if (scr.dataset.season !== now) scr.dataset.season = now;
  renderChip(now);
  renderWind(shownWind(g));
  ensureDecor();
}
// las cuatro estaciones, en su orden, con la de ahora resaltada (y su nombre)
function renderChip(now) {
  let el = $('seasonChip');
  if (!el) {
    el = document.createElement('div');
    el.id = 'seasonChip';
    $('gameBar').appendChild(el); // (en la segunda fila de la barra, como la etiqueta del modo: el tablero se reajusta)
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }
  if (el.dataset.now === now) return;
  el.dataset.now = now;
  el.title = `${t('seasons.' + now + '.title')}: ${t('seasons.' + now + '.what')}`;
  el.innerHTML = SEASONS.map(s => `<span class="seStep${s === now ? ' on' : ''}" data-s="${s}">${seasonIcon(s)}${s === now ? `<b>${t('seasons.' + s + '.title')}</b>` : ''}</span>`).join('');
}
// decorado de la escena (una vez por partida): capas de fondo de cada estación y lo que flota en el aire
function ensureDecor() {
  const d = $('gameDecor');
  if (!d || d.querySelector('.dSeason')) return;
  d.insertAdjacentHTML('afterbegin', SEASONS.map(s => `<div class="dSeason ${s}"></div>`).join('') +
    [1, 2, 3, 4, 5, 6].map(i => `<i class="dFly f${i}"></i>`).join(''));
}

/* ---------- el viento ---------- */
let windKey = '';
// trazo abierto y suave por los centros de las casillas
function windPathD(pts) {
  const f = n => n.toFixed(1);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) { const p = pts[i], q = pts[i + 1]; d += `Q${f(p[0])} ${f(p[1])} ${f((p[0] + q[0]) / 2)} ${f((p[1] + q[1]) / 2)}`; }
  const e = pts[pts.length - 1];
  return d + `L${f(e[0])} ${f(e[1])}`;
}
const PETAL_D = u => `M0 ${-u * .07}C${u * .06} ${-u * .05} ${u * .06} ${u * .04} 0 ${u * .07}C${-u * .06} ${u * .04} ${-u * .06} ${-u * .05} 0 ${-u * .07}Z`;
function renderWind(w) {
  const area = $('boardArea'), g = app.game;
  let svg = $('windSvg');
  if (!w) { if (svg) { svg.remove(); windKey = ''; } return; }
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'windSvg'; svg.setAttribute('aria-hidden', 'true');
    area.insertBefore(svg, $('pieces'));
  }
  const s = cellStep(), W = area.offsetWidth, H = area.offsetHeight, u = Math.min(s.w, s.h);
  const k = `${w.path.join(';')}|${w.on}|${s.w}x${s.h}|${W}x${H}`;
  if (k === windKey && svg.firstChild) return;
  windKey = k;
  svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.classList.toggle('on', !!w.on);
  const pts = w.path.map(([x, y]) => { const c = cellCenterPx(x, y); return [c.px, c.py]; }), f = n => n.toFixed(1);
  // la ruta sigue hasta el borde del tablero: por ahí lo echa
  const ex = g && w.path.length > 1 ? windExitOf(w.path, g.S.cols, g.S.rows) : null, L = pts.length, [lx, ly] = pts[L - 1];
  const exit = ex ? [lx + (ex.x - w.path[L - 1][0]) * s.w * .62, ly + (ex.y - w.path[L - 1][1]) * s.h * .62] : [lx, ly];
  const d = windPathD([...pts, exit]);
  // flechas a lo largo de la ruta (cada dos casillas), giradas hacia donde sopla
  let arrows = '';
  for (let i = 1; i < pts.length - 1; i += 2) {
    const a = pts[i - 1], b = pts[i + 1], ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
    arrows += `<g transform="translate(${f(pts[i][0])} ${f(pts[i][1])}) rotate(${f(ang)})"><path class="wArrow" style="--i:${i}" d="M${f(-u * .09)} ${f(-u * .12)}L${f(u * .05)} 0L${f(-u * .09)} ${f(u * .12)}"/></g>`;
  }
  // remolinos sueltos (giran despacio) y, soplando, pétalos que viajan por la ruta
  let curls = '';
  for (let i = 2; i < pts.length - 1; i += 3) curls += `<g transform="translate(${f(pts[i][0] + u * .18)} ${f(pts[i][1] - u * .2)})"><path class="wCurl" style="--i:${i}" d="M${f(-u * .13)} 0a${f(u * .13)} ${f(u * .13)} 0 1 1 ${f(u * .13)} ${f(u * .13)}a${f(u * .07)} ${f(u * .07)} 0 0 1 ${f(-u * .07)} ${f(-u * .07)}"/></g>`;
  const dur = Math.max(1.6, pts.length * .16);
  const petals = w.on ? [0, 1, 2, 3, 4, 5].map(i => `<path class="wPetal" d="${PETAL_D(u)}" fill="${['#F8C3D6', '#FFFFFF', '#F4A9C4'][i % 3]}">` +
    `<animateMotion dur="${f(dur)}s" begin="${f(-i * dur / 6)}s" repeatCount="indefinite" rotate="auto" path="${d}"/></path>`).join('') : '';
  // la salida: unas flechas que apuntan fuera del tablero
  const exA = ex ? Math.atan2(exit[1] - ly, exit[0] - lx) * 180 / Math.PI : 0;
  const exitG = ex ? `<g class="wExit" transform="translate(${f((lx + exit[0]) / 2)} ${f((ly + exit[1]) / 2)}) rotate(${f(exA)})">` +
    [0, 1].map(k => `<path d="M${f(-u * .12 + k * u * .16)} ${f(-u * .15)}L${f(u * .04 + k * u * .16)} 0L${f(-u * .12 + k * u * .16)} ${f(u * .15)}" style="--k:${k}"/>`).join('') + `</g>` : '';
  svg.innerHTML = `<path class="wBand" d="${d}" stroke-width="${f(u * .74)}"/>` +
    `<path class="wCore" d="${d}" stroke-width="${f(u * .34)}"/>` +
    `<path class="wDots" d="${d}"/>` +
    (w.on ? [0, 1, 2, 3].map(i => `<path class="wStreak s${i}" d="${d}" stroke-width="${f(u * [.05, .035, .07, .03][i])}" style="--u:${f(u)}px"/>`).join('') : '') +
    arrows + curls + petals +
    `<circle class="wStart" cx="${f(pts[0][0])}" cy="${f(pts[0][1])}" r="${f(u * .16)}"/>` + exitG;
}

/* ---------- la bola de nieve (pieza móvil) ---------- */
const pieceEl = id => document.querySelector(`#pieces .piece[data-id="${id}"]`);
export function ensureSnow(g) {
  const sn = g.S.season?.snow;
  let el = pieceEl('snow');
  if (!sn) { if (el && !app.animating && !app.animQueue.length) el.remove(); return; } // (si se derrite, lo hace en su animación)
  if (el) return;
  el = document.createElement('div');
  el.className = 'piece psnow';
  el.dataset.id = 'snow';
  el.innerHTML = `<div class="snowBody">${SNOWBALL}</div>`;
  $('pieces').prepend(el); // (debajo de pelotas y hoyo: van "dentro")
  setPos(el, sn.x, sn.y, 0);
  if (app.sv?.snowHidden) el.style.opacity = 0;
}
export function syncSnow(g) {
  const sn = g.S.season?.snow;
  if (!sn) { pieceEl('snow')?.remove(); return; }
  ensureSnow(g);
  const el = pieceEl('snow');
  setPos(el, sn.x, sn.y, 0);
  el.style.opacity = 1;
  packSnow(g.S.balls.filter(b => !b.holed && b.x === sn.x && b.y === sn.y).map(b => 'b' + b.player));
}
// lo que lleva dentro la bola de nieve, colocado para que se vea todo (una, en el centro; varias, repartidas y más pequeñas)
const PACK = { 2: [[-.2, 0], [.2, 0]], 3: [[-.2, .12], [.2, .12], [0, -.17]], 4: [[-.18, -.14], [.18, -.14], [-.18, .14], [.18, .14]] };
function packSnow(ids) {
  const s = cellStep(), spots = PACK[Math.min(4, ids.length)];
  ids.forEach((id, i) => {
    const inner = pieceEl(id)?.firstChild;
    if (!inner) return;
    if (!spots) { inner.style.transform = ''; return; }
    const [ox, oy] = spots[i % spots.length];
    inner.style.transition = 'transform .25s cubic-bezier(.3,1.4,.5,1)';
    inner.style.transform = `translate(${(ox * s.w).toFixed(1)}px, ${(oy * s.h).toFixed(1)}px) scale(.52)`;
  });
}

/* ---------- reproducción ---------- */
// lluvia: una nubecilla sobre la casilla deja caer unas gotas y se va (el charco aparece después)
async function rainOn(x, y) {
  const c = cellCenterPx(x, y), s = cellStep(), el = document.createElement('div');
  el.className = 'rainCloud';
  el.style.left = c.px + 'px'; el.style.top = (c.py - s.h * .62) + 'px'; el.style.setProperty('--w', Math.min(s.w, s.h) + 'px');
  el.innerHTML = '<svg viewBox="0 0 60 34" aria-hidden="true"><path d="M14 30C6 30 2 25 3 19C4 13 10 11 14 13C15 6 22 2 29 3C36 4 40 9 41 13C47 10 55 13 56 20C57 26 52 30 46 30Z" fill="#F4F8FA"/>' +
    '<path d="M14 30C6 30 2 25 3 19C8 24 30 26 56 20C57 26 52 30 46 30Z" fill="#C8D8E2"/></svg>' +
    [0, 1, 2, 3, 4].map(i => `<i style="--x:${18 + i * 16}%;--d:${(i * 0.09 + (i % 2) * .05).toFixed(2)}s"></i>`).join('');
  $('boardArea').appendChild(el);
  sfx('drip'); setTimeout(() => sfx('drip'), 220);
  await wait(620);
  el.classList.add('out');
  setTimeout(() => el.remove(), 380);
}
const burst = (x, y, opts) => { const c = cellCenterPx(x, y); fxSpawn(c.px, c.py, opts); };
const cellEl = (x, y) => document.querySelector(`#board .cell[data-x="${x}"][data-y="${y}"]`);
// el cambio de estación sobre las piezas que se ven (lo mismo que hace el motor, sin lo que llega con grow)
function seasonTiles(tiles, from, to) {
  let out = tiles.filter(tl => !(from === 'summer' && tl.type === 'fire') && !(from === 'autumn' && tl.type === 'leaf') && !(to === 'summer' && tl.type === 'plant'));
  for (const tl of out) { if (to === 'winter' && tl.type === 'puddle') tl.type = 'ice'; if (to === 'spring' && tl.type === 'ice') tl.type = 'plant'; }
  return out;
}
const ROT = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
export const SEASON_PLAY = {
  async gust(ev) { // el viento la lleva: deprisa, girando, con rachas de aire
    const el = pieceEl(ev.p);
    if (!el) return;
    if (!el.classList.contains('gusting')) { el.classList.add('gusting'); sfx('wind'); }
    clearTimeout(el._gT); el._gT = setTimeout(() => el.classList.remove('gusting'), 260);
    const from = pieceCenterPx(el), to = cellCenterPx(ev.x, ev.y);
    setPos(el, ev.x, ev.y, 120, 'linear');
    // ráfagas blancas que siguen a la pieza y algún pétalo arrastrado
    const ang = Math.atan2(to.py - from.py, to.px - from.px);
    fxSpawn(from.px, from.py, { n: 1, colors: WIND_C, size: 14, dist: 26, dur: 560, shape: 'wind', alpha: .9, angMin: ang - .15, angMax: ang + .15 });
    if (Math.random() < .5) fxSpawn(from.px, from.py, { n: 1, colors: PETAL_C, size: 7, dist: 30, dur: 620, shape: 'leaf', angMin: ang - .4, angMax: ang + .4 });
    await wait(120);
  },
  async crunch(ev) { // la hoja se rompe en trocitos
    if (app.sv?.tiles) { app.sv.tiles = app.sv.tiles.filter(tl => !(tl.x === ev.x && tl.y === ev.y && tl.type === 'leaf')); renderBoard(); }
    burst(ev.x, ev.y, { n: 10, colors: LEAF_C, size: 7, dist: 26, up: 8, dur: 520, gravity: 14, shape: 'leaf' });
    sfx('leaf');
    await wait(30);
  },
  async puddle(ev) {
    const c = cellCenterPx(ev.x, ev.y);
    fxSpawn(c.px, c.py, { n: 6, colors: WATER_C, size: 4, dist: 14, up: 10, dur: 380, gravity: 30 });
    cellEl(ev.x, ev.y)?.classList.remove('splashed'); void cellEl(ev.x, ev.y)?.offsetWidth; cellEl(ev.x, ev.y)?.classList.add('splashed');
    sfx('drip');
    await wait(20);
  },
  async slide(ev) {
    burst(ev.x, ev.y, { n: 5, colors: SNOW_C, size: 4, dist: 18, dur: 380 });
    sfx('ice');
    await wait(10);
  },
  async flare(ev) { // cruza el fuego: llamarada e impulso
    const el = pieceEl(ev.p);
    burst(ev.x, ev.y, { n: 10, colors: FIRE_C, size: 7, dist: 26, up: 18, dur: 460, gravity: -10 });
    if (el) { el.classList.remove('scorched'); void el.offsetWidth; el.classList.add('scorched'); setTimeout(() => el.classList.remove('scorched'), 700); }
    sfx('flare');
    await wait(30);
  },
  async burn(ev) { // se queda en el fuego: se achicharra y se va en humo
    const el = pieceEl(ev.p);
    if (!el) return;
    setPos(el, ev.x, ev.y, 100, 'ease-out');
    await wait(90);
    el.classList.add('burnt');
    burst(ev.x, ev.y, { n: 12, colors: FIRE_C, size: 7, dist: 22, up: 26, dur: 520, gravity: -14 });
    setTimeout(() => burst(ev.x, ev.y, { n: 8, colors: ASH_C, size: 9, dist: 18, up: 30, dur: 760, gravity: -18, alpha: .7 }), 180);
    sfx('burn');
    await wait(480);
    el.style.opacity = 0;
    el.classList.remove('burnt');
    await wait(60);
  },
  async eaten(ev) { // la planta se lanza a por ella: ¡ñam!
    const el = pieceEl(ev.p);
    if (!el) return;
    const cell = cellEl(ev.px, ev.py), plant = cell?.querySelector('.tile-plant');
    if (plant) { plant.classList.remove('chomp'); void plant.offsetWidth; plant.classList.add('chomp'); setTimeout(() => plant.classList.remove('chomp'), 700); }
    setPos(el, ev.px, ev.py, 260, 'cubic-bezier(.5,0,.8,.4)');
    el.classList.add('gulp');
    sfx('chomp');
    await wait(280);
    burst(ev.px, ev.py, { n: 8, colors: ['#4F8A3A', '#C8463F', '#F1E6C0'], size: 5, dist: 20, dur: 380 });
    el.style.opacity = 0;
    el.classList.remove('gulp');
    await wait(160);
  },
  async grow(ev) { // fuego que crece, hoja que cae, charco de lluvia
    if (app.sv?.tiles && !app.sv.tiles.some(tl => tl.x === ev.x && tl.y === ev.y)) app.sv.tiles.push({ type: ev.tile, x: ev.x, y: ev.y, ...(ev.rain ? { rain: true } : {}) });
    const c = cellCenterPx(ev.x, ev.y), s = cellStep();
    if (ev.tile === 'leaf') fxSpawn(c.px, c.py - s.h * .9, { n: 2, colors: LEAF_C, size: 9, dist: 10, up: -s.h * .8, dur: 520, shape: 'leaf' });
    if (ev.tile === 'puddle' && ev.rain && !REDUCED) await rainOn(ev.x, ev.y); // (una nubecilla llueve sobre la casilla)
    if (ev.tile === 'fire') fxSpawn(c.px, c.py, { n: 8, colors: FIRE_C, size: 6, dist: 20, up: 22, dur: 520, gravity: -12 });
    markPlaced(ev.x, ev.y);
    renderBoard();
    if (ev.tile === 'puddle') { fxSplashRing(c.px, c.py, 'calm'); sfx('drip'); }
    await wait(ev.tile === 'fire' ? 170 : 200);
  },
  snowPack(ev) { for (const id of ev.ids) pieceEl(id)?.classList.add('snowed'); packSnow(ev.ids); }, // (atrapa algo: se recoloca lo que lleva dentro)
  async snow(ev) { // la bola rueda una casilla (lo que lleva dentro se mueve a la vez: eventos ride de antes)
    const el = pieceEl('snow');
    if (!el) return;
    setPos(el, ev.x, ev.y, REDUCED ? 60 : SNOW_MS, 'linear');
    const tex = el.querySelector('.snowTex'), [dx, dy] = ROT[ev.dir] || [0, 0];
    el._spin = (el._spin || 0) + (dx + dy) * 70;
    if (tex) { tex.style.transition = `transform ${SNOW_MS}ms linear`; tex.style.transform = `rotate(${el._spin}deg)`; }
    const c = pieceCenterPx(el);
    fxSpawn(c.px, c.py, { n: 2, colors: SNOW_C, size: 6, dist: 12, dur: 380, gravity: 8 });
    if (!el._snd || Date.now() - el._snd > 280) { el._snd = Date.now(); sfx('snow'); }
    await wait(REDUCED ? 60 : SNOW_MS);
  },
  async snowIn(ev) {
    const el = pieceEl('snow');
    if (!el) return;
    setPos(el, ev.x, ev.y, 0);
    el.style.opacity = 1;
    el.firstChild.animate([{ transform: 'translateY(-40%) scale(.3)', opacity: 0 }, { transform: 'scale(1.12, .9)', opacity: 1, offset: .7 }, { transform: 'none' }], { duration: 420, easing: 'ease-out' });
    burst(ev.x, ev.y, { n: 12, colors: SNOW_C, size: 7, dist: 28, dur: 520, gravity: 10 });
    sfx('snow');
    await wait(360);
  },
  async snowOut(ev) { // se derrite: se encoge en un charquito y desaparece
    const el = pieceEl('snow');
    if (!el) return;
    await el.firstChild.animate([{ transform: 'none', opacity: 1 }, { transform: 'scale(1.2, .35)', opacity: .7, offset: .6 }, { transform: 'scale(1.3, .2)', opacity: 0 }], { duration: 520, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {});
    burst(ev.x, ev.y, { n: 6, colors: WATER_C, size: 4, dist: 16, dur: 360 });
    el.remove();
  },
  async season(ev) { // cambio de estación: el campo cambia y un rótulo grande lo anuncia
    const g = app.game;
    if (app.sv) {
      if (app.sv.tiles) app.sv.tiles = seasonTiles(app.sv.tiles, ev.from, ev.to);
      app.sv.season = ev.to;
      if (ev.from === 'spring') app.sv.wind = null;
    }
    renderBoard();
    if (g) renderSeason(g);
    const area = $('boardArea'), b = document.createElement('div');
    b.className = 'seasonBanner'; b.dataset.s = ev.to;
    b.innerHTML = `${seasonIcon(ev.to, 'sbIco')}<b>${t('seasons.' + ev.to + '.title')}</b><small>${t('seasons.' + ev.to + '.what')}</small>`;
    area.appendChild(b);
    const W = area.offsetWidth, H = area.offsetHeight, C = { spring: PETAL_C, summer: FIRE_C, autumn: LEAF_C, winter: SNOW_C }[ev.to];
    for (let i = 0; i < 5; i++) setTimeout(() => fxSpawn(W * (.15 + Math.random() * .7), H * .1, { n: 4, colors: C, size: 8, dist: 30, up: -H * .35, dur: 900, shape: ev.to === 'summer' ? 'circ' : 'leaf' }), i * 90);
    sfx('season');
    await wait(REDUCED ? 500 : 1150);
    b.classList.add('out');
    setTimeout(() => b.remove(), 400);
  },
  async wind(ev) { // el viento avisa (aparece su ruta, tenue) o empieza a soplar
    const g = app.game;
    if (app.sv) app.sv.wind = ev.phase === 'on' ? { ...(app.sv.wind || g.S.season.wind), on: true } : clone(g.S.season.wind);
    if (g) renderSeason(g);
    sfx(ev.phase === 'on' ? 'wind' : 'gust');
    await wait(ev.phase === 'on' ? 420 : 200);
  },
};
// la cola de animaciones: lo que va dentro de la bola de nieve se mueve a la vez que ella
export function markSnowRuns(q) {
  if (!q.some(e => e.t === 'snow')) return;
  for (const e of q) if (e.t === 'move' && e.ride && !e._ms) e._ms = REDUCED ? 60 : SNOW_MS;
}
