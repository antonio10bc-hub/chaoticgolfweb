/* =========================================================
   Baraja del Gambling (el casino).
     suelo      ajedrezado, rojo y negro (rojo si x + y es par). Una casilla es dorada (S.gamble.gold): no es de ningún color.
     monedas    al empezar, 3 por jugador en casillas vacías al azar (S.gamble.coins). La pelota que pasa por encima (o se
                para en ella) se la lleva y, al terminar la jugada, la lanza: cara, repite su último movimiento (la misma
                dirección y las mismas casillas; con el dedo, el mismo camino), desde donde está; cruz, vuelve a su salida
                (como si se cayera del tablero). Una tirada por moneda. La pelota que acaba en el hoyo ya no la lanza.
     dado       (loseta negra, un cubo como el bloque de madera) lo que choca contra él rebota tantas casillas como marque
                (en vez de las que le quedaban) y el dado rueda una casilla hacia el otro lado, como un dado de verdad:
                muestra otra cara. Si no puede rodar (borde, otra pieza, una pelota, el hoyo, una moneda o la casilla
                dorada), da la vuelta en su sitio. Cada dado guarda su orientación: t (arriba), n (norte), e (este).
     ruleta     (naranja) gira la ruleta: 4 franjas rojas, 4 negras y 1 dorada. Rojo o negro: las pelotas que están en
                casillas de ese color vuelven a su salida (las que están dentro del hoyo, no). Dorado: la pelota que está
                en la casilla dorada gana la partida directamente, sin JAQUE (S.goldWin).
   En las simulaciones de la IA (lite) las monedas no se lanzan: se apuntan en S.coinPend y la IA valora el riesgo.
   Este módulo añade sus métodos a Game (game.js los instala); `this` es la partida.
   ========================================================= */
import { t } from '../i18n/index.js';
import { mulberry32, shuffle } from './rng.js';
import { playerTag, ownerOf } from './multiverse.js';

export const COINS_PER_PLAYER = 3;
// la ruleta: el orden de sus franjas (la dorada, entre la última negra y la primera roja)
export const WHEEL = ['red', 'black', 'red', 'black', 'red', 'black', 'red', 'black', 'gold'];
const MAX_FLIPS = 16; // tiradas de moneda en una misma jugada (corta las repeticiones encadenadas)
const OUT = ['fall', 'splash', 'burn', 'eaten', 'goHome', 'vanish']; // (eventos de una pelota que sale del campo)
const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
// el dado rueda una casilla hacia `dir`: la cara que queda arriba (un dado de verdad: las opuestas suman 7)
export function rollFaces({ t, n, e }, dir) {
  if (dir === 'up') return { t: 7 - n, n: t, e };
  if (dir === 'down') return { t: n, n: 7 - t, e };
  if (dir === 'right') return { t: 7 - e, n, e: t };
  return { t: e, n, e: 7 - t };
}

