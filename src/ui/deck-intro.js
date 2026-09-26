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

const KEY = 'chaoticgolf_deckIntros';
const seen = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
const markSeen = id => { try { localStorage.setItem(KEY, JSON.stringify({ ...seen(), [id]: true })); } catch (e) { /* sin storage */ } };
export const resetDeckIntros = () => { try { localStorage.removeItem(KEY); } catch (e) { /* sin storage */ } };
export const hasDeckIntro = id => !!deckById(id).newCards?.some(k => CARDS[k]?.demo);

/* ---------- la escena: se juega con el motor ---------- */
function runDemo(demo) {
  const g = Game.fromLevel({ cols: demo.cols, rows: demo.rows, hole: demo.hole, ball: demo.ball, parCells: [], tiles: demo.tiles || [],
    deckCounts: { palo1: 1 }, extraBalls: demo.extraBalls || [] }, { seed: 1 });
  const b = g.S.balls[0];
  if (demo.spawn) { b.spawnX = demo.spawn.x; b.spawnY = demo.spawn.y; }
  const before = { tiles: g.S.tiles.map(x => ({ ...x })), hole: { ...g.S.hole }, ball: { x: b.x, y: b.y }, spawn: { x: b.spawnX, y: b.spawnY } };
  g.takeEvents();
  g.S.hands[0] = [demo.card];
  g.clickCard(0, 0);
  const tg = g.pending?.targets?.find(x => x.dir === demo.dir);
  if (tg) g.clickCell(tg.x, tg.y);
  const events = g.takeEvents().filter(e => e.p === 'b0' && ['move', 'drift', 'teleport', 'fall', 'splash', 'appear', 'sink'].includes(e.t));
  return { ...before, events };
}

