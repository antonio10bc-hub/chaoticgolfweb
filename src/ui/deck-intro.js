// Presentación de una baraja nueva: la primera vez que se juega una baraja con cartas especiales
// (deck.newCards), un diálogo muestra cada carta nueva con un tablero de ejemplo animado y su
// explicación. El tablero no está dibujado a mano: la escena de la carta (card.demo) se juega con
// el motor real y se anima lo que ha pasado, así el ejemplo siempre coincide con las reglas.
// Vale para cualquier baraja futura: basta con `newCards` en la baraja y `demo` en cada carta.
import { $, esc } from './dom.js';
import { t } from '../i18n/index.js';
import { Game } from '../engine/game.js';
import { CARDS } from '../content/cards/index.js';
import { deckById } from '../content/decks.js';
import { cardArtHTML } from './card-art.js';
import { REDUCED } from '../fx/juice.js';
import { tilePic } from '../content/tiles/index.js';
import { trackSVG, LOCO, WAGON } from './train-view.js';
import { stepDir } from '../engine/train.js';
import { SNOWBALL } from './season-art.js';
import { WHEEL } from '../engine/gambling.js';
import { wheelSVG, GOLD_ICON } from './gambling-view.js';

const KEY = 'chaoticgolf_deckIntros';
const seen = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
const markSeen = id => { try { localStorage.setItem(KEY, JSON.stringify({ ...seen(), [id]: true })); } catch (e) { /* sin storage */ } };
export const resetDeckIntros = () => { try { localStorage.removeItem(KEY); } catch (e) { /* sin storage */ } };
export const hasDeckIntro = id => !!deckById(id).newCards?.some(k => CARDS[k]?.demo);

/* ---------- la escena: se juega con el motor ---------- */
const PIECE_EVENTS = ['move', 'drift', 'teleport', 'fall', 'splash', 'appear', 'sink', 'launch', 'tunnel', 'bump', 'gust', 'burn', 'eaten',
  'absorb', 'clone', 'vanish', 'clash', 'gstuck', // (multiverso)
  'goHome', 'goldWin']; // (casino)
// (estaciones) lo que cambia en el campo y la bola de nieve
const FIELD_EVENTS = ['tilePlaced', 'crunch', 'season', 'grow', 'snow', 'snowIn', 'snowOut', 'meteor', 'meteorRock', 'gravity', // (y del multiverso)
  'diceRoll', 'roulette']; // (y del casino)
function runDemo(demo) {
  const g = Game.fromLevel({ cols: demo.cols, rows: demo.rows, hole: demo.hole, ball: demo.ball, parCells: [], tiles: demo.tiles || [],
    deckCounts: { palo1: 1 }, extraBalls: demo.extraBalls || [], train: demo.train, season: demo.season, gamble: demo.gamble }, { seed: demo.seed ?? 3 });
  const b = g.S.balls[0];
  if (demo.spawn) { b.spawnX = demo.spawn.x; b.spawnY = demo.spawn.y; }
  const before = { tiles: g.S.tiles.map(x => ({ ...x })), hole: { ...g.S.hole }, balls: g.S.balls.map(x => ({ id: 'b' + x.player, x: x.x, y: x.y, decoy: !!x.decoy })),
    spawn: { x: b.spawnX, y: b.spawnY }, train: g.S.train ? { ...g.S.train } : null,
    season: g.S.season?.now || null, snow: g.S.season?.snow ? { ...g.S.season.snow } : null, gamble: g.S.gamble ? { gold: g.S.gamble.gold } : null };
  g.takeEvents();
  // la carta (y, si la escena lo pide, otra después: p. ej. pon un charco y luego tira por encima)
  const events = [];
  const play = ({ card, dir, cell, spin }) => {
    g.S.hands[0] = [card];
    if (spin != null) g._forceSpin = spin; // (la ruleta: lo que sale en la escena)
    g.clickCard(0, 0);
    const tg = cell || g.pending?.targets?.find(x => x.dir === dir);
    if (tg) g.clickCell(tg.x, tg.y);
    // (las pelotas; con tren, también la locomotora, los vagones y el hoyo, que el tren empuja; con estaciones, el campo)
    for (const e of g.takeEvents()) {
      if (e.t === 'tilePlaced') { const tl = g.realTileAt(e.x, e.y); if (tl) events.push({ ...e, tile: { ...tl } }); continue; }
      if (FIELD_EVENTS.includes(e.t)) { events.push(e); continue; }
      if (typeof e.p === 'string' && (e.p.startsWith('b') && PIECE_EVENTS.includes(e.t) || (e.p === 'hole' && e.t === 'move') || // (el hoyo: el tren o la gravedad)
        (before.train && (e.t === 'train' || e.t === 'wagon')))) events.push(e);
    }
  };
  play(demo);
  if (demo.then) play(demo.then);
  return { ...before, events };
}
// (estaciones) colores del césped de la escena según la estación
const SEASON_GRASS = { spring: ['#59A757', '#4C9A4C'], summer: ['#98A84D', '#8C9D45'], autumn: ['#7C8B41', '#6F7F3B'], winter: ['#B7CBD5', '#A9C0CB'] };

