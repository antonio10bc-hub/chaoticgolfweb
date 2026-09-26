/* ---------- animaciones ----------
   el motor registra eventos (move, impact, sink…) mientras resuelve; tras el
   render se reproducen en orden sobre la capa de piezas #pieces            */
import { app } from './app.js';
import { $, wait } from './dom.js';
import { pieceEl, syncPieces } from './board.js';
import { setPos, cellCenterPx, pieceCenterPx } from './geometry.js';
import { DIRS } from '../engine/game.js';
import { pColor } from '../art.js';
import { JUICE, GRASS_C, SAND_C, DIRT_C, WARP_C, WATER_C, CONFETTI_C } from '../fx/juice.js';
import { fxSpawn } from '../fx/particles.js';
import { fxShake, fxZoomPulse, fxEdgeFall, fxSplashRing, fxComboText, fxChainStop, fxTrailPush, fxTrailReset, fxTrailShow, fxArmIdle } from '../fx/effects.js';
import { sfx, resetChain } from '../audio/sfx.js';
import { tileDef } from '../content/tiles/index.js';
import { t } from '../i18n/index.js';
import { toast } from './hud.js';
import { botReact } from './bot-react.js';
import { unlock } from './achievements.js';
import { isBot } from './players.js';

let combo = 0;

export async function playQueue(onDone) {
  const game = app.game; // si la partida se descarta o reinicia a mitad, la reproducción se aborta
  app.animating = true;
  resetChain(); combo = 0; fxTrailReset();   // reinicia contadores decorativos de la jugada
  const piecesEl = $('pieces');
  if (piecesEl) piecesEl.classList.remove('idle');
  if (app.animLead) { const lead = app.animLead; app.animLead = 0; await wait(lead); }
  if (app.game !== game) return;
  const q = app.animQueue; app.animQueue = [];
  const warped = new Set(); // pelotas que han cruzado un portal en esta jugada (logro "de portal a hoyo")
  for (const ev of q) {
    if (ev.t === 'teleport') warped.add(ev.p);
    if (ev.t === 'sink' && warped.has(ev.p) && app.mode !== 'free' && !isBot(+ev.p.slice(1))) unlock('portalSink');
    if (ev.t === 'chainStop' && app.mode !== 'free') unlock('loop');
    pieceEl(ev.p)?.classList.add('acting'); // la pieza que se mueve se destaca mientras actúa
    try { await playEvent(ev); } catch (e) { console.warn('animación', ev, e); }
    if (app.game !== game) return; // partida descartada: no tocar la nueva
  }
  app.animating = false;
  if (combo >= 3 && app.mode !== 'free' && app.lastActor != null && !isBot(app.lastActor)) unlock('combo3');
  syncPieces();
  fxTrailShow(); // estela fantasma del camino recorrido
  fxArmIdle();
  onDone?.();
}

