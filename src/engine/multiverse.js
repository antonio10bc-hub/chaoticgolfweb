/* =========================================================
   Baraja del multiverso.
     agujero negro  (loseta) se traga la pelota que entra o se para en una casilla pegada a él en cruz (o en la suya). De
                    él salen 4 pelotas, una por dirección (la original sigue hacia donde iba y 3 copias), con los pasos que
                    le quedaban por dar (si no le quedaba ninguno, 1). Las copias también se multiplican si caen en otro (o
                    en el mismo, en otra jugada), con un tope de pelotas por jugador.
     copias         son pelotas de su jugador: si una entra en el hoyo, gana. Si se sale del tablero (o le cae un
                    meteorito) desaparece para siempre. Con varias pelotas, los palos y el dedo preguntan cuál se mueve.
     gravedad       (negra, cruz de 2 · naranja, cruz de 1) en cualquier casilla, aunque esté ocupada: lo que haya en su
                    cruz (pelotas y el hoyo) va hacia ella, hasta el centro o hasta pararse al lado si está ocupado. Si 2
                    o más pelotas llegan a la vez al centro, chocan y se quedan donde estaban. Si el centro es el hoyo, la
                    pelota que llega entra; si el hoyo llega a una pelota, se la traga. Lo que no puede moverse (tiene
                    delante otra pelota o un muro) se queda, y se ve que tira (evento gstuck).
     meteoritos     (negra) caen, uno tras otro, en la mitad de las casillas (al azar): la copia alcanzada desaparece; la
                    original vuelve a su salida (como si se hubiera caído del tablero). La copia del hoyo alcanzada también
                    desaparece; al hoyo de siempre y a las piezas no les hace nada.
                    El primero que cae en una casilla vacía (que no sea una salida, la casilla inicial del hoyo ni pegada a un
                    hoyo) se queda
                    ahí como una roca: un muro, como el bloque de madera.
   El hoyo también: si pasa (o se para) junto a un agujero negro salen 4 hoyos; las copias del hoyo (S.holeCopies, con su
   `id`: hole1, hole2…) son hoyos de verdad (la pelota que entra en cualquiera gana), las cartas de hoyo preguntan cuál se
   mueve y la copia que se sale del tablero (o a la que le cae un meteorito) desaparece; al hoyo de siempre los meteoritos
   no le hacen nada. Como mucho, MAX_HOLES.
   Las copias son pelotas más de S.balls con `copy: true` y un número propio (`player`) que lleva dentro el de su jugador:
   COPY_BASE + 10·n + jugador (ownerOf lo saca). Así el resto del juego (choques, animaciones, guardado) las trata como
   cualquier pelota.
   Este módulo añade sus métodos a Game (game.js los instala); `this` es la partida.
   ========================================================= */
import { t } from '../i18n/index.js';
import { CARDS } from '../content/cards/index.js';

export const COPY_BASE = 100;
export const ownerOf = id => id >= COPY_BASE ? id % 10 : id;
// etiqueta del jugador (J1, J2…); la de una copia lleva una prima: J1′
export const playerTag = i => t('player.tag', { n: ownerOf(i) + 1 }) + (i >= COPY_BASE ? '′' : '');
const playerTagOf = b => playerTag(b.player);
export const MAX_BALLS = 8;   // pelotas de un jugador a la vez (la original y 7 copias)
export const MAX_HOLES = 8;   // hoyos a la vez (el de siempre y 7 copias)
const MAX_SPLITS = 6;         // agujeros negros que se pueden atravesar en una misma jugada (corta los bucles entre dos)
const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
// por dónde salen las 4 pelotas: la original sigue recto; las copias, a los lados y hacia atrás
const SPLIT_DIRS = { up: ['up', 'left', 'right', 'down'], down: ['down', 'right', 'left', 'up'],
  left: ['left', 'down', 'up', 'right'], right: ['right', 'up', 'down', 'left'] };
const isBH = tl => tl?.type === 'blackhole';

