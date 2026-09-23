/* =========================================================
   Motor de reglas de Chaotic Golf — puro: sin DOM, sin sonido, sin timers.

   Una partida es un objeto Game con:
     S         estado serializable (tablero, mazo, manos, turno, JAQUE, log…)
     pending   acción en curso que espera una elección (destino, pasos…)
   La interfaz y la IA llaman a sus métodos de acción (clickCard, clickCell,
   chooseAmount, endTurn…) y después recogen con takeEvents() los eventos que
   la resolución ha producido, en orden:
     { t:'move'|'teleport'|'impact'|'fall'|'appear'|'sink'|'settle', p, … }  animación
     { t:'card', p, idx, key }   se ha consumido una carta
     { t:'discard', p, cards }   descarte (antes de quitarlas de la mano)
     { t:'badCard', p, idx }     se ha pulsado una carta no jugable
     { t:'tilePlaced', x, y }    loseta colocada
     { t:'rewind' }              carta NO: el tablero se ha restaurado
     { t:'tip', key }            momento didáctico (choque / búnker / portal)
     { t:'resolved' }            una carta ha terminado de resolverse
     { t:'turnEnded' }           cambio de turno
     { t:'win' }                 victoria confirmada
     { t:'undo' }                deshacer (debug)
     { t:'notice', text }        aviso para el jugador (toast)
   ========================================================= */
import { t, joinAnd } from '../i18n/index.js';
import { CARDS } from '../content/cards/index.js';
import { isTrap, isPortal } from '../content/tiles/index.js';
import { mulberry32, randomSeed, shuffle } from './rng.js';

export const DIRS = { up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 } };
export const PLAYER_COLORS = ['#f26d6d', '#5b8def', '#f2b705', '#9b6dd6', '#2fbfa3', '#f27bb4'];
const SPAWN_NEIGHBORS = [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]];
const MAX_LOG = 200, MAX_HISTORY = 100;
// tope de choques encadenados: con portales puede formarse un bucle infinito
// (P2 · A · B · P1: A golpea a B, B sale por P2 y vuelve a golpear a A…).
// El juego original reventaba la pila en ese caso; aquí la cadena se detiene.
const MAX_CHAIN = 12;

export const clone = o => JSON.parse(JSON.stringify(o));
export const manhattan = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);
export const playerTag = i => t('player.tag', { n: i + 1 });

// estado vacío de partida; `extra` añade/sobrescribe campos
function blankState(extra) {
  return {
    cols: 0, rows: 0, par: 0, nPlayers: 0,
    hole: null,
    parCells: [], tiles: [], balls: [],
    deck: [], discard: [], hands: [],
    turn: 0, blackPlayed: 0, playedThisTurn: 0,
    winner: null, winners: [], jaque: false,
    lastSnap: null, lastCardLabel: null, lastCardKey: null, // para el NO
    log: [],
    ...extra,
  };
}

export class Game {
  // opts: { seed } para un RNG reproducible, o { rand } para inyectar uno (tests)
  constructor(S, opts = {}) {
    this.S = S;
    this.pending = null;
    this.godMode = false;
    this.godPick = null;
    this.history = [];
    this.events = [];
    this.initMarks = [];   // casillas de salida (decorativo: marcas en el tablero)
    if (opts.rand) { this.rand = opts.rand; this.seed = null; }
    else { this.seed = opts.seed ?? randomSeed(); this.rand = mulberry32(this.seed); }
  }

  /* ---------- creación de partidas ---------- */

  // disposición estándar: hoyo arriba, columna de pares y fila de pelotas detrás del Par 1
  static standard(cfg, opts, extra) {
    const courseLen = cfg.par + 2; // hoyo + pares + fila de pelotas
    const rows = Math.max(cfg.rows, courseLen);
    const cols = cfg.cols;
    const cx = Math.floor(cols / 2);
    const holeY = Math.floor((rows - courseLen) / 2);
    const g = new Game(blankState({
      cols, rows, par: cfg.par, nPlayers: cfg.players,
      hole: { x: cx, y: holeY, initX: cx, initY: holeY },
      ...extra,
    }), opts);
    const S = g.S;
    // columna de pares: Par N pegado al hoyo, Par 1 el más lejano
    for (let i = 0; i < cfg.par; i++) S.parCells.push({ x: cx, y: holeY + 1 + i, n: cfg.par - i });
    // pelotas detrás del Par 1, en fila, centradas respecto a la columna
    const ballY = holeY + cfg.par + 1;
    let startX = cx - Math.floor((cfg.players - 1) / 2);
    startX = Math.max(0, Math.min(startX, cols - cfg.players));
    for (let i = 0; i < cfg.players; i++) {
      const x = startX + i;
      S.balls.push({ player: i, x, y: ballY, spawnX: x, spawnY: ballY, holed: false });
      S.hands.push([]);
    }
    g.initMarks = g.marksFromBalls();
    g._course = { cx, startX };
    return g;
  }

