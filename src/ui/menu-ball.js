// Menú vivo: al volver al menú con el reto diario recién completado, la bola de la ilustración
// rueda por el green hasta el hoyo (como un putt que frena y rompe un poco) y cae dentro.
// Solo se anima la primera vez ese día; después la bola ya está en el hoyo. Al día siguiente,
// con el reto nuevo por jugar, vuelve a su sitio.
import { $ } from './dom.js';
import { app } from './app.js';
import { REDUCED } from '../fx/juice.js';
import { sfx } from '../audio/sfx.js';

const KEY = 'chaoticgolf_menuBall';
const START = [566, 360], CTRL = [642, 350], HOLE = [636, 266]; // coordenadas del dibujo (1000×700)
const seenOn = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
const markSeen = date => { try { localStorage.setItem(KEY, date); } catch (e) { /* sin storage */ } };

// punto de la curva (bezier cuadrática) relativo a la salida
function at(k) {
  const a = (1 - k) * (1 - k), b = 2 * (1 - k) * k, c = k * k;
  return [a * START[0] + b * CTRL[0] + c * HOLE[0] - START[0], a * START[1] + b * CTRL[1] + c * HOLE[1] - START[1]];
}

let timer = null;
export function syncMenuBall(done, date) {
  const g = $('menuBall');
  if (!g) return;
  clearTimeout(timer);
  g.getAnimations?.().forEach(a => a.cancel());
  g.style.transformOrigin = `${START[0]}px ${START[1]}px`;
  g.style.transformBox = 'view-box';
  if (!done) { g.style.opacity = ''; return; }            // reto pendiente: la bola, en su sitio
  if (seenOn() === date || REDUCED || !g.animate) { g.style.opacity = 0; return; } // ya está en el hoyo
  markSeen(date);
  g.style.opacity = '';
  timer = setTimeout(() => roll(g), 1000); // tras la entrada del menú
}

function roll(g) {
  if (app.screen !== 'menu') { g.style.opacity = 0; return; }
  // rodar: el putt frena al acercarse (ease-out) siguiendo la curva
  const N = 16, frames = [];
  for (let i = 0; i <= N; i++) {
    const tt = i / N, k = 1 - Math.pow(1 - tt, 1.8);
    const [x, y] = at(k);
    frames.push({ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`, offset: tt });
  }
  const [hx, hy] = at(1);
  const rollAnim = g.animate(frames, { duration: 1500, easing: 'linear', fill: 'forwards' });
  rollAnim.onfinish = () => {
    // cae dentro del hoyo
    const drop = g.animate([
      { transform: `translate(${hx}px, ${hy}px) scale(1)`, opacity: 1 },
      { transform: `translate(${hx}px, ${hy + 3}px) scale(.35)`, opacity: 0 },
    ], { duration: 260, easing: 'ease-in', fill: 'forwards' });
    drop.onfinish = () => { g.style.opacity = 0; ripple(); };
    sfx('sink');
  };
}

// destello en el hoyo al embocar
function ripple() {
  const svg = $('menuBall')?.ownerSVGElement;
  if (!svg) return;
  const c = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  c.setAttribute('cx', HOLE[0]); c.setAttribute('cy', HOLE[1] - 2);
  c.setAttribute('rx', 16); c.setAttribute('ry', 11);
  c.setAttribute('fill', 'none'); c.setAttribute('stroke', '#F1F1DC'); c.setAttribute('stroke-width', 3);
  c.style.transformOrigin = `${HOLE[0]}px ${HOLE[1] - 2}px`; c.style.transformBox = 'view-box';
  svg.appendChild(c);
  const a = c.animate([{ transform: 'scale(1)', opacity: .9 }, { transform: 'scale(2.6)', opacity: 0 }], { duration: 650, easing: 'ease-out' });
  a.onfinish = () => c.remove();
}
