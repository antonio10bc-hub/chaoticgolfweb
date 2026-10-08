/* =========================================================
   Baraja de las estaciones: el campo cambia con la estación (S.season.now) y cada una tiene lo suyo.
     primavera  viento, en ciclos de tres turnos: uno en calma, uno de aviso (una ruta serpenteante de borde a borde, tenue)
                y uno en el que sopla: arrastra hasta el final de la ruta, y fuera del tablero, lo que haya dentro al empezar
                a soplar y lo que caiga en ella durante ese turno (la pelota vuelve a su salida; el hoyo, a su casilla).
                Plantas carnívoras: se comen la pelota (o el hoyo) que se queda a su lado.
     verano     incendios (carta naranja): crecen una casilla vacía por turno, hasta 5. Cruzar el fuego suma 2 al tiro;
                quedarse dentro es como caerse del tablero.
     otoño      hojas secas (6 al llegar y van cayendo más entre turnos): restan 1 al tiro y se rompen. A veces llueve:
                un charco nuevo, que resta 1 al tiro de quien pasa por encima (sin atraparlo).
     invierno   la bola de nieve: solo se mueve con su carta naranja, 5 casillas (o hasta toparse con una pieza sólida o el
                borde). Atrapa lo que pilla y se lo lleva (salir no cuesta nada). Hielo: suma 1 al tiro (también con el dedo:
                resbala una casilla más en la dirección en la que iba).
   La carta negra de estación pasa a la siguiente (primavera → verano → otoño → invierno → primavera) y lo que hay en el
   campo cambia con ella: el charco de la lluvia se hiela en invierno, el hielo se vuelve planta carnívora en primavera y la
   planta se seca en verano; las hojas se van con el invierno, el fuego se apaga en otoño, la bola se derrite en primavera.
   Las salidas y la casilla inicial del hoyo son seguras: ahí no se pone ni cae nada, y una planta no se come a quien
   vuelve a su salida.
   Este módulo añade sus métodos a Game (game.js los instala); `this` es la partida.
   ========================================================= */
import { t, joinAnd } from '../i18n/index.js';
import { TILES, isDevice } from '../content/tiles/index.js';
import { mulberry32 } from './rng.js';

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const nextSeason = s => SEASONS[(SEASONS.indexOf(s) + 1) % SEASONS.length];
export const FIRE_MAX = 5;        // casillas de un incendio
export const START_LEAVES = 6;    // hojas secas al llegar el otoño
const LEAF_CHANCE = .4, MAX_LEAVES = 14; // entre turnos (otoño): cae una hoja nueva…
const RAIN_CHANCE = .3, MAX_RAIN = 8;    // …y llueve (un charco nuevo)
const D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
export const SNOW_STEPS = 5; // casillas que rueda la bola de nieve (sola o con la carta)
export const SNOW_DIRS = Object.keys(D);

// ruta del viento de borde a borde (del lado izquierdo al derecho o de arriba abajo, o al revés): avanza siempre por su
// eje y, en cada paso, a veces serpentea de lado unas casillas (nunca pisa dos veces la misma). bad(x, y): ese extremo
// no vale (el hoyo) · keep(x, y): la ruta no pasa por ahí (las salidas: quien vuelve a la suya no se lo lleva el viento
// otra vez). Devuelve [[x, y], …] en el sentido en el que sopla, o null
export function windRoute(C, R, rand, bad = () => false, keep = () => false) {
  for (let tries = 0; tries < 60; tries++) {
    const across = rand() < .5, A = across ? C : R, B = across ? R : C; // A: eje por el que avanza · B: de lado
    if (A < 2 || B < 1) return null;
    let b = Math.floor(rand() * B);
    const cells = [];
    for (let a = 0; a < A; a++) {
      cells.push([a, b]);
      if (a === A - 1) break;
      if (rand() < .55) { // serpentea: 1-3 casillas hacia un lado (si cabe)
        const d = (b === 0 ? 1 : b === B - 1 ? -1 : rand() < .5 ? -1 : 1), n = 1 + Math.floor(rand() * 3);
        for (let k = 0; k < n && b + d >= 0 && b + d < B; k++) { b += d; cells.push([a, b]); }
      }
    }
    const path = cells.map(([a, bb]) => across ? [a, bb] : [bb, a]);
    if (rand() < .5) path.reverse();
    if (bad(...path[0]) || bad(...path[path.length - 1]) || path.some(([x, y]) => keep(x, y))) continue;
    return path;
  }
  return null;
}