  // partida libre (testing tool): cfg = { players, par, cols, rows, counts }
  static free(cfg, opts) {
    const g = Game.standard(cfg, opts);
    g.fillDeck(cfg.counts);
    for (let i = 0; i < cfg.players; i++) g.drawTo2(i);
    g.log('log.newGame', { players: cfg.players, par: cfg.par, cols: g.S.cols, rows: g.S.rows });
    return g;
  }

  // contra la máquina: asientos y colores al azar, empieza el jugador a la derecha
  // del que está bajo el par. cfg = { players, par, cols, rows, humanColor }
  static pve(cfg, opts = {}) {
    const counts = {};
    for (const [k, def] of Object.entries(CARDS)) counts[k] = def.copies;
    const g = Game.standard(cfg, opts, { human: 0, colorMap: null }); // metadatos PVE (no afectan a las reglas)
    const S = g.S, { cx, startX } = g._course;
    S.human = Math.floor(g.rand() * cfg.players);
    const rest = shuffle(PLAYER_COLORS.filter(c => c !== cfg.humanColor), g.rand);
    S.colorMap = [];
    let ri = 0;
    for (let i = 0; i < cfg.players; i++) S.colorMap[i] = i === S.human ? cfg.humanColor : rest[ri++ % rest.length];
    // personalidades de los bots: RNG aparte para no alterar el azar del juego
    const styleRand = opts.styleRand || mulberry32((g.seed ?? 1) ^ 0x9e3779b9);
    S.aiStyles = [];
    for (let i = 0; i < cfg.players; i++) S.aiStyles[i] = i === S.human ? null : (styleRand() < .5 ? 'aggro' : 'trick');
    S.turn = (cx - startX + 1) % cfg.players;
    g.fillDeck(counts);
    for (let i = 0; i < cfg.players; i++) g.drawTo2(i);
    g.log('log.newGamePve', { h: S.human + 1, n: S.nPlayers, t: S.turn + 1 });
    return g;
  }

  // nivel (historia / creador), 1 jugador + pelotas de obstáculo opcionales
  static fromLevel(level, opts) {
    const L = clone(level);
    const g = new Game(blankState({
      cols: L.cols, rows: L.rows,
      par: L.parCells.length ? Math.max(...L.parCells.map(p => p.n)) : 0,
      nPlayers: 1,
      hole: { x: L.hole.x, y: L.hole.y, initX: L.hole.x, initY: L.hole.y },
      parCells: L.parCells, tiles: L.tiles,
      balls: [{ player: 0, x: L.ball.x, y: L.ball.y, spawnX: L.ball.x, spawnY: L.ball.y, holed: false }],
      hands: [[]],
    }), opts);
    const S = g.S;
    // pelotas de obstáculo (señuelos): no juegan turnos y si entran en el hoyo desaparecen
    if (L.extraBalls) for (const eb of L.extraBalls) {
      S.balls.push({ player: S.balls.length, x: eb.x, y: eb.y, spawnX: eb.x, spawnY: eb.y, holed: false, decoy: true });
    }
    g.initMarks = g.marksFromBalls();
    g.fillDeck(L.deckCounts);
    g.drawTo2(0);
    g.log('log.levelLoaded');
    return g;
  }

  // copia independiente para simular jugadas (IA): sin historial ni eventos.
  // lite: además descarta el log y los snapshots del historial (más rápida)
  clone({ lite = false } = {}) {
    let S;
    if (lite) {
      const { log, ...rest } = this.S;
      S = clone(rest); S.log = [];
    } else S = clone(this.S);
    const g = new Game(S, { rand: mulberry32(0) });
    g.lite = lite;
    g.initMarks = this.initMarks;
    g.godMode = this.godMode;
    if (this.pending) {
      const pd = { ...this.pending };
      if (pd.ball) pd.ball = g.S.balls.find(b => b.player === pd.ball.player);
      if (pd.targets) pd.targets = pd.targets.map(x => ({ ...x }));
      if (pd.selected) pd.selected = [...pd.selected];
      g.pending = pd;
    }
    return g;
  }

  marksFromBalls() { return this.S.balls.map(b => ({ x: b.x, y: b.y, player: b.player })); }

  /* ---------- eventos / log ---------- */
  emit(ev) { this.events.push(ev); }
  anim(ev) { this.events.push(ev); }
  takeEvents() { const e = this.events; this.events = []; return e; }
  log(key, params) {
    if (this.lite) return; // simulaciones de la IA: sin log
    const S = this.S;
    S.log.unshift(t(key, params));
    if (S.log.length > MAX_LOG) S.log.pop();
  }
  notice(key, params) { this.emit({ t: 'notice', text: t(key, params) }); }
  tip(key) { this.emit({ t: 'tip', key }); }
  pushHistory() {
    if (this.lite) return;
    this.history.push(clone(this.S));
    if (this.history.length > MAX_HISTORY) this.history.shift();
  }
  setPending(pd) { this.pending = pd; }