export const multiverseMethods = {
  /* ---------- copias ---------- */
  // pelotas de un jugador en el tablero (la original y sus copias; sin las que están en el hoyo)
  ballsOf(p) { return this.S.balls.filter(b => !b.decoy && !b.holed && ownerOf(b.player) === p); },
  // nueva copia de `ball` en su casilla (sin moverla aún)
  makeCopy(ball) {
    const S = this.S, owner = ownerOf(ball.player);
    S.copySeq = (S.copySeq || 0) + 1;
    const c = { player: COPY_BASE + 10 * S.copySeq + owner, x: ball.x, y: ball.y, spawnX: ball.spawnX, spawnY: ball.spawnY, holed: false, copy: true };
    S.balls.push(c);
    return c;
  },
  // una copia se va para siempre (se ha salido del tablero, le ha caído un meteorito o se ha quedado sin sitio)
  copyGone(ball, why) {
    const S = this.S, i = S.balls.indexOf(ball);
    if (i < 0) return;
    S.balls.splice(i, 1);
    this.anim({ t: 'vanish', p: 'b' + ball.player, x: ball.x, y: ball.y, why });
    this.log('log.copyGone', { b: playerTagOf(ball) });
  },
  // cuántas pelotas tiene ahora (para el tope)
  canSplit(ball) { return this.ballsOf(ownerOf(ball.player)).length < MAX_BALLS; },

  // con más de una pelota, los palos y el dedo preguntan antes cuál se mueve; con una, empieza ya
  playOwn(p, idx, key) {
    const own = this.ballsOf(p).filter(b => CARDS[key].canStart?.(this, b) !== false);
    if (own.length > 1) { this.setPending({ kind: 'pickOwn', p, idx, card: key }); return; }
    CARDS[key].start(this, p, idx, own[0] || this.ownBall(p));
  },
  pickOwnAt(x, y) {
    const pd = this.pending, b = this.ballAt(x, y);
    if (!b || b.decoy || ownerOf(b.player) !== pd.p || CARDS[pd.card].canStart?.(this, b) === false) return false;
    this.pending = null;
    CARDS[pd.card].start(this, pd.p, pd.idx, b);
    return true;
  },

  /* ---------- copias del hoyo ---------- */
  allHoles() { return this.S.holeCopies?.length ? [this.S.hole, ...this.S.holeCopies] : [this.S.hole]; },
  holeAt(x, y) { return this.allHoles().find(h => h.x === x && h.y === y) || null; },
  isHoleObj(o) { return o === this.S.hole || !!this.S.holeCopies?.includes(o); },
  makeHoleCopy(h) {
    const S = this.S;
    S.holeSeq = (S.holeSeq || 0) + 1;
    const c = { id: 'hole' + S.holeSeq, x: h.x, y: h.y, copy: true };
    (S.holeCopies ||= []).push(c);
    return c;
  },
  holeGone(h, why) {
    const S = this.S, i = S.holeCopies?.indexOf(h) ?? -1;
    if (i < 0) return;
    S.holeCopies.splice(i, 1);
    this.anim({ t: 'vanish', p: h.id, x: h.x, y: h.y, why });
    this.log('log.holeCopyGone');
  },
  // ¿puede moverse este hoyo con esta carta de hoyo? (desde una trampa, la carta pierde 1)
  holeCanMove(h, def) { return !!h && !!def?.dist && def.dist - (this.hardTrapAt(h.x, h.y) ? 1 : 0) > 0; },
  pickHoleAt(x, y) {
    const pd = this.pending, h = this.holeAt(x, y), def = CARDS[pd.card];
    if (!this.holeCanMove(h, def)) return false;
    this.pending = null;
    def.moveOne(this, pd.p, pd.idx, h);
    return true;
  },
  // la gravedad, en cualquier casilla salvo la del agujero negro
  gravitySpot(x, y) { return this.inBoard(x, y) && !isBH(this.realTileAt(x, y)); },

  /* ---------- agujero negro ---------- */
  // el agujero negro pegado (en cruz) a (x,y) o en ella, salvo el que se acaba de atravesar
  blackHoleNear(x, y, skip = null) {
    if (!this.S.tiles.length) return null;
    return this.S.tiles.find(tl => isBH(tl) && tl !== skip && Math.abs(tl.x - x) + Math.abs(tl.y - y) <= 1) || null;
  },
  // ¿se la traga uno al pasar (o pararse) en (x,y)? Devuelve true si la jugada de esa pelota acaba aquí
  bhCheck(ball, x, y, dir, remaining) {
    if (ball.decoy || (this._splits || 0) >= MAX_SPLITS) return false;
    const bh = this.blackHoleNear(x, y, this._bhSkip?.get(ball));
    if (!bh) return false;
    if (this.isHoleObj(ball)) this.absorbHole(ball, bh, dir, remaining); // (el hoyo, igual: salen 4 hoyos)
    else this.absorb(ball, bh, dir, remaining);
    return true;
  },
  // el hoyo entra en el agujero y salen 4 hoyos (o los que quepan hasta el tope), cada uno por un lado
  absorbHole(h, bh, dir, remaining) {
    const S = this.S, pid = h === S.hole ? 'hole' : h.id;
    this._splits = (this._splits || 0) + 1;
    this.anim({ t: 'absorb', p: pid, x: bh.x, y: bh.y });
    this.log('log.holeAbsorbed');
    this.tip('blackhole');
    h.x = bh.x; h.y = bh.y;
    const steps = Math.max(1, remaining), dirs = SPLIT_DIRS[dir] || SPLIT_DIRS.up;
    const out = [[h, dirs[0]]];
    for (const d of dirs.slice(1)) {
      if (this.allHoles().length >= MAX_HOLES) break;
      const c = this.makeHoleCopy(h);
      this.anim({ t: 'clone', p: c.id, of: pid, x: bh.x, y: bh.y });
      out.push([c, d]);
    }
    this._bhSkip ||= new Map();
    for (const [hh, d] of out) {
      if (!this.isHoleObj(hh)) continue;
      this._bhSkip.set(hh, bh);
      this.moveHole(d, steps, hh);
      this._bhSkip.delete(hh);
    }
    // los que no han podido salir (un muro pegado) no se quedan dentro del agujero
    for (const [hh] of out) {
      if (!this.isHoleObj(hh) || hh.x !== bh.x || hh.y !== bh.y) continue;
      if (hh !== S.hole) { this.holeGone(hh, 'stuck'); continue; }
      const spot = this.nearestFree(bh.x, bh.y);
      if (spot) { hh.x = spot.x; hh.y = spot.y; this.anim({ t: 'appear', p: 'hole', x: spot.x, y: spot.y }); }
    }
  },
  // la pelota entra en el agujero y salen 4 (o las que quepan hasta el tope), cada una por un lado
  absorb(ball, bh, dir, remaining) {
    const S = this.S, pid = 'b' + ball.player;
    this._splits = (this._splits || 0) + 1;
    this.anim({ t: 'absorb', p: pid, x: bh.x, y: bh.y });
    this.log('log.absorbed', { b: playerTagOf(ball) });
    this.tip('blackhole');
    ball.x = bh.x; ball.y = bh.y;
    const steps = Math.max(1, remaining), dirs = SPLIT_DIRS[dir] || SPLIT_DIRS.up;
    const out = [[ball, dirs[0]]];
    for (const d of dirs.slice(1)) {
      if (!this.canSplit(ball)) break;
      const c = this.makeCopy(ball);
      this.anim({ t: 'clone', p: 'b' + c.player, of: pid, x: bh.x, y: bh.y });
      out.push([c, d]);
    }
    if (out.length > 1) this.log('log.split', { b: playerTagOf(ball), n: out.length });
    this._bhSkip ||= new Map();
    for (const [b, d] of out) {
      if (!S.balls.includes(b) || b.holed) continue;
      this._bhSkip.set(b, bh); // (al salir no se la vuelve a tragar el mismo)
      this.moveBallRaw(b, d, steps);
      this._bhSkip.delete(b);
    }
    // las que no han podido salir (había una pelota pegada y la han golpeado) no se quedan dentro del agujero
    for (const [b] of out) {
      if (!S.balls.includes(b) || b.holed || b.x !== bh.x || b.y !== bh.y) continue;
      if (b.copy) { this.copyGone(b, 'stuck'); continue; }
      const spot = this.nearestFree(bh.x, bh.y);
      if (spot) { b.x = spot.x; b.y = spot.y; this.anim({ t: 'appear', p: 'b' + b.player, x: b.x, y: b.y }); }
    }
  },

  /* ---------- gravedad ---------- */
  // las casillas de la cruz de (x,y) a distancia 1..r, por brazos (de dentro afuera)
  gravityArms(x, y, r) {
    return Object.entries(DIRV).map(([d, [dx, dy]]) => {
      const cells = [];
      for (let k = 1; k <= r; k++) if (this.inBoard(x + dx * k, y + dy * k)) cells.push([x + dx * k, y + dy * k]);
      return { toward: OPP[d], cells };
    });
  },
  // lo que hay en la cruz (pelotas y el hoyo) va hacia el centro
  gravityPull(cx, cy, r) {
    const S = this.S;
    this.anim({ t: 'gravity', x: cx, y: cy, r });
    this.log('log.gravity', { x: cx, y: cy });
    this.tip('gravity');
    const pieceAt = (x, y) => this.ballAt(x, y) || this.holeAt(x, y); // (pelotas y hoyos, también sus copias)
    // en cada brazo, las piezas de dentro afuera; se resuelven por rondas (primero la más cercana de cada brazo)
    const arms = this.gravityArms(cx, cy, r).map(a => ({ ...a, pieces: a.cells.map(([x, y]) => pieceAt(x, y)).filter(Boolean) }));
    const isH = pc => this.isHoleObj(pc), idOf = pc => isH(pc) ? (pc === S.hole ? 'hole' : pc.id) : 'b' + pc.player;
    for (let round = 0; round < r; round++) {
      // hasta dónde puede ir cada una: casillas libres seguidas hacia el centro (el centro, si está libre o es el hoyo)
      const moves = [];
      for (const a of arms) {
        const pc = a.pieces[round];
        if (!pc || (isH(pc) ? !this.isHoleObj(pc) : (pc.holed || !S.balls.includes(pc)))) continue;
        const x0 = pc.x, y0 = pc.y, [dx, dy] = DIRV[a.toward];
        const dist = Math.abs(x0 - cx) + Math.abs(y0 - cy);
        let run = 0;
        while (run < dist) {
          const nx = x0 + dx * (run + 1), ny = y0 + dy * (run + 1), center = nx === cx && ny === cy;
          if (this.ballAt(nx, ny) || this.bouncesAt(nx, ny, a.toward)) break; // (otra pelota o un muro: roca, bloque…)
          if (this.isHole(nx, ny) && (isH(pc) || !center)) break; // (la pelota solo entra en el hoyo si es el centro)
          run++;
        }
        if (run) moves.push({ pc, dir: a.toward, run, center: run === dist });
        else this.anim({ t: 'gstuck', p: idOf(pc), dir: a.toward, x: x0 + dx, y: y0 + dy }); // (no puede: tira y se queda)
      }
      // dos o más pelotas llegan a la vez al centro: chocan y se quedan donde estaban
      const toCenter = moves.filter(m => m.center && !isH(m.pc));
      if (toCenter.length > 1) {
        for (const m of toCenter) { m.run = 0; this.anim({ t: 'clash', p: 'b' + m.pc.player, dir: m.dir, x: cx, y: cy }); }
        this.log('log.gravityClash');
      }
      // primero las pelotas y después el hoyo (si llega a una pelota, se la traga)
      for (const m of moves) if (!isH(m.pc) && m.run && S.balls.includes(m.pc)) { this.anim({ t: 'gpull', p: idOf(m.pc) }); this.moveBallRaw(m.pc, m.dir, m.run); }
      for (const m of moves) {
        if (!isH(m.pc) || !m.run || !this.isHoleObj(m.pc)) continue;
        // (mover un hoyo en un JAQUE: las que estaban dentro salen; con copias, solo las de ese hoyo)
        if (S.jaque && S.winner !== null) this.popHoledBalls(S.holeCopies?.length ? m.pc : null);
        this.anim({ t: 'gpull', p: idOf(m.pc) });
        this.moveHole(m.dir, m.run, m.pc);
      }
    }
  },

  /* ---------- lluvia de meteoritos ---------- */
  meteorShower() {
    const S = this.S, cells = [];
    for (let y = 0; y < S.rows; y++) for (let x = 0; x < S.cols; x++) cells.push([x, y]);
    for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(this.rand() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
    const hits = cells.slice(0, Math.round(cells.length / 2));
    this.log('log.meteors', { n: hits.length });
    this.tip('meteors');
    // (el primero que cae en una casilla vacía se queda como roca; nunca en una salida ni en la casilla inicial del hoyo)
    // (ni pegada a un hoyo: podría encerrarlo entre rocas para siempre)
    const home = (x, y) => (x === S.hole.initX && y === S.hole.initY) || S.balls.some(b => b.spawnX === x && b.spawnY === y) ||
      this.allHoles().some(h => Math.abs(h.x - x) + Math.abs(h.y - y) <= 1);
    let rock = false;
    for (const [x, y] of hits) {
      const b = this.ballAt(x, y), hc = S.holeCopies?.find(h => h.x === x && h.y === y); // (y las copias del hoyo)
      this.anim({ t: 'meteor', x, y, hit: b ? 'b' + b.player : hc ? hc.id : null });
      if (hc) { this.holeGone(hc, 'meteor'); continue; } // (la copia del hoyo alcanzada, para siempre; al de siempre no le pasa nada)
      if (!rock && !b && this.cellFree(x, y) && !home(x, y)) {
        rock = true;
        S.tiles.push({ type: 'meteorite', x, y });
        this.anim({ t: 'meteorRock', x, y });
        this.log('log.meteorRock', { x, y });
      }
      if (!b || b.decoy) continue;
      if (b.copy) { this.copyGone(b, 'meteor'); continue; }
      if (b.x === b.spawnX && b.y === b.spawnY) continue; // (ya está en su salida)
      this.resetBallToSpawn(b);
      this.anim({ t: 'appear', p: 'b' + b.player, x: b.x, y: b.y });
      this.log('log.meteorHit', { b: playerTagOf(b), x: b.x, y: b.y });
    }
  },
};
