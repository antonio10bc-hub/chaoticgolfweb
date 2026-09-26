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

const SVGNS = 'http://www.w3.org/2000/svg';

// simula la acción `act(sim)` y devuelve los recorridos de cada pieza
function simulate(g, act) {
  const sim = g.clone({ lite: true });
  sim.events = [];
  if (!act(sim)) return null;
  const evs = sim.takeEvents();
  const pos = { hole: { x: g.S.hole.x, y: g.S.hole.y } };
  for (const b of g.S.balls) pos['b' + b.player] = { x: b.x, y: b.y };
  const paths = {}, marks = [], unknown = new Set(); // (tras un túnel, el camino es incierto: se corta con un "?")
  const push = (id, pt) => {
    if (!pos[id] || unknown.has(id)) return;
    (paths[id] ||= [{ ...pos[id], kind: 'start' }]).push(pt);
    pos[id] = { x: pt.x, y: pt.y };
  };
  for (const ev of evs) {
    switch (ev.t) {
      case 'move': case 'drift': push(ev.p, { x: ev.x, y: ev.y, kind: 'move' }); break;
      case 'splash': push(ev.p, { x: ev.x, y: ev.y, kind: 'fall' }); break;
      case 'launch': push(ev.p, { x: ev.x, y: ev.y, kind: 'jump' }); break;
      case 'bump': if (pos[ev.p] && !unknown.has(ev.p)) marks.push({ kind: 'impact', ...pos[ev.p], dir: ev.dir }); break;
      case 'tunnel': if (pos[ev.p] && !unknown.has(ev.p)) { marks.push({ kind: 'unknown', x: ev.x, y: ev.y }); unknown.add(ev.p); } break;
      case 'teleport': push(ev.p, { x: ev.x, y: ev.y, kind: 'jump' }); break;
      case 'fall': push(ev.p, { x: ev.x, y: ev.y, kind: 'fall' }); break;
      case 'appear': if (paths[ev.p]) push(ev.p, { x: ev.x, y: ev.y, kind: 'appear' }); break;
      case 'impact': if (pos[ev.p]) marks.push({ kind: 'impact', ...pos[ev.p], dir: ev.dir }); break;
      case 'sink': if (pos[ev.p]) marks.push({ kind: 'sink', ...pos[ev.p] }); break;
      case 'settle': if (pos[ev.p]) marks.push({ kind: 'sand', ...pos[ev.p] }); break;
    }
  }
  return { paths, marks, jaque: sim.S.winner !== null };
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
const colorOf = id => id === 'hole' ? '#242424' : pColor(+id.slice(1));

function draw(res, { armedAt = null } = {}) {
  const svg = layer();
  if (!res) { hidePreview(); return; }
  const area = $('boardArea');
  svg.setAttribute('width', area.offsetWidth); svg.setAttribute('height', area.offsetHeight);
  svg.setAttribute('viewBox', `0 0 ${area.offsetWidth} ${area.offsetHeight}`);
  const s = cellStep(), rBall = Math.min(s.w, s.h) * .26;
  let out = '';
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
    const c = cellCenterPx(armedAt.x, armedAt.y);
    out += `<g class="pvTap" transform="translate(${c.px} ${c.py - s.h * .62})"><rect x="-44" y="-12" width="88" height="22" rx="11"/><text y="4">${t('preview.tapAgain')}</text></g>`;
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
export function previewCard(p, idx) {
  const g = app.game;
  if (!g || g.pending || app.animating || !g.canPlay(p, g.S.hands[p][idx])) { hidePreview(); return; }
  const res = simulate(g, sim => sim.clickCard(p, idx) && !sim.pending);
  if (!res || !Object.keys(res.paths).length) { hidePreview(); return; }
  draw(res);
}

// una jugada completa (lista de acciones, como las de la IA): consejo del caddie
export function previewPlan(actions) {
  const g = app.game;
  if (!g || g.pending || app.animating) return;
  const res = simulate(g, sim => { for (const a of actions) if (!applyAction(sim, a)) return false; return true; });
  if (res && Object.keys(res.paths).length) draw(res);
}