  /* ---------- consultas ---------- */
  inBoard(x, y) { const S = this.S; return x >= 0 && x < S.cols && y >= 0 && y < S.rows; }
  ballAt(x, y) { return this.S.balls.find(b => !b.holed && b.x === x && b.y === y); }
  tileAt(x, y) { return this.S.tiles.find(t => t.x === x && t.y === y); }
  parAt(x, y) { return this.S.parCells.find(p => p.x === x && p.y === y); }
  isHole(x, y) { const h = this.S.hole; return h.x === x && h.y === y; }
  // las casillas PAR son solo una referencia impresa: no bloquean colocación
  cellFree(x, y) { return this.inBoard(x, y) && !this.ballAt(x, y) && !this.tileAt(x, y) && !this.isHole(x, y); }
  trapAt(x, y) { return isTrap(this.tileAt(x, y)); }
  inTrap(ball) { return this.trapAt(ball.x, ball.y); }
  holeInTrap() { return this.trapAt(this.S.hole.x, this.S.hole.y); }
  // distancia efectiva de una carta de hoyo (la trampa resta 1)
  holeMoveDist(def) { return def.dist - (this.holeInTrap() ? 1 : 0); }
  holeDist(x, y) { return manhattan(x, y, this.S.hole.x, this.S.hole.y); }
  ownBall(p) { return this.S.balls.find(b => b.player === p); }

  /* ---------- mazo ---------- */
  fillDeck(counts) {
    const S = this.S;
    for (const [k, n] of Object.entries(counts)) { if (CARDS[k]) for (let i = 0; i < n; i++) S.deck.push(k); }
    shuffle(S.deck, this.rand);
  }
  drawOne(p) {
    const S = this.S;
    if (S.deck.length === 0) {
      if (S.discard.length === 0) { this.log('log.noCardsLeft'); return false; }
      S.deck = S.discard; S.discard = [];
      shuffle(S.deck, this.rand);
      this.log('log.reshuffle');
    }
    S.hands[p].push(S.deck.pop());
    return true;
  }
  drawTo2(p) { while (this.S.hands[p].length < 2) { if (!this.drawOne(p)) break; } }

  /* ---------- movimiento ---------- */

  // avanza por portales encadenados desde (nx,ny) (los portales no cuentan como casilla);
  // onCross(nx, ny, other) se llama en cada salto. Devuelve la casilla resultante.
  crossPortals(nx, ny, dx, dy, onCross) {
    let guard = 0, here;
    while (this.inBoard(nx, ny) && isPortal(here = this.tileAt(nx, ny)) && guard++ < 10) {
      const other = this.S.tiles.find(t => isPortal(t) && t !== here);
      if (other) {
        onCross(nx, ny, other);
        nx = other.x + dx; ny = other.y + dy;
      } else { nx += dx; ny += dy; }
    }
    return [nx, ny];
  }

  // mueve una pelota en línea recta; aplica portales, trampas, colisiones en cadena, caídas y hoyo
  moveBallRaw(ball, dirKey, steps) {
    const { dx, dy } = DIRS[dirKey];
    const pid = 'b' + ball.player, b = playerTag(ball.player);
    const startX = ball.x, startY = ball.y;
    let cx = ball.x, cy = ball.y;
    let remaining = steps;
    while (remaining > 0) {
      const [nx, ny] = this.crossPortals(cx + dx, cy + dy, dx, dy, (px, py, other) => {
        this.log('log.ballPortal', { b });
        this.tip('portal');
        this.anim({ t: 'move', p: pid, x: px, y: py });
        this.anim({ t: 'teleport', p: pid, x: other.x, y: other.y });
      });
      if (!this.inBoard(nx, ny)) {
        this.anim({ t: 'fall', p: pid, x: nx, y: ny });
        this.resetBallToSpawn(ball);
        this.anim({ t: 'appear', p: pid, x: ball.x, y: ball.y });
        this.log('log.ballFell', { b, x: ball.x, y: ball.y });
        this.finishMoveChecks(ball); // si el hoyo ocupa su posición inicial, la pelota entra (JAQUE)
        return;
      }
      const hit = this.ballAt(nx, ny);
      if (hit && hit !== ball) {
        ball.x = cx; ball.y = cy;
        this.anim({ t: 'impact', p: pid, dir: dirKey, target: 'b' + hit.player });
        this.log('log.collision', { a: b, b: playerTag(hit.player), n: remaining });
        this.tip('hit');
        this.moveBallTransfer(hit, dirKey, remaining);
        return;
      }
      cx = nx; cy = ny; remaining--;
      this.anim({ t: 'move', p: pid, x: cx, y: cy });
      if (this.trapAt(cx, cy) && remaining > 0) {
        this.log('log.ballTrapped', { b, n: remaining });
        this.tip('bunker');
        remaining = 0;
      }
    }
    ball.x = cx; ball.y = cy;
    this.log('log.ballMoved', { b, x0: startX, y0: startY, x1: cx, y1: cy });
    this.finishMoveChecks(ball);
  }

