// Vista del tren (baraja del tren): las vías, las paradas y la locomotora con sus vagones.
//   · Vías: una capa SVG continua sobre la cuadrícula (#trackSvg, entre las casillas y las piezas): balasto de grava,
//     traviesas de madera y dos raíles de hierro que siguen el circuito con curvas suaves. En cada parada, un andén
//     de piedra hacia fuera del circuito, con su línea amarilla, un tejadillo rojo y una farola.
//   · Locomotora (clásica, de vapor: caldera negra, cabina roja y remates dorados) y vagones planos con un montón de
//     arena: piezas móviles de #pieces (debajo de pelotas y hoyo), vistas desde arriba y giradas según la vía.
// La reproducción de los eventos 'train' / 'wagon' del motor está aquí (la llama src/ui/animations.js).
import { app } from './app.js';
import { $, wait } from './dom.js';
import { cellCenterPx, cellStep, setPos, GAP } from './geometry.js';
import { stepDir, stepsToNext } from '../engine/train.js';
import { fxSpawn } from '../fx/particles.js';
import { REDUCED } from '../fx/juice.js';
import { sfx } from '../audio/sfx.js';

const ANG = { up: 0, right: 90, down: 180, left: 270 };

/* ---------- vías ---------- */
// el circuito como trazo cerrado con las esquinas redondeadas (de punto medio a punto medio, con la casilla de control)
export function railPath(pts) {
  const L = pts.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], f = n => n.toFixed(1);
  const m0 = mid(pts[L - 1], pts[0]);
  let d = `M${f(m0[0])} ${f(m0[1])}`;
  for (let i = 0; i < L; i++) { const p = pts[i], m = mid(p, pts[(i + 1) % L]); d += `Q${f(p[0])} ${f(p[1])} ${f(m[0])} ${f(m[1])}`; }
  return d + 'Z';
}
let seq = 0;
// las vías a partir de su trazo `d`: balasto, traviesas (un trazo grueso discontinuo: cada trazo es una traviesa) y dos
// raíles (con una máscara: un trazo ancho menos uno estrecho). Debajo, las paradas: una losa de cemento en la casilla,
// alrededor de la vía, con sus líneas amarillas a los lados (en el suelo: no es una pieza, no tapa nada)
// stops: [{ p: [px, py], ang }] (centro de la casilla y dirección de la vía) · cell: { w, h } de una casilla
function railsSVG(d, stops, w, h, u, cell) {
  const id = 'trk' + (++seq), gauge = u * .34, rail = Math.max(1.6, u * .055), sleeper = u * .62, f = n => n.toFixed(1);
  let out = `<defs><mask id="${id}m" maskUnits="userSpaceOnUse"><path d="${d}" fill="none" stroke="#fff" stroke-width="${f(gauge + rail)}" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="#000" stroke-width="${f(gauge - rail)}" stroke-linejoin="round"/></mask>` +
    `<mask id="${id}h" maskUnits="userSpaceOnUse"><path d="${d}" fill="none" stroke="#fff" stroke-width="${f(gauge + rail * .25)}" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="#000" stroke-width="${f(gauge - rail * .25)}" stroke-linejoin="round"/></mask>` +
    `<pattern id="${id}c" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="2" r=".7" fill="rgba(90,84,70,.22)"/><circle cx="5" cy="5.5" r=".6" fill="rgba(255,255,255,.35)"/></pattern></defs>`;
  for (const st of stops) { // losa de cemento (la casilla entera, con el canto un poco más oscuro)
    const [x, y] = st.p, cw = cell.w, ch = cell.h, r = Math.min(cw, ch) * .16;
    out += `<rect x="${f(x - cw / 2)}" y="${f(y - ch / 2)}" width="${f(cw)}" height="${f(ch)}" rx="${f(r)}" fill="#CCC6B8" stroke="#ADA696" stroke-width="1.2"/>` +
      `<rect x="${f(x - cw / 2)}" y="${f(y - ch / 2)}" width="${f(cw)}" height="${f(ch)}" rx="${f(r)}" fill="url(#${id}c)"/>`;
  }
  out += `<path d="${d}" fill="none" stroke="rgba(92,78,58,.34)" stroke-width="${f(sleeper * 1.12)}" stroke-linejoin="round" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="rgba(40,30,18,.28)" stroke-width="${f(sleeper)}" stroke-dasharray="${f(u * .11)} ${f(u * .17)}" transform="translate(1.2 1.8)"/>` +
    `<path d="${d}" fill="none" stroke="#8A5A33" stroke-width="${f(sleeper)}" stroke-dasharray="${f(u * .11)} ${f(u * .17)}"/>` +
    `<path d="${d}" fill="none" stroke="#A8743F" stroke-width="${f(sleeper * .62)}" stroke-dasharray="${f(u * .11)} ${f(u * .17)}" opacity=".55"/>`;
  for (const st of stops) { // líneas amarillas de seguridad a los dos lados de la vía (encima de la losa; en una curva, solo la losa)
    if (Math.abs(st.ang % 90) > 1 && Math.abs(st.ang % 90) < 89) continue;
    const along = Math.abs(Math.cos(st.ang * Math.PI / 180)) > .5 ? cell.w : cell.h, L = along * .82, off = sleeper * .5 + Math.max(2, u * .06);
    out += `<g transform="translate(${f(st.p[0])} ${f(st.p[1])}) rotate(${f(st.ang)})" stroke="#E8B23A" stroke-width="${f(Math.max(1.6, u * .045))}" stroke-linecap="round">` +
      `<path d="M${f(-L / 2)} ${f(-off)}H${f(L / 2)}M${f(-L / 2)} ${f(off)}H${f(L / 2)}"/></g>`;
  }
  return out + `<rect x="0" y="0" width="${w}" height="${h}" fill="#4B5057" mask="url(#${id}m)"/>` +
    `<rect x="0" y="0" width="${w}" height="${h}" fill="#C9CED3" mask="url(#${id}h)" opacity=".75"/>`;
}
const cellBox = (unit, cell) => { const s = cellStep(); return { u: unit ?? Math.min(s.w, s.h), cell: cell || { w: s.w - GAP, h: s.h - GAP } }; };
// SVG de las vías de `tr` ({ path, stations }) con la métrica de casilla actual; center(x, y) → [px, py]
export function trackSVG(tr, center, w, h, unit = null, cell = null) {
  const { u, cell: c } = cellBox(unit, cell), L = tr.path.length;
  const pts = tr.path.map(([x, y]) => center(x, y));
  const stops = tr.stations.map(i => { const a = pts[(i - 1 + L) % L], b = pts[(i + 1) % L]; return { p: pts[i], ang: Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI }; });
  return railsSVG(railPath(pts), stops, w, h, u, c);
}
// (creador de niveles) vías aún sin cerrar: tramos sueltos entre casillas vecinas; cells / stations: [[x, y], …]
export function draftTrackSVG(cells, stations, center, w, h, unit = null, cell = null) {
  const { u, cell: c } = cellBox(unit, cell), has = new Set(cells.map(([x, y]) => x + ',' + y)), f = n => n.toFixed(1);
  let d = '';
  for (const [x, y] of cells) {
    const [px, py] = center(x, y);
    for (const [dx, dy] of [[1, 0], [0, 1]]) if (has.has((x + dx) + ',' + (y + dy))) { const [qx, qy] = center(x + dx, y + dy); d += `M${f(px)} ${f(py)}L${f(qx)} ${f(qy)}`; }
    if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => has.has((x + dx) + ',' + (y + dy)))) d += `M${f(px - u * .2)} ${f(py)}L${f(px + u * .2)} ${f(py)}`; // (una suelta)
  }
  const stops = stations.map(([x, y]) => { const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => has.has((x + dx) + ',' + (y + dy)));
    return { p: center(x, y), ang: n && n[1] ? 90 : 0 }; });
  return railsSVG(d, stops, w, h, u, c);
}
const boardCenter = (x, y) => { const c = cellCenterPx(x, y); return [c.px, c.py]; };
let drawnKey = '';
// pinta (o quita) las vías del tablero de la partida; solo se rehace si cambian el circuito o el tamaño de casilla
export function renderTrack(g) {
  const area = $('boardArea'), tr = g?.S.train;
  let svg = $('trackSvg');
  if (!tr) { if (svg) { svg.remove(); drawnKey = ''; } return; }
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'trackSvg'; svg.setAttribute('aria-hidden', 'true');
    area.insertBefore(svg, $('pieces'));
  }
  const s = cellStep(), w = area.offsetWidth, h = area.offsetHeight;
  const k = `${tr.path.length}:${tr.path[0]}:${tr.stations}|${s.w}x${s.h}|${w}x${h}`;
  if (k !== drawnKey || !svg.firstChild) {
    drawnKey = k;
    svg.setAttribute('width', w); svg.setAttribute('height', h); svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.innerHTML = trackSVG(tr, boardCenter, w, h) + `<circle id="trkNext" r="${(Math.min(s.w, s.h) * .4).toFixed(1)}"/>`;
  }
  // la próxima parada (adonde irá solo al acabar el turno): un aro que palpita sobre la vía
  const next = tr.path[(tr.pos + stepsToNext(tr)) % tr.path.length], c = cellCenterPx(next[0], next[1]), ring = $('trkNext');
  if (ring) { ring.setAttribute('cx', c.px.toFixed(1)); ring.setAttribute('cy', c.py.toFixed(1)); }
}