async function playEvent(ev) {
  const el = pieceEl(ev.p);
  if (!el) return;
  botReact(ev); // caras y bocadillos de los bots (decorativo)
  const inner = el.firstChild;
  const isHole = ev.p === 'hole';
  const pid = isHole ? -1 : +ev.p.slice(1);
  const trailCol = pid < 0 ? '#2c5c46' : pColor(pid);
  switch (ev.t) {
    case 'move': {    // deslizamiento con easing, squash & stretch, sombra y estela
      const ms = isHole ? JUICE.move.holeMs : JUICE.move.ms;
      if (!isHole) { el.classList.remove('glide'); void el.offsetWidth; el.classList.add('glide'); }
      setPos(el, ev.x, ev.y, ms, isHole ? JUICE.move.holeEase : JUICE.move.ease);
      fxTrailPush(ev.x, ev.y, trailCol);
      const { px, py } = cellCenterPx(ev.x, ev.y);
      if (isHole) {
        fxSpawn(px, py, { n: JUICE.move.dirtPuffs, colors: DIRT_C, size: 6, dist: 26, dur: 430, gravity: 14 });
        sfx('holeMove');
      } else {
        const tile = app.game.tileAt(ev.x, ev.y), step = tile && tileDef(tile.type)?.stepSound;
        fxSpawn(px, py, { n: JUICE.move.grassPuffs, colors: step ? SAND_C : GRASS_C, size: 5, dist: 20, dur: 380, gravity: 12 });
        sfx(step || 'roll'); // cada loseta suena distinto al rodar por ella (arena…)
      }
      await wait(ms + 15);
      break;
    }
    case 'drift': {   // río: la pieza flota y la corriente la baja despacio, con ondas a su paso
      el.classList.add('swimming');
      const ms = 430;
      setPos(el, ev.x, ev.y, ms, 'cubic-bezier(.45,.05,.55,.95)');
      const { px, py } = cellCenterPx(ev.x, ev.y);
      fxSpawn(px, py, { n: 3, colors: WATER_C, size: 5, dist: 16, dur: 420, gravity: -6 });
      fxTrailPush(ev.x, ev.y, trailCol);
      if (!app.driftSfx) { sfx('water'); app.driftSfx = true; setTimeout(() => { app.driftSfx = false; }, 900); }
      await wait(ms + 10);
      if (ev.out) { el.classList.remove('swimming'); el.classList.add('climbOut'); setTimeout(() => el.classList.remove('climbOut'), 380); }
      break;
    }
    case 'splash': {  // lago: entra en el agua, se hunde con salpicadura y aros
      el.classList.remove('swimming');
      setPos(el, ev.x, ev.y, 120, 'ease-out');
      await wait(110);
      const { px, py } = cellCenterPx(ev.x, ev.y);
      el.classList.add('splashing');
      fxSpawn(px, py, { n: 5, colors: WATER_C, size: 4, dist: 14, up: 8, dur: 420, gravity: 40 });
      fxSplashRing(px, py);
      sfx('splash');
      await wait(380);
      el.style.opacity = 0;
      el.classList.remove('splashing');
      await wait(60);
      break;
    }
    case 'teleport': { // succión con escala + rotación y glow; expulsión simétrica al salir
      const src = pieceCenterPx(el);
      el.classList.add('warp', 'warpOut');
      fxSpawn(src.px, src.py, { n: JUICE.teleport.vortex, colors: WARP_C, size: 6, dist: 34, dur: 430 });
      sfx('portal');
      await wait(JUICE.teleport.inMs);
      el.classList.remove('warpOut');
      el.style.opacity = 0;                    // salto invisible entre portales
      setPos(el, ev.x, ev.y, 0);
      await wait(30);
      const dst = pieceCenterPx(el);
      fxSpawn(dst.px, dst.py, { n: JUICE.teleport.vortex, colors: WARP_C, size: 6, dist: 40, up: 8, dur: 470 });
      fxTrailPush(ev.x, ev.y, trailCol);
      el.style.opacity = 1;
      el.classList.add('warpIn');
      await wait(JUICE.teleport.outMs);
      el.classList.remove('warp', 'warpIn');
      break;
    }
    case 'impact': {  // golpe seco: carga, choque con shake + destello + chispas
      const d = DIRS[ev.dir];
      const tgt = pieceEl(ev.target);
      const hitPt = tgt ? pieceCenterPx(tgt) : pieceCenterPx(el);
      inner.style.transform = `translate(${-d.dx * 3}px, ${-d.dy * 3}px)`;   // carga hacia atrás
      await wait(JUICE.impact.windupMs);
      inner.style.transform = `translate(${d.dx * JUICE.impact.lungePx}px, ${d.dy * JUICE.impact.lungePx}px)`;
      if (tgt) {
        tgt.firstChild.classList.add('hitFlash');
        setTimeout(() => tgt.firstChild.classList.remove('hitFlash'), 340);
      }
      fxShake();
      fxSpawn(hitPt.px, hitPt.py, { n: JUICE.impact.sparks, colors: ['#ffffff', '#ffe9a8', '#ffd06b'], size: 6, dist: 52, dur: 430 });
      combo++;
      if (combo >= 2) fxComboText(hitPt.px, hitPt.py, combo);   // reacción en cadena
      sfx('knock');
      await wait(JUICE.impact.strikeMs);
      inner.style.transform = '';
      await wait(JUICE.impact.recoverMs);
      break;
    }
    case 'fall': {    // rueda hacia fuera con rotación y fade + poof en el borde
      el.classList.remove('swimming');
      const edge = pieceCenterPx(el);
      el.classList.add('falling');
      setPos(el, ev.x, ev.y, JUICE.fall.ms, 'ease-in');
      el.style.opacity = 0;
      fxSpawn(edge.px, edge.py, { n: JUICE.fall.poof, colors: ['#ffffff', '#e3ebdf'], size: 8, dist: 30, dur: 440 });
      setTimeout(() => fxEdgeFall(ev.x, ev.y, trailCol), JUICE.fall.ms * .45); // al cruzar el borde
      sfx('fall');
      await wait(JUICE.fall.ms + 20);
      el.classList.remove('falling');
      break;
    }
    case 'appear': {  // reaparece con drop-in, rebote y polvareda
      el.style.display = 'flex';
      el.classList.remove('ghostHoled', 'ghostPick', 'ghostCan', 'swimming'); // (si salía del hoyo, deja de ser fantasma)
      inner.style.transform = '';
      setPos(el, ev.x, ev.y, 0);
      el.classList.add('dropping', 'air');
      await wait(30);
      el.style.opacity = 1;
      const { px, py } = cellCenterPx(ev.x, ev.y);
      fxSpawn(px, py, { n: JUICE.appear.dust, colors: ['#ffffff', '#e6ead9'], size: 7, dist: 26, dur: 410 });
      sfx('pop');
      await wait(JUICE.appear.ms);
      el.classList.remove('dropping', 'air');
      break;
    }
    case 'sink': {    // espiral + slow-motion antes del confeti + zoom del tablero
      const cup = pieceCenterPx(el);
      const hole = pieceEl('hole');
      el.classList.add('sinking');
      if (hole && ev.p !== 'hole') {
        hole.firstChild.classList.add('hitFlash');
        setTimeout(() => hole.firstChild.classList.remove('hitFlash'), 340);
      }
      sfx('sink');
      await wait(JUICE.sink.ms - 140);
      inner.style.animationPlayState = 'paused';   // slow-motion: congela la espiral un instante
      fxZoomPulse();
      await wait(JUICE.slowMoMs);
      inner.style.animationPlayState = '';
      fxSpawn(cup.px, cup.py, { n: JUICE.sink.confetti, colors: CONFETTI_C, size: 7, dist: 64, up: 38, dur: 650, rect: true });
      el.style.opacity = 0;                    // se desvanece ya casi dentro
      await wait(140);
      el.classList.remove('sinking');
      el.style.display = 'none';
      break;
    }
    case 'chainStop': { // tope anti-bucle: la cadena de choques entre portales se corta aquí
      const pt = pieceCenterPx(el);
      el.firstChild.classList.add('hitFlash');
      setTimeout(() => el.firstChild.classList.remove('hitFlash'), 500);
      fxChainStop(pt.px, pt.py);
      fxShake();
      sfx('chainBreak');
      toast(t('notice.chainStop'), 'warn');
      await wait(Math.max(420, JUICE.comboMs * .6));
      break;
    }
    case 'settle': {  // "plof" de arena al quedarse en el búnker
      const pt = pieceCenterPx(el);
      inner.style.transform = 'scale(.82)';
      fxSpawn(pt.px, pt.py, { n: JUICE.settle.sand, colors: SAND_C, size: 6, dist: 34, up: 10, dur: 470, gravity: 16 });
      sfx('sand');
      await wait(JUICE.settle.plofMs);
      inner.style.transform = '';
      await wait(90);
      break;
    }
  }
}