  // registra una victoria; si ya había JAQUE en curso, se suma al empate
  registerWin(pl) {
    const S = this.S;
    const wb = S.balls.find(b => b.player === pl);
    if (wb && wb.decoy) { // pelota de obstáculo: no gana; se queda en el hoyo y desaparece para siempre
      this.log('log.decoyGone', { b: playerTag(wb.player) });
      return;
    }
    if (S.winner === null) {
      S.winner = pl; S.winners = [pl];
    } else if (!S.winners.includes(pl)) {
      S.winners.push(pl);
      this.log('log.tieInPlay', { list: joinAnd(S.winners.map(playerTag)) });
    }
  }

  // comprobaciones al terminar un movimiento (trampa informativa + hoyo exacto)
  finishMoveChecks(ball) {
    const pid = 'b' + ball.player;
    if (this.inTrap(ball)) {
      this.log('log.ballStaysTrap', { b: playerTag(ball.player) });
      this.tip('bunker');
      this.anim({ t: 'settle', p: pid });
    }
    if (this.isHole(ball.x, ball.y)) {
      ball.holed = true;
      this.log('log.ballHoled', { b: playerTag(ball.player) });
      this.anim({ t: 'sink', p: pid });
      this.registerWin(ball.player);
    }
  }

  // movimiento transferido por colisión: también sufre la penalización de trampa
  moveBallTransfer(ball, dirKey, steps) {
    if ((this._chain || 0) >= MAX_CHAIN) { this.log('log.chainStops'); return; }
    this._chain = (this._chain || 0) + 1;
    try { this._moveBallTransfer(ball, dirKey, steps); } finally { this._chain--; }
  }
  _moveBallTransfer(ball, dirKey, steps) {
    let s = steps;
    if (this.inTrap(ball)) {
      s -= 1;
      this.log('log.transferTrap', { b: playerTag(ball.player) });
      if (s <= 0) { this.log('log.cantLeaveTrap', { b: playerTag(ball.player) }); return; }
    }
    this.moveBallRaw(ball, dirKey, s);
  }

  resetBallToSpawn(ball) {
    const x = ball.spawnX, y = ball.spawnY;
    const occ = this.ballAt(x, y);
    if (!occ || occ === ball) { ball.x = x; ball.y = y; return; }
    // spawn ocupado: primero una casilla vacía adyacente
    for (const [dx, dy] of SPAWN_NEIGHBORS) {
      if (this.cellFree(x + dx, y + dy)) { ball.x = x + dx; ball.y = y + dy; return; }
    }
    // si no hay adyacente libre: la casilla libre más cercana en la misma fila
    for (let d = 1; d < this.S.cols; d++) {
      if (this.cellFree(x - d, y)) { ball.x = x - d; ball.y = y; return; }
      if (this.cellFree(x + d, y)) { ball.x = x + d; ball.y = y; return; }
    }
    ball.x = x; ball.y = y; // último recurso
  }

  // el hoyo se mueve con la misma lógica que una pelota: portales, trampas y caída del tablero;
  // si termina sobre una pelota, se la traga y ese jugador gana
  moveHole(dirKey, dist) {
    const S = this.S;
    const { dx, dy } = DIRS[dirKey];
    let cx = S.hole.x, cy = S.hole.y;
    let remaining = dist;
    while (remaining > 0) {
      const [nx, ny] = this.crossPortals(cx + dx, cy + dy, dx, dy, (px, py, other) => {
        this.log('log.holePortal');
        this.anim({ t: 'move', p: 'hole', x: px, y: py });
        this.anim({ t: 'teleport', p: 'hole', x: other.x, y: other.y });
      });
      if (!this.inBoard(nx, ny)) {
        this.anim({ t: 'fall', p: 'hole', x: nx, y: ny });
        let hx = S.hole.initX, hy = S.hole.initY;
        this.log('log.holeFell', { x: hx, y: hy });
        this.anim({ t: 'appear', p: 'hole', x: hx, y: hy });
        // regla: si en la casilla inicial del hoyo hay ahora un portal, el hoyo lo
        // atraviesa siguiendo la dirección de la caída (encadenando portales)
        if (isPortal(this.tileAt(hx, hy))) {
          let guard2 = 0;
          while (isPortal(this.tileAt(hx, hy)) && guard2++ < 10) {
            const here = this.tileAt(hx, hy);
            const other = S.tiles.find(t => isPortal(t) && t !== here);
            if (!other) break;
            this.log('log.holeInitPortal');
            this.anim({ t: 'teleport', p: 'hole', x: other.x, y: other.y });
            const ex = other.x + dx, ey = other.y + dy;
            if (this.inBoard(ex, ey)) { hx = ex; hy = ey; }
            else { hx = other.x; hy = other.y; break; } // no puede volver a caerse: se queda en el portal
          }
          this.anim({ t: 'appear', p: 'hole', x: hx, y: hy });
          this.log('log.holeEmerges', { x: hx, y: hy });
        }
        this.holeLandAt(hx, hy);
        return;
      }
      cx = nx; cy = ny; remaining--;
      this.anim({ t: 'move', p: 'hole', x: cx, y: cy });
      if (this.trapAt(cx, cy) && remaining > 0) {
        this.log('log.holeTrapped', { n: remaining });
        remaining = 0;
      }
    }
    this.log('log.holeMoved', { x0: S.hole.x, y0: S.hole.y, x1: cx, y1: cy });
    this.holeLandAt(cx, cy);
  }

