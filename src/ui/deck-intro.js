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

const KEY = 'chaoticgolf_deckIntros';
const seen = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
const markSeen = id => { try { localStorage.setItem(KEY, JSON.stringify({ ...seen(), [id]: true })); } catch (e) { /* sin storage */ } };
export const resetDeckIntros = () => { try { localStorage.removeItem(KEY); } catch (e) { /* sin storage */ } };
export const hasDeckIntro = id => !!deckById(id).newCards?.some(k => CARDS[k]?.demo);

/* ---------- la escena: se juega con el motor ---------- */
const PIECE_EVENTS = ['move', 'drift', 'teleport', 'fall', 'splash', 'appear', 'sink', 'launch', 'tunnel', 'bump'];
function runDemo(demo) {
  const g = Game.fromLevel({ cols: demo.cols, rows: demo.rows, hole: demo.hole, ball: demo.ball, parCells: [], tiles: demo.tiles || [],
    deckCounts: { palo1: 1 }, extraBalls: demo.extraBalls || [], train: demo.train }, { seed: demo.seed ?? 3 });
  const b = g.S.balls[0];
  if (demo.spawn) { b.spawnX = demo.spawn.x; b.spawnY = demo.spawn.y; }
  const before = { tiles: g.S.tiles.map(x => ({ ...x })), hole: { ...g.S.hole }, balls: g.S.balls.map(x => ({ id: 'b' + x.player, x: x.x, y: x.y, decoy: !!x.decoy })),
    spawn: { x: b.spawnX, y: b.spawnY }, train: g.S.train ? { ...g.S.train } : null };
  g.takeEvents();
  g.S.hands[0] = [demo.card];
  g.clickCard(0, 0);
  const tg = g.pending?.targets?.find(x => x.dir === demo.dir);
  if (tg) g.clickCell(tg.x, tg.y);
  // (las pelotas; con tren, también la locomotora, los vagones y el hoyo, que el tren empuja)
  const events = g.takeEvents().filter(e => typeof e.p === 'string' && (e.p.startsWith('b') && PIECE_EVENTS.includes(e.t) ||
    (before.train && (e.t === 'train' || e.t === 'wagon' || (e.p === 'hole' && e.t === 'move')))));
  return { ...before, events };
}

/* ---------- el dibujo (SVG) con las pelotas animadas ---------- */
const CW = 40, CH = 52, G = 4;
// dibujo real de una loseta (el de la partida) dentro del SVG de la escena
const embed = (tl, x0, y0) => tilePic(tl).replace('<svg ', `<svg x="${x0 + 1}" y="${y0 + 1}" width="${CW - 2}" height="${CH - 2}" `);
function demoSVG(demo) {
  const d = runDemo(demo), W = demo.cols * CW, H = demo.rows * CH;
  const cx = x => x * CW + CW / 2, cy = y => y * CH + CH / 2;
  let cells = '';
  for (let y = 0; y < demo.rows; y++) for (let x = 0; x < demo.cols; x++)
    cells += `<rect x="${x * CW + G / 2}" y="${y * CH + G / 2}" width="${CW - G}" height="${CH - G}" rx="5" fill="${((x + y) >> 1) & 1 ? '#5C9854' : '#4F8A4B'}"/>`;
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
  const sp = d.events.some(e => e.p === 'b0' && (e.t === 'fall' || e.t === 'splash')) ? `<circle cx="${cx(d.spawn.x)}" cy="${cy(d.spawn.y)}" r="11" fill="none" stroke="#F1F1DC" stroke-width="2" stroke-dasharray="3 3" opacity=".8"/>` +
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
  let pendingSplash = null; const splashes = [], tunnels = [];
  for (const e of d.events) {
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
  const anim = (f, attr, i, fmt = v => v) => { const kt = f.map(k => (k[0] / total).toFixed(4)).join(';');
    return `<animate attributeName="${attr}" dur="${total}ms" repeatCount="indefinite" calcMode="linear" keyTimes="${kt}" values="${f.map(k => fmt(k[i])).join(';')}"/>`; };
  const pulse = (x, y, t0, dt, shape) => { const a = (t0 / total).toFixed(4), b = ((t0 + dt) / total).toFixed(4);
    return `<g opacity="0">${shape}<animate attributeName="opacity" dur="${total}ms" repeatCount="indefinite" keyTimes="0;${a};${b};1" values="0;1;0;0"/></g>`; };
  const extras = splashes.map(s => pulse(s.x, s.y, s.t0, 400, `<ellipse cx="${s.x}" cy="${s.y}" rx="14" ry="7" fill="none" stroke="#fff" stroke-width="1.6"/>`)).join('') +
    tunnels.map(s => pulse(s.x, s.y, s.t0, 960, `<text x="${s.x}" y="${s.y - 18}" text-anchor="middle" class="dmQ">? ? ?</text>`)).join('');
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
  const balls = d.balls.map((b, i) => { const f = fr[b.id]; f.push([total, ...f[f.length - 1].slice(1)]);
    const col = b.decoy ? '#F1F1DC' : COLORS[i] || '#f26d6d', last = f[f.length - 1];
    return REDUCED ? `<circle cx="${last[1]}" cy="${last[2]}" r="9" fill="${col}" stroke="#F1F1DC" stroke-width="2"/>`
      : `<circle cx="${f[0][1]}" cy="${f[0][2]}" r="9" fill="${col}" stroke="${b.decoy ? '#9A9A8C' : '#F1F1DC'}" stroke-width="2">${anim(f, 'cx', 1)}${anim(f, 'cy', 2)}${anim(f, 'opacity', 3)}${anim(f, 'r', 4, v => (9 * v).toFixed(2))}</circle>`; }).join('');
  const paths = Object.values(trail).filter(p => p.length > 1).map(p => `<polyline points="${p.map(q => q.join(',')).join(' ')}" fill="none" stroke="rgba(241,241,220,.55)" stroke-width="2.4" stroke-dasharray="4 5" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  return `<svg class="dmBoard" viewBox="-6 -6 ${W + 12} ${H + 12}" role="img" aria-label="${esc(t('deckIntro.aria'))}">` +
    `<rect x="-6" y="-6" width="${W + 12}" height="${H + 12}" rx="12" fill="#F1F1DC"/><rect x="0" y="0" width="${W}" height="${H}" rx="6" fill="#3F7440"/>` +
    cells + tiles + track + hole + sp + paths + extras + trainG + balls + `</svg>`;
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
    dlg.innerHTML = `<form method="dialog" class="dlgBox deckIntro" style="--dk:${dk.color}">
      <span class="dmTag">${esc(t('decks.' + dk.id + '.name'))}</span>
      <h3>${esc(t('deckIntro.title'))}</h3>
      <p class="dmLead">${esc(t('deckIntro.lead'))}</p>
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
