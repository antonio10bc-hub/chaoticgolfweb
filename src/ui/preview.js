// Vista previa de la jugada antes de confirmarla: se simula sobre una copia del motor
// (las mismas reglas que la jugada real) y se dibuja por dónde irá cada pieza que se mueva:
// choques en cadena, portales, búnker, caídas fuera del tablero y el hoyo.
// Es solo dibujo: la partida real no cambia hasta que confirmas.
import { app } from './app.js';
import { $ } from './dom.js';
import { cellCenterPx, cellStep } from './geometry.js';
import { pColor } from '../art.js';
import { t } from '../i18n/index.js';
import { applyAction } from '../ai/bot.js';
import { CARDS } from '../content/cards/index.js';

const SVGNS = 'http://www.w3.org/2000/svg';

// simula la acción `act(sim)` y devuelve los recorridos de cada pieza
function simulate(g, act) {
  const sim = g.clone({ lite: true });
  sim.events = [];
  if (!act(sim)) return null;
  const evs = sim.takeEvents();
  const pos = { hole: { x: g.S.hole.x, y: g.S.hole.y } };
  for (const b of g.S.balls) pos['b' + b.player] = { x: b.x, y: b.y };
  for (const h of g.S.holeCopies || []) pos[h.id] = { x: h.x, y: h.y }; // (multiverso)
  const paths = {}, marks = [], unknown = new Set();
  // (baraja del tren) las casillas que recorre la locomotora y dónde se engancha un vagón nuevo
  const train = g.S.train ? [g.S.train.pos] : null; let wagon = null; // (tras un túnel, el camino es incierto: se corta con un "?")
  const sn = g.S.season?.snow, snow = sn ? [[sn.x, sn.y]] : null; // (estaciones) por dónde rodará la bola de nieve
  const push = (id, pt) => {
    if (!pos[id] || unknown.has(id)) return;
    (paths[id] ||= [{ ...pos[id], kind: 'start' }]).push(pt);
    pos[id] = { x: pt.x, y: pt.y };
  };
  for (const ev of evs) {
    switch (ev.t) {
      case 'move': case 'drift': case 'gust': push(ev.p, { x: ev.x, y: ev.y, kind: 'move' }); break;
      case 'burn': case 'eaten': push(ev.p, { x: ev.x, y: ev.y, kind: 'fall' }); break;
      case 'snow': snow?.push([ev.x, ev.y]); break;
      case 'splash': push(ev.p, { x: ev.x, y: ev.y, kind: 'fall' }); break;
      case 'launch': push(ev.p, { x: ev.x, y: ev.y, kind: 'jump' }); break;
      case 'bump': if (pos[ev.p] && !unknown.has(ev.p)) marks.push({ kind: 'impact', ...pos[ev.p], dir: ev.dir }); break;
      case 'tunnel': if (pos[ev.p] && !unknown.has(ev.p)) { marks.push({ kind: 'unknown', x: ev.x, y: ev.y }); unknown.add(ev.p); } break;
      case 'teleport': push(ev.p, { x: ev.x, y: ev.y, kind: 'jump' }); break;
      case 'fall': push(ev.p, { x: ev.x, y: ev.y, kind: 'fall' }); break;
      case 'appear': if (paths[ev.p]) push(ev.p, { x: ev.x, y: ev.y, kind: 'appear' }); break;
      case 'impact': case 'clash': case 'gstuck': if (pos[ev.p]) marks.push({ kind: 'impact', ...pos[ev.p], dir: ev.dir }); break; // (clash: la gravedad junta dos pelotas)
      case 'sink': if (pos[ev.p]) marks.push({ kind: 'sink', ...pos[ev.p] }); break;
      case 'settle': if (pos[ev.p]) marks.push({ kind: 'sand', ...pos[ev.p] }); break;
      case 'train': train?.push(ev.i); break;
      case 'wagon': wagon = { x: ev.x, y: ev.y }; break;
    }
  }
  return { paths, marks, jaque: sim.S.winner !== null, train: train && train.length > 1 ? train : null, wagon, snow: snow && snow.length > 1 ? snow : null };
}

function layer() {
  let svg = $('previewSvg');
  if (!svg) {
    svg = document.createElementNS(SVGNS, 'svg');
    svg.id = 'previewSvg';
    svg.setAttribute('aria-hidden', 'true');
    $('boardArea').appendChild(svg);
  }
  return svg;
}
const colorOf = id => id.startsWith('hole') ? '#242424' : pColor(+id.slice(1)); // (y las copias del hoyo)