  // el hoyo se asienta en (x,y): "plof" si es trampa y, si una pelota ocupa la casilla, se la traga (JAQUE)
  holeLandAt(x, y) {
    const S = this.S;
    S.hole.x = x; S.hole.y = y;
    if (this.trapAt(x, y)) this.anim({ t: 'settle', p: 'hole' });
    const b = this.ballAt(x, y);
    if (b) {
      b.holed = true;
      this.log('log.holeSwallows', { b: playerTag(b.player) });
      this.anim({ t: 'sink', p: 'b' + b.player });
      this.registerWin(b.player);
    }
  }

  // al mover el hoyo durante un JAQUE, las pelotas que estaban dentro se quedan
  // en la casilla que ocupaba el hoyo (la primera en la casilla exacta, el resto
  // en la libre más cercana) y la victoria queda anulada
  popHoledBalls() {
    const S = this.S;
    const hx = S.hole.x, hy = S.hole.y;
    for (const pl of S.winners) {
      const b = S.balls.find(bb => bb.player === pl);
      if (!b || !b.holed) continue;
      b.holed = false;
      let px = hx, py = hy;
      const occ = this.ballAt(px, py);
      if (occ && occ !== b) {
        outer:
        for (let d = 1; d < Math.max(S.cols, S.rows); d++) {
          for (let ox = -d; ox <= d; ox++) for (let oy = -d; oy <= d; oy++) {
            if (Math.max(Math.abs(ox), Math.abs(oy)) !== d) continue;
            const nx = hx + ox, ny = hy + oy;
            const o2 = this.ballAt(nx, ny);
            if (this.inBoard(nx, ny) && (!o2 || o2 === b) && !this.tileAt(nx, ny)) { px = nx; py = ny; break outer; }
          }
        }
      }
      b.x = px; b.y = py;
      this.anim({ t: 'appear', p: 'b' + b.player, x: px, y: py });
      this.log('log.ballLeavesHole', { b: playerTag(b.player), x: px, y: py });
    }
    S.winner = null; S.winners = []; S.jaque = false;
    this.log('log.jaqueCancelled');
  }

  /* ---------- cartas ---------- */

  canPlay(p, cardKey) {
    if (this.pending || this.godMode) return false;
    const S = this.S, def = CARDS[cardKey];
    if (!def) return false;
    // durante el JAQUE solo se puede reaccionar con cartas naranjas
    if (S.winner !== null && (!S.jaque || def.color !== 'orange')) return false;
    if (def.color === 'black' && (p !== S.turn || S.blackPlayed >= 2)) return false;
    if (def.canPlay && !def.canPlay(this, p)) return false;
    return true;
  }

  // consume la carta: historial, snapshot para el NO, descarte y log
  consumeCard(p, idx) {
    const S = this.S;
    const cardKey = S.hands[p][idx];
    this.emit({ t: 'card', p, idx, key: cardKey });
    this.pushHistory();
    if (p === S.turn) S.playedThisTurn++; // regla: si juegas cartas, no puedes descartar este turno
    const def = CARDS[cardKey];
    const snap = this.boardSnap();
    S.hands[p].splice(idx, 1);
    if (!def.staysOnBoard) S.discard.push(cardKey);
    if (def.color === 'black') S.blackPlayed++;
    this.log('log.plays', { p: playerTag(p), card: def.name });
    if (cardKey !== 'no') { S.lastSnap = snap; S.lastCardLabel = def.name; S.lastCardKey = cardKey; }
    return cardKey;
  }

  afterPlay() {
    const S = this.S;
    // regla general: si al resolver una carta una pelota y el hoyo comparten casilla,
    // sea cual sea el motivo, la pelota entra y hace JAQUE
    for (const b of S.balls) {
      if (!b.holed && this.isHole(b.x, b.y)) {
        b.holed = true;
        this.log('log.ballHoled', { b: playerTag(b.player) });
        this.anim({ t: 'sink', p: 'b' + b.player });
        this.registerWin(b.player);
      }
    }
    // una jugada ganadora no gana aún: se declara JAQUE y se abre la ventana de reacción naranja
    if (S.winner !== null && !S.jaque) {
      S.jaque = true;
      this.log('log.jaque', { n: S.winner + 1 });
    }
    this.emit({ t: 'resolved' });
  }