// hacia dónde sale del tablero lo que llega al final de la ruta (el lado del borde en el que acaba): { x, y, dir }
export function windExitOf(path, C, R) {
  const L = path.length, [ex, ey] = path[L - 1], [px, py] = path[L - 2] || [ex, ey];
  const inB = (x, y) => x >= 0 && y >= 0 && x < C && y < R;
  const out = Object.keys(D).filter(d => !inB(ex + D[d][0], ey + D[d][1]));
  const last = Object.keys(D).find(d => D[d][0] === ex - px && D[d][1] === ey - py);
  const dir = out.includes(last) ? last : out[0] || last || 'down';
  return { x: ex + D[dir][0], y: ey + D[dir][1], dir };
}

export const seasonMethods = {
  /* ---------- montaje ---------- */
  // partida de la baraja (fresh): estación al azar y lo que trae al llegar (hojas, bola de nieve), con un RNG aparte (el
  // mazo sale igual que sin estaciones). Un nivel trae su estación y su campo (fresh = false)
  setupSeasons({ now = null, snow = null, fresh = true } = {}) {
    const rand = mulberry32(((this.seed ?? 1) ^ 0x5ea5025) >>> 0);
    const S = this.S;
    S.season = { now: now || SEASONS[Math.floor(rand() * 4)], wind: null, snow: snow ? { x: snow.x, y: snow.y, dir: null } : null, fireId: 0 };
    this.fireGroups(); // (los incendios del nivel: un grupo por mancha)
    if (fresh) this.enterSeason(S.season.now, rand);
  },
  // grupos de los incendios que no lo tienen (los del nivel o el creador): cada mancha de fuego, el suyo
  fireGroups() {
    const fires = this.S.tiles.filter(tl => tl.type === 'fire' && !tl.g);
    for (const f of fires) {
      if (f.g) continue;
      const g = ++this.S.season.fireId, stack = [f];
      f.g = g;
      while (stack.length) {
        const c = stack.pop();
        for (const o of fires) if (!o.g && Math.abs(o.x - c.x) + Math.abs(o.y - c.y) === 1) { o.g = g; stack.push(o); }
      }
    }
  },

  /* ---------- consultas ---------- */
  isSpawnCell(x, y) { return this.S.balls.some(b => b.spawnX === x && b.spawnY === y); },
  isHoleHome(x, y) { const h = this.S.hole; return h.initX === x && h.initY === y; },
  // casilla vacía donde puede aparecer algo de la estación (ni salidas ni la casilla inicial del hoyo)
  seasonSpot(x, y) { return this.cellFree(x, y) && !this.isSpawnCell(x, y) && !this.isHoleHome(x, y); },
  seasonSpots(extra = () => true) {
    const out = [];
    for (let y = 0; y < this.S.rows; y++) for (let x = 0; x < this.S.cols; x++) if (this.seasonSpot(x, y) && extra(x, y)) out.push([x, y]);
    return out;
  },
  snowTileAt(x, y) { const sn = this.S.season?.snow; return sn && sn.x === x && sn.y === y ? { type: 'snowball', x, y, virtual: true } : null; },
  // índice de (x,y) en la ruta del viento (soplando o de aviso), o -1
  windIndex(x, y) {
    const w = this.S.season?.wind;
    if (!w) return -1;
    return w.path.findIndex(([px, py]) => px === x && py === y);
  },
  windOn(x, y) { return !!this.S.season?.wind?.on && this.windIndex(x, y) >= 0; },
  // ¿lo echará el viento del tablero? (soplando ya o cuando empiece a soplar): adónde vuelve — la pelota a su salida y el
  // hoyo a su casilla inicial —; null si no le afecta. what: la pelota o 'hole'
  windFate(what) {
    const w = this.S.season?.wind, h = this.S.hole;
    if (!w) return null;
    if (what === 'hole') return this.windIndex(h.x, h.y) >= 0 ? { x: h.initX, y: h.initY } : null;
    return this.windIndex(what.x, what.y) >= 0 ? { x: what.spawnX, y: what.spawnY } : null;
  },
  // hacia dónde sale del tablero lo que llega al final de la ruta (el lado del borde en el que acaba)
  windExit() { return windExitOf(this.S.season.wind.path, this.S.cols, this.S.rows); },
  plantNear(x, y) { return this.S.tiles.find(tl => tl.type === 'plant' && Math.abs(tl.x - x) + Math.abs(tl.y - y) <= 1) || null; },
  // con carta solo se pone el fuego (en verano); lo demás llega solo con la estación
  canPlaceSeasonal(type, x, y) {
    const S = this.S;
    return !!S.season && type === 'fire' && S.season.now === 'summer' && this.seasonSpot(x, y);
  },

  /* ---------- al pasar por una casilla ----------
     La pieza `pid` ('b0'… u 'hole') acaba de entrar en (x,y) con `remaining` pasos por dar. Devuelve el tiro que le
     queda y, si toca, wind (el viento se la lleva) o burn (se queda dentro del fuego). */
  seasonCell(pid, x, y, remaining) {
    if (!this.S.season) return { remaining };
    if (this.windOn(x, y)) return { remaining: 0, wind: true };
    const tl = this.realTileAt(x, y), type = tl?.type;
    if (type === 'leaf') { // se rompe y frena
      this.S.tiles.splice(this.S.tiles.indexOf(tl), 1);
      this.anim({ t: 'crunch', p: pid, x, y });
      this.log('log.leafBreaks');
      this.tip('leaf');
      return { remaining: Math.max(0, remaining - 1) };
    }
    if (type === 'puddle') { this.anim({ t: 'puddle', p: pid, x, y }); this.tip('puddle'); return { remaining: Math.max(0, remaining - 1) }; }
    if (type === 'ice') { this.anim({ t: 'slide', p: pid, x, y }); this.tip('ice'); return { remaining: remaining + 1, ice: true }; }
    if (type === 'fire') {
      if (remaining <= 0) return { remaining: 0, burn: true };
      this.anim({ t: 'flare', p: pid, x, y });
      this.tip('fire');
      return { remaining: remaining + 2 };
    }
    return { remaining };
  },
  // la pelota se ha quedado dentro del fuego (o se la come una planta): como caerse del tablero
  ballOut(ball, kind, at = null) {
    const pid = 'b' + ball.player, b = this.ptag(ball);
    this.anim({ t: kind, p: pid, x: ball.x, y: ball.y, ...(at ? { px: at.x, py: at.y } : {}) });
    this.log(kind === 'burn' ? 'log.ballBurns' : 'log.ballEaten', { b });
    this.tip(kind === 'burn' ? 'burn' : 'eaten');
    this.resetBallToSpawn(ball);
    this.anim({ t: 'appear', p: pid, x: ball.x, y: ball.y });
    this.log('log.ballBack', { b, x: ball.x, y: ball.y });
    this.spawnWater(ball);
  },
  // el hoyo, igual: vuelve a su casilla inicial; devuelve dónde se queda
  holeOut(x, y, kind, at = null) {
    const h = this.S.hole;
    this.anim({ t: kind, p: 'hole', x, y, ...(at ? { px: at.x, py: at.y } : {}) });
    this.log(kind === 'burn' ? 'log.holeBurns' : 'log.holeEaten', { x: h.initX, y: h.initY });
    this.anim({ t: 'appear', p: 'hole', x: h.initX, y: h.initY });
    return [h.initX, h.initY];
  },
  // al acabar un movimiento: ¿se la come una planta? (no si ha entrado en el hoyo ni si está en su salida; tampoco si
  // acaba de volver a ella: finishMoveChecks con safe)
  plantBites(ball) {
    if (!this.S.season || ball.holed || (ball.x === ball.spawnX && ball.y === ball.spawnY)) return false;
    const pl = this.plantNear(ball.x, ball.y);
    if (!pl) return false;
    this.ballOut(ball, 'eaten', pl);
    return true;
  },

  /* ---------- el viento ---------- */
  newWind(rand = this.rand) {
    const S = this.S;
    const bad = (x, y) => this.isHoleHome(x, y) || this.isHole(x, y), spawn = (x, y) => this.isSpawnCell(x, y);
    const path = windRoute(S.cols, S.rows, rand, bad, spawn) || windRoute(S.cols, S.rows, rand, (x, y) => bad(x, y) || spawn(x, y));
    S.season.wind = path ? { path, on: false } : null;
    if (path) { this.emit({ t: 'wind', phase: 'warn' }); this.log('log.windWarn'); }
  },
  // la pelota ha caído en el viento: la lleva por la ruta hasta el final y la echa del tablero (vuelve a su salida)
  windCarryBall(ball) {
    const w = this.S.season.wind, L = w.path.length, i0 = this.windIndex(ball.x, ball.y), pid = 'b' + ball.player, b = this.ptag(ball);
    this.log('log.windCarries', { b });
    this.tip('wind');
    for (let i = i0 + 1; i < L; i++) { const [x, y] = w.path[i]; this.anim({ t: 'gust', p: pid, x, y }); }
    const out = this.windExit();
    this.anim({ t: 'fall', p: pid, x: out.x, y: out.y, dir: out.dir, wind: true });
    this.resetBallToSpawn(ball);
    this.anim({ t: 'appear', p: pid, x: ball.x, y: ball.y });
    this.log('log.ballFell', { b, x: ball.x, y: ball.y });
    this.spawnWater(ball);
  },
  // el hoyo, igual: fuera del tablero y de vuelta a su casilla inicial (devuelve dónde se queda)
  windCarryHole(x, y) {
    const w = this.S.season.wind, L = w.path.length, i0 = this.windIndex(x, y), h = this.S.hole;
    this.log('log.windCarriesHole');
    this.tip('wind');
    for (let i = i0 + 1; i < L; i++) { const [px, py] = w.path[i]; this.anim({ t: 'gust', p: 'hole', x: px, y: py }); }
    const out = this.windExit();
    this.anim({ t: 'fall', p: 'hole', x: out.x, y: out.y, dir: out.dir, wind: true });
    this.log('log.holeFell', { x: h.initX, y: h.initY });
    this.anim({ t: 'appear', p: 'hole', x: h.initX, y: h.initY });
    return [h.initX, h.initY];
  },
  // entre turnos, en ciclos de tres: calma → aviso → sopla (y echa del tablero lo que haya en la ruta) → calma…
  windTurn() {
    const S = this.S, w = S.season.wind;
    if (w?.on) { S.season.wind = null; this.emit({ t: 'wind', phase: 'off' }); this.log('log.windCalm'); return; }
    if (!w) { this.newWind(); return; }
    w.on = true;
    this.emit({ t: 'wind', phase: 'on' });
    this.log('log.windBlows');
    // (lo más cercano al final sale antes)
    const things = [];
    for (const b of S.balls) if (!b.holed && this.windIndex(b.x, b.y) >= 0) things.push({ b, i: this.windIndex(b.x, b.y) });
    if (this.windIndex(S.hole.x, S.hole.y) >= 0) things.push({ hole: true, i: this.windIndex(S.hole.x, S.hole.y) });
    things.sort((a, c) => c.i - a.i);
    for (const th of things) {
      if (th.hole) { const [hx, hy] = this.windCarryHole(S.hole.x, S.hole.y); this.holeLandAt(hx, hy); }
      else if (!th.b.holed) { this.windCarryBall(th.b); this.finishMoveChecks(th.b, { safe: true }); }
    }
  },

  /* ---------- el fuego ---------- */
  // cada incendio crece una casilla vacía (al azar, pegada a él) hasta FIRE_MAX
  fireTurn() {
    const S = this.S, groups = new Map();
    for (const tl of S.tiles) if (tl.type === 'fire') (groups.get(tl.g) || groups.set(tl.g, []).get(tl.g)).push(tl);
    for (const [g, cells] of groups) {
      if (cells.length >= FIRE_MAX) continue;
      const spots = this.seasonSpots((x, y) => cells.some(c => Math.abs(c.x - x) + Math.abs(c.y - y) === 1));
      if (!spots.length) continue;
      const [x, y] = spots[Math.floor(this.rand() * spots.length)];
      S.tiles.push({ type: 'fire', x, y, g });
      this.emit({ t: 'grow', x, y, tile: 'fire' });
    }
    if (groups.size) this.log('log.fireSpreads');
  },
  newFireId() { return ++this.S.season.fireId; },

  /* ---------- el otoño ---------- */
  dropLeaves(n, rand = this.rand) {
    for (let k = 0; k < n; k++) {
      const spots = this.seasonSpots();
      if (!spots.length) return;
      const [x, y] = spots[Math.floor(rand() * spots.length)];
      this.S.tiles.push({ type: 'leaf', x, y });
      this.emit({ t: 'grow', x, y, tile: 'leaf' });
    }
  },
  autumnTurn() {
    const S = this.S;
    if (this.rand() < LEAF_CHANCE && S.tiles.filter(tl => tl.type === 'leaf').length < MAX_LEAVES) { this.dropLeaves(1); this.log('log.leafFalls'); }
    if (this.rand() < RAIN_CHANCE && S.tiles.filter(tl => tl.rain).length < MAX_RAIN) {
      const spots = this.seasonSpots();
      if (spots.length) {
        const [x, y] = spots[Math.floor(this.rand() * spots.length)];
        S.tiles.push({ type: 'puddle', x, y, rain: true });
        this.emit({ t: 'grow', x, y, tile: 'puddle', rain: true });
        this.log('log.rain');
      }
    }
  },

  /* ---------- la bola de nieve ---------- */
  // ¿la bola no puede entrar en (x,y)? (fuera del tablero o una pieza sólida, de las que hacen rebotar)
  snowWall(x, y) { return !this.inBoard(x, y) || isDevice(this.realTileAt(x, y)) || (this.S.train && isDevice(this.trainTileAt(x, y))); },
  // dónde se pararía rodando hacia dir (5 casillas o hasta toparse con algo; sin moverla); null si no puede ni empezar
  snowEnd(dir) {
    const sn = this.S.season?.snow;
    if (!sn) return null;
    const [dx, dy] = D[dir];
    let x = sn.x, y = sn.y;
    for (let k = 0; k < SNOW_STEPS && !this.snowWall(x + dx, y + dy); k++) { x += dx; y += dy; }
    return x === sn.x && y === sn.y ? null : { x, y, dir };
  },
  snowTargets() { return SNOW_DIRS.map(d => this.snowEnd(d)).filter(Boolean); },
  // rueda hacia dir 5 casillas (o hasta toparse con algo). Lo que pilla (pelotas, el hoyo) se queda dentro y viaja con ella; una
  // pelota y el hoyo juntos dentro: la pelota entra. Durante un JAQUE se lleva la pelota que ha entrado (no el hoyo)
  snowRoll(dir) {
    const S = this.S, sn = S.season?.snow;
    if (!sn) return 0;
    const [dx, dy] = D[dir];
    sn.dir = dir;
    let riders = S.balls.filter(b => !b.holed && b.x === sn.x && b.y === sn.y), hole = this.isMainHole(sn.x, sn.y), steps = 0;
    this.log('log.snowRolls', { dir: t('dirs.' + dir) });
    while (steps < SNOW_STEPS && !this.snowWall(sn.x + dx, sn.y + dy)) {
      sn.x += dx; sn.y += dy; steps++;
      // (lo que va dentro, antes del paso de la bola en la cola: la interfaz lo mueve a la vez)
      for (const b of riders) { b.x = sn.x; b.y = sn.y; this.anim({ t: 'move', p: 'b' + b.player, x: sn.x, y: sn.y, ride: true }); }
      if (hole) { S.hole.x = sn.x; S.hole.y = sn.y; this.anim({ t: 'move', p: 'hole', x: sn.x, y: sn.y, ride: true }); }
      this.anim({ t: 'snow', x: sn.x, y: sn.y, dir });
      const n0 = riders.length;
      const caught = S.balls.filter(b => !b.holed && b.x === sn.x && b.y === sn.y && !riders.includes(b));
      if (caught.length) { riders.push(...caught); this.log('log.snowCatches', { b: joinAnd(caught.map(b => this.ptag(b))) }); this.tip('snow'); }
      for (const b of caught) this.anim({ t: 'settle', p: 'b' + b.player });
      if (!hole && this.isMainHole(sn.x, sn.y)) {
        const inside = S.balls.filter(b => b.holed && !b.decoy && !b.hunter);
        if (S.jaque && S.winner !== null && inside.length) { // se lleva la pelota ganadora: JAQUE anulado
          for (const b of inside) { b.holed = false; b.x = sn.x; b.y = sn.y; riders.push(b); this.anim({ t: 'appear', p: 'b' + b.player, x: sn.x, y: sn.y }); }
          S.winner = null; S.winners = []; S.jaque = false;
          this.log('log.snowSteals');
          this.log('log.jaqueCancelled');
        } else { hole = true; this.log('log.snowHole'); }
      }
      if (hole) for (const b of riders) if (!b.holed) { // (la pelota y el hoyo, juntos en la bola: entra)
        b.holed = true; this.log('log.ballHoled', { b: this.ptag(b) }); this.anim({ t: 'sink', p: 'b' + b.player }); this.registerWin(b.player);
      }
      riders = riders.filter(b => !b.holed);
      // (lo que lleva dentro, para que la interfaz lo coloque de forma que se vea todo)
      if (riders.length !== n0 || caught.length) this.anim({ t: 'snowPack', x: sn.x, y: sn.y, ids: riders.map(b => 'b' + b.player) });
    }
    if (!steps) this.anim({ t: 'bump', p: 'snow', x: sn.x + dx, y: sn.y + dy, dir });
    return steps;
  },
  placeSnow(rand = this.rand) {
    const S = this.S, far = (x, y) => S.balls.every(b => b.holed || Math.abs(b.x - x) + Math.abs(b.y - y) >= 2) && Math.abs(S.hole.x - x) + Math.abs(S.hole.y - y) >= 2;
    const spots = this.seasonSpots(far), any = spots.length ? spots : this.seasonSpots();
    if (!any.length) { S.season.snow = null; return; }
    const [x, y] = any[Math.floor(rand() * any.length)];
    S.season.snow = { x, y, dir: null };
    this.emit({ t: 'snowIn', x, y });
  },
  // se derrite: si llevaba varias pelotas, una se queda en su casilla y las demás van a la libre más cercana
  meltSnow() {
    const S = this.S, sn = S.season.snow;
    if (!sn) return;
    S.season.snow = null;
    const here = S.balls.filter(b => !b.holed && b.x === sn.x && b.y === sn.y);
    for (const b of here.slice(1)) {
      const spot = this.nearestFree(sn.x, sn.y);
      if (!spot) continue;
      b.x = spot.x; b.y = spot.y;
      this.anim({ t: 'move', p: 'b' + b.player, x: spot.x, y: spot.y });
    }
    this.emit({ t: 'snowOut', x: sn.x, y: sn.y });
  },

  /* ---------- cambio de estación ---------- */
  // lo que llega con la estación (sin lo que se va: leaveSeason)
  enterSeason(now, rand = this.rand) {
    const S = this.S;
    if (now === 'spring') this.transform('ice', 'plant'); // (el viento empieza en calma: avisa al acabar el primer turno)
    if (now === 'summer') S.tiles = S.tiles.filter(tl => tl.type !== 'plant');
    if (now === 'autumn') this.dropLeaves(START_LEAVES, rand);
    if (now === 'winter') { this.transform('puddle', 'ice'); this.placeSnow(rand); }
  },
  leaveSeason(now) {
    const S = this.S;
    if (now === 'spring') S.season.wind = null;
    if (now === 'summer') S.tiles = S.tiles.filter(tl => tl.type !== 'fire');
    if (now === 'autumn') S.tiles = S.tiles.filter(tl => tl.type !== 'leaf');
    if (now === 'winter') this.meltSnow();
  },
  transform(from, to) { for (const tl of this.S.tiles) if (tl.type === from) tl.type = to; },
  changeSeason() {
    const S = this.S, from = S.season.now, to = nextSeason(from);
    this.leaveSeason(from);
    S.season.now = to;
    this.enterSeason(to);
    this.anim({ t: 'season', from, to });
    this.log('log.seasonChange', { s: t('seasons.' + to + '.name') });
    this.tip('season');
  },

  // al acabar cada turno, lo que hace la estación sola. Si así una pelota acaba en el hoyo, gana su dueño (JAQUE)
  seasonTurn() {
    const S = this.S;
    if (!S.season || S.winner !== null) return;
    const now = S.season.now;
    if (now === 'spring') this.windTurn();
    else if (now === 'summer') this.fireTurn();
    else if (now === 'autumn') this.autumnTurn();
    if (S.winner !== null || S.balls.some(b => !b.holed && this.isHole(b.x, b.y))) this.afterPlay();
  },
  ptag(ball) { return t('player.tag', { n: ball.player + 1 }); },
};

export const seasonTileDef = type => TILES[type];
