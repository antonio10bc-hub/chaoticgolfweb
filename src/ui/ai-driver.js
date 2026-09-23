/* ================= PVE: orquestador de la máquina en la interfaz =================
   Las decisiones salen de src/ai/bot.js (las mismas que en las simulaciones);
   aquí solo se les da ritmo: pausas de "pensar", clic a clic, esperando a que
   terminen las animaciones, para que el jugador entienda qué hace cada bot. */
import { app } from './app.js';
import { wait } from './dom.js';
import { JUICE } from '../fx/juice.js';
import { CARDS } from '../content/cards/index.js';
import { choosePlan, discardPlan, chooseReaction, farness } from '../ai/bot.js';
import { jaqueSaver } from '../ai/autoplay.js';
import * as ctl from './controller.js';

const AI = JUICE.ai;
let timer = null;
let turnLock = false;     // un único bucle de turno de IA a la vez
let gen = 0;              // se incrementa al parar: invalida bucles en curso
let reactedSeq = -1;      // última jugada ya evaluada para reacciones
let pendSince = 0;        // watchdog de acciones pendientes huérfanas
const rand = Math.random;

const G = () => app.game;
const S = () => app.game.S;
const isBot = p => p !== S().human;
const live = g => app.mode === 'pve' && app.game && gen === g;
const idle = () => new Promise(r => { const t = () => (!app.animating && !app.animQueue.length) ? r() : setTimeout(t, 90); t(); });

export function aiStop() {
  clearTimeout(timer);
  gen++;
  turnLock = false;
  app.ai.acting = false;
  app.ai.thinkingOf = null;
}

// ejecuta una jugada (lista de acciones del bot) con ritmo humano
async function runPlan(plan, g) {
  app.ai.acting = true;
  try {
    for (let i = 0; i < plan.actions.length; i++) {
      const a = plan.actions[i];
      if (i > 0) await wait(G().pending?.kind === 'serpent' ? AI.stepMs : AI.clickMs);
      await idle();
      if (!live(g)) return;
      let ok;
      switch (a[0]) {
        case 'card': ok = ctl.clickCard(a[1], a[2]); break;
        case 'cell': ok = ctl.clickCell(a[1], a[2]); break;
        case 'amount': ok = ctl.chooseAmount(a[1]); break;
        case 'pickHoled': ok = ctl.pickHoled(a[1]); break;
      }
      if (ok === false) break;
    }
    await idle();
    if (!live(g)) return;
    // blindaje: nunca dejar una acción de la máquina a medias
    if (G().pending?.kind === 'serpent') ctl.endSerpent();
    else if (G().pending && G().pending.p !== S().human) ctl.cancel();
  } finally { app.ai.acting = false; }
}

// orquestador: se llama tras cada jugada y cada cambio de turno
export function aiKick() {
  clearTimeout(timer);
  if (app.mode !== 'pve' || !app.game) return;
  const s = S(), g = gen;
  if (s.winner !== null && !s.jaque) return; // partida terminada (durante el JAQUE sí hay que actuar)
  if (app.animating || app.animQueue.length || G().pending) {
    watchdog();
    timer = setTimeout(aiKick, 350);
    return;
  }
  pendSince = 0;
  if (s.jaque) { handleJaque(g); return; }
  // reacción naranja espontánea, evaluada una sola vez por jugada
  if (!turnLock && app.playSeq !== reactedSeq && s.lastSnap) {
    reactedSeq = app.playSeq;
    const cands = [];
    for (let p = 0; p < s.nPlayers; p++) {
      if (!isBot(p) || p === app.lastActor) continue; // el autor no se sabotea
      const r = chooseReaction(G(), p, rand);
      if (r) cands.push({ p, ...r });
    }
    cands.sort((a, b) => b.gain - a.gain || farness(G(), b.p) - farness(G(), a.p));
    const c = cands[0];
    if (c && rand() < c.chance) {
      timer = setTimeout(async () => {
        if (!live(g) || S().jaque || S().winner !== null || G().pending || turnLock) { aiKick(); return; }
        const fresh = chooseReaction(G(), c.p, rand); // el tablero puede haber cambiado
        if (fresh) await runPlan(fresh, g);
        if (live(g)) aiKick();
      }, AI.reactDelayMs + rand() * 500);
      return;
    }
  }
  if (isBot(s.turn)) timer = setTimeout(() => takeTurn(g), 240);
}

async function takeTurn(g) {
  if (!live(g) || S().winner !== null || !isBot(S().turn) || turnLock) return;
  turnLock = true;
  const p = S().turn;
  app.ai.thinkingOf = p; ctl.render(); // puntos de "pensando…" en el panel del bot
  try {
    await wait(AI.thinkMs + rand() * 400);
    for (let n = 0; n < 3; n++) {
      await idle();
      if (!live(g) || S().winner !== null || S().turn !== p || G().pending) break;
      const plan = choosePlan(G(), p, rand);
      if (!plan) break;
      await runPlan(plan, g);
      await wait(AI.betweenMs + rand() * 300);
    }
    await idle();
    if (live(g) && S().winner === null && S().turn === p && !G().pending) {
      const junk = S().playedThisTurn === 0 ? discardPlan(G(), p) : [];
      if (junk.length) {
        ctl.startDiscard();
        await wait(280);
        if (live(g) && G().pending?.kind === 'discard') {
          for (const i of junk) ctl.clickCard(p, i);
          await wait(280);
          if (live(g)) ctl.confirmDiscard();
        }
      } else {
        await wait(AI.endMs);
        if (live(g) && S().winner === null && S().turn === p && !G().pending) ctl.endTurn();
      }
    }
  } finally {
    if (gen === g) { app.ai.thinkingOf = null; turnLock = false; ctl.render(); aiKick(); }
  }
}

// JAQUE: si algún bot puede evitar la victoria, lo hace el que va peor; si no,
// se deja una ventana de reacción al humano y luego se confirma
function handleJaque(g) {
  const saver = jaqueSaver(G(), rand, isBot);
  if (saver) {
    timer = setTimeout(async () => {
      if (live(g) && S().jaque && S().winner !== null && !G().pending && !app.animating) await runPlan(saver, g);
      if (live(g)) aiKick();
    }, AI.thinkMs + rand() * 500);
    return;
  }
  const h = S().human;
  const humanCan = !S().winners.includes(h) && S().hands[h].some(k => CARDS[k].color === 'orange' && G().canPlay(h, k));
  timer = setTimeout(() => {
    if (live(g) && S().jaque && S().winner !== null && !G().pending && !app.animating && !app.animQueue.length) ctl.confirmWin();
    else if (live(g)) aiKick();
  }, humanCan ? AI.jaqueWindowMs : AI.jaqueIdleMs);
}

// watchdog anti-atascos: una acción pendiente de la máquina sin bucle que la atienda se resuelve sola
function watchdog() {
  const pd = G().pending;
  if (!pd || app.animating || app.animQueue.length || turnLock || app.ai.acting) { pendSince = 0; return; }
  const owner = pd.p !== undefined ? pd.p : (pd.kind === 'serpent' ? pd.ball.player : undefined);
  if (owner === undefined || !isBot(owner)) { pendSince = 0; return; }
  if (!pendSince) pendSince = performance.now();
  if (performance.now() - pendSince < 1800) return;
  pendSince = 0;
  app.ai.acting = true;
  if (pd.kind === 'serpent') ctl.endSerpent(); else ctl.cancel();
  app.ai.acting = false;
}