function draw(res, { armedAt = null, label = 'tapAgain' } = {}) {
  const svg = layer();
  if (!res) { hidePreview(); return; }
  const area = $('boardArea');
  svg.setAttribute('width', area.offsetWidth); svg.setAttribute('height', area.offsetHeight);
  svg.setAttribute('viewBox', `0 0 ${area.offsetWidth} ${area.offsetHeight}`);
  const s = cellStep(), rBall = Math.min(s.w, s.h) * .26;
  let out = '';
  if (res.train) { // el tren: su recorrido por la vía (discontinuo) y la locomotora fantasma donde parará
    const path = app.game.S.train.path, c = i => cellCenterPx(...path[i]);
    out += `<polyline points="${res.train.map(i => { const q = c(i); return q.px + ',' + q.py; }).join(' ')}" class="pvTrainLine"/>`;
    const e = c(res.train[res.train.length - 1]);
    out += `<rect x="${e.px - s.w * .34}" y="${e.py - s.h * .4}" width="${s.w * .68}" height="${s.h * .8}" rx="${s.w * .14}" class="pvTrain"/>`;
  }
  if (res.snow) { // la bola de nieve: su recorrido y dónde se parará
    out += `<polyline points="${res.snow.map(([x, y]) => { const q = cellCenterPx(x, y); return q.px + ',' + q.py; }).join(' ')}" class="pvSnowLine"/>`;
    const e = cellCenterPx(...res.snow[res.snow.length - 1]);
    out += `<circle cx="${e.px}" cy="${e.py}" r="${Math.min(s.w, s.h) * .42}" class="pvSnow"/>`;
  }
  if (res.wagon) { const e = cellCenterPx(res.wagon.x, res.wagon.y); out += `<rect x="${e.px - s.w * .34}" y="${e.py - s.h * .4}" width="${s.w * .68}" height="${s.h * .8}" rx="${s.w * .14}" class="pvTrain wagon"/>`; }
  const ids = Object.keys(res.paths).sort((a, b) => (b === 'hole') - (a === 'hole')); // el hoyo debajo
  for (const id of ids) {
    const pts = res.paths[id], col = colorOf(id);
    let seg = [];
    const flush = (dashed = false) => {
      if (seg.length > 1) out += `<polyline points="${seg.map(p => p.join(',')).join(' ')}" class="pvLine${dashed ? ' fall' : ''}" style="--pc:${col}"/>`;
      seg = [];
    };
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], c = cellCenterPx(p.x, p.y), xy = [c.px, c.py];
      if (p.kind === 'jump') { // portal: salto (sin línea) con aro en la salida
        flush(); out += `<circle cx="${c.px}" cy="${c.py}" r="${rBall * .9}" class="pvPortal" style="--pc:${col}"/>`;
      } else if (p.kind === 'fall') { // cae fuera: tramo discontinuo y aspa
        seg.push(xy); flush(true);
        out += `<g class="pvOut" transform="translate(${c.px} ${c.py})"><path d="M-6 -6L6 6M6 -6L-6 6"/></g>`;
        continue;
      } else if (p.kind === 'appear') { // vuelve a su salida
        flush(); out += `<circle cx="${c.px}" cy="${c.py}" r="${rBall * .75}" class="pvRespawn" style="--pc:${col}"/>`;
      }
      seg.push(xy);
    }
    flush();
    // posición final: fantasma de la pieza
    const last = pts[pts.length - 1];
    if (last.kind !== 'fall') {
      const c = cellCenterPx(last.x, last.y);
      out += id === 'hole'
        ? `<circle cx="${c.px}" cy="${c.py}" r="${rBall * 1.05}" class="pvGhost hole"/>`
        : `<circle cx="${c.px}" cy="${c.py}" r="${rBall}" class="pvGhost" style="--pc:${col}"/>`;
    }
  }
  for (const m of res.marks) {
    const c = cellCenterPx(m.x, m.y);
    if (m.kind === 'impact') out += `<g class="pvHit" transform="translate(${c.px} ${c.py})"><path d="M0 -9V-4M0 4V9M-9 0H-4M4 0H9M-6 -6L-3.5 -3.5M3.5 3.5L6 6M6 -6L3.5 -3.5M-3.5 3.5L-6 6"/></g>`;
    if (m.kind === 'sink') out += `<circle cx="${c.px}" cy="${c.py}" r="${rBall * 1.5}" class="pvSink"/>`;
    if (m.kind === 'sand') out += `<circle cx="${c.px}" cy="${c.py}" r="${rBall * 1.3}" class="pvSand"/>`;
    if (m.kind === 'unknown') out += `<g class="pvUnknown" transform="translate(${c.px} ${c.py})"><circle r="${rBall * 1.2}"/><text y="${rBall * .45}">?</text></g>`;
  }
  if (armedAt) { // en pantallas táctiles: primer toque = vista previa, segundo = confirmar
    // (encima de la casilla; en la fila de arriba, debajo, y nunca fuera por los lados: el marco del tablero la cortaba)
    const c = cellCenterPx(armedAt.x, armedAt.y), W = area.offsetWidth, H = area.offsetHeight;
    const up = c.py - s.h * .62, y = up - 12 >= 0 ? up : Math.min(H - 11, c.py + s.h * .62);
    const x = Math.max(45, Math.min(W - 45, c.px));
    if (label === 'tapHere') out += `<circle cx="${c.px}" cy="${c.py}" r="${Math.min(s.w, s.h) * .44}" class="pvTarget"/>`;
    out += `<g class="pvTap" transform="translate(${x} ${y})"><rect x="-44" y="-12" width="88" height="22" rx="11"/><text y="4">${t('preview.' + label)}</text></g>`;
  }
  svg.innerHTML = out;
  svg.classList.add('visible');
  svg.classList.toggle('jaque', res.jaque);
}