  confirmWin() {
    const S = this.S;
    if (S.winner === null) return false;
    S.jaque = false;
    this.emit({ t: 'win' });
    return true;
  }

  // casillas de destino nominales para un movimiento recto de n pasos; las que caen
  // fuera del tablero se marcan sobre la última casilla dentro (out: la pelota caería fuera)
  straightTargets(ball, n) {
    const targets = [];
    for (const [dirKey, d] of Object.entries(DIRS)) {
      const tx = ball.x + d.dx * n, ty = ball.y + d.dy * n;
      if (this.inBoard(tx, ty)) {
        targets.push({ x: tx, y: ty, dir: dirKey, out: false });
      } else {
        let lx = ball.x, ly = ball.y;
        while (this.inBoard(lx + d.dx, ly + d.dy)) { lx += d.dx; ly += d.dy; }
        if (!targets.some(t => t.x === lx && t.y === ly)) targets.push({ x: lx, y: ly, dir: dirKey, out: true });
      }
    }
    return targets;
  }

  serpentTargets() {
    const b = this.pending.ball;
    const targets = [];
    for (const [dirKey, d] of Object.entries(DIRS)) {
      const tx = b.x + d.dx, ty = b.y + d.dy;
      if (this.inBoard(tx, ty)) targets.push({ x: tx, y: ty, dir: dirKey, out: false });
    }
    return targets;
  }

  // pulsar una carta de la mano (o seleccionarla para descartar)
  clickCard(p, idx) {
    const pd = this.pending;
    if (pd?.kind === 'discard') {
      if (p !== pd.p) return false;
      const i = pd.selected.indexOf(idx);
      if (i >= 0) pd.selected.splice(i, 1);
      else if (pd.selected.length < 2) pd.selected.push(idx);
      return true;
    }
    const cardKey = this.S.hands[p][idx];
    if (!this.canPlay(p, cardKey)) { this.emit({ t: 'badCard', p, idx }); return false; }
    CARDS[cardKey].play(this, p, idx);
    return true;
  }

  // pulsar una casilla del tablero (elegir pelota / destino / casilla)
  clickCell(x, y) {
    if (this.godMode) return this.godClick(x, y);
    if (!this.pending) return false;
    const S = this.S, pd = this.pending;

    if (pd.kind === 'pickBall') { // solo el palo 1 reactivo elige pelota (propia o rival)
      // durante el JAQUE se puede clicar el hoyo para sacar la pelota que hay dentro
      if (S.jaque && this.isHole(x, y) && !this.trapAt(x, y)) {
        const holed = S.balls.filter(b => b.holed);
        if (!holed.length) return false;
        if (holed.length === 1) {
          this.pending = { kind: 'move', p: pd.p, idx: pd.idx, n: 1, ball: holed[0], extract: true, targets: this.straightTargets(holed[0], 1) };
        } else {
          this.pending = { kind: 'pickHoled', p: pd.p, idx: pd.idx }; // empate: elegir cuál sacar
        }
        return true;
      }
      const b = this.ballAt(x, y);
      if (!b || this.inTrap(b)) return false; // un palo de 1 no saca de la trampa
      this.pending = { kind: 'move', p: pd.p, idx: pd.idx, n: 1, ball: b, targets: this.straightTargets(b, 1) };
      return true;
    }
    if (pd.kind === 'move') {
      const tg = pd.targets.find(t => t.x === x && t.y === y);
      if (!tg) return false;
      this.pending = null;
      this.consumeCard(pd.p, pd.idx);
      if (pd.extract) {
        // sacar la pelota del hoyo: se anula su victoria y se golpea desde la casilla del hoyo
        const b = pd.ball;
        b.holed = false;
        S.winners = S.winners.filter(w => w !== b.player);
        if (S.winners.length === 0) { S.winner = null; S.jaque = false; }
        else S.winner = S.winners[0];
        this.anim({ t: 'appear', p: 'b' + b.player, x: b.x, y: b.y });
        this.log('log.ballExtracted', { b: playerTag(b.player) });
      }
      let steps = pd.n;
      if (!pd.extract && this.inTrap(pd.ball)) {
        steps -= 1;
        this.log('log.ballLeavesTrap', { b: playerTag(pd.ball.player), n: steps });
      }
      this.moveBallRaw(pd.ball, tg.dir, steps);
      // si una colisión la deja sobre la casilla del hoyo, vuelve a caer dentro
      if (pd.extract && !pd.ball.holed && this.isHole(pd.ball.x, pd.ball.y)) this.finishMoveChecks(pd.ball);
      this.afterPlay();
      return true;
    }
    if (pd.kind === 'serpent') {
      const tg = this.serpentTargets().find(t => t.x === x && t.y === y);
      if (!tg) return false;
      this.serpentStep(tg.dir);
      return true;
    }
    if (pd.kind === 'placeTile') {
      if (!this.cellFree(x, y)) return false;
      const type = pd.tileType;
      this.pending = null;
      this.consumeCard(pd.p, pd.idx);
      S.tiles.push({ type, x, y });
      this.emit({ t: 'tilePlaced', x, y });
      this.log('log.tilePlaced', { tile: t(`tiles.${type}.name`), x, y });
      this.afterPlay();
      return true;
    }
    return false;
  }

