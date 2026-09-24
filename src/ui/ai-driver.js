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
import { isBot as botSeat, humansOf } from './players.js';

const AI = JUICE.ai;
let timer = null;
let turnLock = false;     // un único bucle de turno de IA a la vez
let gen = 0;              // se incrementa al parar: invalida bucles en curso
let reactedSeq = -1;      // última jugada ya evaluada para reacciones
let pendSince = 0;        // watchdog de acciones pendientes huérfanas
const rand = Math.random;

const G = () => app.game;
const S = () => app.game.S;
const isBot = p => botSeat(p);
// la IA solo actúa en su partida (gen) y con la pantalla de partida a la vista
const live = g => app.mode === 'pve' && app.game && gen === g && app.screen === 'game';
// en pausa, la máquina se queda quieta donde esté (las esperas no avanzan)
const idle = () => new Promise(r => { const t = () => (!app.animating && !app.animQueue.length && !app.paused) ? r() : setTimeout(t, 90); t(); });
const pwait = async ms => { await wait(ms); while (app.paused) await wait(120); };

// arranque retrasado de la IA (al empezar o continuar): cancelable con aiStop
export function aiStart(delay) {
  clearTimeout(timer);
  const g = gen;
  timer = setTimeout(() => { if (gen === g) aiKick(); }, delay);
}

export function aiStop() {
  clearTimeout(timer);
  app.jaqueTimer = null;
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
      if (i > 0) await pwait(G().pending?.kind === 'serpent' ? AI.stepMs : AI.clickMs);
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
    else if (G().pending && isBot(G().pending.p)) ctl.cancel();
  } finally { app.ai.acting = false; }
}

// orquestador: se llama tras cada jugada y cada cambio de turno
export function aiKick() {
  clearTimeout(timer);
  if (app.mode !== 'pve' || !app.game || app.screen !== 'game' || app.paused) return; // (al reanudar se vuelve a llamar)
  const s = S(), g = gen;
  if (s.winner !== null && !s.jaque) return; // partida terminada (durante el JAQUE sí hay que actuar)
  if (app.animating || app.animQueue.length || G().pending) {
    watchdog();
    timer = setTimeout(aiKick, 350);
    return;
  }
  pendSince = 0;
  if (s.jaque) { handleJaque(g); return; }
  app.jaqueTimer = null;
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
        if (!live(g) || app.paused || S().jaque || S().winner !== null || G().pending || turnLock) { aiKick(); return; }
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
    await pwait(AI.thinkMs + rand() * 400);
    for (let n = 0; n < 3; n++) {
      await idle();
      if (!live(g) || S().winner !== null || S().turn !== p || G().pending) break;
      const plan = choosePlan(G(), p, rand);
      if (!plan) break;
      await runPlan(plan, g);
      await pwait(AI.betweenMs + rand() * 300);
    }
    await idle();
    if (live(g) && S().winner === null && S().turn === p && !G().pending) {
      const junk = S().playedThisTurn === 0 ? discardPlan(G(), p) : [];
      if (junk.length) {
        ctl.startDiscard();
        await pwait(280);
        if (live(g) && G().pending?.kind === 'discard') {
          for (const i of junk) ctl.clickCard(p, i);
          await pwait(280);
          if (live(g)) ctl.confirmDiscard();
        }
      } else {
        await pwait(AI.endMs);
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
  if (app.passFor != null) { timer = setTimeout(aiKick, 400); return; } // esperando a que se pase el dispositivo
  const saver = jaqueSaver(G(), rand, isBot);
  if (saver) {
    timer = setTimeout(async () => {
      if (app.paused) return; // al reanudar, aiKick() lo reevalúa
      if (live(g) && S().jaque && S().winner !== null && !G().pending && !app.animating) await runPlan(saver, g);
      if (live(g)) aiKick();
    }, AI.thinkMs + rand() * 500);
    return;
  }
  // ¿alguna persona (en multijugador local, cualquiera de ellas) puede reaccionar?
  const humanCan = humansOf().some(h => !S().winners.includes(h) && S().hands[h].some(k => CARDS[k].color === 'orange' && G().canPlay(h, k)));
  // cuenta atrás visible en el cartel del JAQUE mientras puedes reaccionar
  if (humanCan && !app.jaqueTimer) { app.jaqueTimer = { at: Date.now(), ms: AI.jaqueWindowMs }; ctl.renderJaque(); }
  timer = setTimeout(() => {
    if (app.paused) return;
    if (live(g) && S().jaque && S().winner !== null && !G().pending && !app.animating && !app.animQueue.length) ctl.confirmWin();
    else if (live(g)) aiKick();
  }, humanCan ? Math.max(400, app.jaqueTimer.at + app.jaqueTimer.ms - Date.now()) : AI.jaqueIdleMs);
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

