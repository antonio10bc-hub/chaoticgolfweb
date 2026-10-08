/* =========================================================
   Baraja del Gambling (el casino).
     suelo      ajedrezado, rojo y negro (rojo si x + y es par). Una casilla es dorada (S.gamble.gold): no es de ningún color.
     monedas    al empezar, 3 por jugador en casillas vacías al azar (S.gamble.coins). La pelota (o el hoyo) que pasa por
                encima (o se para en ella) se la lleva y, al terminar la jugada, la lanza: cara, vuelve a elegir como si
                jugara otra vez la carta, sin gastar ninguna (acción pendiente `bonus`); cruz, vuelve a su salida (el hoyo,
                a su casilla inicial), como si se cayera del tablero. Una tirada por moneda, y la moneda se va a otra casilla
                vacía al azar. La pelota que acaba en el hoyo (o el hoyo que se traga una) ya no la lanza.
     dado       (loseta negra, un cubo como el bloque de madera) lo que choca contra él rebota tantas casillas como marque
                (en vez de las que le quedaban) y el dado rueda una casilla hacia el otro lado, como un dado de verdad:
                muestra otra cara. Si no puede rodar (borde, otra pieza, una pelota, el hoyo, una moneda o la casilla
                dorada), da la vuelta en su sitio. Al acabar cada turno, cada dado cambia de número al azar. Cada dado guarda
                su orientación: t (arriba), n (norte), e (este).
     ruleta     (naranja) gira la ruleta: 4 franjas rojas, 4 negras y 1 dorada. Rojo o negro: las pelotas que están en
                casillas de ese color vuelven a su salida (las que están dentro del hoyo, no). Dorado: la pelota que está
                en la casilla dorada gana la partida directamente, sin JAQUE (S.goldWin); si es el hoyo el que está en
                ella, gana el hoyo y pierde todo el mundo (S.holeWin).
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
  // lo que está haciendo cada pelota (moveBallRaw lo apunta al empezar) y el hoyo (moveHole): lo que vuelve a elegir con cara
  noteMove(ball, mv) { (this._mv ||= new Map()).set(ball, mv); },
  // una pelota o un hoyo pasa (o se para) en (x,y): si hay moneda, se la lleva; se lanza al terminar la jugada
  takeCoin(pc, x, y, mv = null) {
    const G = this.S.gamble;
    if (!G?.coins.length || pc.decoy || pc.holed) return;
    const i = G.coins.findIndex(c => c.x === x && c.y === y);
    if (i < 0) return;
    G.coins.splice(i, 1);
    const hole = this.isHoleObj(pc), who = this._actor ?? this.S.turn;
    this.anim({ t: 'coinPick', p: hole ? this.holeId(pc) : 'b' + pc.player, x, y });
    this.log(hole ? 'log.holeCoinPick' : 'log.coinPick', { b: hole ? '' : playerTag(pc.player) });
    this.tip('coin');
    (this.S.coinQ ||= []).push(hole ? { hole: this.holeId(pc), by: who, mv: mv || this._mv?.get(pc) || null, x, y }
      : { p: pc.player, mv: mv || this._mv?.get(pc) || null, x, y });
  },
  holeId(h) { return h === this.S.hole ? 'hole' : h.id; },
  // al terminar la jugada (afterPlay): cada moneda, una tirada, y la moneda se va a otra casilla vacía al azar.
  // Cruz: a su salida (el hoyo, a su casilla inicial). Cara: se vuelve a elegir, como si se jugara otra vez la carta (una
  // acción pendiente `bonus`: la decide el dueño de la pelota; la del hoyo, quien lo movió). Con una cara pendiente, las
  // monedas que quedan esperan a que se juegue
  resolveCoins() {
    const S = this.S, q = S.coinQ;
    for (let k = 0; q?.length && k < MAX_FLIPS && !this.pending; k++) {
      const it = q.shift();
      if (it.hole) { this.flipHole(it); continue; }
      const ball = S.balls.find(b => b.player === it.p);
      if (!ball || ball.holed) { this.dropCoin(it); continue; }
      if (this.lite) { (S.coinPend ||= []).push(it.p); continue; } // (la IA: sin tirar; valora el riesgo)
      const heads = this.rand() < .5, b = playerTag(it.p);
      this.anim({ t: 'coinFlip', p: 'b' + it.p, x: ball.x, y: ball.y, side: heads ? 'heads' : 'tails' });
      this.dropCoin(it);
      if (!heads) { this.log('log.coinTails', { b }); this.sendHome(ball, 'coin'); this.finishMoveChecks(ball, { safe: true }); continue; }
      this.log('log.coinHeads', { b });
      this.bonusFor(ball, it.mv);
    }
    if (!q?.length) delete S.coinQ;
  },
  // cara: la misma carta otra vez, sin gastar ninguna (el palo: la dirección, con las casillas de su último movimiento; el
  // iridiscente: la dirección; el dedo: cuántos pasos y el camino)
  bonusFor(ball, mv) {
    const p = ownerOf(ball.player);
    if (mv?.serp || mv?.path) { this.pending = { kind: 'dedoAmount', p, ball, bonus: true }; return; }
    if (mv?.iri) {
      const targets = Object.entries(DIRV).map(([dir, [dx, dy]]) => ({ x: ball.x + dx, y: ball.y + dy, dir, out: false })).filter(tg => this.inBoard(tg.x, tg.y));
      this.pending = { kind: 'move', p, n: 1, untilHit: true, ball, targets, bonus: true };
      return;
    }
    const n = Math.max(1, mv?.steps || 1);
    this.pending = { kind: 'move', p, n, ball, targets: this.straightTargets(ball, n), bonus: true };
  },
  // la moneda del hoyo: cruz, a su casilla inicial (la copia del hoyo, para siempre); cara, quien lo movió elige otra vez
  // hacia dónde, las mismas casillas. Si el hoyo se ha tragado una pelota en la jugada, no la lanza
  flipHole(it) {
    const S = this.S, h = it.hole === 'hole' ? S.hole : S.holeCopies?.find(c => c.id === it.hole);
    if (!h || S.balls.some(b => b.holed && !b.decoy && b.x === h.x && b.y === h.y)) { this.dropCoin(it); return; }
    if (this.lite) return;
    const heads = this.rand() < .5;
    this.anim({ t: 'coinFlip', p: it.hole, x: h.x, y: h.y, side: heads ? 'heads' : 'tails' });
    this.dropCoin(it);
    if (heads) {
      const dist = Math.max(1, it.mv?.dist || 1);
      this.log('log.holeCoinHeads');
      this.pending = { kind: 'holeMove', p: it.by, hole: it.hole, dist, targets: this.straightTargets(h, dist), bonus: true };
      return;
    }
    this.log('log.holeCoinTails');
    this.anim({ t: 'goHome', p: it.hole, x: h.x, y: h.y, why: 'coin' });
    if (h !== S.hole) { this.holeGone(h, 'coin'); return; }
    const [x, y] = this.holeSpawnWater(S.hole.initX, S.hole.initY);
    this.anim({ t: 'appear', p: 'hole', x, y });
    this.holeLandAt(x, y);
  },
  // (cara del hoyo) quien lo movió elige hacia dónde; mover el hoyo en un JAQUE lo anula, como con su carta
  holeBonusAt(x, y) {
    const pd = this.pending, tg = pd.targets.find(q => q.x === x && q.y === y);
    const h = pd.hole === 'hole' ? this.S.hole : this.S.holeCopies?.find(c => c.id === pd.hole);
    if (!tg || !h) return false;
    this.pending = null;
    this.pushHistory();
    if (this.S.jaque && this.S.winner !== null) this.popHoledBalls(this.S.holeCopies?.length ? h : null);
    this.moveHole(tg.dir, pd.dist, h);
    this.afterPlay();
    return true;
  },
  // la moneda usada se va a otra casilla vacía al azar (ni salidas, ni PAR, ni la del hoyo, ni la dorada)
  dropCoin(it) {
    const S = this.S, G = S.gamble;
    if (!G || this.lite) return;
    const home = (x, y) => (x === S.hole.initX && y === S.hole.initY) || S.balls.some(b => b.spawnX === x && b.spawnY === y);
    const free = [];
    for (let y = 0; y < S.rows; y++) for (let x = 0; x < S.cols; x++)
      if (this.cellFree(x, y) && !this.gambleBlocks(x, y) && !home(x, y) && !this.parAt(x, y) && !(x === it.x && y === it.y)) free.push({ x, y });
    if (!free.length) return;
    const c = free[Math.floor(this.rand() * free.length)];
    G.coins.push(c);
    this.anim({ t: 'coinDrop', x0: it.x, y0: it.y, x: c.x, y: c.y });
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

  // al acabar cada turno, cada dado cambia de número al azar (da una vuelta hacia un lado cualquiera)
  diceTurn() {
    for (const tl of this.S.tiles) {
      if (tl.type !== 'dice') continue;
      const dir = ['up', 'down', 'left', 'right'][Math.floor(this.rand() * 4)];
      Object.assign(tl, rollFaces(tl, dir));
      this.anim({ t: 'diceTurn', id: tl.id, x: tl.x, y: tl.y, dir, face: { t: tl.t, n: tl.n, e: tl.e } });
    }
  },

  /* ---------- la ruleta ---------- */
  spinRoulette() {
    const S = this.S, seg = this._forceSpin ?? Math.floor(this.rand() * WHEEL.length), res = WHEEL[seg];
    this.anim({ t: 'roulette', seg, res });
    this.log('log.roulette', { c: t('gamble.res.' + res) });
    this.tip('roulette');
    if (res === 'gold') {
      const g = S.gamble?.gold, b = g && this.ballAt(g.x, g.y), h = g && this.holeAt(g.x, g.y);
      if (h) { // el hoyo en la casilla dorada: gana el hoyo y pierde todo el mundo
        S.winner = -1; S.winners = []; S.jaque = false; S.goldWin = true; S.holeWin = true;
        this.anim({ t: 'goldWin', p: this.holeId(h), x: h.x, y: h.y });
        this.log('log.holeGold');
        return;
      }
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
