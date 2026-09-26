// Ayudas de la partida:
//   · Consejo del caddie — sugiere tu mejor jugada con la misma IA que los bots: resalta la carta,
//     dibuja el recorrido y, al elegirla, la casilla. Es opcional y queda anotado (resumen final).
//   · Deshacer — en Lo básico y en partidas fáciles puedes deshacer tus jugadas del turno en curso.
import { app } from './app.js';
import { $, esc } from './dom.js';
import { t } from '../i18n/index.js';
import { CARDS } from '../content/cards/index.js';
import { choosePlan, discardPlan, applyAction } from '../ai/bot.js';
import { prefs } from './prefs.js';
import { multiHuman, isBot } from './players.js';
import { dockOwner } from './hands.js';
import { previewPlan, previewCell } from './preview.js';
import { toast } from './hud.js';
import * as ctl from './controller.js';
import { stats } from './controller.js';
import { sfx } from '../audio/sfx.js';

/* ---------- consejo del caddie ---------- */
// ¿se puede pedir ahora? (tu turno o una reacción tuya, sin nada a medias)
export function caddieAvailable() {
  const g = app.game, S = g?.S;
  if (!S || !prefs.caddie || app.mode === 'free' || app.mode === 'test' || app.animating || app.paused) return false;
  const me = dockOwner(g);
  if (isBot(me) || S.turn !== me || S.winner !== null) return false; // en tu turno (y sin JAQUE en juego)
  if (app.mode === 'pve' && multiHuman() && app.viewer !== me) return false;
  return !g.pending && S.hands[me]?.length > 0;
}

export function askCaddie() {
  if (!caddieAvailable()) return;
  const g = app.game, me = dockOwner(g);
  // la IA "normal" del caddie (sin los despistes del nivel fácil) y con estilo equilibrado
  const sim = g.clone({ lite: true });
  delete sim.S.aiLevel; sim.S.aiStyles = sim.S.aiStyles || []; sim.S.aiStyles[me] = 'trick';
  const plan = choosePlan(sim, me, () => .5);
  stats.caddie = (stats.caddie || 0) + 1;
  sfx('select');
  if (!plan) {
    const junk = sim.S.playedThisTurn === 0 && sim.S.turn === me ? discardPlan(sim, me) : [];
    app.caddie = { none: true };
    toast(t(junk.length ? 'caddie.discard' : 'caddie.endTurn'));
    render();
    return;
  }
  app.caddie = { plan, idx: plan.actions[0][2], key: plan.key, turn: g.S.turn };
  toast(t('caddie.suggests', { card: CARDS[plan.key].short || CARDS[plan.key].name }));
  render();
}

// se vuelve a pintar tras cada render (el render limpia la vista previa)
export function redrawCaddie() {
  const c = app.caddie, g = app.game;
  document.querySelectorAll('.caddiePick, .caddieCell').forEach(el => el.classList.remove('caddiePick', 'caddieCell'));
  if (!c || !g) return;
  if (c.none) { $('endTurnBtn').classList.add('caddiePick'); return; }
  const me = dockOwner(g), pd = g.pending;
  if (!pd) {
    const card = document.querySelector(`#hands .card[data-p="${me}"][data-idx="${c.idx}"]`);
    if (!card || g.S.hands[me][c.idx] !== c.key) { app.caddie = null; return; } // la mano ha cambiado
    card.classList.add('caddiePick');
    previewPlan(c.plan.actions);
    return;
  }
  // con la carta elegida: señala la siguiente casilla del plan
  const next = c.plan.actions.find((a, i) => i > 0 && (a[0] === 'cell' || a[0] === 'cellRot') && g.selectableAt(a[1], a[2]));
  if (next) {
    document.querySelector(`#board .cell[data-x="${next[1]}"][data-y="${next[2]}"]`)?.classList.add('caddieCell');
    previewCell(next[1], next[2]);
  }
}
export const clearCaddie = () => { app.caddie = null; };

/* ---------- deshacer ---------- */
// en Lo básico y en partidas fáciles (una persona), tus jugadas del turno en curso
export function undoAllowed() {
  const g = app.game, S = g?.S;
  if (!S || !app.undo?.count || g.pending || app.animating || app.paused || (S.winner !== null && !S.jaque)) return false;
  if (app.mode === 'test' && app.variant === 'lab') return false; // (el laboratorio tiene su propio deshacer)
  if (app.mode === 'story') return !app.variant;
  return app.mode === 'pve' && !app.variant && S.aiLevel === 'easy' && !multiHuman(); // no en el reto diario ni en desafíos
}
export function undoLast() {
  if (!undoAllowed()) return;
  app.undo.count--;
  stats.undos = (stats.undos || 0) + 1;
  ctl.undoMove();
  if (!app.undo.count) app.undo = null;
}

// botones del dock (consejo y deshacer): visibles solo cuando tienen sentido
export function paintAssist() {
  const cb = $('caddieBtn'), ub = $('undoBtn');
  if (!cb) return;
  cb.hidden = !caddieAvailable();
  ub.hidden = !undoAllowed();
}

function render() { ctl.render(); }

export function bindAssist() {
  $('caddieBtn').addEventListener('click', askCaddie);
  $('undoBtn').addEventListener('click', undoLast);
}