  /* ---- dedo: elegir cantidad y serpentear paso a paso ---- */
  chooseAmount(amount) {
    const pd = this.pending;
    if (pd?.kind !== 'dedoAmount') return false;
    let steps = amount;
    if (this.inTrap(pd.ball)) {
      steps -= 1;
      this.log('log.ballLeavesTrap', { b: playerTag(pd.ball.player), n: steps });
    }
    this.consumeCard(pd.p, pd.idx);
    if (steps <= 0) { // un dedo de 1 no basta para salir de la trampa: la carta se pierde sin movimiento
      this.log('log.cantLeaveTrap', { b: playerTag(pd.ball.player) });
      this.pending = null;
      this.afterPlay();
      return true;
    }
    this.pending = { kind: 'serpent', ball: pd.ball, stepsLeft: steps, startX: pd.ball.x, startY: pd.ball.y };
    return true;
  }

  // un paso del dedo, con todas las reglas (portal, trampa, colisión, caída, hoyo exacto)
  serpentStep(dirKey) {
    const pd = this.pending;
    if (!pd || pd.kind !== 'serpent') return false;
    if (pd.stepsLeft <= 0) return this.endSerpent(); // blindaje: jamás contar en negativo
    const ball = pd.ball;
    const pid = 'b' + ball.player, b = playerTag(ball.player);
    const { dx, dy } = DIRS[dirKey];
    const [nx, ny] = this.crossPortals(ball.x + dx, ball.y + dy, dx, dy, (px, py, other) => {
      this.log('log.ballPortal', { b });
      this.anim({ t: 'move', p: pid, x: px, y: py });
      this.anim({ t: 'teleport', p: pid, x: other.x, y: other.y });
    });
    if (!this.inBoard(nx, ny)) {
      this.anim({ t: 'fall', p: pid, x: nx, y: ny });
      this.resetBallToSpawn(ball);
      this.anim({ t: 'appear', p: pid, x: ball.x, y: ball.y });
      this.log('log.ballFell', { b, x: ball.x, y: ball.y });
      return this.endSerpent();
    }
    const hit = this.ballAt(nx, ny);
    if (hit && hit !== ball) {
      // regla: el choque consume solo 1 paso; el impactado recibe ese paso
      // y el jugador conserva los movimientos restantes del dedo
      this.anim({ t: 'impact', p: pid, dir: dirKey, target: 'b' + hit.player });
      pd.stepsLeft--;
      this.log('log.collisionDedo', { a: b, b: playerTag(hit.player), n: pd.stepsLeft });
      this.tip('hit');
      this.moveBallTransfer(hit, dirKey, 1);
      if (pd.stepsLeft === 0) return this.endSerpent();
      return true;
    }
    ball.x = nx; ball.y = ny;
    this.anim({ t: 'move', p: pid, x: nx, y: ny });
    pd.stepsLeft--;
    if (this.trapAt(nx, ny) && pd.stepsLeft > 0) {
      this.log('log.ballTrapped', { b, n: pd.stepsLeft });
      return this.endSerpent();
    }
    if (this.isHole(nx, ny)) return this.endSerpent(); // caer en el hoyo termina el dedo y evalúa la victoria/JAQUE
    if (pd.stepsLeft === 0) return this.endSerpent();
    return true;
  }

  endSerpent() {
    const pd = this.pending;
    this.log('log.ballMoved', { b: playerTag(pd.ball.player), x0: pd.startX, y0: pd.startY, x1: pd.ball.x, y1: pd.ball.y });
    this.finishMoveChecks(pd.ball);
    this.pending = null;
    this.afterPlay();
    return true;
  }

  // en el JAQUE con empate: elegir qué pelota sacar del hoyo con el palo reactivo
  pickHoled(pl) {
    const pd = this.pending;
    if (!pd || pd.kind !== 'pickHoled') return false;
    const b = this.S.balls.find(bb => bb.player === pl);
    if (!b || !b.holed) return false;
    this.pending = { kind: 'move', p: pd.p, idx: pd.idx, n: 1, ball: b, extract: true, targets: this.straightTargets(b, 1) };
    return true;
  }

  cancel() {
    if (this.pending?.kind === 'serpent') return false; // la carta ya está gastada: hay que terminar el movimiento
    this.pending = null;
    return true;
  }

  boardSnap() {
    const S = this.S;
    return clone({ balls: S.balls, hole: S.hole, tiles: S.tiles, winner: S.winner, winners: S.winners });
  }
  restoreBoardSnap(snap) {
    const S = this.S;
    S.balls = clone(snap.balls); S.hole = clone(snap.hole);
    S.tiles = clone(snap.tiles); S.winner = snap.winner;
    S.winners = clone(snap.winners || []);
  }