/* ---------- locomotora y vagones (vistos desde arriba, mirando hacia arriba; viewBox 70×100) ---------- */
export const LOCO = '<svg class="trainSvg" viewBox="0 0 70 100" preserveAspectRatio="none" aria-hidden="true">' +
  '<rect x="13" y="7" width="48" height="90" rx="9" fill="rgba(20,20,10,.3)"/>' +                                  // sombra
  '<g fill="#232326">' + [22, 40, 58, 76].map(y => `<rect x="7" y="${y}" width="6" height="11" rx="2"/><rect x="57" y="${y}" width="6" height="11" rx="2"/>`).join('') + '</g>' + // ruedas
  '<g fill="#B5483B">' + [22, 40, 58, 76].map(y => `<rect x="8.5" y="${y + 4}" width="3" height="3" rx="1"/><rect x="58.5" y="${y + 4}" width="3" height="3" rx="1"/>`).join('') + '</g>' +
  '<path d="M17 13 L35 2 L53 13 Z" fill="#8E3328"/><path d="M23 12 L35 5 M35 12V3 M47 12 L35 5" stroke="#5E2018" stroke-width="1.4"/>' + // quitapiedras
  '<rect x="11" y="11" width="48" height="84" rx="7" fill="#2B2B30"/>' +                                            // bastidor
  '<rect x="17" y="13" width="36" height="54" rx="15" fill="#1C1C20"/>' +                                           // caldera
  '<rect x="20" y="16" width="7" height="48" rx="3.5" fill="rgba(255,255,255,.13)"/>' +                             // brillo
  '<path d="M17 30H53M17 50H53" stroke="#D9A441" stroke-width="2.2"/>' +                                             // anillos dorados
  '<circle cx="35" cy="22" r="7.5" fill="#111"/><circle cx="35" cy="22" r="5.2" fill="#3A3A40"/><circle cx="35" cy="22" r="3" fill="#0A0A0C"/>' + // chimenea
  '<circle cx="35" cy="41" r="5.6" fill="#D9A441"/><circle cx="33.6" cy="39.6" r="1.8" fill="#FFE9A8"/>' +            // cúpula de vapor
  '<circle cx="35" cy="11.5" r="3.2" fill="#FFE38A" stroke="#7A5A1C" stroke-width="1"/>' +                           // farol
  '<rect x="12" y="66" width="46" height="28" rx="5" fill="#B5483B"/><rect x="15" y="69" width="40" height="22" rx="3.5" fill="#2E2E33"/>' + // cabina y techo
  '<path d="M15 76H55M15 84H55" stroke="#414148" stroke-width="1.2"/><rect x="12" y="66" width="46" height="2.4" fill="#D9A441"/>' +
  '<rect x="31" y="94" width="8" height="5" rx="1.5" fill="#3A3A40"/>' +                                             // enganche
  '</svg>';
