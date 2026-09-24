// "¿Por qué he perdido?": durante la partida se valora tu posición (con la misma evaluación que
// usan los bots) tras cada jugada; la que más la empeoró es el momento clave. Al perder se enseña
// con dos esquemas del tablero (antes / después), quién la hizo y por qué, y un consejo.
import { app } from './app.js';
import { esc } from './dom.js';
import { t } from '../i18n/index.js';
import { CARDS } from '../content/cards/index.js';
import { evaluate, explainPlay } from '../ai/bot.js';
import { pColor } from '../art.js';
import { displayName } from './players.js';

let prev = null;       // { eval, game } tras la última jugada
let key = null;        // momento clave: { drop, actor, card, before, after, why }
let final = null;      // la jugada que dio la victoria al rival

export function resetMoments() { prev = null; key = null; final = null; }

// tras cada jugada resuelta o cambio de turno (solo con una persona contra la máquina)
export function trackMoment(g, me, { actor, card, before }) {
  if (me == null) return;
  const S = g.S;
  const snapNow = g.clone({ lite: true });
  if (S.winner !== null) { // jugada ganadora (o JAQUE) de otro
    if (!S.winners.includes(me) && actor != null && actor !== me) final = { actor, card, before: prev?.game || before, after: snapNow };
    return;
  }
  const ev = evaluate(g, me, 'trick');
  if (prev && actor != null && actor !== me) {
    const drop = prev.eval - ev;
    if (drop > 8 && (!key || drop > key.drop)) key = { drop, actor, card, before: prev.game, after: snapNow, why: explainPlay(prev.game, snapNow, actor, card) };
  }
  prev = { eval: ev, game: snapNow };
}

// esquema del tablero: casillas, losetas, hoyo y pelotas con su color
function miniBoard(g) {
  const S = g.S, s = 11, gp = 2, W = S.cols * (s + gp) - gp, H = S.rows * (s + gp) - gp;
  const tile = Object.fromEntries(S.tiles.map(tl => [tl.x + ',' + tl.y, tl.type]));
  let out = '';
  for (let y = 0; y < S.rows; y++) for (let x = 0; x < S.cols; x++) {
    const tp = tile[x + ',' + y];
    const fill = tp === 'bunker' ? '#ECE6CC' : tp === 'portal' ? '#2D4F7C' : ((x + y) % 2 ? '#5C9854' : '#4F8A4B');
    out += `<rect x="${x * (s + gp)}" y="${y * (s + gp)}" width="${s}" height="${s}" rx="2.5" fill="${fill}"/>`;
  }
  const c = (x, y) => [x * (s + gp) + s / 2, y * (s + gp) + s / 2];
  const [hx, hy] = c(S.hole.x, S.hole.y);
  out += `<circle cx="${hx}" cy="${hy}" r="4.6" fill="#242424"/>`;
  for (const b of S.balls) {
    const [bx, by] = c(b.holed ? S.hole.x : b.x, b.holed ? S.hole.y : b.y);
    const col = b.decoy ? '#F1F1DC' : (S.colorMap ? S.colorMap[b.player] : pColor(b.player));
    out += `<circle cx="${bx}" cy="${by}" r="4" fill="${col}" stroke="#fff" stroke-width="1.2"${b.holed ? ' opacity=".6"' : ''}/>`;
  }
  return `<svg viewBox="-2 -2 ${W + 4} ${H + 4}" aria-hidden="true">${out}</svg>`;
}

const whyText = (w, actor) => {
  const target = w.target != null ? (w.target === app.game?.S.human ? t('why.you') : displayName(w.target)) : '';
  return t('explain.' + w.key, { name: displayName(actor), target, n: w.n || '' });
};

// HTML del panel (vacío si no hay nada que contar)
export function keyMomentHTML() {
  const m = key || (final && { ...final, why: explainPlay(final.before, final.after, final.actor, final.card) });
  if (!m) return '';
  const card = CARDS[m.card];
  const tip = t('why.tip.' + (m.why?.key || 'generic'));
  return `<div class="whyHead"><b>${esc(t(key ? 'why.keyTitle' : 'why.finalTitle'))}</b>` +
    `<p>${esc(t('why.played', { name: displayName(m.actor), card: card ? (card.short || card.name) : '' }))} — ${esc(whyText(m.why || { key: 'generic' }, m.actor))}</p></div>` +
    `<div class="whyBoards"><figure>${miniBoard(m.before)}<figcaption>${esc(t('why.before'))}</figcaption></figure>` +
    `<svg class="i whyArrow" aria-hidden="true"><use href="#i-arrow-r"/></svg>` +
    `<figure>${miniBoard(m.after)}<figcaption>${esc(t('why.after'))}</figcaption></figure></div>` +
    `<p class="whyTip"><svg class="i" aria-hidden="true"><use href="#i-bulb"/></svg>${esc(tip)}</p>`;
}
export { whyText };