  /* ---------- turno ---------- */
  canEndTurn() { return this.S.winner === null && !this.pending && !this.godMode; }

  endTurn() {
    if (!this.canEndTurn()) return false;
    this.pushHistory();
    this.log('log.endTurn', { p: playerTag(this.S.turn) });
    this.finishTurn();
    return true;
  }

  startDiscard() {
    const S = this.S;
    if (!this.canEndTurn()) return false;
    if (S.playedThisTurn > 0) { this.notice('notice.cantDiscard'); return false; }
    this.pending = { kind: 'discard', p: S.turn, selected: [] };
    return true;
  }

  confirmDiscard() {
    const S = this.S, pd = this.pending;
    if (!pd || pd.kind !== 'discard' || !pd.selected.length) return false;
    this.emit({ t: 'discard', p: pd.p, cards: pd.selected.map(i => ({ idx: i, key: S.hands[pd.p][i] })) });
    this.pushHistory();
    const names = pd.selected.map(i => CARDS[S.hands[pd.p][i]].name);
    [...pd.selected].sort((a, b) => b - a).forEach(i => {
      S.discard.push(S.hands[pd.p][i]);
      S.hands[pd.p].splice(i, 1);
    });
    this.log('log.discards', { p: playerTag(pd.p), cards: names.map(n => `[${n}]`).join(' ') });
    this.pending = null;
    this.finishTurn();
    return true;
  }

  finishTurn() {
    const S = this.S;
    this.drawTo2(S.turn);
    S.turn = (S.turn + 1) % S.nPlayers;
    S.blackPlayed = 0;
    S.playedThisTurn = 0;
    this.log('log.turnOf', { p: playerTag(S.turn) });
    this.emit({ t: 'turnEnded' });
  }

  // null | 'sel' | 'out' según si la casilla es clicable en la acción en curso
  selectableAt(x, y) {
    if (this.godMode) {
      if (this.godPick) return 'sel';
      return (this.ballAt(x, y) || this.tileAt(x, y) || this.isHole(x, y)) ? 'sel' : null;
    }
    const pd = this.pending;
    if (!pd) return null;
    if (pd.kind === 'pickBall') {
      if (this.S.jaque && this.isHole(x, y) && !this.trapAt(x, y) && this.S.balls.some(b => b.holed)) return 'sel';
      const b = this.ballAt(x, y);
      if (!b) return null;
      if (pd.card === 'oPalo1' && this.inTrap(b)) return null;
      return 'sel';
    }
    if (pd.kind === 'move') {
      const tg = pd.targets.find(t => t.x === x && t.y === y);
      return tg ? (tg.out ? 'out' : 'sel') : null;
    }
    if (pd.kind === 'serpent') return this.serpentTargets().some(t => t.x === x && t.y === y) ? 'sel' : null;
    if (pd.kind === 'placeTile') return this.cellFree(x, y) ? 'sel' : null;
    return null;
  }

  /* ---------- herramientas de debug ---------- */
  toggleGod() { this.godMode = !this.godMode; this.godPick = null; }

  godClick(x, y) {
    const S = this.S;
    if (!this.godPick) {
      const b = this.ballAt(x, y), tl = this.tileAt(x, y);
      if (b) this.godPick = { kind: t('god.ball'), what: 'ball', ref: b };
      else if (this.isHole(x, y)) this.godPick = { kind: t('god.hole'), what: 'hole' };
      else if (tl) this.godPick = { kind: tl.type, what: 'tile', ref: tl };
      else return false;
      return true;
    }
    this.pushHistory();
    const gp = this.godPick;
    if (gp.what === 'ball') {
      const b = S.balls.find(bb => bb.player === gp.ref.player);
      b.x = x; b.y = y; b.holed = false;
    } else if (gp.what === 'hole') { S.hole.x = x; S.hole.y = y; }
    else {
      const tl = S.tiles.find(tt => tt.x === gp.ref.x && tt.y === gp.ref.y && tt.type === gp.ref.type);
      if (tl) { tl.x = x; tl.y = y; }
    }
    this.log('log.godMoved', { kind: gp.kind, x, y });
    this.godPick = null;
    return true;
  }

  undo() {
    if (!this.history.length) return false;
    this.S = this.history.pop();
    this.pending = null;
    this.emit({ t: 'undo' });
    this.log('log.undo');
    return true;
  }
  giveCard(p, key) {
    this.pushHistory();
    this.S.hands[p].push(key);
    this.log('log.give', { p: playerTag(p), card: CARDS[key].name });
  }
  debugDraw() { this.pushHistory(); this.drawOne(this.S.turn); }
  skipTurn() {
    const S = this.S;
    if (this.pending) return false;
    this.pushHistory();
    S.turn = (S.turn + 1) % S.nPlayers; S.blackPlayed = 0;
    this.log('log.skip', { p: playerTag(S.turn) });
    return true;
  }
}