// vagón tolva de madera, lleno de arena de búnker: paredes de tablones con herrajes, dunas con su luz y su sombra,
// marcas de rastrillo y algún grano suelto
export const WAGON = '<svg class="trainSvg" viewBox="0 0 70 100" preserveAspectRatio="none" aria-hidden="true">' +
  '<rect x="13" y="9" width="48" height="86" rx="7" fill="rgba(20,20,10,.28)"/>' +
  '<g fill="#232326">' + [16, 72].map(y => `<rect x="7" y="${y}" width="6" height="12" rx="2"/><rect x="57" y="${y}" width="6" height="12" rx="2"/>`).join('') + '</g>' +
  '<rect x="31" y="1" width="8" height="8" rx="1.5" fill="#3A3A40"/><rect x="31" y="91" width="8" height="7" rx="1.5" fill="#3A3A40"/>' + // enganches
  '<rect x="10" y="6" width="50" height="88" rx="7" fill="#5E3B1E"/>' +                                             // paredes
  '<rect x="11.5" y="7.5" width="47" height="85" rx="6" fill="#8A5A33"/>' +
  '<path d="M11.5 22H16M11.5 38H16M11.5 54H16M11.5 70H16M54 22H58.5M54 38H58.5M54 54H58.5M54 70H58.5" stroke="#5E3B1E" stroke-width="1.3"/>' + // tablones
  '<g fill="#3A3A40">' + [[10, 6], [52, 6], [10, 86], [52, 86]].map(([x, y]) => `<rect x="${x}" y="${y}" width="8" height="8" rx="2"/>`).join('') + '</g>' + // herrajes
  '<rect x="16" y="12" width="38" height="76" rx="4" fill="#C9B47E"/>' +                                            // arena del fondo
  '<path d="M16 26 Q25 15 35 22 T54 18 V88 H16 Z" fill="#DCCB96"/>' +                                               // dunas
  '<path d="M16 50 Q26 36 36 44 Q46 52 54 40 V88 H16 Z" fill="#E8DAAB"/>' +
  '<ellipse cx="34" cy="64" rx="15" ry="18" fill="#F1E6C0"/>' +                                                      // el montón
  '<path d="M23 58 Q30 48 40 52" fill="none" stroke="#FBF5DE" stroke-width="3" stroke-linecap="round"/>' +           // luz
  '<path d="M46 60 Q48 74 38 82" fill="none" stroke="#CDB880" stroke-width="2.4" stroke-linecap="round"/>' +           // sombra
  '<path d="M19 30q8 3 15 0t15 0M19 78q7 3 14 0t14 0" fill="none" stroke="#BFA86E" stroke-width="1.1" stroke-linecap="round"/>' + // rastrillo
  '<g fill="#A88E58">' + [[22, 40], [44, 33], [49, 72], [21, 70], [31, 86]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".9"/>`).join('') + '</g>' +
  '</svg>';

const pieceEl = id => document.querySelector(`#pieces .piece[data-id="${id}"]`);
function ensure(id, svg) {
  let el = pieceEl(id);
  if (!el) {
    el = document.createElement('div');
    el.className = 'piece ptrain' + (id === 'loco' ? ' ploco' : ' pcar');
    el.dataset.id = id;
    el.innerHTML = `<div class="trainBody">${svg}</div>`;
    $('pieces').prepend(el); // (debajo de pelotas y hoyo: van "dentro" de los vagones)
  }
  return el;
}
// giro hacia `deg` por el camino más corto (sin dar media vuelta de 270° al pasar de izquierda a arriba)
function turnTo(el, dir, ms = 0) {
  const target = ANG[dir] ?? 0, cur = el._ang ?? target;
  const next = cur + ((((target - cur) % 360) + 540) % 360 - 180);
  el._ang = next;
  const body = el.firstChild;
  body.style.transition = ms ? `transform ${ms}ms ease-in-out` : '';
  body.style.transform = `rotate(${next}deg)`;
}
// dirección de la casilla i de la vía (hacia la siguiente)
const dirAt = (tr, i) => { const L = tr.path.length, a = tr.path[(i % L + L) % L], b = tr.path[((i + 1) % L + L) % L]; return stepDir(a, b); };
const cellAt = (tr, i) => tr.path[(i % tr.path.length + tr.path.length) % tr.path.length];

// crea las piezas que falten (la locomotora y los vagones que lleve) y quita las que sobren
export function ensureTrain(g, cars = g.S.train?.cars || 0) {
  const tr = g.S.train;
  if (!tr) { document.querySelectorAll('#pieces .ptrain').forEach(e => e.remove()); return; }
  ensure('loco', LOCO);
  for (let k = 1; k <= 3; k++) { const el = pieceEl('car' + k); if (k <= cars) ensure('car' + k, WAGON); else el?.remove(); }
}
// coloca locomotora y vagones según el estado (sin animar)
export function syncTrain(g) {
  const tr = g.S.train;
  if (!tr) return;
  ensureTrain(g);
  place(tr, tr.pos, tr.cars, 0);
}
function place(tr, i, cars, ms) {
  const loco = pieceEl('loco');
  if (loco) { const [x, y] = cellAt(tr, i); setPos(loco, x, y, ms, 'linear'); turnTo(loco, dirAt(tr, i - 1), ms * .9); } // (mira hacia donde iba)
  for (let k = 1; k <= cars; k++) {
    const el = pieceEl('car' + k);
    if (!el) continue;
    const [x, y] = cellAt(tr, i - k);
    setPos(el, x, y, ms, 'linear');
    turnTo(el, dirAt(tr, i - k), ms * .9);
  }
}

/* ---------- reproducción ---------- */
// un paso de la locomotora (ev.i: su nueva casilla). Los pasos de una misma carrera van seguidos y sin frenar:
// ev._first / ev._last / ev._run los calcula animations.js mirando la cola
export function trainMs(ev) { return REDUCED ? 60 : ev._run > 10 ? 125 : ev._run > 5 ? 165 : 210; }
export async function playTrain(ev) {
  const tr = app.game.S.train;
  if (!tr) return;
  ensureTrain(app.game, ev.cars);
  const ms = trainMs(ev);
  if (ev._first) sfx('whistle');
  place(tr, ev.i, ev.cars, ms);
  // humo de la chimenea (un poco por delante del centro de la locomotora)
  const [x, y] = cellAt(tr, ev.i), c = cellCenterPx(x, y), { dx, dy } = { up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 } }[ev.dir];
  const s = cellStep();
  setTimeout(() => fxSpawn(c.px + dx * s.w * .22, c.py + dy * s.h * .22, { n: 2, colors: ['#FFFFFF', '#ECECEC', '#D6D6D6'], size: 10, dist: 12, up: 16, gravity: -8, dur: 820, alpha: .8 }), ms * .3);
  sfx('chug');
  await wait(ms);
}
export async function playWagon(ev) {
  const tr = app.game.S.train;
  if (!tr) return;
  ensureTrain(app.game, ev.cars);
  const el = pieceEl('car' + ev.cars);
  place(tr, tr.pos, ev.cars, 0);
  if (el) el.firstChild.animate([{ transform: el.firstChild.style.transform + ' scale(.4)', opacity: 0 }, { transform: el.firstChild.style.transform, opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.3,1.4,.5,1)' });
  const c = cellCenterPx(ev.x, ev.y);
  fxSpawn(c.px, c.py, { n: 9, colors: ['#E2D3A2', '#F3E9C6', '#C9B47E'], size: 6, dist: 26, up: 8, gravity: 14, dur: 460 });
  sfx('sandPour');
  await wait(340);
}
// la cola de animaciones: el principio, el final y la longitud de la carrera del tren (en una jugada solo hay una:
// la de la carta o la del final del turno). Los empujones y lo que va en los vagones se mueven a la vez que la locomotora
export function markTrainRuns(q) {
  const run = q.filter(e => e.t === 'train');
  if (!run.length) return; // (sin tren: lo que viaja en la bola de nieve lleva su propio paso, seasons-view.js)
  run.forEach((e, k) => { e._run = run.length; e._first = k === 0; e._last = k === run.length - 1; });
  const ms = run.length ? trainMs(run[0]) : 210;
  for (const e of q) if (e.t === 'move' && (e.shove || e.ride)) e._ms = ms;
}
// la locomotora no puede seguir (madera o pelotas que no se apartan): se asoma, choca y vuelve
export async function playTrainBump() {
  const el = pieceEl('loco');
  if (!el) return;
  const a = el._ang || 0, body = el.firstChild;
  body.animate([{ transform: `rotate(${a}deg)` }, { transform: `rotate(${a}deg) translateY(-14%)`, offset: .4 }, { transform: `rotate(${a}deg)` }], { duration: 300, easing: 'ease-out' });
  sfx('wood');
  await wait(320);
}