/* ---------- el dibujo (SVG) con las pelotas animadas ---------- */
const CW = 40, CH = 52, G = 4;
// dibujo real de una loseta (el de la partida) dentro del SVG de la escena
const embed = (tl, x0, y0) => (tl.type === 'blackhole' ? `<rect x="${x0 + G / 2}" y="${y0 + G / 2}" width="${CW - G}" height="${CH - G}" rx="5" fill="#2A2150"/>` : '') + // (el agujero negro, en su casilla de noche)
  tilePic(tl).replace('<svg ', `<svg x="${x0 + 1}" y="${y0 + 1}" width="${CW - 2}" height="${CH - 2}" `);
// (casino) la ruleta en medio de la escena: aparece, gira hasta su franja y se iluminan las casillas de ese color
function spinSVG(s, total, W, H, demo, gold) {
  const k = v => (v / total).toFixed(4), n = WHEEL.length, size = Math.min(W, H) * .78, sc = size / 200;
  const final = 360 * 3 - (s.seg + .5) * 360 / n;
  const show = `<animate attributeName="opacity" dur="${total}ms" repeatCount="indefinite" calcMode="linear" keyTimes="0;${k(s.t0)};${k(s.t0 + 150)};${k(s.t0 + 1350)};${k(s.t0 + 1500)};1" values="0;0;1;1;0;0"/>`;
  const spin = REDUCED ? `transform="rotate(${final} 100 100)"` : '';
  const anim = REDUCED ? '' : `<animateTransform attributeName="transform" type="rotate" dur="${total}ms" repeatCount="indefinite" calcMode="spline" keyTimes="0;${k(s.t0)};${k(s.t0 + 900)};1" keySplines="0 0 1 1;.1 .6 .2 1;0 0 1 1" values="0 100 100;0 100 100;${final} 100 100;${final} 100 100"/>`;
  let lit = '';
  for (let y = 0; y < demo.rows; y++) for (let x = 0; x < demo.cols; x++) {
    const c = gold && gold.x === x && gold.y === y ? 'gold' : (x + y) % 2 === 0 ? 'red' : 'black';
    if (c === s.res) lit += `<rect x="${x * CW + G / 2}" y="${y * CH + G / 2}" width="${CW - G}" height="${CH - G}" rx="5" fill="rgba(255,236,170,.35)" stroke="#FFE38A" stroke-width="2"/>`;
  }
  const litAnim = `<animate attributeName="opacity" dur="${total}ms" repeatCount="indefinite" keyTimes="0;${k(s.t0 + 900)};${k(s.t0 + 1000)};${k(s.t0 + 1500)};1" values="0;0;1;0;0"/>`;
  return `<g opacity="0">${litAnim}${lit}</g><g opacity="0">${show}<g transform="translate(${(W - size) / 2} ${(H - size) / 2}) scale(${sc})">` +
    wheelSVG(200).replace(/<svg[^>]*>/, '').replace('</svg>', '').replace('<g class="rlRot">', `<g ${spin}>${anim}`) + `</g></g>`;
}
function demoSVG(demo) {
  const d = runDemo(demo), W = demo.cols * CW, H = demo.rows * CH;
  const cx = x => x * CW + CW / 2, cy = y => y * CH + CH / 2;
  const grass = s => (x, y) => s ? SEASON_GRASS[s][((x + y) >> 1) & 1 ? 0 : 1] : ((x + y) >> 1) & 1 ? '#5C9854' : '#4F8A4B';
  // (casino) el suelo ajedrezado, rojo y negro, con la casilla dorada
  const felt = gd => (x, y) => gd && gd.x === x && gd.y === y ? '#C9962E' : (x + y) % 2 === 0 ? '#8E1F2E' : '#26262D';
  const cellsOf = col => { let out = ''; for (let y = 0; y < demo.rows; y++) for (let x = 0; x < demo.cols; x++)
    out += `<rect x="${x * CW + G / 2}" y="${y * CH + G / 2}" width="${CW - G}" height="${CH - G}" rx="5" fill="${col(x, y)}"/>`; return out; };
  let cells = cellsOf(d.gamble ? felt(d.gamble.gold) : grass(d.season));
  if (d.gamble?.gold) cells += GOLD_ICON.replace('<svg class="gGoldSvg" viewBox="-12 -12 24 24" aria-hidden="true">', `<svg x="${d.gamble.gold.x * CW + CW / 2 - 13}" y="${d.gamble.gold.y * CH + CH / 2 - 13}" width="26" height="26" viewBox="-12 -12 24 24">`);
  const has = (type, x, y) => d.tiles.some(tl => tl.type === type && tl.x === x && tl.y === y);
  const tiles = d.tiles.map(tl => {
    const x0 = tl.x * CW, y0 = tl.y * CH;
    if (tl.type === 'river' || tl.type === 'lake') {
      const up = has(tl.type, tl.x, tl.y - 1), dn = has(tl.type, tl.x, tl.y + 1), lf = has(tl.type, tl.x - 1, tl.y), rt = has(tl.type, tl.x + 1, tl.y);
      const r = { x: x0 + (lf ? 0 : G / 2), y: y0 + (up ? 0 : G / 2), w: CW - (lf ? 0 : G / 2) - (rt ? 0 : G / 2), h: CH - (up ? 0 : G / 2) - (dn ? 0 : G / 2) };
      const body = `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${tl.type === 'lake' ? 8 : 4}" fill="${tl.type === 'river' ? '#5BB6D6' : '#2E7E8C'}"/>`;
      if (tl.type === 'lake') return body + `<ellipse cx="${x0 + CW * .38}" cy="${y0 + CH * .32}" rx="8" ry="1.6" fill="rgba(255,255,255,.2)"/>`;
      return body + `<g class="dmFlow">` + [-1, 0, 1].map(k => `<path d="M${x0 + CW / 2 - 5} ${y0 + CH / 2 + k * 17 - 3}l5 4 5-4" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`).join('') + `</g>`;
    }
    return embed(tl, x0, y0);
  }).join('');
  const holeAt0 = `<circle cx="0" cy="0" r="7" fill="#242424"/><path d="M1 0v-17l9 3.5-9 3.5" fill="#E8873A" stroke="#F1F1DC" stroke-width="1.2" stroke-linejoin="round"/>`;
  const track = d.train ? trackSVG(d.train, (x, y) => [cx(x), cy(y)], W, H, Math.min(CW, CH), { w: CW - G, h: CH - G }) : '';
  const sp = d.events.some(e => e.p === 'b0' && (e.t === 'fall' || e.t === 'splash' || e.t === 'goHome')) ? `<circle cx="${cx(d.spawn.x)}" cy="${cy(d.spawn.y)}" r="11" fill="none" stroke="#F1F1DC" stroke-width="2" stroke-dasharray="3 3" opacity=".8"/>` +
    `<text x="${cx(d.spawn.x)}" y="${cy(d.spawn.y) + 24}" text-anchor="middle" class="dmLbl">${esc(t('deckIntro.start'))}</text>` : '';
  // fotogramas por pelota: [ms, x, y, opacidad, escala]; un solo reloj para todas
  const fr = {}, trail = {}, pos = {};
  for (const b of d.balls) { fr[b.id] = [[0, cx(b.x), cy(b.y), 1, 1]]; trail[b.id] = [[cx(b.x), cy(b.y)]]; pos[b.id] = [cx(b.x), cy(b.y)]; }
  fr.hole = [[0, cx(d.hole.x), cy(d.hole.y), 1, 1]]; pos.hole = [cx(d.hole.x), cy(d.hole.y)];
  // tren: fotogramas [ms, x, y, ángulo, opacidad] de la locomotora y de cada vagón
  const tr = d.train, TSTEP = 260, ANG = { up: 0, right: 90, down: 180, left: 270 };
  const tcell = i => tr.path[((i % tr.path.length) + tr.path.length) % tr.path.length];
  const tdir = i => stepDir(tcell(i), tcell(i + 1));
  const tfr = {}, turn = (f, a) => { const cur = f[f.length - 1][3]; return cur + ((((a - cur) % 360) + 540) % 360 - 180); };
  if (tr) for (let k = 0; k <= 3; k++) { const [x, y] = tcell(tr.pos - k); tfr[k] = [[0, cx(x), cy(y), ANG[tdir(tr.pos - k - (k ? 0 : 1))], k <= tr.cars ? 1 : 0]]; }
  const tkey = (k, t0, t1, i, o) => { const f = tfr[k], last = f[f.length - 1], [x, y] = tcell(i - k);
    if (last[0] < t0) f.push([t0, last[1], last[2], last[3], last[4]]);
    f.push([t1, cx(x), cy(y), turn(f, ANG[tdir(i - k - (k ? 0 : 1))]), o ?? last[4]]); };
  let tm = 500;
  const key = (id, dt, x, y, o = 1, sc = 1) => {
    const f = fr[id]; if (!f) return;
    const last = f[f.length - 1];
    if (last[0] < tm) f.push([tm, last[1], last[2], last[3], last[4]]); // quieta hasta ahora
    tm += dt; f.push([tm, x, y, o, sc]); pos[id] = [x, y];
  };
  let pendingSplash = null; const splashes = [], tunnels = [], copies = [], spins = [];
  // (estaciones) las piezas del campo con su momento de aparecer y desaparecer, la bola de nieve y el cambio de estación
  // (también si la carta pone una pieza: aparece a su tiempo)
  const field = d.season || d.events.some(e => e.t === 'tilePlaced' || e.t === 'meteorRock') ? d.tiles.map(tl => ({ tl, t0: 0, t1: Infinity })) : null, live = () => field.filter(f => f.t1 === Infinity);
  const sf = d.snow ? [[0, cx(d.snow.x), cy(d.snow.y), 1]] : [[0, 0, 0, 0]], skey = (t1, x, y, o) => { const l = sf[sf.length - 1]; if (l[0] < tm) sf.push([tm, l[1], l[2], l[3]]); sf.push([t1, x, y, o]); };
  let seasonAt = null, seasonTo = null;
  for (const e of d.events) {
    if (field && e.t === 'tilePlaced') { field.push({ tl: e.tile, t0: tm, t1: Infinity }); tm += 360; continue; }
    if (field && e.t === 'grow') { field.push({ tl: { type: e.tile, x: e.x, y: e.y }, t0: tm, t1: Infinity }); continue; }
    if (field && e.t === 'crunch') { const f = live().find(q => q.tl.x === e.x && q.tl.y === e.y); if (f) f.t1 = tm; continue; }
    if (field && e.t === 'season') { // el campo cambia: lo que se va se quita, lo que se transforma, se cambia
      seasonAt = tm; seasonTo = e.to;
      for (const f of live()) {
        const gone = (e.from === 'summer' && f.tl.type === 'fire') || (e.from === 'autumn' && f.tl.type === 'leaf') || (e.to === 'summer' && f.tl.type === 'plant');
        const to = e.to === 'winter' && f.tl.type === 'puddle' ? 'ice' : e.to === 'spring' && f.tl.type === 'ice' ? 'plant' : null;
        if (gone || to) f.t1 = tm;
        if (to) field.push({ tl: { ...f.tl, type: to }, t0: tm, t1: Infinity });
      }
      tm += 700; continue;
    }
    if (e.t === 'snowIn') { skey(tm, cx(e.x), cy(e.y), 0); skey(tm + 360, cx(e.x), cy(e.y), 1); tm += 360; continue; }
    if (e.t === 'snow') { skey(tm + TSTEP, cx(e.x), cy(e.y), 1); tm += TSTEP; continue; }
    if (e.t === 'snowOut') { const l = sf[sf.length - 1]; skey(tm + 300, l[1], l[2], 0); tm += 300; continue; }
    if (e.t === 'gust') { key(e.p, 140, cx(e.x), cy(e.y)); trail[e.p]?.push([cx(e.x), cy(e.y)]); continue; }
    // (multiverso) el agujero negro se la traga, salen las copias, se van; la gravedad y los meteoritos
    if (e.t === 'absorb') { key(e.p, 300, cx(e.x), cy(e.y), 1, .35); key(e.p, 180, cx(e.x), cy(e.y), 1, 1); trail[e.p]?.push([cx(e.x), cy(e.y)]); continue; }
    if (e.t === 'clone') { fr[e.p] = [[0, cx(e.x), cy(e.y), 0, .3]]; trail[e.p] = [[cx(e.x), cy(e.y)]]; pos[e.p] = [cx(e.x), cy(e.y)]; copies.push(e.p);
      key(e.p, 1, cx(e.x), cy(e.y), 0, .3); key(e.p, 200, cx(e.x), cy(e.y), 1, 1); continue; }
    if (e.t === 'vanish') { const [px, py] = pos[e.p] || [cx(e.x), cy(e.y)]; key(e.p, 260, px, py, 0, 1.4); continue; }
    if (e.t === 'clash') { const [px, py] = pos[e.p]; key(e.p, 110, (px + cx(e.x)) / 2, (py + cy(e.y)) / 2); key(e.p, 130, px, py); continue; }
    if (e.t === 'gravity') { splashes.push({ x: cx(e.x), y: cy(e.y), t0: tm, grav: true }); tm += 450; continue; }
    if (e.t === 'meteorRock') { field?.push({ tl: { type: 'meteorite', x: e.x, y: e.y }, t0: tm, t1: Infinity }); tm += 120; continue; }
    if (e.t === 'gstuck') { const [px, py] = pos[e.p] || [0, 0], v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[e.dir]; key(e.p, 120, px + v[0] * 7, py + v[1] * 7); key(e.p, 90, px + v[0] * 3, py + v[1] * 3); key(e.p, 90, px + v[0] * 6, py + v[1] * 6); key(e.p, 110, px, py); continue; }
    if (e.t === 'meteor') { splashes.push({ x: cx(e.x), y: cy(e.y), t0: tm, meteor: true }); tm += e.hit ? 300 : 70; continue; }
    // (casino) el dado rueda a su casilla nueva; la ruleta gira en medio; la pelota se va en fichas; ¡bote!
    if (field && e.t === 'diceRoll') { const f = live().find(q => q.tl.type === 'dice' && q.tl.id === e.id);
      if (f) { f.t1 = tm + 60; field.push({ tl: { ...f.tl, x: e.x, y: e.y, ...e.face }, t0: tm + 60, t1: Infinity }); } tm += 160; continue; }
    if (e.t === 'roulette') { spins.push({ t0: tm, seg: e.seg, res: e.res }); tm += 1500; continue; }
    if (e.t === 'goHome') { const [px, py] = pos[e.p] || [cx(e.x), cy(e.y)]; key(e.p, 280, px, py, 0, .3); continue; }
    if (e.t === 'goldWin') { splashes.push({ x: cx(e.x), y: cy(e.y), t0: tm, gold: true }); tm += 500; continue; }
    if (e.t === 'bump' && e.dice) splashes.push({ x: cx(e.x), y: cy(e.y) - 16, t0: tm + 90, dice: e.dice });
    if (e.t === 'burn' || e.t === 'eaten') { const x = cx(e.x), y = cy(e.y); key(e.p, 160, x, y); splashes.push({ x, y, t0: tm, burn: true }); key(e.p, 320, x, y, 0, .4); continue; }
    const id = e.p, clampX = v => Math.max(0, Math.min(demo.cols - 1, v)), clampY = v => Math.max(0, Math.min(demo.rows - 1, v));
    if (e.t === 'train') { for (let k = 0; k <= 3; k++) tkey(k, tm, tm + TSTEP, e.i, k <= e.cars ? 1 : 0); tm += TSTEP; continue; }
    if (e.t === 'wagon') { tkey(e.cars, tm, tm + 1, tr.pos, 0); tkey(e.cars, tm + 1, tm + 320, tr.pos, 1); tm += 340; continue; }
    if (e.t === 'move' && (e.shove || e.ride)) { // (empujada por el tren o en su vagón: a la vez que el paso de la locomotora)
      const f = fr[id], last = f && f[f.length - 1];
      if (f) { if (last[0] < tm) f.push([tm, last[1], last[2], last[3], last[4]]); f.push([tm + TSTEP, cx(e.x), cy(e.y), 1, 1]); pos[id] = [cx(e.x), cy(e.y)]; trail[id]?.push([cx(e.x), cy(e.y)]); }
      continue;
    }
    if (e.t === 'move') { key(id, 280, cx(e.x), cy(e.y)); trail[id]?.push([cx(e.x), cy(e.y)]); }
    if (e.t === 'drift') { key(id, 520, cx(e.x), cy(e.y), 1, e.out ? 1 : .8); trail[id]?.push([cx(e.x), cy(e.y)]); }
    if (e.t === 'bump') { const [px, py] = pos[id] || [0, 0]; key(id, 90, (px + cx(e.x)) / 2, (py + cy(e.y)) / 2); key(id, 110, px, py); }
    if (e.t === 'tunnel') { const [px, py] = pos[id]; tunnels.push({ x: cx(e.x), y: cy(e.y), t0: tm }); key(id, 60, px, py, 0, .5); key(id, 900, px, py, 0, .5); key(id, 1, px, py, 1, 1); }
    if (e.t === 'launch') { const [px, py] = pos[id]; const mx = (px + cx(e.x)) / 2, my = (py + cy(e.y)) / 2; key(id, 280, mx, my - 14, 1, 1.7); key(id, 280, cx(clampX(e.x)), cy(clampY(e.y)), 1, 1); trail[id]?.push([cx(clampX(e.x)), cy(clampY(e.y))]); }
    if (e.t === 'splash' || e.t === 'fall') { const x = cx(clampX(e.x)), y = cy(clampY(e.y)); key(id, 180, x, y); if (e.t === 'splash') splashes.push({ x, y, t0: tm }); key(id, 320, x, y, 0, .4); trail[id]?.push([x, y]); }
    if (e.t === 'appear') { key(id, 350, cx(e.x), cy(e.y), 0, .4); key(id, 1, cx(e.x), cy(e.y), 0, 1.3); key(id, 260, cx(e.x), cy(e.y), 1, 1); }
    if (e.t === 'sink') { const [px, py] = pos[id]; key(id, 300, px, py, 0, .5); }
  }
  const total = tm + 1500;
  // (estaciones) el campo de la estación siguiente aparece encima, a su tiempo; y las piezas, cada una en su momento
  if (seasonAt !== null) cells += `<g opacity="0">${cellsOf(grass(seasonTo))}<animate attributeName="opacity" dur="${total}ms" repeatCount="indefinite" keyTimes="0;${(seasonAt / total).toFixed(4)};${((seasonAt + 500) / total).toFixed(4)};1" values="0;0;1;1"/></g>`;
  const fieldSVG = field ? field.map(f => {
    const pic = embed(f.tl, f.tl.x * CW, f.tl.y * CH);
    if (REDUCED) return f.t1 === Infinity ? pic : '';
    if (f.t0 === 0 && f.t1 === Infinity) return pic;
    const k = [0], v = [f.t0 === 0 ? 1 : 0];
    if (f.t0 > 0) { k.push(f.t0 / total); v.push(1); }
    if (f.t1 !== Infinity) { k.push(f.t1 / total); v.push(0); }
    return `<g opacity="${v[0]}"><animate attributeName="opacity" dur="${total}ms" repeatCount="indefinite" calcMode="discrete" keyTimes="${k.map(q => q.toFixed(4)).join(';')}" values="${v.join(';')}"/>${pic}</g>`;
  }).join('') : '';
  const snowSprite = SNOWBALL.replace('<svg class="snowSvg" viewBox="0 0 100 100" aria-hidden="true">', `<svg x="${-CW * .46}" y="${-CW * .46}" width="${CW * .92}" height="${CW * .92}" viewBox="0 0 100 100">`);
  const snowG = sf.some(q => q[3] > 0) ? (() => { sf.push([total, ...sf[sf.length - 1].slice(1)]);
    const kt = sf.map(q => (q[0] / total).toFixed(4)).join(';'), l = sf[sf.length - 1];
    if (REDUCED) return l[3] ? `<g transform="translate(${l[1]} ${l[2]})">${snowSprite}</g>` : '';
    return `<g><animateTransform attributeName="transform" type="translate" dur="${total}ms" repeatCount="indefinite" calcMode="linear" keyTimes="${kt}" values="${sf.map(q => q[1] + ' ' + q[2]).join(';')}"/>` +
      `<g><animate attributeName="opacity" dur="${total}ms" repeatCount="indefinite" calcMode="linear" keyTimes="${kt}" values="${sf.map(q => q[3]).join(';')}"/>${snowSprite}</g></g>`; })() : '';
  const anim = (f, attr, i, fmt = v => v) => { const kt = f.map(k => (k[0] / total).toFixed(4)).join(';');
    return `<animate attributeName="${attr}" dur="${total}ms" repeatCount="indefinite" calcMode="linear" keyTimes="${kt}" values="${f.map(k => fmt(k[i])).join(';')}"/>`; };
  const pulse = (x, y, t0, dt, shape) => { const a = (t0 / total).toFixed(4), b = ((t0 + dt) / total).toFixed(4);
    return `<g opacity="0">${shape}<animate attributeName="opacity" dur="${total}ms" repeatCount="indefinite" keyTimes="0;${a};${b};1" values="0;1;0;0"/></g>`; };
  const extras = splashes.map(s => pulse(s.x, s.y, s.t0, s.grav ? 520 : s.dice ? 700 : 400, s.dice ? `<g><rect x="${s.x - 13}" y="${s.y - 10}" width="26" height="20" rx="10" fill="#2A2226" stroke="#F2C14E" stroke-width="1.6"/><text x="${s.x}" y="${s.y}" text-anchor="middle" dominant-baseline="central" class="dmDice">×${s.dice}</text></g>`
    : s.gold ? `<circle cx="${s.x}" cy="${s.y}" r="16" fill="rgba(255,227,138,.5)" stroke="#FFE38A" stroke-width="3"/>`
    : s.burn ? `<circle cx="${s.x}" cy="${s.y}" r="13" fill="none" stroke="#FFD23F" stroke-width="2.4"/>`
    : s.grav ? `<circle cx="${s.x}" cy="${s.y}" r="16" fill="none" stroke="#C78BF2" stroke-width="2.4"/><circle cx="${s.x}" cy="${s.y}" r="8" fill="none" stroke="#C78BF2" stroke-width="2"/>`
    : s.meteor ? `<circle cx="${s.x}" cy="${s.y}" r="9" fill="rgba(255,213,138,.55)" stroke="#F2B05E" stroke-width="2"/>`
    : `<ellipse cx="${s.x}" cy="${s.y}" rx="14" ry="7" fill="none" stroke="#fff" stroke-width="1.6"/>`)).join('') +
    tunnels.map(s => pulse(s.x, s.y, s.t0, 960, `<text x="${s.x}" y="${s.y - 18}" text-anchor="middle" class="dmQ">? ? ?</text>`)).join('') +
    spins.map(s => spinSVG(s, total, W, H, demo, d.gamble?.gold)).join('');
  const COLORS = ['#f26d6d', '#F1F1DC', '#5b8def'];
  // el hoyo (se anima si lo empuja el tren) y la locomotora con sus vagones
  const hf = fr.hole; hf.push([total, ...hf[hf.length - 1].slice(1)]);
  const tAnim = (f, vals) => `<animateTransform attributeName="transform" type="translate" dur="${total}ms" repeatCount="indefinite" calcMode="linear" keyTimes="${f.map(k => (k[0] / total).toFixed(4)).join(';')}" values="${vals}"/>`;
  const hole = hf.length > 2 && !REDUCED ? `<g>${tAnim(hf, hf.map(k => k[1] + ' ' + k[2]).join(';'))}${holeAt0}</g>` : `<g transform="translate(${hf[hf.length - 1][1]} ${hf[hf.length - 1][2]})">${holeAt0}</g>`;
  const sprite = (svg) => svg.replace(/<svg class="trainSvg" viewBox="0 0 70 100" preserveAspectRatio="none"/, `<svg x="${-CW * .45}" y="${-CH * .49}" width="${CW * .9}" height="${CH * .98}" viewBox="0 0 70 100" preserveAspectRatio="none"`);
  const trainG = tr ? [3, 2, 1, 0].filter(k => tfr[k].some(q => q[4] > 0)).map(k => { const f = tfr[k]; f.push([total, ...f[f.length - 1].slice(1)]);
    const kt = f.map(q => (q[0] / total).toFixed(4)).join(';'), last = f[f.length - 1];
    if (REDUCED) return `<g transform="translate(${last[1]} ${last[2]}) rotate(${last[3]})">${sprite(k ? WAGON : LOCO)}</g>`;
    return `<g>${tAnim(f, f.map(q => q[1] + ' ' + q[2]).join(';'))}<g><animateTransform attributeName="transform" type="rotate" dur="${total}ms" repeatCount="indefinite" calcMode="linear" keyTimes="${kt}" values="${f.map(q => q[3]).join(';')}"/>` +
      `<g opacity="${f[0][4]}"><animate attributeName="opacity" dur="${total}ms" repeatCount="indefinite" calcMode="discrete" keyTimes="${kt}" values="${f.map(q => q[4]).join(';')}"/>${sprite(k ? WAGON : LOCO)}</g></g></g>`; }).join('') : '';
  const copyBalls = copies.map(id => { const f = fr[id]; f.push([total, ...f[f.length - 1].slice(1)]); const last = f[f.length - 1]; // (multiverso: las copias, con borde discontinuo)
    return REDUCED ? (last[3] ? `<circle cx="${last[1]}" cy="${last[2]}" r="9" fill="#f26d6d" opacity=".8" stroke="#F1F1DC" stroke-width="2" stroke-dasharray="3 2"/>` : '')
      : `<circle cx="${f[0][1]}" cy="${f[0][2]}" r="9" fill="#f26d6d" fill-opacity=".8" stroke="#F1F1DC" stroke-width="2" stroke-dasharray="3 2">${anim(f, 'cx', 1)}${anim(f, 'cy', 2)}${anim(f, 'opacity', 3)}${anim(f, 'r', 4, v => (9 * v).toFixed(2))}</circle>`; }).join('');
  const balls = copyBalls + d.balls.map((b, i) => { const f = fr[b.id]; f.push([total, ...f[f.length - 1].slice(1)]);
    const col = b.decoy ? '#F1F1DC' : COLORS[i] || '#f26d6d', last = f[f.length - 1];
    return REDUCED ? `<circle cx="${last[1]}" cy="${last[2]}" r="9" fill="${col}" stroke="#F1F1DC" stroke-width="2"/>`
      : `<circle cx="${f[0][1]}" cy="${f[0][2]}" r="9" fill="${col}" stroke="${b.decoy ? '#9A9A8C' : '#F1F1DC'}" stroke-width="2">${anim(f, 'cx', 1)}${anim(f, 'cy', 2)}${anim(f, 'opacity', 3)}${anim(f, 'r', 4, v => (9 * v).toFixed(2))}</circle>`; }).join('');
  const paths = Object.values(trail).filter(p => p.length > 1).map(p => `<polyline points="${p.map(q => q.join(',')).join(' ')}" fill="none" stroke="rgba(241,241,220,.55)" stroke-width="2.4" stroke-dasharray="4 5" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  return `<svg class="dmBoard" viewBox="-6 -6 ${W + 12} ${H + 12}" role="img" aria-label="${esc(t('deckIntro.aria'))}">` +
    `<rect x="-6" y="-6" width="${W + 12}" height="${H + 12}" rx="12" fill="#F1F1DC"/><rect x="0" y="0" width="${W}" height="${H}" rx="6" fill="#3F7440"/>` +
    cells + (field ? fieldSVG : tiles) + track + snowG + hole + sp + paths + extras + trainG + balls + `</svg>`;
}

/* ---------- el diálogo ---------- */
// force: mostrarla aunque ya se haya visto (botón "Cartas nuevas" de la tarjeta de la baraja)
// → true = seguir (vista o aceptada); false = cerrada sin jugar
export function deckIntro(deckId, { force = false, play = true } = {}) {
  const dk = deckById(deckId), keys = (dk.newCards || []).filter(k => CARDS[k]?.demo);
  const plain = (dk.newCards || []).filter(k => CARDS[k] && !CARDS[k].demo); // (palos largos…: se nombran sin escena)
  if (!keys.length || (!force && seen()[dk.id])) return Promise.resolve(true);
  return new Promise(resolve => {
    const dlg = $('dialog');
    const panels = keys.map(k => { const def = CARDS[k];
      return `<article class="dmCard"><div class="dmHead"><span class="hintCard ${def.color}">${cardArtHTML(def)}</span><b>${esc(def.name)}</b></div>` +
        demoSVG(def.demo) + `<p>${esc(t('tutorial.card.' + k))}</p></article>`; }).join('');
    dlg.innerHTML = `<form method="dialog" class="dlgBox deckIntro dk-${dk.id}${keys.length >= 3 ? ' wide' : ''}" style="--dk:${dk.color};--n:${keys.length}">
      <span class="dmTag">${esc(t('decks.' + dk.id + '.name'))}</span>
      <h3>${esc(t('deckIntro.title'))}</h3>
      <p class="dmLead">${esc(t(dk.introLead || 'deckIntro.lead'))}</p>
      <div class="dmGrid">${panels}</div>
      ${plain.length ? `<p class="dmAlso"><b>${esc(t('deckIntro.also'))}</b> ${plain.map(k => `<span class="dmChip"><span class="hintCard ${CARDS[k].color}">${cardArtHTML(CARDS[k])}</span>${esc(CARDS[k].name)}</span>`).join('')}</p>` : ''}
      <div class="dlgBtns"><button value="ok" class="btn-primary">${esc(t(play ? 'intro.go' : 'common.close'))}</button></div>
    </form>`;
    const done = () => {
      dlg.removeEventListener('close', done);
      const ok = dlg.returnValue === 'ok';
      if (ok) markSeen(dk.id);
      resolve(ok);
    };
    dlg.addEventListener('close', done);
    dlg.returnValue = '';
    dlg.showModal();
    dlg.querySelector('button[value="ok"]').focus();
  });
}