export const gamblingMethods = {
  /* ---------- el campo ---------- */
  // la casilla dorada en un sitio al azar (ni pegada al hoyo ni a las salidas) y las monedas en casillas vacías. Con un
  // RNG aparte (sacado de la semilla): el mazo sale igual que sin casino
  setupGambling({ coinsPer = COINS_PER_PLAYER } = {}) {
    const S = this.S, rand = mulberry32(((this.seed ?? 1) ^ 0x6a3b1d5) >>> 0);
    const home = (x, y) => (x === S.hole.initX && y === S.hole.initY) || S.balls.some(b => b.spawnX === x && b.spawnY === y);
    const free = [];
    for (let y = 0; y < S.rows; y++) for (let x = 0; x < S.cols; x++) {
      if (home(x, y) || this.parAt(x, y) || this.tileAt(x, y) || this.isHole(x, y) || this.ballAt(x, y)) continue;
      free.push({ x, y });
    }
    // (la dorada, en el campo de juego: entre la fila del hoyo y la de las salidas, sin tocar los bordes de los lados)
    const ys = S.balls.map(b => b.spawnY), y0 = Math.min(S.hole.y, ...ys), y1 = Math.max(S.hole.y, ...ys);
    const far = c => c.x > 0 && c.x < S.cols - 1 && c.y >= y0 && c.y <= y1 && Math.abs(c.x - S.hole.x) + Math.abs(c.y - S.hole.y) >= 2 &&
      S.balls.every(b => Math.abs(c.x - b.spawnX) + Math.abs(c.y - b.spawnY) >= 3);
    const pool = free.filter(far), gold = (pool.length ? pool : free)[Math.floor(rand() * (pool.length || free.length))] || null;
    const rest = shuffle(free.filter(c => c !== gold), rand);
    S.gamble = { gold, coins: rest.slice(0, coinsPer * S.balls.filter(b => !b.decoy && !b.hunter).length) };
  },
  isGold(x, y) { const g = this.S.gamble?.gold; return !!g && g.x === x && g.y === y; },
  coinAt(x, y) { return !!this.S.gamble?.coins.some(c => c.x === x && c.y === y); },
  // el color de una casilla: 'gold', 'red' o 'black'
  cellColor(x, y) { return this.isGold(x, y) ? 'gold' : (x + y) % 2 === 0 ? 'red' : 'black'; },
  // (en el casino) ninguna pieza encima de una moneda ni de la casilla dorada
  gambleBlocks(x, y) { return !!this.S.gamble && (this.coinAt(x, y) || this.isGold(x, y)); },

  /* ---------- monedas ---------- */
  // lo que está haciendo cada pelota ahora (moveBallRaw lo apunta al empezar): lo que repetirá si le sale cara
  noteMove(ball, mv) { (this._mv ||= new Map()).set(ball, mv); },
  // la pelota pasa (o se para) en (x,y): si hay moneda, se la lleva; se lanza al terminar la jugada
  takeCoin(ball, x, y, mv = null) {
    const G = this.S.gamble;
    if (!G?.coins.length || ball.decoy || ball.holed) return;
    const i = G.coins.findIndex(c => c.x === x && c.y === y);
    if (i < 0) return;
    G.coins.splice(i, 1);
    this.anim({ t: 'coinPick', p: 'b' + ball.player, x, y });
    this.log('log.coinPick', { b: playerTag(ball.player) });
    this.tip('coin');
    (this.S.coinQ ||= []).push({ p: ball.player, mv: this._repeating || mv || this._mv?.get(ball) || null });
  },
  // al terminar la jugada (afterPlay): cada moneda, una tirada. Cara: repite su último movimiento; cruz: a su salida
  resolveCoins() {
    const S = this.S, q = S.coinQ;
    if (!q?.length) return;
    for (let k = 0; q.length && k < MAX_FLIPS; k++) {
      const { p, mv } = q.shift(), ball = S.balls.find(b => b.player === p);
      if (!ball || ball.holed) continue;
      if (this.lite) { (S.coinPend ||= []).push(p); continue; } // (la IA: sin tirar; valora el riesgo)
      const heads = this.rand() < .5, b = playerTag(p);
      this.anim({ t: 'coinFlip', p: 'b' + p, x: ball.x, y: ball.y, side: heads ? 'heads' : 'tails' });
      if (!heads) { this.log('log.coinTails', { b }); this.sendHome(ball, 'coin'); continue; }
      this.log('log.coinHeads', { b });
      if (mv) this.repeatMove(ball, mv);
    }
    delete S.coinQ;
  },
  // cara: el mismo movimiento otra vez, desde donde está (con el dedo, el mismo camino, paso a paso)
  repeatMove(ball, mv) {
    this._repeating = mv;
    try {
      if (mv.path) {
        const pid = 'b' + ball.player;
        for (const d of mv.path) {
          if (!this.S.balls.includes(ball) || ball.holed) break;
          const n0 = this.events.length;
          this.moveBallRaw(ball, d, 1);
          // (si se ha caído, ha vuelto a su salida o ha rebotado en un dado, el camino se acaba ahí)
          if (this.events.slice(n0).some(e => e.p === pid && (OUT.includes(e.t) || (e.t === 'bump' && e.dice)))) break;
        }
        return;
      }
      const steps = mv.steps - (this.inTrap(ball) ? 1 : 0);
      if (steps > 0 || mv.iri) this.moveBallRaw(ball, mv.dir, Math.max(1, steps), { untilHit: !!mv.iri });
    } finally { this._repeating = null; }
  },
  // vuelve a su salida, como si se hubiera caído (why: 'coin' cruz, 'roulette' su color en la ruleta)
  sendHome(ball, why) {
    const pid = 'b' + ball.player;
    if (ball.x === ball.spawnX && ball.y === ball.spawnY && !ball.copy) return; // (ya está en su salida)
    this.anim({ t: 'goHome', p: pid, x: ball.x, y: ball.y, why });
    this.resetBallToSpawn(ball); // (una copia del multiverso, para siempre)
    if (!this.S.balls.includes(ball)) return;
    this.anim({ t: 'appear', p: pid, x: ball.x, y: ball.y });
    this.spawnWater(ball);
  },

  /* ---------- el dado ---------- */
  // un dado nuevo: una cara al azar arriba y el resto coherente
  newDice() {
    const t = 1 + Math.floor(this.rand() * 6), side = [1, 2, 3, 4, 5, 6].filter(v => v !== t && v !== 7 - t);
    const n = side[Math.floor(this.rand() * 4)], e = side.filter(v => v !== n && v !== 7 - n)[Math.floor(this.rand() * 2)];
    this.S.diceSeq = (this.S.diceSeq || 0) + 1;
    return { id: this.S.diceSeq, t, n, e };
  },
  // lo han golpeado yendo hacia `dir`: rueda una casilla hacia allí (si puede) y cambia de cara
  rollDice(tl, dir) {
    const [dx, dy] = DIRV[dir], x0 = tl.x, y0 = tl.y, x = x0 + dx, y = y0 + dy;
    const moved = this.cellFree(x, y) && !this.gambleBlocks(x, y) && !(this.S.train && this.trackIndex(x, y) >= 0);
    Object.assign(tl, rollFaces(tl, dir));
    if (moved) { tl.x = x; tl.y = y; }
    this.anim({ t: 'diceRoll', id: tl.id, x0, y0, x: tl.x, y: tl.y, dir, face: { t: tl.t, n: tl.n, e: tl.e }, moved });
    this.log(moved ? 'log.diceRolls' : 'log.diceTumbles', { n: tl.t });
  },

  /* ---------- la ruleta ---------- */
  spinRoulette() {
    const S = this.S, seg = this._forceSpin ?? Math.floor(this.rand() * WHEEL.length), res = WHEEL[seg];
    this.anim({ t: 'roulette', seg, res });
    this.log('log.roulette', { c: t('gamble.res.' + res) });
    this.tip('roulette');
    if (res === 'gold') {
      const g = S.gamble?.gold, b = g && this.ballAt(g.x, g.y);
      if (!b || b.decoy || b.hunter) { this.log('log.goldEmpty'); return; }
      const pl = ownerOf(b.player);
      S.winner = pl; S.winners = [pl]; S.jaque = false; S.goldWin = true;
      this.anim({ t: 'goldWin', p: 'b' + b.player, x: b.x, y: b.y });
      this.log('log.goldWin', { b: playerTag(b.player) });
      return;
    }
    const hit = S.balls.filter(b => !b.holed && !b.decoy && this.cellColor(b.x, b.y) === res && (b.copy || b.x !== b.spawnX || b.y !== b.spawnY));
    if (!hit.length) { this.log('log.rouletteNone'); return; }
    for (const b of hit) { this.log('log.rouletteOut', { b: playerTag(b.player) }); this.sendHome(b, 'roulette'); }
    for (const b of hit) if (S.balls.includes(b)) this.finishMoveChecks(b, { safe: true }); // (si el hoyo está en su salida, entra)
  },
};