export function hidePreview() { const svg = $('previewSvg'); if (svg) { svg.classList.remove('visible'); svg.innerHTML = ''; } }

// casilla de destino de la acción en curso (palo, dedo, palo reactivo…)
export function previewCell(x, y, opts) {
  const g = app.game;
  if (!g?.pending || app.animating) { hidePreview(); return; }
  draw(simulate(g, sim => sim.clickCell(x, y)), opts);
}
// carta de efecto inmediato (cartas de hoyo…): se ve qué hará antes de jugarla
// (las que reparten al azar, como la lluvia de meteoritos, no: la copia no sabe dónde caerán)
const cardSim = (g, p, idx) => CARDS[g.S.hands[p][idx]]?.random ? null : simulate(g, sim => sim.clickCard(p, idx) && !sim.pending);
export function previewCard(p, idx, { targets = null } = {}) {
  const g = app.game;
  if (!g || g.pending || app.animating || !g.canPlay(p, g.S.hands[p][idx])) { hidePreview(); return; }
  const res = cardSim(g, p, idx);
  if (!res || (!Object.keys(res.paths).length && !res.train && !res.wagon)) { hidePreview(); return; }
  draw(res, targets?.length ? { armedAt: targets[0], label: 'tapHere' } : undefined);
}
// táctil: casillas donde acaba lo que mueve la carta elegida (el hoyo, si lo mueve). Tocar ahí la juega,
// como el segundo toque del palo en su destino. Sin nada que se vea moverse, null (queda el botón Jugar).
export function cardTargets(p, idx) {
  const g = app.game, res = g && cardSim(g, p, idx);
  if (!res) return null;
  const end = id => { const pts = res.paths[id], l = pts[pts.length - 1]; return l.kind === 'fall' ? null : { x: l.x, y: l.y }; };
  const ids = res.paths.hole ? ['hole'] : Object.keys(res.paths);
  const out = ids.map(end).filter(Boolean);
  // el tren: primero la parada donde se detendrá (o la casilla del vagón nuevo)
  if (res.train) { const [x, y] = g.S.train.path[res.train[res.train.length - 1]]; out.unshift({ x, y }); }
  if (res.wagon) out.unshift({ ...res.wagon });
  return out.length ? out : null;
}

// una jugada completa (lista de acciones, como las de la IA): consejo del caddie
export function previewPlan(actions) {
  const g = app.game;
  if (!g || g.pending || app.animating) return;
  const res = simulate(g, sim => { for (const a of actions) if (!applyAction(sim, a)) return false; return true; });
  if (res && (Object.keys(res.paths).length || res.train || res.wagon)) draw(res);
}