/* ---------- el dibujo (SVG) con la pelota animada ---------- */
const CW = 40, CH = 52, G = 4;
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
    if (tl.type === 'bunker') return `<ellipse cx="${cx(tl.x)}" cy="${cy(tl.y)}" rx="14" ry="10" fill="#ECE6CC"/>`;
    if (tl.type === 'portal') return `<circle cx="${cx(tl.x)}" cy="${cy(tl.y)}" r="13" fill="#2D4F7C"/><circle cx="${cx(tl.x)}" cy="${cy(tl.y)}" r="6" fill="#A9C3E6"/>`;
    return '';
  }).join('');
  const hole = `<circle cx="${cx(d.hole.x)}" cy="${cy(d.hole.y)}" r="7" fill="#242424"/><path d="M${cx(d.hole.x) + 1} ${cy(d.hole.y)}v-17l9 3.5-9 3.5" fill="#E8873A" stroke="#F1F1DC" stroke-width="1.2" stroke-linejoin="round"/>`;
  // salida (si la pelota vuelve a ella) y recorrido
  const sp = d.events.some(e => e.t === 'fall' || e.t === 'splash') ? `<circle cx="${cx(d.spawn.x)}" cy="${cy(d.spawn.y)}" r="11" fill="none" stroke="#F1F1DC" stroke-width="2" stroke-dasharray="3 3" opacity=".8"/>` +
    `<text x="${cx(d.spawn.x)}" y="${cy(d.spawn.y) + 24}" text-anchor="middle" class="dmLbl">${esc(t('deckIntro.start'))}</text>` : '';
  // fotogramas: [ms, x, y, opacidad, escala]
  const fr = [[0, cx(d.ball.x), cy(d.ball.y), 1, 1]], trail = [[cx(d.ball.x), cy(d.ball.y)]];
  let tm = 500, px = cx(d.ball.x), py = cy(d.ball.y);
  for (const e of d.events) {
    if (e.t === 'move') { tm += 300; px = cx(e.x); py = cy(e.y); fr.push([tm, px, py, 1, 1]); trail.push([px, py]); }
    if (e.t === 'drift') { tm += 520; px = cx(e.x); py = cy(e.y); fr.push([tm, px, py, 1, e.out ? 1 : .8]); trail.push([px, py]); }
    if (e.t === 'splash' || e.t === 'fall') { tm += 180; px = cx(Math.max(0, Math.min(demo.cols - 1, e.x))); py = cy(Math.max(0, Math.min(demo.rows - 1, e.y))); fr.push([tm, px, py, 1, 1]); tm += 320; fr.push([tm, px, py, 0, .4]); trail.push([px, py]); }
    if (e.t === 'appear') { tm += 350; fr.push([tm, cx(e.x), cy(e.y), 0, .4]); tm += 1; fr.push([tm, cx(e.x), cy(e.y), 0, 1.3]); tm += 260; fr.push([tm, cx(e.x), cy(e.y), 1, 1]); px = cx(e.x); py = cy(e.y); }
    if (e.t === 'sink') { tm += 300; fr.push([tm, px, py, 0, .5]); }
  }
  const total = tm + 1500;
  fr.push([total, px, py, fr[fr.length - 1][3], fr[fr.length - 1][4]]);
  const kt = fr.map(f => (f[0] / total).toFixed(4)).join(';');
  const anim = (attr, i, fmt = v => v) => `<animate attributeName="${attr}" dur="${total}ms" repeatCount="indefinite" calcMode="linear" keyTimes="${kt}" values="${fr.map(f => fmt(f[i])).join(';')}"/>`;
  const splash = d.events.filter(e => e.t === 'splash').map(e => { const k = fr.find(f => f[3] === 0); const t0 = (k ? k[0] - 320 : 0) / total;
    return `<ellipse cx="${cx(e.x)}" cy="${cy(e.y)}" rx="8" ry="4" fill="none" stroke="#fff" stroke-width="1.5" opacity="0"><animate attributeName="opacity" dur="${total}ms" repeatCount="indefinite" keyTimes="0;${t0.toFixed(4)};${(t0 + .12).toFixed(4)};1" values="0;.9;0;0"/>` +
      `<animate attributeName="rx" dur="${total}ms" repeatCount="indefinite" keyTimes="0;${t0.toFixed(4)};${(t0 + .12).toFixed(4)};1" values="8;8;18;18"/><animate attributeName="ry" dur="${total}ms" repeatCount="indefinite" keyTimes="0;${t0.toFixed(4)};${(t0 + .12).toFixed(4)};1" values="4;4;9;9"/></ellipse>`; }).join('');
  const last = fr[fr.length - 1];
  const ball = REDUCED
    ? `<circle cx="${last[1]}" cy="${last[2]}" r="9" fill="#f26d6d" stroke="#F1F1DC" stroke-width="2"/>`
    : `<circle cx="${fr[0][1]}" cy="${fr[0][2]}" r="9" fill="#f26d6d" stroke="#F1F1DC" stroke-width="2">${anim('cx', 1)}${anim('cy', 2)}${anim('opacity', 3)}${anim('r', 4, v => (9 * v).toFixed(2))}</circle>`;
  const path = `<polyline points="${trail.map(p => p.join(',')).join(' ')}" fill="none" stroke="rgba(241,241,220,.55)" stroke-width="2.4" stroke-dasharray="4 5" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<svg class="dmBoard" viewBox="-6 -6 ${W + 12} ${H + 12}" role="img" aria-label="${esc(t('deckIntro.aria'))}">` +
    `<rect x="-6" y="-6" width="${W + 12}" height="${H + 12}" rx="12" fill="#F1F1DC"/><rect x="0" y="0" width="${W}" height="${H}" rx="6" fill="#3F7440"/>` +
    cells + tiles + hole + sp + path + splash + ball + `</svg>`;
}

/* ---------- el diálogo ---------- */
// force: mostrarla aunque ya se haya visto (botón "Cartas nuevas" de la tarjeta de la baraja)
// → true = seguir (vista o aceptada); false = cerrada sin jugar
export function deckIntro(deckId, { force = false, play = true } = {}) {
  const dk = deckById(deckId), keys = (dk.newCards || []).filter(k => CARDS[k]?.demo);
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
